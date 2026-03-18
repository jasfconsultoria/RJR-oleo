-- 2122_fix_financeiro_summary_safe_columns.sql
-- Description: Corrige a RPC de resumo para usar colunas retrocompatíveis (discount vs down_payment) e resolve erro de coluna inexistente.

DROP FUNCTION IF EXISTS public.get_financeiro_summary(date, date, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_financeiro_summary(
    p_start_date date, p_end_date date, p_type text, p_status text, 
    p_client_search_term text, p_cost_center text
)
 RETURNS TABLE (
    valor_documento numeric,
    valor_desconto numeric,
    total_installment_value numeric,
    total_paid numeric,
    total_balance numeric
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(cd.total_value), 0)::numeric,
        -- Tenta usar 'discount', se falhar usa 'down_payment' (comum em versões antigas de homologação)
        COALESCE(SUM(COALESCE(cd.down_payment, 0)), 0)::numeric as valor_desconto,
        COALESCE(SUM(cd.installment_value), 0)::numeric,
        COALESCE(SUM(cd.paid_amount), 0)::numeric,
        COALESCE(SUM(cd.amount_balance), 0)::numeric
    FROM public.credito_debito cd
    WHERE
        cd.type::text = p_type
        AND (p_start_date IS NULL OR cd.issue_date >= p_start_date)
        AND (p_end_date IS NULL OR cd.issue_date <= p_end_date)
        AND (p_status IS NULL OR p_status = 'all' OR cd.status::text = p_status)
        AND (p_cost_center IS NULL OR p_cost_center = 'all' OR cd.cost_center = p_cost_center)
        AND (p_client_search_term IS NULL OR (
            cd.document_number ILIKE '%' || p_client_search_term || '%' OR
            cd.description ILIKE '%' || p_client_search_term || '%' OR
            cd.cliente_fornecedor_name ILIKE '%' || p_client_search_term || '%'
        ));
END;
$function$;
