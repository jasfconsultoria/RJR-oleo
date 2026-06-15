-- Re-normalizar municípios legados (nome -> código IBGE) em clientes e coletas
-- Data: 2026-06-15

CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Clientes: nome -> código IBGE
UPDATE public.clientes c
SET municipio = m.codigo::text
FROM public.municipios m
WHERE c.municipio !~ '^[0-9]+$'
  AND unaccent(lower(trim(c.municipio))) = unaccent(lower(trim(m.municipio)))
  AND (
    c.estado::text = m.uf::text
    OR c.estado::text = (SELECT e.sigla::text FROM public.estados e WHERE e.sigla::text = m.uf::text LIMIT 1)
    OR c.estado IS NULL
  );

-- 2. Coletas: sincronizar a partir do cliente vinculado
UPDATE public.coletas c
SET municipio = cl.municipio,
    estado = COALESCE(c.estado, cl.estado)
FROM public.clientes cl
WHERE c.cliente_id = cl.id
  AND cl.municipio ~ '^[0-9]+$'
  AND (c.municipio IS NULL OR c.municipio !~ '^[0-9]+$' OR c.municipio <> cl.municipio);

-- 3. Coletas restantes: nome -> código IBGE via tabela municipios
UPDATE public.coletas c
SET municipio = m.codigo::text
FROM public.municipios m
WHERE (c.municipio IS NULL OR c.municipio !~ '^[0-9]+$')
  AND unaccent(lower(trim(c.municipio))) = unaccent(lower(trim(m.municipio)))
  AND (
    c.estado::text = m.uf::text
    OR c.estado::text = (SELECT e.sigla::text FROM public.estados e WHERE e.sigla::text = m.uf::text LIMIT 1)
    OR c.estado IS NULL
  );

-- Verificação (executar manualmente após migration):
-- SELECT municipio, estado, COUNT(*) FROM public.coletas
-- WHERE municipio ILIKE '%parauapebas%' OR municipio = '1505536'
-- GROUP BY municipio, estado;
