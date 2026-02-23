-- Migration: Add deletion rules for financial installments
-- Description: Prevents orphan installments and ensures that deleting the entrance deletes the whole document.

CREATE OR REPLACE FUNCTION public.handle_credito_debito_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se pg_trigger_depth() = 1, a deleção foi iniciada pelo usuário/aplicação diretamente nesta linha
    IF pg_trigger_depth() = 1 THEN
        -- REGRA: Somente permite iniciar a exclusão se for a Entrada (0) ou Parcela Única (1/1)
        IF NOT (
            OLD.installment_number = 0 OR 
            (OLD.installment_number = 1 AND OLD.total_installments = 1)
        ) THEN
            RAISE EXCEPTION 'Não é possível excluir parcelas individuais. Para excluir o documento completo, exclua a "Entrada" ou a parcela "1/1".'
                USING ERRCODE = 'P0001';
        END IF;

        -- Exclui todas as outras parcelas vinculadas ao mesmo lancamento_id
        -- O pg_trigger_depth() para essas deleções será > 1, então elas passarão sem entrar neste bloco
        DELETE FROM public.credito_debito 
        WHERE lancamento_id = OLD.lancamento_id 
          AND id != OLD.id;
    END IF;

    RETURN OLD;
END;
$$;

-- Aplica o trigger na tabela credito_debito
DROP TRIGGER IF EXISTS trig_handle_credito_debito_deletion ON public.credito_debito;
CREATE TRIGGER trig_handle_credito_debito_deletion
BEFORE DELETE ON public.credito_debito
FOR EACH ROW
EXECUTE FUNCTION public.handle_credito_debito_deletion();
