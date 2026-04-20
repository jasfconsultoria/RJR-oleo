-- 2147_fix_storage_and_estoque.sql

-- 1) Recriando regras de RLS simplificadas de storage para focar na sessão e evitar 403 Forbidden Error
DROP POLICY IF EXISTS "Public Upload Contratos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload Contratos" ON storage.objects;

CREATE POLICY "Auth Upload Contratos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos');

-- Garante update, delete e selet genericamente para usuários autenticados para evitar dores de cabeça
DROP POLICY IF EXISTS "Auth Update Contratos" ON storage.objects;
CREATE POLICY "Auth Update Contratos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'contratos');

DROP POLICY IF EXISTS "Auth Delete Contratos" ON storage.objects;
CREATE POLICY "Auth Delete Contratos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'contratos');

DROP POLICY IF EXISTS "Public Read Contratos" ON storage.objects;
CREATE POLICY "Public Read Contratos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'contratos');
