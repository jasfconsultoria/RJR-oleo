-- supabase/migrations/2024_08_19_add_version_1_9_0.sql

INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.0', NOW(), 'Correções no formulário financeiro:
- Detalhes das parcelas agora são exibidos apenas se o valor da entrada for menor que o valor total.
- Campo "Nº do Documento" tornou-se obrigatório.
- Campo "CNPJ/CPF" tornou-se obrigatório e é bloqueado após a seleção de um cliente/fornecedor existente.');