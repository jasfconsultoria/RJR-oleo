CREATE OR REPLACE FUNCTION public.get_financeiro_detailed_report(p_start_date date, p_end_date date, p_type text, p_status text, p_client_search_term text, p_cost_center text, p_offset integer, p_limit integer, p_sort_column text, p_sort_direction text)
 RETURNS TABLE(id uuid, lancamento_id uuid, type text, document_number text, model text, pessoa_id uuid, cliente_fornecedor_name text, cliente_fornecedor_fantasy_name text, cnpj_cpf text, description text, issue_date date, total_value numeric, paid_amount numeric, amount_balance numeric, payment_method text, cost_center text, notes text, status pagamento_status, installment_number integer, total_installments numeric, has_down_payment boolean, user_id uuid, created_at timestamp with time zone, cliente_fornecedor_name_fantasia text, coleta_id uuid, recibo_assinatura_url text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        cd.id,
        cd.lancamento_id,
        cd.type,
        cd.document_number,
        cd.model,
        cd.pessoa_id,
        cd.cliente_fornecedor_name,
        cd.cliente_fornecedor_fantasy_name,
        cd.cnpj_cpf,
        cd.description,
        cd.issue_date,
        cd.total_value,
        cd.paid_amount,
        cd.amount_balance,
        cd.payment_method,
        cd.cost_center,
        cd.notes,
        cd.status,
        cd.installment_number,
        cd.total_installments,
        (SELECT COUNT(*) FROM public.credito_debito WHERE credito_debito.lancamento_id = cd.lancamento_id AND credito_debito.installment_number = 0) > 0 AS has_down_payment,
        cd.user_id,
        cd.created_at,
        cd.cliente_fornecedor_fantasy_name,
        cd.coleta_id,
        r.assinatura_url -- NOVO: Seleciona a URL da assinatura
    FROM
        public.credito_debito cd
    LEFT JOIN
        public.recibos r ON cd.coleta_id = r.coleta_id -- NOVO: JOIN com a tabela de recibos
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
        CASE WHEN p_sort_column = 'document_number' AND p_sort_direction = 'asc' THEN cd.document_number END ASC,
        CASE WHEN p_sort_column = 'document_number' AND p_sort_direction = 'desc' THEN cd.document_number END DESC,
        CASE WHEN p_sort_column = 'cliente_fornecedor_name' AND p_sort_direction = 'asc' THEN cd.cliente_fornecedor_name END ASC,
        CASE WHEN p_sort_column = 'cliente_fornecedor_name' AND p_sort_direction = 'desc' THEN cd.cliente_fornecedor_name END DESC,
        CASE WHEN p_sort_column = 'issue_date' AND p_sort_direction = 'asc' THEN cd.issue_date END ASC,
        CASE WHEN p_sort_column = 'issue_date' AND p_sort_direction = 'desc' THEN cd.issue_date END DESC,
        CASE WHEN p_sort_column = 'total_value' AND p_sort_direction = 'asc' THEN cd.total_value END ASC,
        CASE WHEN p_sort_column = 'total_value' AND p_sort_direction = 'desc' THEN cd.total_value END DESC,
        CASE WHEN p_sort_column = 'paid_amount' AND p_sort_direction = 'asc' THEN cd.paid_amount END ASC,
        CASE WHEN p_sort_column = 'paid_amount' AND p_sort_direction = 'desc' THEN cd.paid_amount END DESC,
        CASE WHEN p_sort_column = 'amount_balance' AND p_sort_direction = 'asc' THEN cd.amount_balance END ASC,
        CASE WHEN p_sort_column = 'amount_balance' AND p_sort_direction = 'desc' THEN cd.amount_balance END DESC,
        CASE WHEN p_sort_column = 'status' AND p_sort_direction = 'asc' THEN cd.status END ASC,
        CASE WHEN p_sort_column = 'status' AND p_sort_direction = 'desc' THEN cd.status END DESC,
        cd.created_at DESC -- Ordem padrão de fallback
    OFFSET p_offset
    LIMIT p_limit;
END;
$function$