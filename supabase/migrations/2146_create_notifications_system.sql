-- Migração para estruturação do Módulo de Notificações Inteligentes

CREATE TABLE IF NOT EXISTS public.notificacoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo text NOT NULL CHECK (tipo IN ('coleta', 'contrato', 'financeiro', 'sistema')),
    titulo text NOT NULL,
    mensagem text NOT NULL,
    is_read boolean DEFAULT false,
    link text,
    gerado_em_data date NOT NULL DEFAULT CURRENT_DATE,
    entidade_referencia_id uuid, -- ID referenciando de qual objeto gerou para não duplicar
    created_at timestamp with time zone DEFAULT now()
);

-- Permissões / RLS
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Limpa políticas se já existirem para permitir re-execução
DROP POLICY IF EXISTS "Usuários veem suas próprias notificações ou as globais" ON public.notificacoes;
CREATE POLICY "Usuários veem suas próprias notificações ou as globais" 
ON public.notificacoes FOR SELECT 
USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Super Admins veem todas" ON public.notificacoes;
CREATE POLICY "Super Admins veem todas"
ON public.notificacoes FOR SELECT
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
);

DROP POLICY IF EXISTS "Usuários podem atualizar leitura das suas" ON public.notificacoes;
CREATE POLICY "Usuários podem atualizar leitura das suas"
ON public.notificacoes FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Super Admins podem deletar qualquer" ON public.notificacoes;
CREATE POLICY "Super Admins podem deletar qualquer"
ON public.notificacoes FOR DELETE
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
);

-- RPC para gerar automaticamente cruzando dados

CREATE OR REPLACE FUNCTION public.gerar_notificacoes_diarias(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
    -- 1. COLETAS
    IF p_role IN ('super_admin', 'administrador', 'gerente') THEN
        -- Consolida total pro Admin caso haja
        INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, link, gerado_em_data, entidade_referencia_id)
        SELECT 
            p_user_id, 
            'coleta', 
            'Resumo de Coletas', 
            'Existem ' || count(*) || ' coletas agendadas para hoje.', 
            '/app/agenda?filter=hoje', 
            v_hoje,
            NULL
        FROM clientes
        WHERE (proxima_coleta_prevista AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje
        HAVING count(*) > 0
        AND NOT EXISTS (
            SELECT 1 FROM notificacoes n WHERE n.user_id = p_user_id AND n.gerado_em_data = v_hoje AND n.tipo = 'coleta' AND n.entidade_referencia_id IS NULL
        );
    ELSIF p_role = 'coletor' THEN
        -- Individual por cliente dele
        INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, link, gerado_em_data, entidade_referencia_id)
        SELECT 
            p_user_id, 
            'coleta', 
            'Coleta Agendada', 
            'Coleta no cliente ' || c.nome_fantasia || ' agendada para hoje.', 
            '/app/agenda?filter=hoje', 
            v_hoje,
            c.id
        FROM clientes c
        WHERE (c.proxima_coleta_prevista AT TIME ZONE 'America/Sao_Paulo')::date = v_hoje
        AND NOT EXISTS (
            SELECT 1 FROM notificacoes n WHERE n.user_id = p_user_id AND n.tipo = 'coleta' AND n.entidade_referencia_id = c.id
        );
    END IF;

    -- 2. CONTRATOS
    IF p_role IN ('super_admin', 'administrador', 'gerente') THEN
        INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, link, gerado_em_data, entidade_referencia_id)
        SELECT 
            p_user_id, 
            'contrato', 
            'Contrato Vencendo', 
            'O contrato ' || c.numero_contrato || ' vencerá dia ' || to_char(c.data_fim, 'DD/MM/YYYY') || '.', 
            '/app/cadastro/contratos', 
            v_hoje,
            c.id
        FROM contratos c
        WHERE c.status = 'Ativo' 
          AND c.data_fim >= v_hoje 
          AND c.data_fim <= (v_hoje + interval '30 days')
        AND NOT EXISTS (
            SELECT 1 FROM notificacoes n WHERE n.user_id = p_user_id AND n.tipo = 'contrato' AND n.entidade_referencia_id = c.id AND n.gerado_em_data = v_hoje
        );
    END IF;

    -- 3. FINANCEIRO
    IF p_role IN ('super_admin', 'administrador', 'gerente') THEN
        INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, link, gerado_em_data, entidade_referencia_id)
        SELECT 
            p_user_id, 
            'financeiro', 
            'Alerta Financeiro', 
            'Atenção! O lançamento ' || COALESCE(f.document_number, 'Sem Nº') || (CASE WHEN f.issue_date < v_hoje THEN ' está em atraso.' ELSE ' vence hoje.' END), 
            '/app/financeiro', 
            v_hoje,
            f.id
        FROM credito_debito f
        WHERE f.status IN ('pending', 'partially_paid') 
          AND f.issue_date <= v_hoje
        AND NOT EXISTS (
            SELECT 1 FROM notificacoes n WHERE n.user_id = p_user_id AND n.tipo = 'financeiro' AND n.entidade_referencia_id = f.id AND n.gerado_em_data = v_hoje
        );
    END IF;

END;
$$;
