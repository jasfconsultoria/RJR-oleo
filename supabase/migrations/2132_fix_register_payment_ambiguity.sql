-- 🛡️ SEGURANÇA: Resolver ambiguidade na função register_payment
-- Autor: Antigravity "Se Vira" Mode

-- O erro PGRST203 ocorre porque existem duas versões da função que aceitam os mesmos parâmetros nomeados.
-- Vamos remover a versão de 9 parâmetros, deixando apenas a de 10 parâmetros (que possui p_user_id opcional).

DROP FUNCTION IF EXISTS public.register_payment(
    uuid,    -- p_credito_debito_id
    numeric, -- p_paid_amount
    date,    -- p_payment_date
    text,    -- p_payment_method
    text,    -- p_notes
    integer, -- p_installment_number
    date,    -- p_due_date
    numeric, -- p_expected_amount
    uuid     -- p_conta_corrente_id
);

-- Garantir que a versão de 10 parâmetros existe e está correta
-- (Re-aplicando a lógica da 2128/2117 para segurança)
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

    -- Opcional: Atualizar saldo na conta_corrente LOCAL se ela existir
    IF p_conta_corrente_id IS NOT NULL THEN
        BEGIN
            UPDATE public.conta_corrente 
            SET saldo = saldo - p_paid_amount 
            WHERE id = p_conta_corrente_id;
        EXCEPTION WHEN OTHERS THEN
            -- Ignora erros se a tabela não existir ou o ID não for local
        END;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado com sucesso.', 'payment_id', new_payment_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Erro: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
