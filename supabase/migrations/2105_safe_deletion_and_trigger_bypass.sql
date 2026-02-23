-- Migration: Safe Installment Deletion and Trigger Bypass
-- Description: Updates the integrity trigger to support a bypass variable and creates an RPC for safe deletion.

-- 1. Update the Trigger Function to support bypass
CREATE OR REPLACE FUNCTION public.handle_credito_debito_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_payments BOOLEAN;
    v_bypass_integrity BOOLEAN;
BEGIN
    -- Verificar se o bypass está ativo para esta sessão (usado pelo formulário de edição)
    SELECT COALESCE(current_setting('app.bypass_financeiro_integrity', true), 'false') = 'true' INTO v_bypass_integrity;

    IF v_bypass_integrity THEN
        RETURN OLD;
    END IF;

    -- Se pg_trigger_depth() = 1, a deleção foi iniciada pelo usuário/aplicação diretamente nesta linha
    IF pg_trigger_depth() = 1 THEN
        -- 1. REGRA: Somente permite iniciar a exclusão se for a Entrada (0) ou Parcela Única (1/1)
        IF NOT (
            OLD.installment_number = 0 OR 
            (OLD.installment_number = 1 AND OLD.total_installments = 1)
        ) THEN
            RAISE EXCEPTION 'Não é possível excluir parcelas individuais. Para excluir o documento completo, exclua a "Entrada" ou a parcela "1/1".'
                USING ERRCODE = 'P0001';
        END IF;

        -- 2. REGRA: Nenhuma parcela do documento (mesmo lancamento_id) pode ter pagamentos registrados
        SELECT EXISTS (
            SELECT 1 
            FROM public.pagamentos p
            JOIN public.credito_debito cd ON cd.id = p.credito_debito_id
            WHERE cd.lancamento_id = OLD.lancamento_id
        ) INTO v_has_payments;

        IF v_has_payments THEN
            RAISE EXCEPTION 'Não é possível excluir o documento pois existem pagamentos registrados em uma ou mais parcelas. Remova os pagamentos primeiro.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Se passou nas verificações, exclui todas as outras parcelas vinculadas ao mesmo lancamento_id
        -- O pg_trigger_depth() para essas deleções será > 1, então elas passarão sem entrar neste bloco
        DELETE FROM public.credito_debito 
        WHERE lancamento_id = OLD.lancamento_id 
          AND id != OLD.id;
    END IF;

    RETURN OLD;
END;
$$;

-- 2. Create RPC for safe deletion that sets the bypass variable
CREATE OR REPLACE FUNCTION public.delete_installments_safe(p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ativa o bypass para esta transação local
    PERFORM set_config('app.bypass_financeiro_integrity', 'true', true);

    -- Executa a deleção
    DELETE FROM public.credito_debito WHERE id = ANY(p_ids);

    RETURN jsonb_build_object('success', true, 'message', 'Parcelas excluídas com sucesso.');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
