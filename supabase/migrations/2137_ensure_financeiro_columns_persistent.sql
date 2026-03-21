-- Migração: Garantir colunas de valor e descontos na tabela credito_debito
-- Esta migração resolve erros 400 (Bad Request) quando o frontend tenta selecionar colunas que podem estar ausentes.

DO $$ 
BEGIN
    -- 1. Colunas de Valor e Acréscimos que podem estar faltando
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

-- Log da versão
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.versoes WHERE versao = '4.9.0') THEN
        INSERT INTO public.versoes (versao, descricao, data_implantacao)
        VALUES ('4.9.0', 'Garantindo colunas de valor e descontos na tabela credito_debito para sanar erros de seleção no frontend.', NOW());
    END IF;
END $$;
