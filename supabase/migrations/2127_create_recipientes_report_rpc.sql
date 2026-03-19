-- RPC: get_recipientes_detailed_report (V4 - Fix Nomes Municípios)
-- Função para consolidar dados de recipientes em posse de clientes e sua atividade

DROP FUNCTION IF EXISTS public.get_recipientes_detailed_report(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, INTEGER);

CREATE OR REPLACE FUNCTION public.get_recipientes_detailed_report(
    p_estado TEXT DEFAULT 'all',
    p_municipio TEXT DEFAULT 'all',
    p_search_term TEXT DEFAULT '',
    p_apenas_inativos BOOLEAN DEFAULT FALSE,
    p_apenas_ativos BOOLEAN DEFAULT FALSE,
    p_dias_inatividade INTEGER DEFAULT 0
)
RETURNS TABLE (
    res_cliente_id UUID,
    res_nome_fantasia TEXT,
    res_razao_social TEXT,
    res_estado TEXT,
    res_municipio TEXT,
    res_recipientes_saldo INTEGER,
    res_data_ultima_coleta TIMESTAMPTZ,
    res_dias_sem_coleta INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH last_coleta AS (
        SELECT 
            cliente_id as cte_cliente_id, 
            MAX(data_movimento) as last_date
        FROM public.movimentacoes_recipientes
        WHERE tipo_operacao = 'coleta'
        GROUP BY cliente_id
    )
    SELECT 
        c.id,
        c.nome_fantasia,
        c.razao_social,
        c.estado,
        COALESCE(m.municipio, c.municipio) as municipio_nome, -- Nome legível
        c.recipientes_saldo,
        lc.last_date,
        CASE 
            WHEN lc.last_date IS NULL THEN 9999 -- Nunca teve coleta
            ELSE (EXTRACT(DAY FROM (NOW() - lc.last_date)))::INTEGER
        END
    FROM public.clientes c
    LEFT JOIN last_coleta lc ON lc.cte_cliente_id = c.id
    LEFT JOIN public.municipios m ON m.codigo = c.municipio -- Join para pegar nome do município
    WHERE 
        c.recipientes_saldo > 0
        AND (p_estado = 'all' OR c.estado = p_estado)
        AND (p_municipio = 'all' OR c.municipio = p_municipio OR m.municipio = p_municipio)
        AND (
            p_search_term = '' 
            OR c.nome_fantasia ILIKE '%' || p_search_term || '%' 
            OR c.razao_social ILIKE '%' || p_search_term || '%'
        )
        AND (
            NOT p_apenas_inativos 
            OR lc.last_date IS NULL 
            OR (EXTRACT(DAY FROM (NOW() - lc.last_date)) >= p_dias_inatividade)
        )
        AND (
            NOT p_apenas_ativos
            OR (lc.last_date IS NOT NULL AND EXTRACT(DAY FROM (NOW() - lc.last_date)) < p_dias_inatividade)
        )
    ORDER BY 8 DESC, c.recipientes_saldo DESC; -- 8 is res_dias_sem_coleta
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
