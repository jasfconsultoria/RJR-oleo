INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.10', NOW(), 'Tornando o campo Cliente obrigatório nos formulários de Entrada e Saída de Estoque.')
ON CONFLICT (versao) DO UPDATE SET data_implantacao = NOW(), descricao = EXCLUDED.descricao;