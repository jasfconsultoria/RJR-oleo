INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Upload Contratos" ON storage.objects;
CREATE POLICY "Public Upload Contratos" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'contratos');

DROP POLICY IF EXISTS "Public Update Contratos" ON storage.objects;
CREATE POLICY "Public Update Contratos" ON storage.objects
FOR UPDATE TO public
USING (bucket_id = 'contratos');

DROP POLICY IF EXISTS "Public Read Contratos" ON storage.objects;
CREATE POLICY "Public Read Contratos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'contratos');
