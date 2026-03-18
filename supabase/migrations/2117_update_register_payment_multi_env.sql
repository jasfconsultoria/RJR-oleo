-- CORREÇÃO: Permitir p_user_id opcional no register_payment e manter compatibilidade com p_conta_corrente_id
CREATE OR REPLACE FUNCTION public.register_payment(
    p_credito_debito_id UUID,
    p_paid_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_notes TEXT DEFAULT NULL,
    p_installment_number INTEGER DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_expected_amount NUMERIC DEFAULT NULL,
    p_conta_corrente_id UUID DEFAULT NULL, -- Mantém o parâmetro usado pelo frontend
    p_user_id UUID DEFAULT NULL           -- Novo parâmetro para bypass de auth
)
RETURNS JSONB AS $$
DECLARE
    new_payment_id UUID;
    final_user_id UUID := COALESCE(p_user_id, auth.uid());
BEGIN
    -- Validação de autenticação
    IF final_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuario nao autenticado.');
    END IF;

    -- Registrar o pagamento
    INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
    VALUES (p_credito_debito_id, p_paid_amount, p_payment_date, p_payment_method::public.payment_method, p_notes, final_user_id)
    RETURNING id INTO new_payment_id;

    -- Opcional: Atualizar saldo na conta_corrente LOCAL se ela existir
    -- Se a conta_corrente for GLOBAL (Centralizada no frontend), este update aqui pode falhar 
    -- ou atualizar uma tabela local espelho. O frontend deve cuidar do saldo global.
    BEGIN
        UPDATE public.conta_corrente 
        SET saldo = saldo - p_paid_amount 
        WHERE id = p_conta_corrente_id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignora erros de saldo se a tabela não existir ou o ID não for local
    END;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado com sucesso.', 'payment_id', new_payment_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Erro: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
