-- supabase/migrations/2024_08_19_add_version_1_9_3.sql

INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.3', NOW(), 'Melhorias na lógica de vencimento do formulário financeiro:
- O campo "Vencimento da Entrada" agora é exibido sempre que um valor de entrada maior que zero é informado, facilitando a visualização para pagamentos parcelados.
- O campo "Vencimento" (com padrão de D+30) continua a ser exibido para pagamentos a prazo sem entrada.');