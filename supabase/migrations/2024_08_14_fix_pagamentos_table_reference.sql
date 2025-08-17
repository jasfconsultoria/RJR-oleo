-- This migration corrects all references to the payments table from 'pagamento' (singular)
-- to 'pagamentos' (plural) within the register_payment RPC function. It also ensures
-- the 'expected_total' column exists on the correct table before updating the function.

-- Step 1: Ensure the column exists on the correct table 'pagamentos'.
ALTER TABLE public.pagamentos
ADD COLUMN IF NOT EXISTS expected_total NUMERIC NOT NULL DEFAULT 0;

-- Step 2: Update the RPC function with the correct table name 'pagamentos'.
CREATE OR REPLACE FUNCTION public.register_payment(
    p_credito_debito_id UUID,
    p_paid_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    new_payment_id UUID;
    current_user_id UUID := auth.uid();
    total_paid_so_far NUMERIC;
    entry_total_value NUMERIC;
    new_balance NUMERIC;
    new_status public.payment_status;
BEGIN
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado.');
    END IF;

    -- Get the total value of the entry before inserting the payment
    SELECT cd.total_value
    INTO entry_total_value
    FROM public.credito_debito cd
    WHERE cd.id = p_credito_debito_id;

    -- Insert the payment into the correct 'pagamentos' table
    INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id, expected_total)
    VALUES (p_credito_debito_id, p_paid_amount, p_payment_date, p_payment_method::public.payment_method, p_notes, current_user_id, entry_total_value)
    RETURNING id INTO new_payment_id;

    -- Now, update the main entry
    -- Lock the row to prevent race conditions
    PERFORM * FROM public.credito_debito WHERE id = p_credito_debito_id FOR UPDATE;

    -- Calculate the total paid for the entry from the correct 'pagamentos' table
    SELECT COALESCE(SUM(p.paid_amount), 0)
    INTO total_paid_so_far
    FROM public.pagamentos p
    WHERE p.credito_debito_id = p_credito_debito_id;

    -- Calculate the new balance
    new_balance := entry_total_value - total_paid_so_far;

    -- Determine the new status
    IF new_balance <= 0.009 THEN
        new_status := 'paid';
    ELSIF total_paid_so_far > 0 THEN
        new_status := 'partially_paid';
    ELSE
        new_status := 'pending';
    END IF;

    -- Update the credito_debito table
    UPDATE public.credito_debito
    SET
        paid_amount = total_paid_so_far,
        amount_balance = new_balance,
        status = new_status,
        updated_at = NOW()
    WHERE id = p_credito_debito_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado e atualizado com sucesso.', 'payment_id', new_payment_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Erro interno do banco de dados: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;