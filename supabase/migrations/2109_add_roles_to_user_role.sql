-- Migração: Adicionar Super Admin e Gerente ao enum user_role
-- Data: 2026-03-08

-- Adicionar 'super_admin' e 'gerente' ao enum user_role
-- Nota: PostgreSQL não permite DROP TYPE CASCADE se houver dependências, 
-- então usamos ALTER TYPE ADD VALUE que é mais seguro para produção.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'gerente';

-- Garantir que as políticas de RLS e funções que usam esses papéis continuem funcionando
-- ou sejam atualizadas para incluir os novos papéis onde apropriado.

COMMENT ON TYPE public.user_role IS 'Papéis do sistema: super_admin, administrador, gerente, coletor';
