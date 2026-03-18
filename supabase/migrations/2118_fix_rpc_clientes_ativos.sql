-- 2118_fix_rpc_clientes_ativos.sql
-- Description: Melhora a RPC de busca de clientes com contrato ativo para incluir dados extras necessários para a coleta (usa_recipiente, id do contrato, etc)

-- Remover versão existente para evitar erro de mudança de tipo de retorno
DROP FUNCTION IF EXISTS public.get_clientes_com_contratos_ativos();

CREATE OR REPLACE FUNCTION public.get_clientes_com_contratos_ativos()
RETURNS TABLE (
    id UUID,
    nome_fantasia TEXT,
    razao_social TEXT,
    cnpj_cpf TEXT,
    telefone TEXT,
    email TEXT,
    endereco TEXT,
    municipio TEXT,
    estado TEXT,
    contrato_id UUID,
    contrato_status TEXT,
    tipo_coleta TEXT,
    valor_coleta NUMERIC,
    fator_troca NUMERIC,
    usa_recipiente BOOLEAN,
    data_fim DATE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH latest_contracts AS (
        -- Seleciona o contrato mais recente (pela data de fim) de cada cliente que esteja Ativo
        SELECT DISTINCT ON (cliente_id)
            c.id,
            c.cliente_id,
            c.status,
            c.tipo_coleta,
            c.valor_coleta,
            c.fator_troca,
            c.usa_recipiente,
            c.data_fim
        FROM public.contratos c
        WHERE c.status = 'Ativo'
        ORDER BY c.cliente_id, c.data_fim DESC
    )
    SELECT 
        cli.id,
        cli.nome_fantasia,
        cli.razao_social,
        cli.cnpj_cpf,
        cli.telefone,
        cli.email,
        cli.endereco,
        cli.municipio,
        cli.estado,
        lc.id as contrato_id,
        lc.status::TEXT as contrato_status,
        lc.tipo_coleta,
        lc.valor_coleta,
        lc.fator_troca,
        lc.usa_recipiente,
        lc.data_fim
    FROM public.clientes cli
    INNER JOIN latest_contracts lc ON cli.id = lc.cliente_id
    ORDER BY cli.nome_fantasia, cli.razao_social;
END;
$$;
