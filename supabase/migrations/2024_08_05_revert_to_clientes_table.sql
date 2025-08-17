-- This migration reverts the database structure back to using the 'clientes' table.

-- Step 1: Drop the views that depend on the 'pessoas' table.
DROP VIEW IF EXISTS public.clientes;
DROP VIEW IF EXISTS public.fornecedores;

-- Step 2: Rename the 'pessoas' table back to 'clientes'.
ALTER TABLE IF EXISTS public.pessoas RENAME TO clientes;

-- Step 3: Drop potentially incorrect foreign key constraints.
ALTER TABLE public.coletas DROP CONSTRAINT IF EXISTS coletas_cliente_id_fkey;
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_cliente_id_fkey;
ALTER TABLE public.certificados DROP CONSTRAINT IF EXISTS certificados_cliente_id_fkey;
ALTER TABLE public.credito_debito DROP CONSTRAINT IF EXISTS credito_debito_cliente_fornecedor_id_fkey;

-- Step 4: Re-establish correct foreign key relationships to the 'clientes' table.
ALTER TABLE public.coletas
ADD CONSTRAINT coletas_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
ON DELETE SET NULL;

ALTER TABLE public.contratos
ADD CONSTRAINT contratos_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
ON DELETE CASCADE;

ALTER TABLE public.certificados
ADD CONSTRAINT certificados_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
ON DELETE CASCADE;

ALTER TABLE public.credito_debito
ADD CONSTRAINT credito_debito_cliente_fornecedor_id_fkey
FOREIGN KEY (cliente_fornecedor_id) REFERENCES public.clientes(id)
ON DELETE SET NULL;