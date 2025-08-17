-- This migration removes the foreign key relationship between contratos and pessoas
-- to temporarily resolve issues with list views.

ALTER TABLE public.contratos
DROP CONSTRAINT IF EXISTS contratos_cliente_id_fkey;