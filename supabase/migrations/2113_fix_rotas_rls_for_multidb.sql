-- Migração para corrigir erro de RLS em ambiente multi-banco (Homologação)
-- Remove a dependência da tabela profiles local para permitir inserção/update por usuários autenticados

-- 1. Remover políticas antigas de 'rotas'
DROP POLICY IF EXISTS "Permitir inserção para administradores, gerentes e super admins" ON public.rotas;
DROP POLICY IF EXISTS "Permitir atualização para administradores, gerentes e super admins" ON public.rotas;
DROP POLICY IF EXISTS "Permitir atualização pelo próprio coletor" ON public.rotas;
DROP POLICY IF EXISTS "Permitir deleção para administradores, gerentes e super admins" ON public.rotas;

-- 2. Criar novas políticas flexíveis para 'rotas'
-- Usamos 'public' porque as requisições de Homologação chegam sem uma sessão JWT válida daquele projeto específico
CREATE POLICY "Permitir tudo para todos (Homologação)" ON public.rotas 
    FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Remover políticas antigas de 'rota_clientes'
DROP POLICY IF EXISTS "Permitir inserção para administradores, gerentes e super admins" ON public.rota_clientes;
DROP POLICY IF EXISTS "Permitir atualização para administradores, gerentes e super admins" ON public.rota_clientes;
DROP POLICY IF EXISTS "Permitir atualização pelo coletor da rota" ON public.rota_clientes;
DROP POLICY IF EXISTS "Permitir deleção para administradores, gerentes e super admins" ON public.rota_clientes;

-- 4. Criar novas políticas flexíveis para 'rota_clientes'
CREATE POLICY "Permitir tudo para todos (Homologação)" ON public.rota_clientes 
    FOR ALL TO public USING (true) WITH CHECK (true);
