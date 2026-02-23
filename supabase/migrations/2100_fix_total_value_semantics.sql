-- MigraÃ§Ã£o para corrigir a semÃ¢ntica das colunas de valor e ajustar lÃ³gica de saldo
-- total_value -> passarÃ¡ a armazenar o valor TOTAL do documento.
-- installment_value -> passarÃ¡ a armazenar o valor individual da parcela.

-- 1. Atualizar a RPC de criaÃ§Ã£o
CREATE OR REPLACE FUNCTION public.create_financeiro_lancamento(
    p_lancamento_id uuid, p_type text, p_document_number text, p_model text, 
    p_pessoa_id uuid, p_cliente_fornecedor_name text, p_cliente_fornecedor_fantasy_name text, 
    p_cnpj_cpf text, p_description text, p_payment_method text, p_cost_center text, 
    p_notes text, p_user_id uuid, p_total_installments integer, 
    p_down_payment jsonb, p_installments jsonb[], p_coleta_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    down_payment_entry_id uuid;
    result jsonb;
    inst jsonb;
    v_down_payment_amount numeric;
    v_down_payment_date date;
    v_total_document_value numeric := 0;
    v_formatted_document_number TEXT;
BEGIN
    -- FormataÃ§Ã£o do nÃºmero do documento
    IF p_document_number ~ '^[0-9]+$' AND LENGTH(p_document_number) < 6 THEN
        v_formatted_document_number := LPAD(p_document_number, 6, '0');
    ELSE
        v_formatted_document_number := p_document_number;
    END IF;

    -- CÃ¡lculo do valor total do documento
    IF p_down_payment IS NOT NULL THEN
        v_total_document_value := v_total_document_value + (p_down_payment->>'amount')::numeric;
    END IF;
    IF array_length(p_installments, 1) > 0 THEN
        FOREACH inst IN ARRAY p_installments LOOP
            v_total_document_value := v_total_document_value + (inst->>'amount')::numeric;
        END LOOP;
    END IF;

    -- Inserir Entrada (se existir)
    IF p_down_payment IS NOT NULL THEN
        v_down_payment_amount := (p_down_payment->>'amount')::numeric;
        v_down_payment_date := (p_down_payment->>'date')::date;

        INSERT INTO public.credito_debito (
            lancamento_id, type, document_number, model, pessoa_id,
            cliente_fornecedor_name, cliente_fornecedor_fantasy_name,
            cnpj_cpf, description, issue_date, 
            total_value, installment_value,
            payment_method, cost_center, notes, user_id, 
            installment_number, total_installments,
            coleta_id, paid_amount, amount_balance, status
        )
        VALUES (
            p_lancamento_id, p_type, v_formatted_document_number, p_model, p_pessoa_id,
            p_cliente_fornecedor_name, p_cliente_fornecedor_fantasy_name,
            p_cnpj_cpf, p_description, v_down_payment_date,
            v_total_document_value, v_down_payment_amount, 
            p_payment_method::public.payment_method, p_cost_center, p_notes, p_user_id, 0, p_total_installments,
            p_coleta_id, v_down_payment_amount, 0, 'paid'::pagamento_status
        )
        RETURNING id INTO down_payment_entry_id;

        -- Registrar o pagamento no histÃ³rico DIRETAMENTE (evita ambiguidade de function overload)
        INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
        VALUES (
            down_payment_entry_id,
            v_down_payment_amount,
            v_down_payment_date,
            p_payment_method::public.payment_method,
            'Pagamento automÃ¡tico de entrada'::text,
            p_user_id
        );
    END IF;

    -- Inserir Parcelas
    IF array_length(p_installments, 1) > 0 THEN
        FOREACH inst IN ARRAY p_installments LOOP
            INSERT INTO public.credito_debito (
                lancamento_id, type, document_number, model, pessoa_id,
                cliente_fornecedor_name, cliente_fornecedor_fantasy_name,
                cnpj_cpf, description, issue_date, 
                total_value, installment_value,
                payment_method, cost_center, notes, user_id, 
                installment_number, total_installments,
                coleta_id, paid_amount, amount_balance, status
            )
            VALUES (
                p_lancamento_id, p_type, v_formatted_document_number, p_model, p_pessoa_id,
                p_cliente_fornecedor_name, p_cliente_fornecedor_fantasy_name,
                p_cnpj_cpf, p_description, (inst->>'date')::date,
                v_total_document_value, (inst->>'amount')::numeric,
                p_payment_method::public.payment_method, p_cost_center, p_notes, p_user_id, 
                (inst->>'number')::integer, p_total_installments,
                p_coleta_id, 0, (inst->>'amount')::numeric, 'pending'::pagamento_status
            );
        END LOOP;
    END IF;

    result := jsonb_build_object('success', true, 'lancamento_id', p_lancamento_id);
    RETURN result;
END;
$function$;

-- 2. Atualizar gatilhos para usar installment_value no cÃ¡lculo do saldo
CREATE OR REPLACE FUNCTION public.update_credito_debito_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    total_paid_so_far NUMERIC;
    entry_value NUMERIC;
    new_balance NUMERIC;
    new_status TEXT;
BEGIN
    SELECT COALESCE(SUM(paid_amount), 0) INTO total_paid_so_far
    FROM public.pagamentos WHERE credito_debito_id = NEW.credito_debito_id;

    -- Usa installment_value (R$ 25,00/50,00) se existir, senÃ£o usa total_value (compatibilidade)
    SELECT COALESCE(installment_value, total_value) INTO entry_value
    FROM public.credito_debito WHERE id = NEW.credito_debito_id;

    new_balance := entry_value - total_paid_so_far;

    IF new_balance <= 0.009 THEN new_status := 'paid';
    ELSIF total_paid_so_far > 0 THEN new_status := 'partially_paid';
    ELSE new_status := 'pending';
    END IF;

    UPDATE public.credito_debito SET
        paid_amount = total_paid_so_far,
        amount_balance = new_balance,
        status = new_status::public.pagamento_status,
        updated_at = NOW()
    WHERE id = NEW.credito_debito_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Atualizar gatilho de deleÃ§Ã£o
CREATE OR REPLACE FUNCTION public.update_credito_debito_on_payment_delete()
RETURNS TRIGGER AS $$
DECLARE
    total_paid_so_far NUMERIC;
    entry_value NUMERIC;
    new_balance NUMERIC;
    new_status TEXT;
BEGIN
    SELECT COALESCE(SUM(paid_amount), 0) INTO total_paid_so_far
    FROM public.pagamentos WHERE credito_debito_id = OLD.credito_debito_id;

    SELECT COALESCE(installment_value, total_value) INTO entry_value
    FROM public.credito_debito WHERE id = OLD.credito_debito_id;

    new_balance := entry_value - total_paid_so_far;

    IF new_balance <= 0.009 THEN new_status := 'paid';
    ELSIF total_paid_so_far > 0 THEN new_status := 'partially_paid';
    ELSE new_status := 'pending';
    END IF;

    UPDATE public.credito_debito SET
        paid_amount = total_paid_so_far,
        amount_balance = new_balance,
        status = new_status::public.pagamento_status,
        updated_at = NOW()
    WHERE id = OLD.credito_debito_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 4. Atualizar RPC de listagem para expor a installment_value
DROP FUNCTION IF EXISTS public.get_financeiro_detailed_receipt(date, date, text, text, text, text, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_financeiro_detailed_receipt(
    p_start_date date, p_end_date date, p_type text, p_status text, 
    p_client_search_term text, p_cost_center text, p_offset integer, 
    p_limit integer, p_sort_column text, p_sort_direction text
)
 RETURNS TABLE(
    id uuid, lancamento_id uuid, type text, document_number text, model text, 
    pessoa_id uuid, cliente_fornecedor_name text, cliente_fornecedor_fantasy_name text, 
    cnpj_cpf text, description text, issue_date date, 
    total_value numeric, installment_value numeric,
    valor_desconto numeric, paid_amount numeric, amount_balance numeric, 
    payment_method text, cost_center text, notes text, 
    status public.pagamento_status, installment_number integer, 
    total_installments numeric, has_down_payment boolean, user_id uuid, 
    created_at timestamp with time zone, coleta_id uuid, recibo_assinatura_url text
)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        cd.id, cd.lancamento_id, cd.type, cd.document_number, cd.model,
        cd.pessoa_id, cd.cliente_fornecedor_name, cd.cliente_fornecedor_fantasy_name,
        cd.cnpj_cpf, cd.description, cd.issue_date,
        cd.total_value,
        COALESCE(cd.installment_value, cd.total_value) as installment_value,
        COALESCE(cd.down_payment, 0) as valor_desconto,
        cd.paid_amount, cd.amount_balance, cd.payment_method, cd.cost_center, cd.notes,
        cd.status, cd.installment_number, cd.total_installments,
        (SELECT COUNT(*) FROM public.credito_debito WHERE credito_debito.lancamento_id = cd.lancamento_id AND credito_debito.installment_number = 0) > 0 AS has_down_payment,
        cd.user_id, cd.created_at, cd.coleta_id, r.assinatura_url
    FROM
        public.credito_debito cd
    LEFT JOIN
        public.recibos r ON cd.coleta_id = r.coleta_id
    WHERE
        cd.type = p_type
        AND (p_start_date IS NULL OR cd.issue_date >= p_start_date)
        AND (p_end_date IS NULL OR cd.issue_date <= p_end_date)
        AND (p_status IS NULL OR p_status = 'all' OR cd.status = p_status::public.pagamento_status)
        AND (p_cost_center IS NULL OR p_cost_center = 'all' OR cd.cost_center = p_cost_center)
        AND (p_client_search_term IS NULL OR (
            cd.document_number ILIKE '%' || p_client_search_term || '%' OR
            cd.description ILIKE '%' || p_client_search_term || '%' OR
            cd.cliente_fornecedor_name ILIKE '%' || p_client_search_term || '%' OR
            cd.cliente_fornecedor_fantasy_name ILIKE '%' || p_client_search_term || '%'
        ))
    ORDER BY
        CASE WHEN p_sort_column = 'issue_date' AND p_sort_direction = 'asc' THEN cd.issue_date END ASC,
        CASE WHEN p_sort_column = 'issue_date' AND p_sort_direction = 'desc' THEN cd.issue_date END DESC,
        cd.created_at DESC
    OFFSET p_offset
    LIMIT p_limit;
END;
$function$;

-- 5. Atualizar RPC de registro de pagamento para consistÃªncia
-- LIMPEZA RADICAL: Drop de todas as variantes conhecidas para evitar ambiguidade (Erro 400/42725)
DROP FUNCTION IF EXISTS public.register_payment(uuid, numeric, date, text, text);
DROP FUNCTION IF EXISTS public.register_payment(uuid, numeric, date, text, text, integer, date, numeric);

CREATE OR REPLACE FUNCTION public.register_payment(
    p_credito_debito_id UUID,
    p_paid_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_notes TEXT,
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
        RETURN jsonb_build_object('success', false, 'message', 'UsuÃ¡rio nÃ£o autenticado.');
    END IF;

    INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
    VALUES (p_credito_debito_id, p_paid_amount, p_payment_date, p_payment_method, p_notes, current_user_id)
    RETURNING id INTO new_payment_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado com sucesso.', 'payment_id', new_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

