-- 2120_fix_financeiro_consistency.sql
-- Description: Padroniza RPCs financeiras, resolve conflitos de nomes de tabelas (pagamento vs pagamentos) e garante permissões.

-- 1. Garantir que a tabela se chama 'pagamentos' (plural) conforme padrões recentes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagamento') 
    AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagamentos') THEN
        ALTER TABLE public.pagamento RENAME TO pagamentos;
    END IF;
END $$;

-- 2. Atualizar get_financeiro_summary para ser SECURITY DEFINER e usar as tabelas corretas
DROP FUNCTION IF EXISTS public.get_financeiro_summary(date, date, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_financeiro_summary(
    p_start_date date, p_end_date date, p_type text, p_status text, 
    p_client_search_term text, p_cost_center text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'valor_documento', COALESCE(SUM(cd.total_value), 0),
        'valor_desconto', COALESCE(SUM(cd.discount), 0),
        'total_installment_value', COALESCE(SUM(cd.installment_value), 0),
        'total_paid', COALESCE(SUM(cd.paid_amount), 0),
        'total_balance', COALESCE(SUM(cd.amount_balance), 0)
    ) INTO result
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
            cd.cliente_fornecedor_name ILIKE '%' || p_client_search_term || '%'
        ));

    RETURN result;
END;
$function$;

-- 3. Garantir que o trigger de atualização de saldo está correto e aponta para 'pagamentos'
CREATE OR REPLACE FUNCTION public.update_credito_debito_on_payment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_paid numeric;
    v_total_value numeric;
BEGIN
    -- Calcula o total pago para o lancamento relacionado
    SELECT COALESCE(SUM(paid_amount), 0)
    INTO v_total_paid
    FROM public.pagamentos
    WHERE credito_debito_id = COALESCE(NEW.credito_debito_id, OLD.credito_debito_id);

    -- Busca o valor total do lancamento
    SELECT installment_value INTO v_total_value
    FROM public.credito_debito
    WHERE id = COALESCE(NEW.credito_debito_id, OLD.credito_debito_id);

    -- Atualiza a tabela credito_debito
    UPDATE public.credito_debito
    SET 
        paid_amount = v_total_paid,
        amount_balance = v_total_value - v_total_paid,
        status = CASE 
            WHEN v_total_paid >= v_total_value THEN 'paid'::public.pagamento_status
            WHEN v_total_paid > 0 THEN 'partially_paid'::public.pagamento_status
            ELSE 'pending'::public.pagamento_status
        END,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.credito_debito_id, OLD.credito_debito_id);

    RETURN NULL;
END;
$function$;

-- Recriar o trigger na tabela correta (pagamentos)
DROP TRIGGER IF EXISTS on_payment_change ON public.pagamentos;
CREATE TRIGGER on_payment_change
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.update_credito_debito_on_payment_change();
