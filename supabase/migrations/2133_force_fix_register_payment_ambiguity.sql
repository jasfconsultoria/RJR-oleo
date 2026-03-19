-- 🛡️ SEGURANÇA: LIMPEZA TOTAL DE register_payment
-- Autor: Antigravity "Se Vira" Mode

-- Este script é mais agressivo e deve ser executado para resolver o erro PGRST203 definitivamente.

-- 1. Remove qualquer função chamada register_payment, independente dos parâmetros
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'register_payment'
    ) LOOP
        EXECUTE 'DROP FUNCTION public.' || quote_ident(func_record.proname) || '(' || func_record.argtypes || ') CASCADE';
    END LOOP;
END $$;

-- 2. Recria a versão ÚNICA e DEFINITIVA (10 parâmetros)
CREATE OR REPLACE FUNCTION public.register_payment(
    p_credito_debito_id UUID,
    p_paid_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_notes TEXT DEFAULT NULL,
    p_installment_number INTEGER DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_expected_amount NUMERIC DEFAULT NULL,
    p_conta_corrente_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    new_payment_id UUID;
    final_user_id UUID := COALESCE(p_user_id, auth.uid());
BEGIN
    -- Validação
    IF final_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado.');
    END IF;

    -- Registrar pagamento
    INSERT INTO public.pagamentos (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
    VALUES (p_credito_debito_id, p_paid_amount, p_payment_date, p_payment_method::public.payment_method, p_notes, final_user_id)
    RETURNING id INTO new_payment_id;

    -- Update conta_corrente LOCAL se ID for fornecido
    IF p_conta_corrente_id IS NOT NULL THEN
        BEGIN
            UPDATE public.conta_corrente 
            SET saldo = saldo - p_paid_amount 
            WHERE id = p_conta_corrente_id;
        EXCEPTION WHEN OTHERS THEN
            -- Ignora erros se a tabela não existir
        END;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado com sucesso.', 'payment_id', new_payment_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Erro: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
