-- Drop the old view
DROP VIEW IF EXISTS public.v_financeiro_completo;

-- Recreate the view with corrected logic for down payments and a new has_down_payment flag
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
    CASE
        WHEN cd.installment_number = 0 THEN cd.total_value
        ELSE COALESCE(ps.total_paid, 0::numeric)
    END AS paid_amount,
    CASE
        WHEN cd.installment_number = 0 THEN 0::numeric
        ELSE (cd.total_value - COALESCE(ps.total_paid, 0::numeric))
    END AS amount_balance,
    cd.payment_method,
    cd.cost_center,
    cd.notes,
    CASE
        WHEN cd.installment_number = 0 THEN 'paid'::text
        WHEN cd.status = 'canceled' THEN 'canceled'::text
        WHEN (cd.total_value - COALESCE(ps.total_paid, 0::numeric)) <= 0.009 THEN 'paid'::text
        WHEN cd.issue_date < CURRENT_DATE AND (cd.total_value - COALESCE(ps.total_paid, 0::numeric)) > 0.009 THEN 'overdue'::text
        WHEN COALESCE(ps.total_paid, 0::numeric) > 0 THEN 'partially_paid'::text
        ELSE 'pending'::text
    END AS status,
    cd.installment_number,
    cd.total_installments,
    (EXISTS (SELECT 1 FROM credito_debito cd2 WHERE cd2.lancamento_id = cd.lancamento_id AND cd2.installment_number = 0)) AS has_down_payment,
    cd.user_id,
    cd.created_at,
    c.nome AS cliente_nome_join
FROM
    credito_debito cd
LEFT JOIN
    clientes c ON cd.pessoa_id = c.id
LEFT JOIN
    payment_summary ps ON cd.id = ps.credito_debito_id;

-- The summary function uses the view, so it will be automatically corrected. No need to change it.