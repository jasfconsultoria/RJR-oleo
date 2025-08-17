CREATE OR REPLACE FUNCTION delete_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credito_debito_id uuid;
    v_deleted_amount numeric;
    v_credito_debito_entry record;
    v_new_paid_amount numeric;
    v_new_status text;
BEGIN
    -- Find the payment and get its details
    SELECT credito_debito_id, paid_amount INTO v_credito_debito_id, v_deleted_amount
    FROM public.pagamentos
    WHERE id = p_payment_id;

    IF v_credito_debito_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pagamento não encontrado.');
    END IF;

    -- Delete the payment
    DELETE FROM public.pagamentos WHERE id = p_payment_id;

    -- Get the main entry
    SELECT * INTO v_credito_debito_entry FROM public.credito_debito WHERE id = v_credito_debito_id;

    -- Recalculate paid amount
    v_new_paid_amount := v_credito_debito_entry.paid_amount - v_deleted_amount;

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

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento excluído e saldo atualizado.');
END;
$$;