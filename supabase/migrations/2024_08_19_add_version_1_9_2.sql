-- supabase/migrations/2024_08_19_add_version_1_9_2.sql

INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.2', NOW(), 'Ajustes finos na lógica de lançamento financeiro:
- O campo "Valor de Entrada" agora inicia com 0,00 por padrão.
- Um campo "Vencimento" (com padrão de D+30) é exibido para pagamentos únicos (quando a entrada é 0).
- A lógica de exibição da seção de parcelas foi refinada para depender do valor da entrada ser menor que o valor total.');