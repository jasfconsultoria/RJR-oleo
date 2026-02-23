-- CORREÇÃO DEFINITIVA v2: Usa DO block para dropar TODAS as versões dinamicamente
-- Execute no SQL Editor do Supabase

-- PASSO 1: Dropar TODAS as versões de create_financeiro_lancamento de forma dinâmica
DO $$
DECLARE
  func_sig text;
BEGIN
  FOR func_sig IN
    SELECT pg_get_function_identity_arguments(oid)
    FROM pg_proc
    WHERE proname = 'create_financeiro_lancamento'
    AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.create_financeiro_lancamento(' || func_sig || ') CASCADE';
    RAISE NOTICE 'Dropada: create_financeiro_lancamento(%)', func_sig;
  END LOOP;
  RAISE NOTICE 'Limpeza concluida.';
END;
$$;

-- PASSO 2: Criar a versão correta e única
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
    p_down_payment jsonb,
    p_installments jsonb[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    inst jsonb;
    down_payment_entry_id uuid;
    v_down_payment_amount numeric := 0;
    v_down_payment_date date;
    v_total_document_value numeric := 0;
    v_formatted_document_number TEXT;
BEGIN
    IF p_document_number ~ '^[0-9]+$' AND LENGTH(p_document_number) < 6 THEN
        v_formatted_document_number := LPAD(p_document_number, 6, '0');
    ELSE
        v_formatted_document_number := p_document_number;
    END IF;

    IF p_down_payment IS NOT NULL THEN
        v_total_document_value := v_total_document_value + (p_down_payment->>'amount')::numeric;
    END IF;
    IF array_length(p_installments, 1) > 0 THEN
        FOREACH inst IN ARRAY p_installments LOOP
            v_total_document_value := v_total_document_value + (inst->>'amount')::numeric;
        END LOOP;
    END IF;

    IF p_down_payment IS NOT NULL THEN
        v_down_payment_amount := (p_down_payment->>'amount')::numeric;
        v_down_payment_date := (p_down_payment->>'date')::date;

        INSERT INTO public.credito_debito (
            lancamento_id, type, document_number, model, pessoa_id,
            cliente_fornecedor_name, cliente_fornecedor_fantasy_name, cnpj_cpf,
            description, issue_date, total_value, installment_value,
            payment_method, cost_center, notes, user_id,
            installment_number, total_installments,
            paid_amount, amount_balance, status
        ) VALUES (
            p_lancamento_id, p_type, v_formatted_document_number, p_model, p_pessoa_id,
            p_cliente_fornecedor_name, p_cliente_fornecedor_fantasy_name, p_cnpj_cpf,
            p_description, v_down_payment_date, v_total_document_value, v_down_payment_amount,
            p_payment_method::public.payment_method, p_cost_center, p_notes, p_user_id,
            0, p_total_installments,
            v_down_payment_amount, 0, 'paid'::pagamento_status
        )
        RETURNING id INTO down_payment_entry_id;

        INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
        VALUES (
            down_payment_entry_id, v_down_payment_amount, v_down_payment_date,
            p_payment_method::public.payment_method, 'Pagamento de entrada', p_user_id
        );
    END IF;

    IF array_length(p_installments, 1) > 0 THEN
        FOREACH inst IN ARRAY p_installments LOOP
            INSERT INTO public.credito_debito (
                lancamento_id, type, document_number, model, pessoa_id,
                cliente_fornecedor_name, cliente_fornecedor_fantasy_name, cnpj_cpf,
                description, issue_date, total_value, installment_value,
                payment_method, cost_center, notes, user_id,
                installment_number, total_installments,
                paid_amount, amount_balance, status
            ) VALUES (
                p_lancamento_id, p_type, v_formatted_document_number, p_model, p_pessoa_id,
                p_cliente_fornecedor_name, p_cliente_fornecedor_fantasy_name, p_cnpj_cpf,
                p_description, (inst->>'date')::date, v_total_document_value, (inst->>'amount')::numeric,
                p_payment_method::public.payment_method, p_cost_center, p_notes, p_user_id,
                (inst->>'number')::integer, p_total_installments,
                0, (inst->>'amount')::numeric, 'pending'::pagamento_status
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'lancamento_id', p_lancamento_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Verificar resultado final
SELECT proname, pg_get_function_identity_arguments(oid) as args
FROM pg_proc 
WHERE proname = 'create_financeiro_lancamento'
AND pronamespace = 'public'::regnamespace;
