-- Migration: Comprehensive Fix for Financial Balance and Table Logic
-- Description: Fixes triggers, balance calculation, and RPCs for the 'pagamentos' system.

-- 1. Create or Replace Function for Triggers (Centralized Balance Logic)
CREATE OR REPLACE FUNCTION public.update_credito_debito_on_payment_change()
RETURNS TRIGGER AS $$
DECLARE
    v_credito_debito_id UUID;
    v_total_paid_so_far NUMERIC;
    v_entry_installment_value NUMERIC;
    v_new_balance NUMERIC;
    v_new_status TEXT;
BEGIN
    -- Determina o ID do registro pai
    IF (TG_OP = 'DELETE') THEN
        v_credito_debito_id := OLD.credito_debito_id;
    ELSE
        v_credito_debito_id := NEW.credito_debito_id;
    END IF;

    -- Calcula o total pago para esta parcela específica
    SELECT COALESCE(SUM(paid_amount), 0)
    INTO v_total_paid_so_far
    FROM public.pagamentos
    WHERE credito_debito_id = v_credito_debito_id;

    -- Obtém o valor da PARCELA (installment_value)
    SELECT installment_value
    INTO v_entry_installment_value
    FROM public.credito_debito
    WHERE id = v_credito_debito_id;

    -- Caso não encontre a entrada (exclusão em cascata talvez?), sai
    IF v_entry_installment_value IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calcula o novo saldo baseado na PARCELA
    v_new_balance := v_entry_installment_value - v_total_paid_so_far;

    -- Determina o novo status
    IF v_new_balance <= 0.009 THEN 
        v_new_status := 'paid';
    ELSIF v_total_paid_so_far > 0 THEN
        v_new_status := 'partially_paid';
    ELSE
        v_new_status := 'pending';
    END IF;

    -- Atualiza o registro pai
    UPDATE public.credito_debito
    SET
        paid_amount = v_total_paid_so_far,
        amount_balance = v_new_balance,
        status = v_new_status::public.pagamento_status,
        updated_at = NOW()
    WHERE id = v_credito_debito_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach triggers to 'pagamentos' (and clean up old table if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagamento') THEN
        DROP TRIGGER IF EXISTS on_payment_insert_or_update ON public.pagamento;
        DROP TRIGGER IF EXISTS on_payment_delete ON public.pagamento;
    END IF;
END $$;
DROP TRIGGER IF EXISTS on_payment_change ON public.pagamentos;

CREATE TRIGGER on_payment_change
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_credito_debito_on_payment_change();

-- 3. Fix update_payment RPC
CREATE OR REPLACE FUNCTION public.update_payment(
    payment_id uuid, 
    new_amount numeric, 
    new_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credito_debito_id uuid;
    v_original_amount numeric;
    v_installment_value numeric;
    v_other_payments_total numeric;
BEGIN
    -- Busca o pagamento e o valor da parcela vinculada
    SELECT p.credito_debito_id, p.paid_amount, cd.installment_value 
    INTO v_credito_debito_id, v_original_amount, v_installment_value
    FROM public.pagamentos p
    JOIN public.credito_debito cd ON cd.id = p.credito_debito_id
    WHERE p.id = payment_id;

    IF v_credito_debito_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pagamento não encontrado.');
    END IF;

    -- Validação: O novo total não pode exceder o valor da parcela
    SELECT COALESCE(SUM(paid_amount), 0) - v_original_amount
    INTO v_other_payments_total
    FROM public.pagamentos
    WHERE credito_debito_id = v_credito_debito_id;

    IF (v_other_payments_total + new_amount) > (v_installment_value + 0.01) THEN
        RETURN jsonb_build_object('success', false, 'message', 'O valor total pago não pode exceder o valor da parcela (R$ ' || v_installment_value || ').');
    END IF;

    -- Atualiza o pagamento. O gatilho 'on_payment_change' cuidará de atualizar o saldo em credito_debito.
    UPDATE public.pagamentos
    SET
        paid_amount = new_amount,
        payment_date = new_date,
        updated_at = NOW()
    WHERE id = payment_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento atualizado com sucesso.');
END;
$$;

-- 4. Fix delete_payment RPC
CREATE OR REPLACE FUNCTION public.delete_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verifica existência
    IF NOT EXISTS (SELECT 1 FROM public.pagamentos WHERE id = p_payment_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pagamento não encontrado.');
    END IF;

    -- Deleta o pagamento. O gatilho 'on_payment_change' cuidará de atualizar o saldo em credito_debito.
    DELETE FROM public.pagamentos WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento excluído com sucesso.');
END;
$$;
