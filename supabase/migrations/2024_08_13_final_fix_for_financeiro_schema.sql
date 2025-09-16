-- Adiciona a nova versão ao histórico
INSERT INTO public.versoes (versao, descricao, data_implantacao)
VALUES ('1.1.0', 'Correção do módulo financeiro, incluindo relacionamentos de banco de dados e cálculo automático de parcelas. Adicionada a tabela de versões para rastreamento de atualizações.', NOW())
ON CONFLICT (versao) DO NOTHING;

-- Garante um estado limpo, removendo objetos antigos e suas dependências
DROP FUNCTION IF EXISTS public.get_credito_debito_details(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_financeiro_summary(date, date, public.credito_debito_type, public.pagamento_status) CASCADE;
DROP TABLE IF EXISTS public.pagamento CASCADE;
DROP TABLE IF EXISTS public.credito_debito CASCADE;
DROP TYPE IF EXISTS public.pagamento_status CASCADE;
DROP TYPE IF EXISTS public.credito_debito_type CASCADE;

-- Recria os tipos ENUM
CREATE TYPE public.credito_debito_type AS ENUM ('credito', 'debito');
CREATE TYPE public.pagamento_status AS ENUM ('pending', 'paid', 'partially_paid', 'overdue', 'canceled');

-- Recria a tabela credito_debito com o relacionamento correto
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

-- Recria a tabela de pagamentos (parcelas)
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

-- Habilita RLS e cria políticas de acesso
ALTER TABLE public.credito_debito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON public.credito_debito FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users" ON public.pagamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cria índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_credito_debito_pessoa_id ON public.credito_debito(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pagamento_credito_debito_id ON public.pagamento(credito_debito_id);

-- Recria a função para buscar detalhes de um lançamento
CREATE OR REPLACE FUNCTION public.get_credito_debito_details(p_credito_debito_id uuid)
RETURNS TABLE (
    id uuid, document_number text, issue_date date, model text, pessoa_id uuid,
    cliente_fornecedor_name text, cnpj_cpf text, description text, total_value numeric,
    payment_method text, cost_center text, notes text, down_payment numeric,
    installments_number integer, status public.pagamento_status, installments jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.id, cd.document_number, cd.issue_date, cd.model, cd.pessoa_id,
        cd.cliente_fornecedor_name, cd.cnpj_cpf, cd.description, cd.total_value,
        cd.payment_method, cd.cost_center, cd.notes, cd.down_payment,
        cd.installments_number, cd.status,
        (SELECT jsonb_agg(p.* ORDER BY p.installment_number) FROM public.pagamento p WHERE p.credito_debito_id = cd.id) AS installments
    FROM public.credito_debito cd
    WHERE cd.id = p_credito_debito_id;
END;
$$;

-- Recria a função para calcular os totais do dashboard financeiro
CREATE OR REPLACE FUNCTION public.get_financeiro_summary(
    p_start_date date, p_end_date date, p_type public.credito_debito_type, p_status public.pagamento_status
)
RETURNS TABLE (total_entries bigint, total_value numeric, total_paid numeric, total_balance numeric)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(cd.id),
        COALESCE(SUM(cd.total_value), 0),
        COALESCE(SUM(p.total_paid_amount), 0),
        COALESCE(SUM(cd.total_value), 0) - COALESCE(SUM(p.total_paid_amount), 0)
    FROM public.credito_debito cd
    LEFT JOIN (
        SELECT p_inner.credito_debito_id, SUM(p_inner.paid_amount) AS total_paid_amount
        FROM public.pagamento p_inner
        GROUP BY p_inner.credito_debito_id
    ) p ON cd.id = p.credito_debito_id
    WHERE
        cd.type = p_type
        AND (p_start_date IS NULL OR cd.issue_date >= p_start_date)
        AND (p_end_date IS NULL OR cd.issue_date <= p_end_date)
        AND (p_status IS NULL OR cd.status = p_status);
END;
$$;