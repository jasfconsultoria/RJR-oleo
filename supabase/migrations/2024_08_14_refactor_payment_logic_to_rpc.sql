-- This migration refactors the payment registration logic into a robust RPC function.
-- It corrects previous errors by:
-- 1. Using the correct table name 'pagamentos' (plural).
-- 2. Explicitly casting the text 'payment_method' from the application to the 'public.payment_method' ENUM type.
-- 3. Handling all calculations and status updates atomically within the function.

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
    -- Step 1: Validate user authentication
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado.');
    END IF;

    -- Step 2: Get the total value of the entry
    SELECT cd.total_value
    INTO entry_total_value
    FROM public.credito_debito cd
    WHERE cd.id = p_credito_debito_id;

    -- Step 3: Insert the new payment record into the 'pagamentos' table
    -- The key fix is here: casting p_payment_method from TEXT to the ENUM type
    INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id, expected_total)
    VALUES (
        p_credito_debito_id,
        p_paid_amount,
        p_payment_date,
        p_payment_method::public.payment_method, -- Explicit cast to the ENUM
        p_notes,
        current_user_id,
        entry_total_value
    )
    RETURNING id INTO new_payment_id;

    -- Step 4: Update the main 'credito_debito' entry atomically
    -- Lock the row to prevent race conditions
    PERFORM * FROM public.credito_debito WHERE id = p_credito_debito_id FOR UPDATE;

    -- Recalculate the total paid amount for the entry
    SELECT COALESCE(SUM(p.paid_amount), 0)
    INTO total_paid_so_far
    FROM public.pagamentos p
    WHERE p.credito_debito_id = p_credito_debito_id;

    -- Calculate the new balance
    new_balance := entry_total_value - total_paid_so_far;

    -- Determine the new status based on the balance
    IF new_balance <= 0.009 THEN
        new_status := 'paid';
    ELSIF total_paid_so_far > 0 THEN
        new_status := 'partially_paid';
    ELSE
        new_status := 'pending';
    END IF;

    -- Apply the updates to the main entry
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
        -- Catch any other potential errors and return a helpful message
        RETURN jsonb_build_object('success', false, 'message', 'Erro interno do banco de dados: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;