INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.11', NOW(), 'Melhorias na UI dos formulários de movimentação de estoque: removido rótulo duplicado de produto, aumentada altura da lista de itens e reposicionado campo de observação.')
ON CONFLICT (versao) DO UPDATE SET data_implantacao = NOW(), descricao = EXCLUDED.descricao;