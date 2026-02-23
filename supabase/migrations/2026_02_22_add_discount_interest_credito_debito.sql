-- Migration: adicionar campos document_value, discount e interest na tabela credito_debito
-- Data: 2026-02-22

-- document_value: valor bruto do documento (antes do desconto)
ALTER TABLE public.credito_debito
  ADD COLUMN IF NOT EXISTS document_value numeric(15,2) DEFAULT 0;

-- discount: valor de desconto aplicado ao documento
ALTER TABLE public.credito_debito
  ADD COLUMN IF NOT EXISTS discount numeric(15,2) DEFAULT 0;

-- interest: valor de juros/acréscimo aplicado ao documento
ALTER TABLE public.credito_debito
  ADD COLUMN IF NOT EXISTS interest numeric(15,2) DEFAULT 0;

-- Atualizar registros existentes: document_value = total_value (sem desconto até agora)
UPDATE public.credito_debito
  SET document_value = total_value
  WHERE document_value IS NULL OR document_value = 0;

-- Comentários de documentação
COMMENT ON COLUMN public.credito_debito.document_value IS 'Valor bruto do documento antes de descontos e juros';
COMMENT ON COLUMN public.credito_debito.discount IS 'Valor de desconto aplicado ao documento';
COMMENT ON COLUMN public.credito_debito.interest IS 'Valor de juros ou acréscimo aplicado ao documento';
