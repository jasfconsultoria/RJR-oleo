-- supabase/migrations/2024_08_19_add_version_1_9_1.sql

INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.1', NOW(), 'Correções na lógica de parcelamento do formulário financeiro:
- A seção de parcelas agora só é exibida após a modificação do campo "Valor de Entrada" para um valor menor que o "Valor Total".
- Corrigido bug que gerava uma parcela indevida quando o valor da entrada era igual ao valor total.');