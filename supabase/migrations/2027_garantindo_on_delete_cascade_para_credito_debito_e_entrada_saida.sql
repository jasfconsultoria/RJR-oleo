-- Garante que a constraint fk_coleta_id em entrada_saida seja removida e recriada com ON DELETE CASCADE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_coleta_id' AND conrelid = 'public.entrada_saida'::regclass) THEN
        ALTER TABLE public.entrada_saida DROP CONSTRAINT fk_coleta_id;
    END IF;
END
$$;

ALTER TABLE public.entrada_saida
ADD CONSTRAINT fk_coleta_id
FOREIGN KEY (coleta_id) REFERENCES public.coletas(id) ON DELETE CASCADE;

-- Garante que a constraint fk_coleta_id em credito_debito seja removida e recriada com ON DELETE CASCADE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_coleta_id' AND conrelid = 'public.credito_debito'::regclass) THEN
        ALTER TABLE public.credito_debito DROP CONSTRAINT fk_coleta_id;
    END IF;
END
$$;

ALTER TABLE public.credito_debito
ADD CONSTRAINT fk_coleta_id
FOREIGN KEY (coleta_id) REFERENCES public.coletas(id) ON DELETE CASCADE;