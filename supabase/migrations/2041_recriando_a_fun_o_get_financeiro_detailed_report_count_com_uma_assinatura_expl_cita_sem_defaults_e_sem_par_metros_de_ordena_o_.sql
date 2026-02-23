CREATE OR REPLACE FUNCTION public.get_financeiro_detailed_report_count(p_start_date date, p_end_date date, p_type text, p_status text, p_client_search_term text, p_cost_center text)
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
DECLARE
    total_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO total_count
    FROM public.credito_debito cd
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
        ));

    RETURN total_count;
END;
$function$