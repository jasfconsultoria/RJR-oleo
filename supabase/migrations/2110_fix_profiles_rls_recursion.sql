-- Fix: infinite recursion detected in policy for relation "profiles"
-- Causa: policies que consultam a própria tabela profiles para verificar o role,
-- causando loop infinito ao fazer SELECT/UPDATE na tabela.
-- Solução: remover TODAS as policies atuais e recriar sem sub-queries em profiles.

-- 1. Remover todas as policies existentes na tabela profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- 2. Garantir que RLS está habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Recriar policies SEM recursão
-- Usar auth.jwt() para verificar o role em vez de sub-query em profiles

-- Usuário pode ver/editar seu próprio perfil
CREATE POLICY "profiles_own_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_own_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Administrador e Super Admin podem ver TODOS os perfis
-- Usa auth.jwt() -> app_metadata -> role para evitar recursão
CREATE POLICY "profiles_admin_select_all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('administrador', 'super_admin')
);

-- Administrador e Super Admin podem atualizar QUALQUER perfil
CREATE POLICY "profiles_admin_update_all"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('administrador', 'super_admin')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('administrador', 'super_admin')
);

-- Administrador e Super Admin podem inserir novos perfis
CREATE POLICY "profiles_admin_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('administrador', 'super_admin')
);

-- O trigger handle_new_user precisa de INSERT (roda como SECURITY DEFINER, bypassa RLS)
-- Mas para garantir, liberar INSERT para o próprio usuário também
CREATE POLICY "profiles_own_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
