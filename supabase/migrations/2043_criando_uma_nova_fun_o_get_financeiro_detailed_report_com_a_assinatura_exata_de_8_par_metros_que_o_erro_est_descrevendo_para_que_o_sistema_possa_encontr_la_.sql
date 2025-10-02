CREATE OR REPLACE FUNCTION public.get_financeiro_detailed_report(
    p_client_search_term text,
    p_cost_center text,
    p_end_date date,
    p_limit integer,
    p_offset integer,
    p_start_date date,
    p_status text,
    p_type text
)
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
        r.assinatura_url
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
        cd.issue_date DESC, cd.created_at DESC -- Ordenação padrão
    OFFSET p_offset
    LIMIT p_limit;
END;
$function$;