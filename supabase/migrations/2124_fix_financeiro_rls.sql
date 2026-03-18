-- 2124_fix_financeiro_rls.sql
-- Description: Garante que as políticas de RLS permitam o acesso de leitura/escrita para usuários autenticados na tabela credito_debito.
-- Isso resolve o erro 406/PGRST116 (The result contains 0 rows) que ocorre quando a RPC (Security Definer) vê o dado mas a query direta não.

-- 1. Garantir que o RLS está ativado
ALTER TABLE public.credito_debito ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas que podem estar restringindo o acesso (ex: por user_id)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.credito_debito;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credito_debito;
DROP POLICY IF EXISTS "Users can only see their own records" ON public.credito_debito;

-- 3. Criar a política permissiva corrigida
CREATE POLICY "Enable all access for authenticated users" 
ON public.credito_debito 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Registrar a versão
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.versoes WHERE versao = '3.7.9') THEN
        INSERT INTO public.versoes (versao, descricao, data_implantacao)
        VALUES ('3.7.9', 'Correção de RLS na tabela credito_debito - Garantindo visibilidade total para usuários autenticados.', NOW());
    END IF;
END $$;
