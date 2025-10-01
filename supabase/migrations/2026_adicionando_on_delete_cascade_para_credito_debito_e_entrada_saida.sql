ALTER TABLE public.credito_debito
ADD CONSTRAINT fk_coleta_id
FOREIGN KEY (coleta_id) REFERENCES public.coletas(id) ON DELETE CASCADE;

ALTER TABLE public.entrada_saida
ADD CONSTRAINT fk_coleta_id
FOREIGN KEY (coleta_id) REFERENCES public.coletas(id) ON DELETE CASCADE;