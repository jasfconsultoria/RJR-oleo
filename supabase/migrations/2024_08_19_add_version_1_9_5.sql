-- supabase/migrations/2024_08_19_add_version_1_9_5.sql

INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.5', NOW(), 'Melhoria na Clareza do Formulário Financeiro:
- Adicionado um campo "Saldo" calculado (Valor Total - Entrada) para visualização imediata do valor a ser parcelado.
- Reorganizado o layout da seção de pagamento para agrupar campos relacionados, melhorando a usabilidade.');