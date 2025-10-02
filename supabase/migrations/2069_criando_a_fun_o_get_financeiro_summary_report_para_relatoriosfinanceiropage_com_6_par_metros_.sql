CREATE OR REPLACE FUNCTION public.get_financeiro_summary_report(
    p_start_date date,
    p_end_date date,
    p_type text,
    p_status text,
    p_client_search_term text,
    p_cost_center text
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    summary_data jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total_entries', COUNT(*),
        'total_value', COALESCE(SUM(total_value), 0),
        'total_paid', COALESCE(SUM(paid_amount), 0),
        'total_balance', COALESCE(SUM(amount_balance), 0)
    )
    INTO summary_data
    FROM public.credito_debito cd
    WHERE
        (p_type IS NULL OR p_type = 'all' OR type = p_type)
        AND (p_start_date IS NULL OR issue_date >= p_start_date)
        AND (p_end_date IS NULL OR issue_date <= p_end_date)
        AND (p_status IS NULL OR p_status = 'all' OR status = p_status::public.pagamento_status)
        AND (p_cost_center IS NULL OR p_cost_center = 'all' OR cost_center = p_cost_center)
        AND (p_client_search_term IS NULL OR (
            document_number ILIKE '%' || p_client_search_term || '%' OR
            description ILIKE '%' || p_client_search_term || '%' OR
            cliente_fornecedor_name ILIKE '%' || p_client_search_term || '%' OR
            cliente_fornecedor_fantasy_name ILIKE '%' || p_client_search_term || '%'
        ));

    RETURN summary_data;
END;
$function$;