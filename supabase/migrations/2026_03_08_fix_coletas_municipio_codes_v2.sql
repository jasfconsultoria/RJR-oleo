-- Migração: Ajuste de Municípios (Nome -> Código IBGE) na tabela Coletas
-- Data: 2026-03-08

-- 1. Habilitar extensões necessárias para comparação robusta
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. PRIORIDADE 1: Sincronizar com a tabela de Clientes (que já foi corrigida)
-- Como cada coleta é vinculada a um cliente, o código do município deve ser preferencialmente o mesmo do cadastro do cliente.
UPDATE public.coletas c
SET municipio = cl.municipio
FROM public.clientes cl
WHERE c.cliente_id = cl.id
AND cl.municipio ~ '^[0-9]+$'  -- Cliente já possui código IBGE
AND (c.municipio IS NULL OR c.municipio !~ '^[0-9]+$'); -- Coleta ainda está com nome ou vazia

-- 3. PRIORIDADE 2: Atualizar coletas restantes via correspondência de nomes na tabela municipios
-- Útil para coletas sem cliente_id ou onde o cliente não foi atualizado.
UPDATE public.coletas c
SET municipio = m.codigo::text
FROM public.municipios m
WHERE 
    (c.municipio IS NULL OR c.municipio !~ '^[0-9]+$')
    AND unaccent(lower(trim(c.municipio))) = unaccent(lower(trim(m.municipio)))
    AND (
        c.estado::text = m.uf::text 
        OR c.estado::text = (SELECT sigla::text FROM public.estados WHERE uf::text = m.uf::text LIMIT 1)
    );

-- 4. Documentar a coluna
COMMENT ON COLUMN public.coletas.municipio IS 'Armazena o código IBGE do município.';
