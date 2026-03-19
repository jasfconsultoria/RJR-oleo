-- 🛡️ SEGURANÇA: Habilitar Bypass para o Storage no bucket de recibos
-- Autor: Antigravity "Se Vira" Mode

-- Garante que o bucket 'recibos' exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('recibos', 'recibos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para o bucket 'recibos' em storage.objects
-- Como o bypass remove o token real e usa o papel 'anon', precisamos garantir que 
-- o papel anon (public) possa interagir se o bypass estiver presente.

DROP POLICY IF EXISTS "Bypass Admin Upload Recibos" ON storage.objects;
CREATE POLICY "Bypass Admin Upload Recibos" ON storage.objects
FOR INSERT TO public
WITH CHECK (
  bucket_id = 'recibos' AND 
  public.is_admin()
);

DROP POLICY IF EXISTS "Bypass Admin Update Recibos" ON storage.objects;
CREATE POLICY "Bypass Admin Update Recibos" ON storage.objects
FOR UPDATE TO public
USING (
  bucket_id = 'recibos' AND 
  public.is_admin()
);

DROP POLICY IF EXISTS "Public Read Recibos" ON storage.objects;
CREATE POLICY "Public Read Recibos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'recibos');

-- Debug: Logar que a aplicação das políticas de storage foi concluída
-- No Postgres do Supabase, não temos RAISE NOTICE visível facilmente, mas a execução silenciosa indica sucesso.
