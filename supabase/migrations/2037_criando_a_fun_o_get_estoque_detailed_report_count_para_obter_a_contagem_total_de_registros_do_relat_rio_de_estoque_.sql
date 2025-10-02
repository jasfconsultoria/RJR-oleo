CREATE OR REPLACE FUNCTION public.get_estoque_detailed_report_count(p_start_date date, p_end_date date, p_type text, p_product_search_term text)
 RETURNS bigint
 LANGUAGE plpgsql
AS $function$
DECLARE
    total_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO total_count
    FROM
        public.entrada_saida es
    LEFT JOIN
        public.itens_entrada_saida ies ON es.id = ies.entrada_saida_id
    LEFT JOIN
        public.produtos p ON ies.produto_id = p.id
    WHERE
        (p_start_date IS NULL OR es.data::date >= p_start_date)
        AND (p_end_date IS NULL OR es.data::date <= p_end_date)
        AND (p_type IS NULL OR p_type = 'all' OR es.tipo = p_type::public.entrada_saida_tipo)
        AND (p_product_search_term IS NULL OR (
            p.nome ILIKE '%' || p_product_search_term || '%' OR
            p.codigo ILIKE '%' || p_product_search_term || '%'
        ));

    RETURN total_count;
END;
$function$