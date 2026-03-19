-- Migration: Ensure all required columns exist in credito_debito
-- This migration fixes the "406 Not Acceptable" error by adding missing columns that the frontend expects.

DO $$ 
BEGIN
    -- 1. Identificadores de Lançamento e Parcelamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'lancamento_id') THEN
        ALTER TABLE public.credito_debito ADD COLUMN lancamento_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'installment_number') THEN
        ALTER TABLE public.credito_debito ADD COLUMN installment_number INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'total_installments') THEN
        ALTER TABLE public.credito_debito ADD COLUMN total_installments INTEGER;
    END IF;

    -- 2. Valores e Saldos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'installment_value') THEN
        ALTER TABLE public.credito_debito ADD COLUMN installment_value NUMERIC(15,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'paid_amount') THEN
        ALTER TABLE public.credito_debito ADD COLUMN paid_amount NUMERIC(15,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'amount_balance') THEN
        ALTER TABLE public.credito_debito ADD COLUMN amount_balance NUMERIC(15,2);
    END IF;

    -- 3. Detalhes de Cliente/Documento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'cliente_fornecedor_fantasy_name') THEN
        ALTER TABLE public.credito_debito ADD COLUMN cliente_fornecedor_fantasy_name TEXT;
    END IF;

    -- 4. Campos de Valor e Acréscimos (Garantir que os de 2026/02/22 existam)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'document_value') THEN
        ALTER TABLE public.credito_debito ADD COLUMN document_value NUMERIC(15,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'discount') THEN
        ALTER TABLE public.credito_debito ADD COLUMN discount NUMERIC(15,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credito_debito' AND column_name = 'interest') THEN
        ALTER TABLE public.credito_debito ADD COLUMN interest NUMERIC(15,2) DEFAULT 0;
    END IF;

END $$;

-- Atualizar índices para as colunas novas
CREATE INDEX IF NOT EXISTS idx_credito_debito_lancamento_id ON public.credito_debito(lancamento_id);

-- Log da versão (Seguro sem depender de constraint UNIQUE)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.versoes WHERE versao = '4.8.1') THEN
        INSERT INTO public.versoes (versao, descricao, data_implantacao, hash)
        VALUES ('4.8.1', 'Sanitização da tabela credito_debito - Garantindo colunas para compatibilidade com o frontend.', NOW(), '9e2a3df9994c012833b71dd1da259ddde93b648a');
    END IF;
END $$;

