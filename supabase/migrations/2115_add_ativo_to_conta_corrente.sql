-- Adicionar coluna de controle de status ativo/inativo na tabela conta_corrente
ALTER TABLE public.conta_corrente ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
