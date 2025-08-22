-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create 'produtos' table
CREATE TABLE public.produtos (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome character varying(255) NOT NULL,
    unidade character varying(50) NOT NULL, -- e.g., 'kg', 'litro'
    tipo character varying(50) NOT NULL,    -- 'coletado' or 'novo'
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Ensure unique constraint for product name (moved before INSERT)
ALTER TABLE public.produtos ADD CONSTRAINT produtos_nome_key UNIQUE (nome);

-- Insert initial products
INSERT INTO public.produtos (nome, unidade, tipo, ativo) VALUES
('Óleo de fritura', 'kg', 'coletado', true),
('Óleo novo', 'litro', 'novo', true)
ON CONFLICT (nome) DO NOTHING; -- Now this will work as the unique constraint exists

-- Create 'movement_type' and 'movement_origin' enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type') THEN
        CREATE TYPE public.movement_type AS ENUM ('entrada', 'saida');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_origin') THEN
        CREATE TYPE public.movement_origin AS ENUM ('manual', 'coleta');
    END IF;
END $$;

-- Create 'entrada_saida' table for stock movements
CREATE TABLE public.entrada_saida (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    data timestamp with time zone DEFAULT now() NOT NULL,
    tipo public.movement_type NOT NULL,
    origem public.movement_origin NOT NULL,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL, -- Optional FK to clients
    observacao text,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- User who performed the movement
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create 'itens_entrada_saida' table for items within a movement
CREATE TABLE public.itens_entrada_saida (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    entrada_saida_id uuid REFERENCES public.entrada_saida(id) ON DELETE CASCADE NOT NULL,
    produto_id uuid REFERENCES public.produtos(id) ON DELETE RESTRICT NOT NULL,
    quantidade numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create or replace the 'is_admin' function
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'administrador');
END;
$$;

-- Create a view to calculate the current stock balance for each product
CREATE OR REPLACE VIEW public.v_saldo_produtos AS
SELECT
    p.id AS produto_id,
    p.nome AS produto_nome,
    p.unidade,
    p.tipo AS produto_tipo,
    COALESCE(SUM(CASE WHEN es.tipo = 'entrada' THEN ies.quantidade ELSE 0 END), 0) AS total_entradas,
    COALESCE(SUM(CASE WHEN es.tipo = 'saida' THEN ies.quantidade ELSE 0 END), 0) AS total_saidas,
    COALESCE(SUM(CASE WHEN es.tipo = 'entrada' THEN ies.quantidade ELSE -ies.quantidade END), 0) AS saldo_atual
FROM
    public.produtos p
LEFT JOIN
    public.itens_entrada_saida ies ON p.id = ies.produto_id
LEFT JOIN
    public.entrada_saida es ON ies.entrada_saida_id = es.id
GROUP BY
    p.id, p.nome, p.unidade, p.tipo
ORDER BY
    p.nome;

-- Add RLS policies for new tables
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for admins" ON public.produtos USING (is_admin(auth.uid()));
CREATE POLICY "Enable read access for all users" ON public.produtos FOR SELECT USING (true);

ALTER TABLE public.entrada_saida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for admins" ON public.entrada_saida USING (is_admin(auth.uid()));
CREATE POLICY "Enable read access for all users" ON public.entrada_saida FOR SELECT USING (true);

ALTER TABLE public.itens_entrada_saida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for admins" ON public.itens_entrada_saida USING (is_admin(auth.uid()));
CREATE POLICY "Enable read access for all users" ON public.itens_entrada_saida FOR SELECT USING (true);

-- Add a new version entry
INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.7', NOW(), 'Implementação inicial do módulo de Estoque com tabelas de produtos, movimentações e itens, além de view de saldo e produtos iniciais.')
ON CONFLICT (versao) DO UPDATE SET data_implantacao = NOW(), descricao = EXCLUDED.descricao;