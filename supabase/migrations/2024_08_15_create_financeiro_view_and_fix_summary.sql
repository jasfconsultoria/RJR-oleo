-- 1. Create the view to simplify queries
CREATE OR REPLACE VIEW public.v_financeiro_completo AS
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
    cd.paid_amount,
    cd.amount_balance,
    cd.payment_method,
    cd.cost_center,
    cd.notes,
    cd.status,
    cd.installment_number,
    cd.total_installments,
    cd.user_id,
    cd.created_at,
    c.nome AS cliente_nome_join
FROM
    credito_debito cd
LEFT JOIN
    clientes c ON cd.pessoa_id = c.id;

-- 2. Drop the old summary function if it exists to avoid signature conflicts
DROP FUNCTION IF EXISTS public.get_financeiro_summary(text,uuid,date,date,text,text);

-- 3. Recreate the summary function using the new view for consistency
CREATE OR REPLACE FUNCTION public.get_financeiro_summary(
    p_type text,
    p_cliente_id uuid DEFAULT NULL,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_search_term text DEFAULT NULL
)
RETURNS TABLE(total_value numeric, total_paid numeric, total_balance numeric)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(vfc.total_value), 0.00) as total_value,
        COALESCE(SUM(vfc.paid_amount), 0.00) as total_paid,
        COALESCE(SUM(vfc.amount_balance), 0.00) as total_balance
    FROM
        public.v_financeiro_completo vfc
    WHERE
        vfc.type = p_type
        AND (p_cliente_id IS NULL OR vfc.pessoa_id = p_cliente_id)
        AND (p_start_date IS NULL OR vfc.issue_date >= p_start_date)
        AND (p_end_date IS NULL OR vfc.issue_date <= p_end_date)
        AND (p_status IS NULL OR vfc.status = p_status)
        AND (
            p_search_term IS NULL OR
            vfc.description ILIKE ('%' || p_search_term || '%') OR
            vfc.cliente_fornecedor_name ILIKE ('%' || p_search_term || '%') OR
            vfc.document_number ILIKE ('%' || p_search_term || '%')
        );
END;
$$;