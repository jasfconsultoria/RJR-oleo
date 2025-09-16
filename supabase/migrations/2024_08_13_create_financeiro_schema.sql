-- Drop existing types and tables if they exist to ensure a clean slate
DROP TABLE IF EXISTS public.pagamento;
DROP TABLE IF EXISTS public.credito_debito;
DROP TYPE IF EXISTS public.pagamento_status;
DROP TYPE IF EXISTS public.credito_debito_type;

-- Create ENUM types for status and type
CREATE TYPE public.credito_debito_type AS ENUM ('credito', 'debito');
CREATE TYPE public.pagamento_status AS ENUM ('pending', 'paid', 'partially_paid', 'overdue', 'canceled');

-- Create the credito_debito table
CREATE TABLE public.credito_debito (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type public.credito_debito_type NOT NULL,
    document_number text,
    issue_date date NOT NULL,
    model text,
    pessoa_id uuid,
    cliente_fornecedor_name text NOT NULL,
    cnpj_cpf text,
    description text NOT NULL,
    total_value numeric(15,2) NOT NULL,
    payment_method text,
    cost_center text,
    notes text,
    down_payment numeric(15,2) DEFAULT 0,
    installments_number integer DEFAULT 1,
    status public.pagamento_status DEFAULT 'pending'::public.pagamento_status,
    user_id uuid,
    CONSTRAINT credito_debito_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES public.clientes(id) ON DELETE SET NULL,
    CONSTRAINT credito_debito_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create the pagamento (installments) table
CREATE TABLE public.pagamento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    credito_debito_id uuid NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    expected_amount numeric(15,2) NOT NULL,
    paid_amount numeric(15,2) DEFAULT 0,
    paid_date date,
    status public.pagamento_status DEFAULT 'pending'::public.pagamento_status,
    CONSTRAINT pagamento_credito_debito_id_fkey FOREIGN KEY (credito_debito_id) REFERENCES public.credito_debito(id) ON DELETE CASCADE
);

-- Add RLS policies
ALTER TABLE public.credito_debito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON public.credito_debito FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.pagamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_credito_debito_pessoa_id ON public.credito_debito(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pagamento_credito_debito_id ON public.pagamento(credito_debito_id);