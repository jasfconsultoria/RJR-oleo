CREATE OR REPLACE FUNCTION create_financeiro_lancamento(
    p_lancamento_id uuid,
    p_type text,
    p_document_number text,
    p_model text,
    p_pessoa_id uuid,
    p_cliente_fornecedor_name text,
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
AS $$
DECLARE
    down_payment_entry_id uuid;
    result jsonb;
    inst jsonb;
BEGIN
    -- Insert down payment if it exists
    IF p_down_payment IS NOT NULL THEN
        INSERT INTO public.credito_debito (
            lancamento_id, type, document_number, model, pessoa_id, cliente_fornecedor_name, cnpj_cpf,
            description, issue_date, total_value, payment_method, cost_center, notes, user_id,
            installment_number, total_installments
        )
        VALUES (
            p_lancamento_id, p_type, p_document_number, p_model, p_pessoa_id, p_cliente_fornecedor_name, p_cnpj_cpf,
            p_description, (p_down_payment->>'date')::date, (p_down_payment->>'amount')::numeric, p_payment_method, p_cost_center, p_notes, p_user_id,
            0, p_total_installments
        )
        RETURNING id INTO down_payment_entry_id;

        -- Insert corresponding payment for the down payment
        INSERT INTO public.pagamentos (
            credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id
        )
        VALUES (
            down_payment_entry_id, (p_down_payment->>'amount')::numeric, (p_down_payment->>'date')::date, p_payment_method, 'Pagamento de entrada.', p_user_id
        );
    END IF;

    -- Insert installments
    IF array_length(p_installments, 1) > 0 THEN
        FOREACH inst IN ARRAY p_installments
        LOOP
            INSERT INTO public.credito_debito (
                lancamento_id, type, document_number, model, pessoa_id, cliente_fornecedor_name, cnpj_cpf,
                description, issue_date, total_value, payment_method, cost_center, notes, user_id,
                installment_number, total_installments
            )
            VALUES (
                p_lancamento_id, p_type, p_document_number, p_model, p_pessoa_id, p_cliente_fornecedor_name, p_cnpj_cpf,
                p_description, (inst->>'date')::date, (inst->>'amount')::numeric, p_payment_method, p_cost_center, p_notes, p_user_id,
                (inst->>'number')::integer, p_total_installments
            );
        END LOOP;
    END IF;

    result := jsonb_build_object('success', true, 'lancamento_id', p_lancamento_id);
    RETURN result;

EXCEPTION
    WHEN others THEN
        result := jsonb_build_object('success', false, 'message', SQLERRM);
        RETURN result;
END;
$$;