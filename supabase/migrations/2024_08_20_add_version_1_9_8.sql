INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.8', NOW(), 'Implementação do CRUD completo para o cadastro de Produtos no módulo de Estoque.')
ON CONFLICT (versao) DO UPDATE SET data_implantacao = NOW(), descricao = EXCLUDED.descricao;