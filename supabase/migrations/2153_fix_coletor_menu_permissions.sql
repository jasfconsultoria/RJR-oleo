-- Migration: Corrigir permissões de menu para o perfil de coletor
-- Data: 2026-05-25

-- Atualiza as permissões para remover o acesso do Coletor a menus que ele não deveria ver
UPDATE public.role_menu_permissions
SET can_view = false
WHERE role = 'coletor'
AND menu_key IN (
    'cadastro',
    'cadastro_clientes',
    'cadastro_fornecedores',
    'cadastro_contratos',
    'financeiro',
    'financeiro_credito',
    'financeiro_debito',
    'financeiro_centros_custo',
    'recipientes',
    'certificados',
    'relatorios',
    'relatorios_coletas',
    'relatorios_financeiro',
    'relatorios_estoque',
    'relatorios_recipientes',
    'relatorios_contratos',
    'estoque',
    'estoque_produtos',
    'estoque_entradas',
    'estoque_saidas',
    'estoque_movimentacoes',
    'estoque_saldo',
    'estoque_auditoria',
    'configuracoes',
    'configuracoes_empresa',
    'configuracoes_usuarios',
    'configuracoes_notificacoes',
    'configuracoes_ambientes',
    'configuracoes_logs',
    'configuracoes_permissoes'
);

-- Como o coletor precisa ter acesso ao menu "Meus Recibos", precisamos garantir 
-- que a "raiz" do Financeiro fique visível para ele conseguir acessar o subitem de Recibos
UPDATE public.role_menu_permissions
SET can_view = true
WHERE role = 'coletor'
AND menu_key IN ('financeiro', 'financeiro_recibos');
