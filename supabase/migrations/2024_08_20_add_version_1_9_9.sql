INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.9', NOW(), 'Implementação das telas de listagem e formulários de Entradas e Saídas de Estoque, incluindo visualização de detalhes.')
ON CONFLICT (versao) DO UPDATE SET data_implantacao = NOW(), descricao = EXCLUDED.descricao;