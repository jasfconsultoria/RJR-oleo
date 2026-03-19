-- Migration: 2128_fix_register_payment_ambiguity.sql
-- Goal: Resolve "function register_payment is not unique" by dropping old overloads
-- and making the RPC call in create_financeiro_lancamento more robust.

-- 1. Remove old version with 5 parameters (identified as the cause of ambiguity)
DROP FUNCTION IF EXISTS public.register_payment(uuid, numeric, date, text, text);

-- 2. Ensure the latest version (10 parameters) is correctly defined
-- (Based on migration 2117)
CREATE OR REPLACE FUNCTION public.register_payment(
    p_credito_debito_id UUID,
    p_paid_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_notes TEXT DEFAULT NULL,
    p_installment_number INTEGER DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_expected_amount NUMERIC DEFAULT NULL,
    p_conta_corrente_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    new_payment_id UUID;
    final_user_id UUID := COALESCE(p_user_id, auth.uid());
BEGIN
    -- Validation
    IF final_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado.');
    END IF;

    -- Register payment
    INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
    VALUES (p_credito_debito_id, p_paid_amount, p_payment_date, p_payment_method::public.payment_method, p_notes, final_user_id)
    RETURNING id INTO new_payment_id;

    -- Update local conta_corrente balance if ID is provided
    IF p_conta_corrente_id IS NOT NULL THEN
        BEGIN
            UPDATE public.conta_corrente 
            SET saldo = saldo - p_paid_amount 
            WHERE id = p_conta_corrente_id;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors if table doesn't exist or ID is not local
        END;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado com sucesso.', 'payment_id', new_payment_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Erro: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update create_financeiro_lancamento to use explicit casts and be unambiguous
CREATE OR REPLACE FUNCTION public.create_financeiro_lancamento(
    p_lancamento_id uuid,
    p_type text,
    p_document_number text,
    p_model text,
    p_pessoa_id uuid,
    p_cliente_fornecedor_name text,
    p_cliente_fornecedor_fantasy_name text,
    p_cnpj_cpf text,
    p_description text,
    p_payment_method text,
    p_cost_center text,
    p_notes text,
    p_user_id uuid,
    p_total_installments integer,
    p_total_value numeric,    -- Valor bruto do documento
    p_discount numeric,       -- Desconto
    p_interest numeric,       -- Juros
    p_down_payment jsonb,
    p_installments jsonb[],
    p_coleta_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $function$
 DECLARE
     down_payment_entry_id uuid;
     result jsonb;
     inst jsonb;
     v_down_payment_amount numeric;
     v_down_payment_date date;
     v_formatted_document_number TEXT;
 BEGIN
     -- Format document number with leading zeros if numeric
     IF p_document_number ~ '^[0-9]+$' AND LENGTH(p_document_number) < 6 THEN
         v_formatted_document_number := LPAD(p_document_number, 6, '0');
     ELSE
         v_formatted_document_number := p_document_number;
     END IF;

     -- Handle Down Payment (Entrada)
     IF p_down_payment IS NOT NULL THEN
         v_down_payment_amount := (p_down_payment->>'amount')::numeric;
         v_down_payment_date := (p_down_payment->>'date')::date;

         INSERT INTO public.credito_debito (
             lancamento_id, type, document_number, model, pessoa_id,
             cliente_fornecedor_name, cliente_fornecedor_fantasy_name,
             cnpj_cpf, description, issue_date, 
             total_value,      
             installment_value, 
             discount, interest,
             payment_method, cost_center, notes, user_id, 
             installment_number, total_installments,
             coleta_id, paid_amount, amount_balance, status
         )
         VALUES (
             p_lancamento_id, p_type, v_formatted_document_number, p_model, p_pessoa_id,
             p_cliente_fornecedor_name, p_cliente_fornecedor_fantasy_name,
             p_cnpj_cpf, p_description, v_down_payment_date,
             p_total_value, v_down_payment_amount,
             p_discount, p_interest,
             p_payment_method::public.payment_method,
             p_cost_center, p_notes, p_user_id, 0, p_total_installments,
             p_coleta_id, v_down_payment_amount, 0, 'paid'::pagamento_status
         )
         RETURNING id INTO down_payment_entry_id;

         -- Register the payment with explicit parameter casting to avoid ambiguity
         PERFORM public.register_payment(
             p_credito_debito_id := down_payment_entry_id::uuid,
             p_paid_amount := v_down_payment_amount::numeric,
             p_payment_date := v_down_payment_date::date,
             p_payment_method := p_payment_method::text,
             p_notes := 'Pagamento automático de entrada.'::text,
             p_user_id := p_user_id::uuid
         );
     END IF;

     -- Handle Installments
     IF array_length(p_installments, 1) > 0 THEN
         FOREACH inst IN ARRAY p_installments LOOP
             INSERT INTO public.credito_debito (
                 lancamento_id, type, document_number, model, pessoa_id,
                 cliente_fornecedor_name, cliente_fornecedor_fantasy_name,
                 cnpj_cpf, description, issue_date, 
                 total_value,      
                 installment_value, 
                 discount, interest,
                 payment_method, cost_center, notes, user_id, 
                 installment_number, total_installments,
                 coleta_id, paid_amount, amount_balance, status
             )
             VALUES (
                 p_lancamento_id, p_type, v_formatted_document_number, p_model, p_pessoa_id,
                 p_cliente_fornecedor_name, p_cliente_fornecedor_fantasy_name,
                 p_cnpj_cpf, p_description, (inst->>'date')::date,
                 p_total_value, (inst->>'amount')::numeric,
                 p_discount, p_interest,
                 p_payment_method::public.payment_method,
                 p_cost_center, p_notes, p_user_id, (inst->>'number')::integer, p_total_installments,
                 p_coleta_id, 0, (inst->>'amount')::numeric, 'pending'::pagamento_status
             );
         END LOOP;
     END IF;

     result := jsonb_build_object('success', true, 'lancamento_id', p_lancamento_id);
     RETURN result;
 END;
 $function$;
