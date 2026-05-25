-- Fluxo de solicitação de exclusão de coletas por coletores

CREATE TABLE IF NOT EXISTS public.coleta_delete_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    coleta_id uuid REFERENCES public.coletas(id) ON DELETE SET NULL,
    numero_coleta integer,
    cliente_nome text,
    requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    motivo text NOT NULL CHECK (length(trim(motivo)) >= 5),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamp with time zone,
    admin_observacao text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coleta_delete_requests_pending_unique
ON public.coleta_delete_requests (coleta_id)
WHERE status = 'pending' AND coleta_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coleta_delete_requests_status
ON public.coleta_delete_requests (status, created_at DESC);

ALTER TABLE public.coleta_delete_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_request_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_header_user_id text;
BEGIN
    IF v_user_id IS NOT NULL THEN
        RETURN v_user_id;
    END IF;

    BEGIN
        v_header_user_id := current_setting('request.headers', true)::jsonb ->> 'x-user-id';
    EXCEPTION WHEN OTHERS THEN
        v_header_user_id := NULL;
    END;

    IF v_header_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN v_header_user_id::uuid;
    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_review_coleta_delete_requests()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_can_review boolean := false;
BEGIN
    IF public.is_admin() THEN
        RETURN true;
    END IF;

    IF to_regclass('public.profiles') IS NULL THEN
        RETURN false;
    END IF;

    EXECUTE $sql$
        SELECT EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = public.get_request_user_id()
              AND p.role IN ('administrador', 'super_admin', 'gerente')
        )
    $sql$ INTO v_can_review;

    RETURN COALESCE(v_can_review, false);
END;
$$;

DROP POLICY IF EXISTS "Usuários veem solicitações relevantes" ON public.coleta_delete_requests;
CREATE POLICY "Usuários veem solicitações relevantes"
ON public.coleta_delete_requests
FOR SELECT
TO public
USING (
    requested_by = public.get_request_user_id()
    OR public.can_review_coleta_delete_requests()
);

DROP POLICY IF EXISTS "Solicitante cria sua solicitação" ON public.coleta_delete_requests;
CREATE POLICY "Solicitante cria sua solicitação"
ON public.coleta_delete_requests
FOR INSERT
TO public
WITH CHECK (requested_by = public.get_request_user_id());

DROP POLICY IF EXISTS "Administradores revisam solicitações" ON public.coleta_delete_requests;
CREATE POLICY "Administradores revisam solicitações"
ON public.coleta_delete_requests
FOR UPDATE
TO public
USING (public.can_review_coleta_delete_requests())
WITH CHECK (public.can_review_coleta_delete_requests());

CREATE OR REPLACE FUNCTION public.request_coleta_delete(
    p_coleta_id uuid,
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
    v_numero_coleta integer;
    v_cliente_nome text;
    v_coleta_user_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
        RAISE EXCEPTION 'Informe um motivo com pelo menos 5 caracteres.';
    END IF;

    SELECT
        c.numero_coleta,
        COALESCE(cl.nome_fantasia, cl.razao_social, 'Cliente não informado'),
        c.user_id
    INTO v_numero_coleta, v_cliente_nome, v_coleta_user_id
    FROM public.coletas c
    LEFT JOIN public.clientes cl ON cl.id = c.cliente_id
    WHERE c.id = p_coleta_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Coleta não encontrada.';
    END IF;

    IF v_coleta_user_id IS DISTINCT FROM v_user_id
       AND NOT public.can_review_coleta_delete_requests() THEN
        RAISE EXCEPTION 'Você só pode solicitar exclusão de coletas vinculadas ao seu usuário.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.coleta_delete_requests cdr
        WHERE cdr.coleta_id = p_coleta_id
          AND cdr.status = 'pending'
    ) THEN
        RAISE EXCEPTION 'Já existe uma solicitação de exclusão pendente para esta coleta.';
    END IF;

    INSERT INTO public.coleta_delete_requests (
        coleta_id,
        numero_coleta,
        cliente_nome,
        requested_by,
        motivo
    )
    VALUES (
        p_coleta_id,
        v_numero_coleta,
        v_cliente_nome,
        v_user_id,
        trim(p_motivo)
    )
    RETURNING id INTO v_request_id;

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
                'coleta',
                'Exclusão de coleta solicitada',
                'A coleta Nº ' || lpad($1::text, 6, '0') || ' possui uma solicitação de exclusão pendente.',
                '/app/coletas',
                CURRENT_DATE,
                $2
            FROM public.profiles p
            WHERE p.role IN ('administrador', 'super_admin', 'gerente')
        $sql$ USING v_numero_coleta, p_coleta_id;
    END IF;

    RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_coleta_delete_request(
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
    v_request public.coleta_delete_requests%ROWTYPE;
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
    FROM public.coleta_delete_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitação não encontrada.';
    END IF;

    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'Esta solicitação já foi revisada.';
    END IF;

    UPDATE public.coleta_delete_requests
    SET
        status = v_decision,
        reviewed_by = v_reviewer,
        reviewed_at = now(),
        admin_observacao = nullif(trim(COALESCE(p_observacao, '')), ''),
        updated_at = now()
    WHERE id = p_request_id;

    IF v_decision = 'approved' AND v_request.coleta_id IS NOT NULL THEN
        DELETE FROM public.coletas
        WHERE id = v_request.coleta_id;
    END IF;

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
            'coleta',
            CASE
                WHEN v_decision = 'approved' THEN 'Exclusão de coleta aprovada'
                ELSE 'Exclusão de coleta rejeitada'
            END,
            'Sua solicitação de exclusão da coleta Nº ' || lpad(v_request.numero_coleta::text, 6, '0') || ' foi ' ||
                CASE WHEN v_decision = 'approved' THEN 'aprovada.' ELSE 'rejeitada.' END,
            '/app/coletas',
            CURRENT_DATE,
            v_request.coleta_id
        );
    END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.coleta_delete_requests TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_review_coleta_delete_requests() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.request_coleta_delete(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.review_coleta_delete_request(uuid, text, text) TO authenticated, anon;

DROP VIEW IF EXISTS public.v_coletas_com_status CASCADE;

CREATE VIEW public.v_coletas_com_status AS
SELECT
    c.id,
    c.numero_coleta,
    c.cliente_id,
    c.data_coleta,
    c.hora_coleta,
    c.fator,
    c.tipo_coleta,
    c.quantidade_coletada,
    c.quantidade_entregue,
    c.valor_compra,
    c.total_pago,
    c.data_lancamento,
    c.user_id,
    c.estado,
    c.municipio,
    c.created_at,
    c.recipientes_coletados,
    c.recipientes_entregues,
    c.total_recipientes_contrato,
    c.saldo_recipientes_momento,
    cl.nome_fantasia,
    cl.razao_social,
    cl.cnpj_cpf AS cliente_cnpj_cpf,
    cl.endereco AS cliente_endereco,
    cl.email AS cliente_email,
    cl.municipio AS cliente_municipio,
    cl.estado AS cliente_estado,
    cl.telefone AS cliente_telefone,
    r.assinatura_url,
    pending_request.id AS delete_request_id,
    pending_request.status AS delete_request_status,
    pending_request.motivo AS delete_request_motivo,
    pending_request.requested_by AS delete_requested_by,
    pending_request.created_at AS delete_requested_at,
    CASE
        WHEN r.id IS NULL THEN 'nao_gerado'
        WHEN r.assinatura_url IS NULL THEN 'pendente_assinatura'
        ELSE 'assinado'
    END AS status_recibo
FROM public.coletas c
LEFT JOIN public.clientes cl ON c.cliente_id = cl.id
LEFT JOIN public.recibos r ON c.id = r.coleta_id
LEFT JOIN LATERAL (
    SELECT cdr.id, cdr.status, cdr.motivo, cdr.requested_by, cdr.created_at
    FROM public.coleta_delete_requests cdr
    WHERE cdr.coleta_id = c.id
      AND cdr.status = 'pending'
    ORDER BY cdr.created_at DESC
    LIMIT 1
) pending_request ON true;

GRANT SELECT ON public.v_coletas_com_status TO authenticated, anon;
