-- Rename the 'clientes' table to 'pessoas'
ALTER TABLE public.clientes RENAME TO pessoas;

-- Drop existing foreign key constraints that reference the old 'clientes' table
ALTER TABLE public.coletas DROP CONSTRAINT IF EXISTS coletas_cliente_id_fkey;
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_cliente_id_fkey;
ALTER TABLE public.certificados DROP CONSTRAINT IF EXISTS certificados_cliente_id_fkey;
ALTER TABLE public.credito_debito DROP CONSTRAINT IF EXISTS credito_debito_cliente_fornecedor_id_fkey;

-- Recreate foreign key constraints to reference the new 'pessoas' table
ALTER TABLE public.coletas
ADD CONSTRAINT coletas_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

ALTER TABLE public.contratos
ADD CONSTRAINT contratos_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

ALTER TABLE public.certificados
ADD CONSTRAINT certificados_cliente_id_fkey
FOREIGN KEY (cliente_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

ALTER TABLE public.credito_debito
ADD CONSTRAINT credito_debito_cliente_fornecedor_id_fkey
FOREIGN KEY (cliente_fornecedor_id) REFERENCES public.pessoas(id) ON DELETE RESTRICT;

-- Recreate get_coletas_por_cliente function to use 'pessoas'
DROP FUNCTION IF EXISTS public.get_coletas_por_cliente();
CREATE OR REPLACE FUNCTION public.get_coletas_por_cliente()
 RETURNS TABLE(cliente_id uuid, cliente_nome text, coletas bigint, massa numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.cliente_id,
        p.nome AS cliente_nome,
        COUNT(c.id) AS coletas,
        SUM(c.quantidade_coletada) AS massa
    FROM
        coletas c
    JOIN
        pessoas p ON c.cliente_id = p.id
    GROUP BY
        c.cliente_id, p.nome
    ORDER BY
        massa DESC
    LIMIT 10;
END;
$function$;

-- Recreate get_credito_debito_details function to use 'pessoas' for join if needed, and ensure correct structure
DROP FUNCTION IF EXISTS public.get_credito_debito_details(p_credito_debito_id uuid);
CREATE OR REPLACE FUNCTION public.get_credito_debito_details(p_credito_debito_id uuid)
 RETURNS TABLE(
    id uuid,
    type text,
    document_number text,
    issue_date date,
    model text,
    cliente_fornecedor_id uuid,
    cliente_fornecedor_name text,
    cnpj_cpf text,
    description text,
    total_value numeric,
    payment_method text,
    cost_center text,
    notes text,
    down_payment numeric,
    installments_number integer,
    status text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    installments jsonb
 )
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        cd.id,
        cd.type,
        cd.document_number,
        cd.issue_date,
        cd.model,
        cd.cliente_fornecedor_id,
        cd.cliente_fornecedor_name,
        cd.cnpj_cpf,
        cd.description,
        cd.total_value,
        cd.payment_method,
        cd.cost_center,
        cd.notes,
        cd.down_payment,
        cd.installments_number,
        cd.status,
        cd.created_at,
        cd.updated_at,
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', p.id,
                    'credito_debito_id', p.credito_debito_id,
                    'installment_number', p.installment_number,
                    'due_date', p.due_date,
                    'expected_amount', p.expected_amount,
                    'paid_amount', p.paid_amount,
                    'paid_date', p.paid_date,
                    'status', p.status
                ) ORDER BY p.installment_number
            )
            FROM public.pagamento p
            WHERE p.credito_debito_id = cd.id
        ) AS installments
    FROM
        public.credito_debito cd
    WHERE
        cd.id = p_credito_debito_id;
END;
$function$;

-- Recreate get_financeiro_summary function to ensure it's up-to-date
DROP FUNCTION IF EXISTS public.get_financeiro_summary(p_start_date date, p_end_date date, p_type text, p_status text);
CREATE OR REPLACE FUNCTION public.get_financeiro_summary(
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_type text DEFAULT NULL,
    p_status text DEFAULT NULL
)
 RETURNS TABLE(total_entries bigint, total_value numeric, total_paid numeric, total_balance numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(cd.id) AS total_entries,
        SUM(cd.total_value) AS total_value,
        SUM(COALESCE(p.paid_amount, 0)) AS total_paid,
        SUM(cd.total_value - COALESCE(p.paid_amount, 0)) AS total_balance
    FROM
        public.credito_debito cd
    LEFT JOIN LATERAL (
        SELECT SUM(paid_amount) as paid_amount
        FROM public.pagamento
        WHERE credito_debito_id = cd.id
    ) p ON TRUE
    WHERE
        (p_start_date IS NULL OR cd.issue_date >= p_start_date) AND
        (p_end_date IS NULL OR cd.issue_date <= p_end_date) AND
        (p_type IS NULL OR cd.type = p_type) AND
        (p_status IS NULL OR cd.status = p_status);
END;
$function$;