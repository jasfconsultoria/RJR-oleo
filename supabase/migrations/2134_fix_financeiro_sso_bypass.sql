-- 2134_fix_financeiro_sso_bypass.sql
-- Description: Adiciona políticas de bypass de RLS para as tabelas financeiras (credito_debito e pagamentos)
-- permitindo o acesso via x-admin-bypass em ambientes de homologação.

-- 1. Tabela: credito_debito
DROP POLICY IF EXISTS "Admins can insert credito_debito" ON public.credito_debito;
CREATE POLICY "Admins can insert credito_debito" ON public.credito_debito FOR INSERT TO public WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update credito_debito" ON public.credito_debito;
CREATE POLICY "Admins can update credito_debito" ON public.credito_debito FOR UPDATE TO public USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete credito_debito" ON public.credito_debito;
CREATE POLICY "Admins can delete credito_debito" ON public.credito_debito FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Admins can read credito_debito" ON public.credito_debito;
CREATE POLICY "Admins can read credito_debito" ON public.credito_debito FOR SELECT TO public USING (is_admin());

-- 2. Tabela: pagamentos
DROP POLICY IF EXISTS "Admins can insert pagamentos" ON public.pagamentos;
CREATE POLICY "Admins can insert pagamentos" ON public.pagamentos FOR INSERT TO public WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update pagamentos" ON public.pagamentos;
CREATE POLICY "Admins can update pagamentos" ON public.pagamentos FOR UPDATE TO public USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete pagamentos" ON public.pagamentos;
CREATE POLICY "Admins can delete pagamentos" ON public.pagamentos FOR DELETE TO public USING (is_admin());

DROP POLICY IF EXISTS "Admins can read pagamentos" ON public.pagamentos;
CREATE POLICY "Admins can read pagamentos" ON public.pagamentos FOR SELECT TO public USING (is_admin());

-- 3. Registrar a versão
INSERT INTO public.versoes (versao, hash, descricao)
VALUES ('4.8.2', 'financeiro_sso_bypass', 'Adição de políticas de bypass de RLS para tabelas financeiras para suporte a SSO em homologação.');
