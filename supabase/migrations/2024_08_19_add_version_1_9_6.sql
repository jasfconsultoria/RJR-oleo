-- supabase/migrations/2024_08_19_add_version_1_9_6.sql

INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.6', NOW(), 'Validação Proativa no Formulário Financeiro:
- A verificação que impede o "Valor de Entrada" de ser maior que o "Valor Total" agora acontece em tempo real, assim que o valor é digitado.
- Uma mensagem de erro é exibida imediatamente abaixo do campo, melhorando a experiência do usuário e evitando erros no momento de salvar.');