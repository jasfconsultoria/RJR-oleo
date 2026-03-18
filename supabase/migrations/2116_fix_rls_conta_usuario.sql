-- Habilitar RLS e adicionar política para conta_usuario
ALTER TABLE public.conta_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso total para autenticados" ON public.conta_usuario;
CREATE POLICY "Permitir acesso total para autenticados" ON public.conta_usuario
FOR ALL TO authenticated USING (true) WITH CHECK (true);
