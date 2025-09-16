-- Renomeia a tabela 'clientes' para 'pessoas' se ela ainda existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clientes') THEN
        ALTER TABLE public.clientes RENAME TO pessoas;
    END IF;
END
$$;

-- Remove as chaves estrangeiras existentes que podem estar apontando para 'clientes' ou estão incorretas
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_cliente_id_fkey;
ALTER TABLE public.coletas DROP CONSTRAINT IF EXISTS coletas_cliente_id_fkey;
ALTER TABLE public.certificados DROP CONSTRAINT IF EXISTS certificados_cliente_id_fkey;
ALTER TABLE public.credito_debito DROP CONSTRAINT IF EXISTS credito_debito_cliente_fornecedor_id_fkey;

-- Adiciona novas chaves estrangeiras apontando para 'pessoas'
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

-- Adiciona uma nova entrada na tabela de versões
INSERT INTO public.versoes (versao, data_implantacao, descricao, hash)
VALUES (
    '1.0.3',
    NOW(),
    'Renomeação da tabela clientes para pessoas e correção/re-criação de todas as chaves estrangeiras dependentes para garantir a consistência do esquema.',
    '{{GIT_COMMIT_HASH}}'
);