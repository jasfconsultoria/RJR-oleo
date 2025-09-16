-- Fix relationship between 'pessoas' and 'contratos'
-- Ensure the foreign key constraint exists and is correctly recognized.
ALTER TABLE public.contratos
DROP CONSTRAINT IF EXISTS contratos_cliente_id_fkey;

ALTER TABLE public.contratos
ADD CONSTRAINT contratos_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

-- Add a new version entry
INSERT INTO public.versoes (versao, data_implantacao, descricao, hash)
VALUES (
    '1.0.2',
    NOW(),
    'Correção de relacionamento entre tabelas pessoas e contratos, e atualização de chaves estrangeiras para coletas e certificados. Melhoria na consistência do banco de dados.',
    '{{GIT_COMMIT_HASH}}'
);