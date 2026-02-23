-- Corrigindo get_financeiro_summary para somar corretamente os totais
-- Garantindo que o agrupamento por lancamento_id funcione mesmo se o ID for nulo (fallback para ID da linha)

DROP FUNCTION IF EXISTS public.get_financeiro_summary(date, date, text, text, text, text);
CREATE OR REPLACE FUNCTION public.get_financeiro_summary(
    p_start_date date,
    p_end_date date,
    p_type text,
    p_status text,
    p_client_search_term text,
    p_cost_center text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 AS $function$
 DECLARE
     summary_data jsonb;
 BEGIN
     WITH filtered_data AS (
         SELECT 
             id,
             lancamento_id,
             total_value as gross_val,
             installment_value as part_val,
             COALESCE(discount, 0) as disc_val,
             paid_amount,
             amount_balance
         FROM public.credito_debito
         WHERE
             (p_type IS NULL OR p_type = 'all' OR type = p_type)
             AND (p_start_date IS NULL OR issue_date >= p_start_date)
             AND (p_end_date IS NULL OR issue_date <= p_end_date)
             AND (p_status IS NULL OR p_status = 'all' OR status = p_status::public.pagamento_status)
             AND (p_cost_center IS NULL OR p_cost_center = 'all' OR cost_center = p_cost_center)
             AND (p_client_search_term IS NULL OR (
                 document_number ILIKE '%' || p_client_search_term || '%' OR
                 description ILIKE '%' || p_client_search_term || '%' OR
                 cliente_fornecedor_name ILIKE '%' || p_client_search_term || '%' OR
                 cliente_fornecedor_fantasy_name ILIKE '%' || p_client_search_term || '%'
             ))
     ),
     unique_lancamentos AS (
         -- Crucial: DISTINCT ON lancamento_id para pegar o bruto uma única vez por grupo
         -- Se lancamento_id for nulo, trata cada linha como um lançamento único
         SELECT DISTINCT ON (COALESCE(lancamento_id, id::text::uuid))
             gross_val,
             disc_val
         FROM filtered_data
     )
     SELECT jsonb_build_object(
         'total_entries', (SELECT COUNT(*) FROM filtered_data),
         'valor_documento', COALESCE((SELECT SUM(gross_val) FROM unique_lancamentos), 0),
         'valor_desconto', COALESCE((SELECT SUM(disc_val) FROM unique_lancamentos), 0),
         'total_installment_value', COALESCE((SELECT SUM(part_val) FROM filtered_data), 0),
         'total_paid', COALESCE((SELECT SUM(paid_amount) FROM filtered_data), 0),
         'total_balance', COALESCE((SELECT SUM(amount_balance) FROM filtered_data), 0)
     )
     INTO summary_data;

     RETURN summary_data;
 END;
 $function$;
