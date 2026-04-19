-- 2142_update_coletas_view.sql
-- Adiciona colunas de recipientes na view de coletas para que apareçam na listagem e histórico

-- ✅ DROP para evitar erro de mudança de mapeamento de colunas (42P16)
DROP VIEW IF EXISTS public.v_coletas_com_status CASCADE;

CREATE VIEW public.v_coletas_com_status AS
SELECT
    c.id,
    c.numero_coleta,
    c.cliente_id,
    c.data_coleta,
    c.hora_coleta, -- Adicionado para manter compatibilidade com versões existentes
    c.fator,
    c.tipo_coleta,
    c.quantidade_coletada,
    c.quantidade_entregue,
    c.valor_compra,
    c.total_pago,
    c.data_lancamento,
    c.user_id,
    c.estado,
    c.municipio,
    c.created_at,
    -- Campos de recipientes adicionados
    c.recipientes_coletados,
    c.recipientes_entregues,
    c.total_recipientes_contrato,
    c.saldo_recipientes_momento,
    cl.nome_fantasia,
    cl.razao_social,
    cl.cnpj_cpf AS cliente_cnpj_cpf,
    cl.endereco AS cliente_endereco,
    cl.email AS cliente_email,
    cl.municipio AS cliente_municipio,
    cl.estado AS cliente_estado,
    cl.telefone AS cliente_telefone,
    r.assinatura_url,
    CASE
        WHEN r.id IS NULL THEN 'nao_gerado'
        WHEN r.assinatura_url IS NULL THEN 'pendente_assinatura'
        ELSE 'assinado'
    END AS status_recibo
FROM public.coletas c
LEFT JOIN public.clientes cl ON c.cliente_id = cl.id
LEFT JOIN public.recibos r ON c.id = r.coleta_id;

GRANT SELECT ON public.v_coletas_com_status TO authenticated, anon;
