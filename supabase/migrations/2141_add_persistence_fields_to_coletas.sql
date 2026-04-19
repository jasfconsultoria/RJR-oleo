-- 2141_add_persistence_fields_to_coletas.sql
-- Adiciona campos para persistir o estado dos recipientes no momento da coleta

ALTER TABLE public.coletas ADD COLUMN IF NOT EXISTS total_recipientes_contrato INTEGER DEFAULT 0;
ALTER TABLE public.coletas ADD COLUMN IF NOT EXISTS saldo_recipientes_momento INTEGER DEFAULT 0;

COMMENT ON COLUMN public.coletas.total_recipientes_contrato IS 'Quantidade total de recipientes permitida pelo contrato no momento da coleta';
COMMENT ON COLUMN public.coletas.saldo_recipientes_momento IS 'Saldo de recipientes do cliente exatamente antes desta coleta ser processada';
