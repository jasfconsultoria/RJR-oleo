-- supabase/migrations/2024_08_19_add_version_1_9_4.sql

INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.4', NOW(), 'Validação de Lançamento Financeiro:
- Adicionada uma verificação para impedir que o "Valor de Entrada" seja maior que o "Valor Total" do lançamento.
- O sistema agora exibe uma mensagem de erro e foca no campo de entrada para correção.');