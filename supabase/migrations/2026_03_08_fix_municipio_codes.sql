-- Migração Consolidada: Ajuste de Municípios e Criação do Sistema de Rotas
-- Data: 2026-03-08

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Sistema de Rotas (Corrigindo erro de tabela ausente)
CREATE TABLE IF NOT EXISTS public.rotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    coletor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    data_planejada DATE NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_progresso', 'concluida')),
    observacoes TEXT
);

CREATE TABLE IF NOT EXISTS public.rota_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rota_id UUID REFERENCES public.rotas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida', 'pulada')),
    data_conclusao TIMESTAMPTZ
);

-- Habilitar RLS para Rotas
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_clientes ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir leitura para todos os autenticados' AND tablename = 'rotas') THEN
        CREATE POLICY "Permitir leitura para todos os autenticados" ON public.rotas FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir leitura para todos os autenticados' AND tablename = 'rota_clientes') THEN
        CREATE POLICY "Permitir leitura para todos os autenticados" ON public.rota_clientes FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- 3. Atualizar Municípios (Nome -> Código IBGE) em Clientes
UPDATE public.clientes c
SET municipio = m.codigo
FROM public.municipios m
WHERE 
    -- Só atualiza se não for um código (não numérico)
    c.municipio !~ '^[0-9]+$'
    AND unaccent(lower(trim(c.municipio))) = unaccent(lower(trim(m.municipio)))
    AND (
        c.estado = m.uf 
        OR c.estado = (SELECT sigla FROM public.estados WHERE uf = m.uf LIMIT 1)
    );

-- 4. Atualizar Municípios (Nome -> Código IBGE) em Coletas
UPDATE public.coletas c
SET municipio = m.codigo
FROM public.municipios m
WHERE 
    c.municipio !~ '^[0-9]+$'
    AND unaccent(lower(trim(c.municipio))) = unaccent(lower(trim(m.municipio)))
    AND (
        c.estado = m.uf 
        OR c.estado = (SELECT sigla FROM public.estados WHERE uf = m.uf LIMIT 1)
    );

COMMENT ON COLUMN public.clientes.municipio IS 'Armazena o código IBGE do município.';
COMMENT ON COLUMN public.coletas.municipio IS 'Armazena o código IBGE do município.';
