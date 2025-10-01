CREATE OR REPLACE FUNCTION public.get_estoque_detailed_report(
    p_start_date date,
    p_end_date date,
    p_type text,
    p_product_search_term text,
    p_offset integer,
    p_limit integer,
    p_sort_column text DEFAULT 'data', -- Novo parâmetro
    p_sort_direction text DEFAULT 'desc' -- Novo parâmetro
)
 RETURNS TABLE(
    id uuid,
    data timestamp with time zone,
    tipo entrada_saida_tipo,
    origem entrada_saida_origem,
    document_number text,
    observacao text,
    cliente_id uuid,
    cliente_nome text,
    cliente_nome_fantasia text,
    produto_id uuid,
    produto_nome character varying,
    produto_codigo text,
    produto_unidade character varying,
    quantidade numeric
 )
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        es.id,
        es.data,
        es.tipo,
        es.origem,
        es.document_number,
        es.observacao,
        c.id AS cliente_id,
        c.nome AS cliente_nome,
        c.nome_fantasia AS cliente_nome_fantasia,
        p.id AS produto_id,
        p.nome AS produto_nome,
        p.codigo AS produto_codigo,
        p.unidade AS produto_unidade,
        ies.quantidade
    FROM
        public.entrada_saida es
    LEFT JOIN
        public.itens_entrada_saida ies ON es.id = ies.entrada_saida_id
    LEFT JOIN
        public.produtos p ON ies.produto_id = p.id
    LEFT JOIN
        public.clientes c ON es.cliente_id = c.id
    WHERE
        (p_start_date IS NULL OR es.data::date >= p_start_date)
        AND (p_end_date IS NULL OR es.data::date <= p_end_date)
        AND (p_type IS NULL OR p_type = 'all' OR es.tipo = p_type::public.entrada_saida_tipo)
        AND (p_product_search_term IS NULL OR (
            p.nome ILIKE '%' || p_product_search_term || '%' OR
            p.codigo ILIKE '%' || p_product_search_term || '%'
        ))
    ORDER BY
        CASE WHEN p_sort_column = 'data' AND p_sort_direction = 'asc' THEN es.data END ASC,
        CASE WHEN p_sort_column = 'data' AND p_sort_direction = 'desc' THEN es.data END DESC,
        CASE WHEN p_sort_column = 'document_number' AND p_sort_direction = 'asc' THEN es.document_number END ASC,
        CASE WHEN p_sort_column = 'document_number' AND p_sort_direction = 'desc' THEN es.document_number END DESC,
        CASE WHEN p_sort_column = 'produto_nome' AND p_sort_direction = 'asc' THEN p.nome END ASC,
        CASE WHEN p_sort_column = 'produto_nome' AND p_sort_direction = 'desc' THEN p.nome END DESC,
        CASE WHEN p_sort_column = 'quantidade' AND p_sort_direction = 'asc' THEN ies.quantidade END ASC,
        CASE WHEN p_sort_column = 'quantidade' AND p_sort_direction = 'desc' THEN ies.quantidade END DESC,
        es.created_at DESC -- Fallback default order
    OFFSET p_offset
    LIMIT p_limit;
END;
$function$