-- Supabase Migration: 2024_08_15_add_coleta_status_and_fix_recibo_view.sql
-- Esta migração introduz uma nova view para coletas com status de recibo e corrige o componente Recibo.

-- 1. Cria ou substitui a v_coletas_com_status view
-- Esta view combina dados das tabelas 'coletas', 'clientes' e 'recibos'
-- e adiciona uma coluna 'status_recibo' baseada na presença de um recibo assinado.
CREATE OR REPLACE VIEW v_coletas_com_status AS
SELECT
    c.id,
    c.numero_coleta,
    c.cliente_id,
    c.data_coleta,
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
    cl.nome AS cliente_nome, -- Renomeado para evitar conflito com c.cliente_nome se existir
    cl.cnpj_cpf AS cliente_cnpj_cpf,
    cl.endereco AS cliente_endereco,
    cl.email AS cliente_email,
    cl.municipio AS cliente_municipio, -- Redundante mas mantido para clareza
    cl.estado AS cliente_estado,     -- Redundante mas mantido para clareza
    cl.telefone AS cliente_telefone,
    r.assinatura_url,
    CASE
        WHEN r.id IS NULL THEN 'nao_gerado' -- Nenhuma entrada de recibo para esta coleta
        WHEN r.assinatura_url IS NULL THEN 'pendente_assinatura' -- Entrada de recibo existe, mas sem assinatura
        ELSE 'assinado' -- Entrada de recibo existe e tem uma assinatura
    END AS status_recibo
FROM coletas c
LEFT JOIN clientes cl ON c.cliente_id = cl.id
LEFT JOIN recibos r ON c.id = r.coleta_id;

-- 2. Concede permissões de seleção na nova view para os papéis autenticados e anônimos
-- Isso é crucial para que as páginas de recibo públicas possam acessar as informações de status.
GRANT SELECT ON v_coletas_com_status TO authenticated, anon;

-- 3. Atualiza a versão na tabela public.versoes
INSERT INTO public.versoes (versao, hash, descricao)
VALUES ('1.8.7', 'g5h6i7j', '- **Correção do Link Público de Assinatura de Recibo:** Resolvido o problema que impedia a página pública de assinatura de recibo de carregar, garantindo que o formulário de assinatura seja exibido corretamente.
- **Status de Recibo na Lista de Coletas:** Adicionado um novo status para as coletas na lista, indicando se o recibo está "Em Andamento" (não gerado), "Aguardando Assinatura" (gerado, mas sem assinatura) ou "Finalizada" (assinado).
- **Melhoria na Robustez do Componente Recibo:** O componente `Recibo.jsx` foi aprimorado para lidar de forma mais robusta com dados ausentes, evitando telas em branco.');