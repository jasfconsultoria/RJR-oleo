-- SQL Migration: Infraestrutura de Múltiplos Ambientes de Banco de Dados
-- Destino: Supabase Produção (Projeto itegudxajerdxhnhlqat)

-- 1. Tabela de Configuração de Ambientes
CREATE TABLE IF NOT EXISTS public.db_environments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('producao', 'homologacao', 'custom')),
    url TEXT NOT NULL,
    anon_key TEXT NOT NULL,
    service_role_key TEXT,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Preferências por Usuário (Roteamento)
CREATE TABLE IF NOT EXISTS public.user_db_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    user_name TEXT,
    url TEXT NOT NULL,
    anon_key TEXT NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Inserir Ambientes Padrão Iniciais
-- Substitui estes valores se houver alteração nas URLs/Keys
INSERT INTO public.db_environments (nome, tipo, url, anon_key, descricao)
VALUES 
('Produção', 'producao', 'https://itegudxajerdxhnhlqat.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZWd1ZHhhamVyZHhobmhscWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODYzMjMsImV4cCI6MjA2OTQ2MjMyM30.7buIgCbI9iwOdd3OFVBxTjF-Yw48aqeX6HxozN53PtA', 'Ambiente Principal de Produção'),
('Homologação', 'homologacao', 'https://lbeolteglljmfbucxhma.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZW9sdGVnbGxqbWZidWN4aG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDk2NzUsImV4cCI6MjA4NzM4NTY3NX0.gXQNaSWh5NKrdku3c3jS4oMyePERQz1Ep3usJkN_F6U', 'Ambiente de Testes / Homologação')
ON CONFLICT DO NOTHING;

-- 4. Segurança (RLS)
ALTER TABLE public.db_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_db_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas para Super Admins (Controle Total)
CREATE POLICY "Super Admins - Acesso Total em db_environments" ON public.db_environments
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Super Admins - Acesso Total em user_db_preferences" ON public.user_db_preferences
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

-- Política para Usuários (Leitura da própria preferência)
CREATE POLICY "Usuários - Ler própria preferência" ON public.user_db_preferences
    FOR SELECT USING (auth.uid() = user_id);
