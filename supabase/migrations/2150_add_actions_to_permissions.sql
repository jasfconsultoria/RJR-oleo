-- Migração: Adicionar ações granulares às permissões de menu
-- Data: 2026-04-20

-- 1. Adicionar as novas colunas
ALTER TABLE public.role_menu_permissions 
ADD COLUMN IF NOT EXISTS can_create BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS can_delete BOOLEAN DEFAULT FALSE;

-- 2. Atualizar permissões iniciais para super_admin e administrador (Acesso Total)
UPDATE public.role_menu_permissions
SET can_create = true, can_edit = true, can_delete = true
WHERE role IN ('super_admin', 'administrador');

-- 3. Atualizar permissões para gerente (Ver e Editar em alguns itens)
-- Supondo que gerente pode criar e editar na maioria, mas talvez não deletar (rever conforme necessidade)
UPDATE public.role_menu_permissions
SET can_create = true, can_edit = true
WHERE role = 'gerente' AND can_view = true 
AND menu_key NOT IN ('configuracoes', 'configuracoes_usuarios', 'configuracoes_permissoes', 'configuracoes_logs');

-- 4. Garantir que as restrições de RLS continuem as mesmas (já aplicadas na migração anterior)
