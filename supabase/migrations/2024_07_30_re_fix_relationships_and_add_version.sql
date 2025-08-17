-- Re-adding foreign key constraint for 'coletas' to 'pessoas' to ensure schema cache refresh
ALTER TABLE public.coletas
DROP CONSTRAINT IF EXISTS coletas_cliente_id_fkey;

ALTER TABLE public.coletas
ADD CONSTRAINT coletas_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

-- Add a new version entry
INSERT INTO public.versoes (versao, data_implantacao, descricao, hash)
VALUES (
    '1.0.4',
    NOW(),
    'Nova tentativa de correção de relacionamento entre tabelas coletas e pessoas, visando forçar a atualização do cache do esquema do banco de dados.',
    '{{GIT_COMMIT_HASH}}'
);