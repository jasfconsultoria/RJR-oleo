-- Storage RLS para o bucket certificados (mesmo padrão do bucket recibos, migração 2131).
-- Sem políticas em storage.objects, o upload do PDF do certificado falha com:
-- "new row violates row-level security policy".

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados', 'certificados', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Bypass Admin Upload Certificados" ON storage.objects;
CREATE POLICY "Bypass Admin Upload Certificados" ON storage.objects
FOR INSERT TO public
WITH CHECK (
  bucket_id = 'certificados' AND
  public.is_admin()
);

DROP POLICY IF EXISTS "Bypass Admin Update Certificados" ON storage.objects;
CREATE POLICY "Bypass Admin Update Certificados" ON storage.objects
FOR UPDATE TO public
USING (
  bucket_id = 'certificados' AND
  public.is_admin()
);

DROP POLICY IF EXISTS "Public Read Certificados" ON storage.objects;
CREATE POLICY "Public Read Certificados" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'certificados');
