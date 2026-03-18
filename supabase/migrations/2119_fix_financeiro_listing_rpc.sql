-- 2119_fix_financeiro_listing_rpc.sql
-- Description: Garante que a RPC de listagem financeira funcione corretamente em todos os ambientes, com permissões e tipos explícitos.

DROP FUNCTION IF EXISTS public.get_financeiro_detailed_receipt(date, date, text, text, text, text, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.get_financeiro_detailed_receipt(
    p_start_date date, p_end_date date, p_type text, p_status text, 
    p_client_search_term text, p_cost_center text, p_offset integer, 
    p_limit integer, p_sort_column text, p_sort_direction text
)
 RETURNS TABLE(
    id uuid, lancamento_id uuid, type text, document_number text, model text, 
    pessoa_id uuid, cliente_fornecedor_name text, cliente_fornecedor_fantasy_name text, 
    cnpj_cpf text, description text, issue_date date, 
    total_value numeric, installment_value numeric,
    valor_desconto numeric, paid_amount numeric, amount_balance numeric, 
    payment_method text, cost_center text, notes text, 
    status public.pagamento_status, installment_number integer, 
    total_installments numeric, has_down_payment boolean, user_id uuid, 
    created_at timestamp with time zone, coleta_id uuid, recibo_assinatura_url text
)
 LANGUAGE plpgsql
 SECURITY DEFINER -- Garante acesso às tabelas mesmo que as políticas de RLS sejam restritivas
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        cd.id, cd.lancamento_id, cd.type::text, cd.document_number, cd.model,
        cd.pessoa_id, cd.cliente_fornecedor_name, cd.cliente_fornecedor_fantasy_name,
        cd.cnpj_cpf, cd.description, cd.issue_date,
        cd.total_value,
        COALESCE(cd.installment_value, cd.total_value) as installment_value,
        COALESCE(cd.down_payment, 0) as valor_desconto,
        cd.paid_amount, cd.amount_balance, cd.payment_method, cd.cost_center, cd.notes,
        cd.status, cd.installment_number, cd.total_installments,
        (SELECT COUNT(*) FROM public.credito_debito WHERE credito_debito.lancamento_id = cd.lancamento_id AND credito_debito.installment_number = 0) > 0 AS has_down_payment,
        cd.user_id, cd.created_at, cd.coleta_id, r.assinatura_url
    FROM
        public.credito_debito cd
    LEFT JOIN
        public.recibos r ON cd.coleta_id = r.coleta_id
    WHERE
        cd.type::text = p_type -- Cast explícito para comparação de ENUM com TEXT
        AND (p_start_date IS NULL OR cd.issue_date >= p_start_date)
        AND (p_end_date IS NULL OR cd.issue_date <= p_end_date)
        AND (p_status IS NULL OR p_status = 'all' OR cd.status::text = p_status)
        AND (p_cost_center IS NULL OR p_cost_center = 'all' OR cd.cost_center = p_cost_center)
        AND (p_client_search_term IS NULL OR (
            cd.document_number ILIKE '%' || p_client_search_term || '%' OR
            cd.description ILIKE '%' || p_client_search_term || '%' OR
            cd.cliente_fornecedor_name ILIKE '%' || p_client_search_term || '%' OR
            cd.cliente_fornecedor_fantasy_name ILIKE '%' || p_client_search_term || '%'
        ))
    ORDER BY
        CASE WHEN p_sort_column = 'issue_date' AND p_sort_direction = 'asc' THEN cd.issue_date END ASC,
        CASE WHEN p_sort_column = 'issue_date' AND p_sort_direction = 'desc' THEN cd.issue_date END DESC,
        cd.created_at DESC
    OFFSET p_offset
    LIMIT p_limit;
END;
$function$;

-- Também atualizar a função de contagem por segurança
DROP FUNCTION IF EXISTS public.get_financeiro_detailed_receipt_count(date, date, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_financeiro_detailed_receipt_count(
    p_start_date date, p_end_date date, p_type text, p_status text, 
    p_client_search_term text, p_cost_center text
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_count integer;
BEGIN
    SELECT COUNT(*)
    INTO v_total_count
    FROM public.credito_debito cd
    WHERE
        cd.type::text = p_type
        AND (p_start_date IS NULL OR cd.issue_date >= p_start_date)
        AND (p_end_date IS NULL OR cd.issue_date <= p_end_date)
        AND (p_status IS NULL OR p_status = 'all' OR cd.status::text = p_status)
        AND (p_cost_center IS NULL OR p_cost_center = 'all' OR cd.cost_center = p_cost_center)
        AND (p_client_search_term IS NULL OR (
            cd.document_number ILIKE '%' || p_client_search_term || '%' OR
            cd.description ILIKE '%' || p_client_search_term || '%' OR
            cd.cliente_fornecedor_name ILIKE '%' || p_client_search_term || '%' OR
            cd.cliente_fornecedor_fantasy_name ILIKE '%' || p_client_search_term || '%'
        ));
        
    RETURN v_total_count;
END;
$function$;
