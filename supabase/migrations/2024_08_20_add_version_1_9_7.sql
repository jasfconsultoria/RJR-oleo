INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.7', NOW(), 'Implementação inicial do módulo de Estoque com tabelas de produtos, movimentações e itens, além de view de saldo e produtos iniciais.')
ON CONFLICT (versao) DO UPDATE SET data_implantacao = NOW(), descricao = EXCLUDED.descricao;