-- =========================================================================================
-- SCRIPT DE SEGURANÇA VIA JWT (AUTORIZAÇÃO POR ROLE) - SEM TABELA LOCAL
-- =========================================================================================
-- Instruções:
-- 1. Copie o conteúdo deste script.
-- 2. No Dashboard do Supabase, selecione o projeto de HOMOLOGAÇÃO.
-- 3. Vá em "SQL Editor" -> "New Query".
-- 4. Cole e execute este script.
--
-- Este script permite que o banco de homologação autorize administradores que venham 
-- de outro ambiente (Produção) através das informações (claims) contidas no Token (JWT).
-- =========================================================================================

-- GARANTIR QUE A FUNÇÃO IS_ADMIN LEIA O PAPEL (ROLE) DIRETAMENTE DO TOKEN (JWT)
-- Isso remove totalmente a necessidade de ter uma cópia da tabela 'profiles' em homologação.
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Em homologação, verificamos apenas as claims do JWT enviado na requisição.
  -- Se o papel for 'administrador' ou 'super_admin' no metadata do token, permitimos.
  -- Usamos auth.jwt() para ler as informações de app_metadata injetadas pelo Supabase Auth.
  RETURN (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'administrador' 
    OR 
    auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin'
  );
END;
$$;

-- ATUALIZAR POLÍTICAS DE RLS PARA GARANTIR QUE ESTEJAM USANDO A FUNÇÃO CORRETA
-- O Supabase converte USING internamente para WITH CHECK quando necessário no INSERT.

DROP POLICY IF EXISTS "Enable all for admins" ON public.entrada_saida;
CREATE POLICY "Enable all for admins" ON public.entrada_saida 
FOR ALL TO authenticated 
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Enable all for admins" ON public.itens_entrada_saida;
CREATE POLICY "Enable all for admins" ON public.itens_entrada_saida 
FOR ALL TO authenticated 
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Enable all for admins" ON public.produtos;
CREATE POLICY "Enable all for admins" ON public.produtos 
FOR ALL TO authenticated 
USING (public.is_admin(auth.uid()));

-- Comentário para fins de confirmação no console do SQL
SELECT 'RLS Atualizada com sucesso! Autenticação baseada em JWT Claims (App Metadata).' as status;
