-- Habilita a extensão pgcrypto se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum para tipo de lançamento financeiro
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financeiro_type') THEN
        CREATE TYPE public.financeiro_type AS ENUM ('credito', 'debito');
    END IF;
END$$;

-- Enum para status de pagamento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('pending', 'partially_paid', 'paid', 'overdue', 'canceled');
    END IF;
END$$;

-- Tabela Principal de Crédito e Débito
CREATE TABLE IF NOT EXISTS public.credito_debito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lancamento_id UUID NOT NULL,
    type "financeiro_type" NOT NULL,
    document_number TEXT,
    model TEXT,
    pessoa_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    cliente_fornecedor_name TEXT NOT NULL,
    cnpj_cpf TEXT,
    description TEXT NOT NULL,
    issue_date DATE NOT NULL,
    total_value NUMERIC(15, 2) NOT NULL,
    paid_amount NUMERIC(15, 2) DEFAULT 0,
    amount_balance NUMERIC(15, 2),
    payment_method TEXT,
    cost_center TEXT,
    status "payment_status" DEFAULT 'pending',
    installment_number INT,
    total_installments INT,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS public.pagamento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credito_debito_id UUID NOT NULL REFERENCES public.credito_debito(id) ON DELETE CASCADE,
    paid_amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Função Trigger para atualizar credito_debito
CREATE OR REPLACE FUNCTION public.update_credito_debito_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    total_paid_so_far NUMERIC;
    entry_total_value NUMERIC;
    new_balance NUMERIC;
    new_status TEXT;
BEGIN
    -- Calcula o total pago para a entrada de crédito/débito
    SELECT COALESCE(SUM(paid_amount), 0)
    INTO total_paid_so_far
    FROM public.pagamento
    WHERE credito_debito_id = NEW.credito_debito_id;

    -- Obtém o valor total da entrada
    SELECT total_value
    INTO entry_total_value
    FROM public.credito_debito
    WHERE id = NEW.credito_debito_id;

    -- Calcula o novo saldo
    new_balance := entry_total_value - total_paid_so_far;

    -- Determina o novo status
    IF new_balance <= 0.009 THEN -- Adiciona uma pequena tolerância para arredondamento
        new_status := 'paid';
    ELSIF total_paid_so_far > 0 THEN
        new_status := 'partially_paid';
    ELSE
        new_status := 'pending';
    END IF;

    -- Atualiza a tabela credito_debito
    UPDATE public.credito_debito
    SET
        paid_amount = total_paid_so_far,
        amount_balance = new_balance,
        status = new_status::public.payment_status,
        updated_at = NOW()
    WHERE id = NEW.credito_debito_id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro no gatilho update_credito_debito_on_payment: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- Trigger para inserção/atualização
DROP TRIGGER IF EXISTS on_payment_insert_or_update ON public.pagamento;
CREATE TRIGGER on_payment_insert_or_update
AFTER INSERT OR UPDATE ON public.pagamento
FOR EACH ROW
EXECUTE FUNCTION public.update_credito_debito_on_payment();

-- Trigger para deleção
CREATE OR REPLACE FUNCTION public.update_credito_debito_on_payment_delete()
RETURNS TRIGGER AS $$
DECLARE
    total_paid_so_far NUMERIC;
    entry_total_value NUMERIC;
    new_balance NUMERIC;
    new_status TEXT;
BEGIN
    -- Recalcula o total pago
    SELECT COALESCE(SUM(paid_amount), 0)
    INTO total_paid_so_far
    FROM public.pagamento
    WHERE credito_debito_id = OLD.credito_debito_id;

    -- Obtém o valor total da entrada
    SELECT total_value
    INTO entry_total_value
    FROM public.credito_debito
    WHERE id = OLD.credito_debito_id;

    -- Calcula o novo saldo
    new_balance := entry_total_value - total_paid_so_far;

    -- Determina o novo status
    IF new_balance <= 0.009 THEN
        new_status := 'paid';
    ELSIF total_paid_so_far > 0 THEN
        new_status := 'partially_paid';
    ELSE
        new_status := 'pending';
    END IF;

    -- Atualiza a tabela credito_debito
    UPDATE public.credito_debito
    SET
        paid_amount = total_paid_so_far,
        amount_balance = new_balance,
        status = new_status::public.payment_status,
        updated_at = NOW()
    WHERE id = OLD.credito_debito_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payment_delete ON public.pagamento;
CREATE TRIGGER on_payment_delete
AFTER DELETE ON public.pagamento
FOR EACH ROW
EXECUTE FUNCTION public.update_credito_debito_on_payment_delete();

-- Função para buscar resumo financeiro
CREATE OR REPLACE FUNCTION get_financeiro_summary(
    p_start_date DATE,
    p_end_date DATE,
    p_type TEXT,
    p_status TEXT
)
RETURNS TABLE(total_entries BIGINT, total_value NUMERIC, total_paid NUMERIC, total_balance NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS total_entries,
        COALESCE(SUM(cd.total_value), 0) AS total_value,
        COALESCE(SUM(cd.paid_amount), 0) AS total_paid,
        COALESCE(SUM(cd.amount_balance), 0) AS total_balance
    FROM
        credito_debito cd
    WHERE
        cd.type = p_type::financeiro_type AND
        (p_start_date IS NULL OR cd.issue_date >= p_start_date) AND
        (p_end_date IS NULL OR cd.issue_date <= p_end_date) AND
        (p_status IS NULL OR cd.status = p_status::payment_status);
END;
$$ LANGUAGE plpgsql;

-- Nova função RPC para registrar pagamento
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
BEGIN
    -- Check if user is authenticated
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado.');
    END IF;

    -- Insert the payment
    INSERT INTO public.pagamento (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
    VALUES (p_credito_debito_id, p_paid_amount, p_payment_date, p_payment_method, p_notes, current_user_id)
    RETURNING id INTO new_payment_id;

    -- The trigger will handle updating the credito_debito table.

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado com sucesso.', 'payment_id', new_payment_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;