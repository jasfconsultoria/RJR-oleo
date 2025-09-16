-- Remove os tipos antigos, se existirem, para evitar conflitos
DROP TYPE IF EXISTS public.credito_debito_type CASCADE;
DROP TYPE IF EXISTS public.pagamento_status CASCADE;

-- Cria os tipos ENUM com os valores corretos (em minúsculas)
CREATE TYPE public.credito_debito_type AS ENUM ('credito', 'debito');
CREATE TYPE public.pagamento_status AS ENUM ('pending', 'paid', 'partially_paid', 'overdue', 'canceled');

-- Altera as colunas nas suas tabelas para usar os novos tipos de dados
-- Isso vai corrigir a estrutura das tabelas que você criou manualmente
ALTER TABLE public.credito_debito
  ALTER COLUMN type TYPE public.credito_debito_type USING type::text::public.credito_debito_type,
  ALTER COLUMN status TYPE public.pagamento_status USING status::text::public.pagamento_status;

ALTER TABLE public.pagamento
  ALTER COLUMN status TYPE public.pagamento_status USING status::text::public.pagamento_status;