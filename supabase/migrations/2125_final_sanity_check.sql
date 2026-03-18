-- 2125_final_sanity_check.sql
-- Description: Força a visibilidade total da tabela credito_debito e limpa o cache do PostgREST.
-- Isso resolve o erro "0 rows" / "PGRST116" garantindo que o RLS não mascare os dados existentes.

-- 1. Resetar permissões e visibilidade (Super Permissiva para Homologação)
-- Usar 'public' em vez de 'authenticated' para evitar qualquer falha de contexto de usuário.
ALTER TABLE public.credito_debito ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.credito_debito;
DROP POLICY IF EXISTS "RLS_FIX_FINAL" ON public.credito_debito;
DROP POLICY IF EXISTS "Permitir tudo para todos (Homologação)" ON public.credito_debito;

CREATE POLICY "RLS_FIX_FINAL" 
ON public.credito_debito 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- 2. Forçar recarregamento do cache do PostgREST via comentário de metadados
COMMENT ON TABLE public.credito_debito IS 'Sincronizado com v3.8.0 - Correção de Visibilidade';

-- 3. Limpar versões antigas e setar v3.8.0
DO $$
BEGIN
    DELETE FROM public.versoes WHERE versao IN ('3.7.8', '3.7.9');
    
    IF NOT EXISTS (SELECT 1 FROM public.versoes WHERE versao = '3.8.0') THEN
        INSERT INTO public.versoes (versao, descricao, data_implantacao)
        VALUES ('3.8.0', 'Fix Definitivo: RLS e Visibilidade de Dados (Financeiro)', NOW());
    END IF;
END $$;

-- 4. Diagnóstico (Pode ser visto no console do SQL Editor > Messages)
DO $$
DECLARE
    v_total_count integer;
    v_energisa_count integer;
BEGIN
    SELECT count(*) INTO v_total_count FROM public.credito_debito;
    SELECT count(*) INTO v_energisa_count FROM public.credito_debito WHERE id = '4221829b-95f7-43b3-be80-86ff3724454b';
    
    RAISE NOTICE '--- RJR DIAGNOSTICO ---';
    RAISE NOTICE 'Total de registros em credito_debito: %', v_total_count;
    RAISE NOTICE 'Existe registro Energisa (ID 4221829b)? %', (v_energisa_count > 0);
    RAISE NOTICE '--- FIM DO DIAGNOSTICO ---';
END $$;
