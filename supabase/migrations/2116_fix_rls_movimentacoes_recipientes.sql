-- EXECUTAR ESTE COMANDO NO SQL EDITOR DO SUPABASE (PROJETO rnuq...)
ALTER TABLE public.movimentacoes_recipientes DISABLE ROW LEVEL SECURITY;

-- 1. Remove TODAS as políticas possíveis para limpar
DROP POLICY IF EXISTS "Enable read access for all active users" ON public.movimentacoes_recipientes;
DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.movimentacoes_recipientes;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.movimentacoes_recipientes;
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.movimentacoes_recipientes;

-- 2. Cria nova política de leitura
CREATE POLICY "Permitir leitura para usuários autenticados" ON public.movimentacoes_recipientes
    FOR SELECT TO authenticated USING (true);

-- 3. Cria nova política de inserção
CREATE POLICY "Permitir inserção para usuários autenticados" ON public.movimentacoes_recipientes
    FOR INSERT TO authenticated WITH CHECK (true);

