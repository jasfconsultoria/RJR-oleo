CREATE OR REPLACE FUNCTION public.get_financeiro_detailed_report(
    p_start_date date,
    p_end_date date,
    p_type text,
    p_status text,
    p_client_search_term text,
    p_cost_center text,
    p_offset integer,
    p_limit integer,
    p_sort_column text DEFAULT 'issue_date',
    p_sort_direction text DEFAULT 'desc',
    OUT id uuid,
    OUT lancamento_id uuid,
    OUT type text,
    OUT document_number text,
    OUT model text,
    OUT pessoa_id uuid,
    OUT cliente_fornecedor_name text,
    OUT cliente_fornecedor_fantasy_name text,
    OUT cnpj_cpf text,
    OUT description text,
    OUT issue_date date,
    OUT total_value numeric,
    OUT paid_amount numeric,
    OUT amount_balance numeric,
    OUT payment_method text,
    OUT cost_center text,
    OUT notes text,
    OUT status pagamento_status,
    OUT installment_number integer,
    OUT total_installments numeric,
    OUT has_down_payment boolean,
    OUT user_id uuid,
    OUT created_at timestamp with time zone,
    OUT cliente_fornecedor_name_fantasia text,
    OUT coleta_id uuid,
    OUT recibo_assinatura_url text -- NOVO: URL da assinatura do recibo
)
 RETURNS SETOF record
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