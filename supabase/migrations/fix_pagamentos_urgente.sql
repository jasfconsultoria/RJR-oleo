-- CORREÇÃO URGENTE: Recriar create_financeiro_lancamento com nome correto da tabela (pagamentos)
-- Execute este arquivo no SQL Editor do Supabase

-- Passo 1: Remover funções register_payment duplicadas
DROP FUNCTION IF EXISTS public.register_payment(uuid, numeric, date, text, text);
DROP FUNCTION IF EXISTS public.register_payment(uuid, numeric, date, text, text, integer, date, numeric);

-- Passo 2: Recriar register_payment com nome correto
CREATE OR REPLACE FUNCTION public.register_payment(
    p_credito_debito_id UUID,
    p_paid_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_notes TEXT DEFAULT NULL,
    p_installment_number INTEGER DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_expected_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    new_payment_id UUID;
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuario nao autenticado.');
    END IF;

    INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
    VALUES (p_credito_debito_id, p_paid_amount, p_payment_date, p_payment_method::public.payment_method, p_notes, current_user_id)
    RETURNING id INTO new_payment_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado com sucesso.', 'payment_id', new_payment_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Erro: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Passo 3: Recriar create_financeiro_lancamento com nome correto da tabela (pagamentos)
CREATE OR REPLACE FUNCTION public.create_financeiro_lancamento(
    p_lancamento_id uuid, p_type text, p_document_number text, p_model text, 
    p_pessoa_id uuid, p_cliente_fornecedor_name text, p_cliente_fornecedor_fantasy_name text, 
    p_cnpj_cpf text, p_description text, p_issue_date date, p_down_payment jsonb, 
    p_installments jsonb[], p_payment_method text, p_cost_center uuid, p_notes text, 
    p_user_id uuid, p_coleta_id uuid DEFAULT NULL, p_total_discount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    inst jsonb;
    down_payment_entry_id uuid;
    v_down_payment_amount numeric := 0;
    v_down_payment_date date;
    v_total_document_value numeric := 0;
    v_formatted_document_number TEXT;
BEGIN
    -- Formatacao do numero do documento
    IF p_document_number ~ '^[0-9]+$' AND LENGTH(p_document_number) < 6 THEN
        v_formatted_document_number := LPAD(p_document_number, 6, '0');
    ELSE
        v_formatted_document_number := p_document_number;
    END IF;

    -- Calculo do valor total do documento
    IF p_down_payment IS NOT NULL THEN
        v_total_document_value := v_total_document_value + (p_down_payment->>'amount')::numeric;
    END IF;
    IF array_length(p_installments, 1) > 0 THEN
        FOREACH inst IN ARRAY p_installments LOOP
            v_total_document_value := v_total_document_value + (inst->>'amount')::numeric;
        END LOOP;
    END IF;

    -- Inserir Entrada (parcela 0)
    IF p_down_payment IS NOT NULL THEN
        v_down_payment_amount := (p_down_payment->>'amount')::numeric;
        v_down_payment_date := (p_down_payment->>'due_date')::date;

        INSERT INTO public.credito_debito (
            lancamento_id, type, document_number, model, pessoa_id,
            cliente_fornecedor_name, cliente_fornecedor_fantasy_name, cnpj_cpf,
            description, issue_date, total_value, installment_value,
            payment_method, cost_center, notes, user_id, 
            installment_number, total_installments,
            coleta_id, paid_amount, amount_balance, status
        ) VALUES (
            p_lancamento_id, p_type, v_formatted_document_number, p_model, p_pessoa_id,
            p_cliente_fornecedor_name, p_cliente_fornecedor_fantasy_name, p_cnpj_cpf,
            p_description, v_down_payment_date,
            v_total_document_value, v_down_payment_amount,
            p_payment_method::public.payment_method, p_cost_center, p_notes, p_user_id, 
            0, array_length(p_installments, 1) + 1,
            p_coleta_id, v_down_payment_amount, 0, 'paid'::pagamento_status
        )
        RETURNING id INTO down_payment_entry_id;

        -- Inserir pagamento DIRETAMENTE na tabela pagamentos (evita ambiguidade de overload)
        INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
        VALUES (
            down_payment_entry_id,
            v_down_payment_amount,
            v_down_payment_date,
            p_payment_method::public.payment_method,
            'Pagamento automatico de entrada',
            p_user_id
        );
    END IF;

    -- Inserir Parcelas
    IF array_length(p_installments, 1) > 0 THEN
        FOREACH inst IN ARRAY p_installments LOOP
            INSERT INTO public.credito_debito (
                lancamento_id, type, document_number, model, pessoa_id,
                cliente_fornecedor_name, cliente_fornecedor_fantasy_name, cnpj_cpf,
                description, issue_date, total_value, installment_value,
                payment_method, cost_center, notes, user_id,
                installment_number, total_installments,
                coleta_id, paid_amount, amount_balance, status,
                has_down_payment
            ) VALUES (
                p_lancamento_id, p_type, v_formatted_document_number, p_model, p_pessoa_id,
                p_cliente_fornecedor_name, p_cliente_fornecedor_fantasy_name, p_cnpj_cpf,
                p_description, (inst->>'due_date')::date,
                v_total_document_value, (inst->>'amount')::numeric,
                p_payment_method::public.payment_method, p_cost_center, p_notes, p_user_id,
                (inst->>'installment_number')::integer, array_length(p_installments, 1),
                p_coleta_id, 0, (inst->>'amount')::numeric, 'pending'::pagamento_status,
                (p_down_payment IS NOT NULL)
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'lancamento_id', p_lancamento_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;
