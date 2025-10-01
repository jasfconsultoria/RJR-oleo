-- Adiciona ON DELETE CASCADE para credito_debito referenciando coletas
ALTER TABLE public.credito_debito
DROP CONSTRAINT IF EXISTS credito_debito_coleta_id_fkey;
ALTER TABLE public.credito_debito
ADD CONSTRAINT credito_debito_coleta_id_fkey
FOREIGN KEY (coleta_id) REFERENCES public.coletas(id) ON DELETE CASCADE;

-- Adiciona ON DELETE CASCADE para entrada_saida referenciando coletas
ALTER TABLE public.entrada_saida
DROP CONSTRAINT IF EXISTS entrada_saida_coleta_id_fkey;
ALTER TABLE public.entrada_saida
ADD CONSTRAINT entrada_saida_coleta_id_fkey
FOREIGN KEY (coleta_id) REFERENCES public.coletas(id) ON DELETE CASCADE;

-- Adiciona ON DELETE CASCADE para itens_entrada_saida referenciando entrada_saida
ALTER TABLE public.itens_entrada_saida
DROP CONSTRAINT IF EXISTS itens_entrada_saida_entrada_saida_id_fkey;
ALTER TABLE public.itens_entrada_saida
ADD CONSTRAINT itens_entrada_saida_entrada_saida_id_fkey
FOREIGN KEY (entrada_saida_id) REFERENCES public.entrada_saida(id) ON DELETE CASCADE;

-- Adiciona ON DELETE CASCADE para recibos referenciando coletas
ALTER TABLE public.recibos
DROP CONSTRAINT IF EXISTS recibos_coleta_id_fkey;
ALTER TABLE public.recibos
ADD CONSTRAINT recibos_coleta_id_fkey
FOREIGN KEY (coleta_id) REFERENCES public.coletas(id) ON DELETE CASCADE;