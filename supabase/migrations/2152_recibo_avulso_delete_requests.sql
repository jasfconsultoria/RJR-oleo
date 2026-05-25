-- Fluxo de solicitação de exclusão de recibos avulsos
-- Replica o mesmo padrão de coleta_delete_requests

CREATE TABLE IF NOT EXISTS public.recibo_avulso_delete_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    recibo_avulso_id uuid REFERENCES public.recibos_avulso(id) ON DELETE SET NULL,
    numero_recibo text,
    pessoa_nome text,
    requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    motivo text NOT NULL CHECK (length(trim(motivo)) >= 5),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamp with time zone,
    admin_observacao text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recibo_avulso_delete_requests_pending_unique
ON public.recibo_avulso_delete_requests (recibo_avulso_id)
WHERE status = 'pending' AND recibo_avulso_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recibo_avulso_delete_requests_status
ON public.recibo_avulso_delete_requests (status, created_at DESC);

ALTER TABLE public.recibo_avulso_delete_requests ENABLE ROW LEVEL SECURITY;

-- Reutiliza as funções get_request_user_id() e can_review_coleta_delete_requests() já existentes

DROP POLICY IF EXISTS "Usuários veem solicitações relevantes de recibos avulsos" ON public.recibo_avulso_delete_requests;
CREATE POLICY "Usuários veem solicitações relevantes de recibos avulsos"
ON public.recibo_avulso_delete_requests
FOR SELECT
TO public
USING (
    requested_by = public.get_request_user_id()
    OR public.can_review_coleta_delete_requests()
);

DROP POLICY IF EXISTS "Solicitante cria sua solicitação de recibo avulso" ON public.recibo_avulso_delete_requests;
CREATE POLICY "Solicitante cria sua solicitação de recibo avulso"
ON public.recibo_avulso_delete_requests
FOR INSERT
TO public
WITH CHECK (requested_by = public.get_request_user_id());

DROP POLICY IF EXISTS "Administradores revisam solicitações de recibos avulsos" ON public.recibo_avulso_delete_requests;
CREATE POLICY "Administradores revisam solicitações de recibos avulsos"
ON public.recibo_avulso_delete_requests
FOR UPDATE
TO public
USING (public.can_review_coleta_delete_requests())
WITH CHECK (public.can_review_coleta_delete_requests());

-- Função para solicitar exclusão de recibo avulso
CREATE OR REPLACE FUNCTION public.request_recibo_avulso_delete(
    p_recibo_avulso_id uuid,
    p_motivo text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request_id uuid;
    v_user_id uuid := public.get_request_user_id();
    v_numero_recibo text;
    v_pessoa_nome text;
    v_recibo_user_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
        RAISE EXCEPTION 'Informe um motivo com pelo menos 5 caracteres.';
    END IF;

    SELECT
        r.numero_recibo,
        r.pessoa_nome,
        r.user_id
    INTO v_numero_recibo, v_pessoa_nome, v_recibo_user_id
    FROM public.recibos_avulso r
    WHERE r.id = p_recibo_avulso_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recibo avulso não encontrado.';
    END IF;

    IF v_recibo_user_id IS DISTINCT FROM v_user_id
       AND NOT public.can_review_coleta_delete_requests() THEN
        RAISE EXCEPTION 'Você só pode solicitar exclusão de recibos vinculados ao seu usuário.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.recibo_avulso_delete_requests rdr
        WHERE rdr.recibo_avulso_id = p_recibo_avulso_id
          AND rdr.status = 'pending'
    ) THEN
        RAISE EXCEPTION 'Já existe uma solicitação de exclusão pendente para este recibo.';
    END IF;

    INSERT INTO public.recibo_avulso_delete_requests (
        recibo_avulso_id,
        numero_recibo,
        pessoa_nome,
        requested_by,
        motivo
    )
    VALUES (
        p_recibo_avulso_id,
        v_numero_recibo,
        v_pessoa_nome,
        v_user_id,
        trim(p_motivo)
    )
    RETURNING id INTO v_request_id;

    -- Notificar administradores
    IF to_regclass('public.notificacoes') IS NOT NULL
       AND to_regclass('public.profiles') IS NOT NULL THEN
        EXECUTE $sql$
            INSERT INTO public.notificacoes (
                user_id,
                tipo,
                titulo,
                mensagem,
                link,
                gerado_em_data,
                entidade_referencia_id
            )
            SELECT
                p.id,
                'financeiro',
                'Exclusão de recibo avulso solicitada',
                'O recibo avulso Nº ' || $1 || ' possui uma solicitação de exclusão pendente.',
                '/app/financeiro/recibos-avulsos',
                CURRENT_DATE,
                $2
            FROM public.profiles p
            WHERE p.role IN ('administrador', 'super_admin', 'gerente')
        $sql$ USING v_numero_recibo, p_recibo_avulso_id;
    END IF;

    RETURN v_request_id;
END;
$$;

-- Função para revisar solicitação de exclusão de recibo avulso
CREATE OR REPLACE FUNCTION public.review_recibo_avulso_delete_request(
    p_request_id uuid,
    p_decision text,
    p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request public.recibo_avulso_delete_requests%ROWTYPE;
    v_decision text := lower(trim(p_decision));
    v_reviewer uuid := public.get_request_user_id();
BEGIN
    IF NOT public.can_review_coleta_delete_requests() THEN
        RAISE EXCEPTION 'Apenas administradores podem revisar solicitações de exclusão.';
    END IF;

    IF v_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Decisão inválida.';
    END IF;

    SELECT *
    INTO v_request
    FROM public.recibo_avulso_delete_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitação não encontrada.';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Esta solicitação já foi revisada.';
    END IF;

    UPDATE public.recibo_avulso_delete_requests
    SET
        status = v_decision,
        reviewed_by = v_reviewer,
        reviewed_at = now(),
        admin_observacao = nullif(trim(COALESCE(p_observacao, '')), ''),
        updated_at = now()
    WHERE id = p_request_id;

    IF v_decision = 'approved' AND v_request.recibo_avulso_id IS NOT NULL THEN
        DELETE FROM public.recibos_avulso
        WHERE id = v_request.recibo_avulso_id;
    END IF;

    -- Notificar solicitante
    IF v_request.requested_by IS NOT NULL
       AND to_regclass('public.notificacoes') IS NOT NULL THEN
        INSERT INTO public.notificacoes (
            user_id,
            tipo,
            titulo,
            mensagem,
            link,
            gerado_em_data,
            entidade_referencia_id
        )
        VALUES (
            v_request.requested_by,
            'financeiro',
            CASE
                WHEN v_decision = 'approved' THEN 'Exclusão de recibo avulso aprovada'
                ELSE 'Exclusão de recibo avulso rejeitada'
            END,
            'Sua solicitação de exclusão do recibo avulso Nº ' || v_request.numero_recibo || ' foi ' ||
                CASE WHEN v_decision = 'approved' THEN 'aprovada.' ELSE 'rejeitada.' END,
            '/app/financeiro/recibos-avulsos',
            CURRENT_DATE,
            v_request.recibo_avulso_id
        );
    END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.recibo_avulso_delete_requests TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_recibo_avulso_delete(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.review_recibo_avulso_delete_request(uuid, text, text) TO authenticated, anon;

-- View para recibos avulsos com status de exclusão pendente
DROP VIEW IF EXISTS public.v_recibos_avulso_com_status CASCADE;

CREATE VIEW public.v_recibos_avulso_com_status AS
SELECT
    r.*,
    pending_request.id AS delete_request_id,
    pending_request.status AS delete_request_status,
    pending_request.motivo AS delete_request_motivo,
    pending_request.requested_by AS delete_requested_by,
    pending_request.created_at AS delete_requested_at
FROM public.recibos_avulso r
LEFT JOIN LATERAL (
    SELECT rdr.id, rdr.status, rdr.motivo, rdr.requested_by, rdr.created_at
    FROM public.recibo_avulso_delete_requests rdr
    WHERE rdr.recibo_avulso_id = r.id
      AND rdr.status = 'pending'
    ORDER BY rdr.created_at DESC
    LIMIT 1
) pending_request ON true;

GRANT SELECT ON public.v_recibos_avulso_com_status TO authenticated, anon;
