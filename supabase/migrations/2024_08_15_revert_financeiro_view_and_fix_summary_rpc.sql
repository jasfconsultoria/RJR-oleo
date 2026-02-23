-- 1. Drop the old summary function to avoid signature conflicts
DROP FUNCTION IF EXISTS public.get_financeiro_summary(date,date,text,text,uuid,text);

-- 2. Drop the old view if it exists
DROP VIEW IF EXISTS public.v_financeiro_completo;

-- 3. Create the new view with a LEFT JOIN to payments
CREATE OR REPLACE VIEW public.v_financeiro_completo AS
WITH payment_summary AS (
    SELECT
        pagamentos.credito_debito_id,
        sum(pagamentos.paid_amount) AS total_paid
    FROM
        public.pagamentos
    GROUP BY
        pagamentos.credito_debito_id
)
SELECT
    cd.id,
    cd.lancamento_id,
    cd.type,
    cd.document_number,
    cd.model,
    cd.pessoa_id,
    cd.cliente_fornecedor_name,
    cd.cnpj_cpf,
    cd.description,
    cd.issue_date,
    cd.total_value,
    COALESCE(ps.total_paid, 0::numeric) AS paid_amount,
    (cd.total_value - COALESCE(ps.total_paid, 0::numeric)) AS amount_balance,
    cd.payment_method,
    cd.cost_center,
    cd.notes,
    CASE
        WHEN cd.status = 'canceled' THEN 'canceled'::text
        WHEN (cd.total_value - COALESCE(ps.total_paid, 0::numeric)) <= 0.009 THEN 'paid'::text
        WHEN cd.issue_date < CURRENT_DATE AND (cd.total_value - COALESCE(ps.total_paid, 0::numeric)) > 0.009 THEN 'overdue'::text
        WHEN COALESCE(ps.total_paid, 0::numeric) > 0 THEN 'partially_paid'::text
        ELSE 'pending'::text
    END AS status,
    cd.installment_number,
    cd.total_installments,
    cd.user_id,
    cd.created_at,
    c.nome AS cliente_nome_join
FROM
    credito_debito cd
LEFT JOIN
    clientes c ON cd.pessoa_id = c.id
LEFT JOIN
    payment_summary ps ON cd.id = ps.credito_debito_id;

-- 4. Recreate the summary function to use the new view
CREATE OR REPLACE FUNCTION public.get_financeiro_summary(
    p_start_date date,
    p_end_date date,
    p_type text,
    p_status text,
    p_cliente_id uuid,
    p_search_term text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    summary_data jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total_entries', COUNT(*),
        'total_value', COALESCE(SUM(total_value), 0),
        'total_paid', COALESCE(SUM(paid_amount), 0),
        'total_balance', COALESCE(SUM(amount_balance), 0)
    )
    INTO summary_data
    FROM public.v_financeiro_completo
    WHERE
        type = p_type
        AND (p_start_date IS NULL OR issue_date >= p_start_date)
        AND (p_end_date IS NULL OR issue_date <= p_end_date)
        AND (p_status IS NULL OR p_status = 'all' OR status = p_status)
        AND (p_cliente_id IS NULL OR pessoa_id = p_cliente_id)
        AND (p_search_term IS NULL OR (
            document_number ILIKE '%' || p_search_term || '%' OR
            description ILIKE '%' || p_search_term || '%' OR
            cliente_fornecedor_name ILIKE '%' || p_search_term || '%'
        ));

    RETURN summary_data;
END;
$$;