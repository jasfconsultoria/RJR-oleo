-- Migração: Criação do sistema de rotas
-- Data: 2026-03-08

-- Tabela de Rotas
CREATE TABLE IF NOT EXISTS public.rotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    coletor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    data_planejada DATE NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_progresso', 'concluida')),
    observacoes TEXT
);

-- Tabela de Clientes na Rota
CREATE TABLE IF NOT EXISTS public.rota_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rota_id UUID REFERENCES public.rotas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluida', 'pulada')),
    data_conclusao TIMESTAMPTZ
);

-- Habilitar RLS
ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota_clientes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS simples (Ajustar conforme necessário)
CREATE POLICY "Permitir leitura para todos os autenticados" ON public.rotas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir inserção para administradores, gerentes e super admins" ON public.rotas
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role::text IN ('super_admin', 'administrador', 'gerente')
        )
    );

CREATE POLICY "Permitir leitura para todos os autenticados" ON public.rota_clientes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir inserção para administradores, gerentes e super admins" ON public.rota_clientes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role::text IN ('super_admin', 'administrador', 'gerente')
        )
    );

-- Comentários para documentação
COMMENT ON TABLE public.rotas IS 'Armazena cabeçalhos de rotas planejadas para coletores.';
COMMENT ON TABLE public.rota_clientes IS 'Armazena os clientes vinculados a uma rota específica.';
