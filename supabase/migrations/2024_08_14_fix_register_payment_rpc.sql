-- This migration corrects the data type cast within the register_payment function.
-- It ensures that the text input for the payment method is correctly cast to the
-- 'public.payment_method' ENUM type, resolving the "type mismatch" error.

CREATE OR REPLACE FUNCTION public.register_payment(
    p_credito_debito_id UUID,
    p_paid_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT, -- Keep as TEXT for flexibility from client
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    new_payment_id UUID;
    current_user_id UUID := auth.uid();
BEGIN
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado.');
    END IF;

    -- Insert the payment, casting the text parameter to the correct ENUM type 'payment_method'
    INSERT INTO public.pagamento (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
    VALUES (p_credito_debito_id, p_paid_amount, p_payment_date, p_payment_method::public.payment_method, p_notes, current_user_id)
    RETURNING id INTO new_payment_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado com sucesso.', 'payment_id', new_payment_id);
EXCEPTION
    WHEN OTHERS THEN
        -- Provide a more detailed error message for debugging
        RETURN jsonb_build_object('success', false, 'message', 'Erro interno do banco de dados: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;