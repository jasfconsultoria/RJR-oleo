-- Migration: Criar tabela recibos_avulso
-- Esta tabela permite criar recibos avulsos para clientes, fornecedores e coletores
-- sem estar vinculado a uma coleta específica

-- Criar enum para tipo de recibo avulso
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recibo_avulso_tipo') THEN
        CREATE TYPE public.recibo_avulso_tipo AS ENUM ('cliente', 'fornecedor', 'coletor');
    END IF;
END$$;

-- Criar tabela recibos_avulso
CREATE TABLE IF NOT EXISTS public.recibos_avulso (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_recibo text NOT NULL UNIQUE,
    tipo public.recibo_avulso_tipo NOT NULL,
    pessoa_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    pessoa_nome text NOT NULL,
    pessoa_cnpj_cpf text,
    pessoa_endereco text,
    pessoa_municipio text,
    pessoa_estado text,
    pessoa_telefone text,
    pessoa_email text,
    descricao text NOT NULL,
    valor numeric(15,2) NOT NULL DEFAULT 0,
    data_recibo date NOT NULL,
    assinatura_url text,
    observacoes text,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_recibos_avulso_numero ON public.recibos_avulso(numero_recibo);
CREATE INDEX IF NOT EXISTS idx_recibos_avulso_tipo ON public.recibos_avulso(tipo);
CREATE INDEX IF NOT EXISTS idx_recibos_avulso_data ON public.recibos_avulso(data_recibo);
CREATE INDEX IF NOT EXISTS idx_recibos_avulso_pessoa ON public.recibos_avulso(pessoa_id);

-- Habilitar RLS
ALTER TABLE public.recibos_avulso ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Enable all access for authenticated users" 
    ON public.recibos_avulso 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Permitir acesso público para leitura e assinatura
CREATE POLICY "Allow public read access" 
    ON public.recibos_avulso 
    FOR SELECT 
    TO anon 
    USING (true);

CREATE POLICY "Allow public insert/update access for signing" 
    ON public.recibos_avulso 
    FOR ALL 
    TO anon 
    USING (true) 
    WITH CHECK (true);

-- Criar função para gerar número de recibo sequencial
CREATE OR REPLACE FUNCTION generate_recibo_avulso_numero()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    next_num integer;
    formatted_num text;
BEGIN
    -- Buscar o maior número de recibo existente
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_recibo FROM '[0-9]+') AS integer)), 0) + 1
    INTO next_num
    FROM public.recibos_avulso
    WHERE numero_recibo ~ '^[0-9]+$';
    
    -- Formatar com 6 dígitos
    formatted_num := LPAD(next_num::text, 6, '0');
    
    RETURN formatted_num;
END;
$$;

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_recibos_avulso_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_recibos_avulso_updated_at
    BEFORE UPDATE ON public.recibos_avulso
    FOR EACH ROW
    EXECUTE FUNCTION update_recibos_avulso_updated_at();

-- Comentários
COMMENT ON TABLE public.recibos_avulso IS 'Tabela para armazenar recibos avulsos para clientes, fornecedores e coletores';
COMMENT ON COLUMN public.recibos_avulso.numero_recibo IS 'Número único do recibo (gerado automaticamente)';
COMMENT ON COLUMN public.recibos_avulso.tipo IS 'Tipo de recibo: cliente, fornecedor ou coletor';
COMMENT ON COLUMN public.recibos_avulso.assinatura_url IS 'URL da assinatura digital do recibo';
