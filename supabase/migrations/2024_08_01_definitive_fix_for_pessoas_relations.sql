-- Migration to definitively fix all relationships pointing to the 'pessoas' table.

-- Step 1: Ensure the table is named 'pessoas'.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes') THEN
        ALTER TABLE public.clientes RENAME TO pessoas;
    END IF;
END
$$;

-- Step 2: Drop all potentially conflicting foreign key constraints.
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_cliente_id_fkey;
ALTER TABLE public.coletas DROP CONSTRAINT IF EXISTS coletas_cliente_id_fkey;
ALTER TABLE public.certificados DROP CONSTRAINT IF EXISTS certificados_cliente_id_fkey;
ALTER TABLE public.credito_debito DROP CONSTRAINT IF EXISTS credito_debito_cliente_fornecedor_id_fkey;

-- Step 3: Recreate all foreign key constraints correctly pointing to 'pessoas.id'.
ALTER TABLE public.contratos
ADD CONSTRAINT contratos_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

ALTER TABLE public.coletas
ADD CONSTRAINT coletas_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

ALTER TABLE public.certificados
ADD CONSTRAINT certificados_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

ALTER TABLE public.credito_debito
ADD CONSTRAINT credito_debito_cliente_fornecedor_id_fkey
FOREIGN KEY (cliente_fornecedor_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

-- Step 4: Add a new version entry to track this definitive fix.
INSERT INTO public.versoes (versao, data_implantacao, descricao, hash)
VALUES (
    '1.0.6',
    NOW(),
    'Correção definitiva dos relacionamentos com a tabela `pessoas`. Remove e recria todas as chaves estrangeiras para garantir a consistência do esquema e limpar o cache do Supabase.',
    '{{GIT_COMMIT_HASH}}'
)
ON CONFLICT (versao) DO NOTHING;