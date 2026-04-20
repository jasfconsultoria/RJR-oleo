-- Migração: Criar tabela de permissões de menu por perfil
-- Data: 2026-04-20

-- 1. Criar a tabela
CREATE TABLE IF NOT EXISTS public.role_menu_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role public.user_role NOT NULL,
    menu_key TEXT NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role, menu_key)
);

-- 2. Habilitar RLS
ALTER TABLE public.role_menu_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS
-- Qualquer usuário autenticado pode ler as permissões (necessário para o layout carregar)
CREATE POLICY "Qualquer usuário autenticado pode ler permissões"
ON public.role_menu_permissions FOR SELECT
TO authenticated
USING (true);

-- Apenas super_admin e administrador podem gerenciar permissões
CREATE POLICY "Admins podem gerenciar permissões"
ON public.role_menu_permissions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'administrador')
    )
);

-- 4. Inserir dados iniciais (Seeding)
-- Nota: Inicializamos com a lógica atual do AppLayout.jsx

INSERT INTO public.role_menu_permissions (role, menu_key, can_view)
VALUES 
-- Dashboard
('super_admin', 'dashboard', true), ('administrador', 'dashboard', true), ('gerente', 'dashboard', true), ('coletor', 'dashboard', true),

-- Cadastro
('super_admin', 'cadastro', true), ('administrador', 'cadastro', true), ('gerente', 'cadastro', true), ('coletor', 'cadastro', true),
('super_admin', 'cadastro_clientes', true), ('administrador', 'cadastro_clientes', true), ('gerente', 'cadastro_clientes', true), ('coletor', 'cadastro_clientes', true),
('super_admin', 'cadastro_fornecedores', true), ('administrador', 'cadastro_fornecedores', true), ('gerente', 'cadastro_fornecedores', true), ('coletor', 'cadastro_fornecedores', true),
('super_admin', 'cadastro_contratos', true), ('administrador', 'cadastro_contratos', true), ('gerente', 'cadastro_contratos', true), ('coletor', 'cadastro_contratos', true),

-- Financeiro (Restrito para Coletor em alguns subitens)
('super_admin', 'financeiro', true), ('administrador', 'financeiro', true), ('gerente', 'financeiro', true), ('coletor', 'financeiro', true),
('super_admin', 'financeiro_credito', true), ('administrador', 'financeiro_credito', true), ('gerente', 'financeiro_credito', false), ('coletor', 'financeiro_credito', false),
('super_admin', 'financeiro_debito', true), ('administrador', 'financeiro_debito', true), ('gerente', 'financeiro_debito', false), ('coletor', 'financeiro_debito', false),
('super_admin', 'financeiro_recibos', true), ('administrador', 'financeiro_recibos', true), ('gerente', 'financeiro_recibos', true), ('coletor', 'financeiro_recibos', true),
('super_admin', 'financeiro_centros_custo', true), ('administrador', 'financeiro_centros_custo', true), ('gerente', 'financeiro_centros_custo', false), ('coletor', 'financeiro_centros_custo', false),

-- Agenda
('super_admin', 'agenda', true), ('administrador', 'agenda', true), ('gerente', 'agenda', true), ('coletor', 'agenda', false),

-- Coletas
('super_admin', 'coletas', true), ('administrador', 'coletas', true), ('gerente', 'coletas', true), ('coletor', 'coletas', true),
('super_admin', 'coletas_lista', true), ('administrador', 'coletas_lista', true), ('gerente', 'coletas_lista', true), ('coletor', 'coletas_lista', true),
('super_admin', 'coletas_rotas', true), ('administrador', 'coletas_rotas', true), ('gerente', 'coletas_rotas', true), ('coletor', 'coletas_rotas', true),
('super_admin', 'coletas_mapa', true), ('administrador', 'coletas_mapa', true), ('gerente', 'coletas_mapa', true), ('coletor', 'coletas_mapa', true),

-- Recipientes (Oculto para Coletor conforme pedido anterior)
('super_admin', 'recipientes', true), ('administrador', 'recipientes', true), ('gerente', 'recipientes', true), ('coletor', 'recipientes', false),

-- Certificados
('super_admin', 'certificados', true), ('administrador', 'certificados', true), ('gerente', 'certificados', true), ('coletor', 'certificados', false),

-- Relatórios
('super_admin', 'relatorios', true), ('administrador', 'relatorios', true), ('gerente', 'relatorios', true), ('coletor', 'relatorios', false),
('super_admin', 'relatorios_coletas', true), ('administrador', 'relatorios_coletas', true), ('gerente', 'relatorios_coletas', true), ('coletor', 'relatorios_coletas', false),
('super_admin', 'relatorios_financeiro', true), ('administrador', 'relatorios_financeiro', true), ('gerente', 'relatorios_financeiro', false), ('coletor', 'relatorios_financeiro', false),
('super_admin', 'relatorios_estoque', true), ('administrador', 'relatorios_estoque', true), ('gerente', 'relatorios_estoque', true), ('coletor', 'relatorios_estoque', false),
('super_admin', 'relatorios_recipientes', true), ('administrador', 'relatorios_recipientes', true), ('gerente', 'relatorios_recipientes', true), ('coletor', 'relatorios_recipientes', false),
('super_admin', 'relatorios_contratos', true), ('administrador', 'relatorios_contratos', true), ('gerente', 'relatorios_contratos', true), ('coletor', 'relatorios_contratos', false),

-- Estoque
('super_admin', 'estoque', true), ('administrador', 'estoque', true), ('gerente', 'estoque', true), ('coletor', 'estoque', false),
('super_admin', 'estoque_produtos', true), ('administrador', 'estoque_produtos', true), ('gerente', 'estoque_produtos', true), ('coletor', 'estoque_produtos', false),
('super_admin', 'estoque_entradas', true), ('administrador', 'estoque_entradas', true), ('gerente', 'estoque_entradas', true), ('coletor', 'estoque_entradas', false),
('super_admin', 'estoque_saidas', true), ('administrador', 'estoque_saidas', true), ('gerente', 'estoque_saidas', true), ('coletor', 'estoque_saidas', false),
('super_admin', 'estoque_movimentacoes', true), ('administrador', 'estoque_movimentacoes', true), ('gerente', 'estoque_movimentacoes', true), ('coletor', 'estoque_movimentacoes', false),
('super_admin', 'estoque_saldo', true), ('administrador', 'estoque_saldo', true), ('gerente', 'estoque_saldo', true), ('coletor', 'estoque_saldo', false),
('super_admin', 'estoque_auditoria', true), ('administrador', 'estoque_auditoria', true), ('gerente', 'estoque_auditoria', true), ('coletor', 'estoque_auditoria', false),

-- Configurações
('super_admin', 'configuracoes', true), ('administrador', 'configuracoes', true), ('gerente', 'configuracoes', false), ('coletor', 'configuracoes', false),
('super_admin', 'configuracoes_empresa', true), ('administrador', 'configuracoes_empresa', true), ('gerente', 'configuracoes_empresa', false), ('coletor', 'configuracoes_empresa', false),
('super_admin', 'configuracoes_usuarios', true), ('administrador', 'configuracoes_usuarios', true), ('gerente', 'configuracoes_usuarios', false), ('coletor', 'configuracoes_usuarios', false),
('super_admin', 'configuracoes_notificacoes', true), ('administrador', 'configuracoes_notificacoes', false), ('gerente', 'configuracoes_notificacoes', false), ('coletor', 'configuracoes_notificacoes', false),
('super_admin', 'configuracoes_ambientes', true), ('administrador', 'configuracoes_ambientes', false), ('gerente', 'configuracoes_ambientes', false), ('coletor', 'configuracoes_ambientes', false),
('super_admin', 'configuracoes_logs', true), ('administrador', 'configuracoes_logs', true), ('gerente', 'configuracoes_logs', false), ('coletor', 'configuracoes_logs', false),
('super_admin', 'configuracoes_permissoes', true), ('administrador', 'configuracoes_permissoes', true), ('gerente', 'configuracoes_permissoes', false), ('coletor', 'configuracoes_permissoes', false),

-- Sobre e Versões
('super_admin', 'sobre', true), ('administrador', 'sobre', true), ('gerente', 'sobre', true), ('coletor', 'sobre', true),
('super_admin', 'versoes', true), ('administrador', 'versoes', true), ('gerente', 'versoes', true), ('coletor', 'versoes', true)

ON CONFLICT (role, menu_key) DO UPDATE 
SET can_view = EXCLUDED.can_view, updated_at = NOW();

-- Trigger para atualizar o campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_role_menu_permissions_updated_at
    BEFORE UPDATE ON public.role_menu_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
