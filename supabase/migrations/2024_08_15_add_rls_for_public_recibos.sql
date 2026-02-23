-- 1. Enable RLS on tables if not already enabled
ALTER TABLE public.coletas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access" ON public.coletas;
DROP POLICY IF EXISTS "Allow public read access" ON public.recibos;
DROP POLICY IF EXISTS "Allow public insert/update access for signing" ON public.recibos;
DROP POLICY IF EXISTS "Allow public read access" ON public.clientes;
DROP POLICY IF EXISTS "Allow public read access" ON public.empresa;

-- 3. Create SELECT policies for anonymous access
CREATE POLICY "Allow public read access" ON public.coletas FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON public.recibos FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON public.clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public read access" ON public.empresa FOR SELECT TO anon USING (true);

-- 4. Create INSERT/UPDATE policies for the recibos table for anonymous access
CREATE POLICY "Allow public insert/update access for signing" ON public.recibos FOR ALL TO anon USING (true) WITH CHECK (true);