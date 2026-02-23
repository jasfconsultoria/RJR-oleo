CREATE OR REPLACE FUNCTION update_payment(
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
    v_credito_debito_entry record;
    v_new_paid_amount numeric;
    v_new_status text;
    v_other_payments_total numeric;
BEGIN
    -- Find the payment and get its details
    SELECT credito_debito_id, paid_amount INTO v_credito_debito_id, v_original_amount
    FROM public.pagamentos
    WHERE id = payment_id;

    IF v_credito_debito_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pagamento não encontrado.');
    END IF;

    -- Get the main entry
    SELECT * INTO v_credito_debito_entry FROM public.credito_debito WHERE id = v_credito_debito_id;

    -- Validation: Check if the new total paid amount exceeds the total value
    v_other_payments_total := v_credito_debito_entry.paid_amount - v_original_amount;
    IF (v_other_payments_total + new_amount) > v_credito_debito_entry.total_value THEN
        RETURN jsonb_build_object('success', false, 'message', 'O valor total pago não pode exceder o valor da parcela.');
    END IF;

    -- Update the payment
    UPDATE public.pagamentos
    SET
        paid_amount = new_amount,
        payment_date = new_date
    WHERE id = payment_id;

    -- Recalculate total paid amount for the main entry
    v_new_paid_amount := v_other_payments_total + new_amount;

    -- Determine the new status
    IF v_new_paid_amount <= 0 THEN
        v_new_status := 'pending';
    ELSIF v_new_paid_amount < v_credito_debito_entry.total_value THEN
        v_new_status := 'partially_paid';
    ELSE
        v_new_status := 'paid';
    END IF;

    -- Update the main entry
    UPDATE public.credito_debito
    SET
        paid_amount = v_new_paid_amount,
        amount_balance = total_value - v_new_paid_amount,
        status = v_new_status
    WHERE id = v_credito_debito_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento atualizado e saldo recalculado.');
END;
$$;