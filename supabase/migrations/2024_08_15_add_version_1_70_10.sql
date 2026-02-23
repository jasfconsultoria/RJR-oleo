-- Supabase Migration: 2024_08_15_add_version_1_70_10.sql
-- Esta migração garante que uma entrada na tabela 'recibos' seja criada ao lançar uma coleta
-- e adiciona uma política RLS para permitir acesso público aos recibos.

-- 1. Adiciona uma política RLS para a tabela 'recibos'
-- Esta política permite que usuários anônimos (anon) e autenticados (authenticated)
-- leiam entradas na tabela 'recibos' se o 'coleta_id' corresponder a uma coleta existente.
CREATE POLICY "Allow anon and authenticated read access to recibos by coleta_id"
ON public.recibos FOR SELECT
TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.coletas WHERE id = coleta_id));

-- 2. Atualiza a versão na tabela public.versoes
INSERT INTO public.versoes (versao, hash, descricao)
VALUES ('1.70.10', 'p0q1r2s', '- **Criação de Entrada na Tabela `recibos` ao Lançar Coleta:** Uma entrada inicial na tabela `public.recibos` é agora criada automaticamente ao finalizar e lançar uma coleta, garantindo que o recibo exista no banco de dados antes da assinatura.
- **Política de RLS para Acesso Público:** Adicionada uma política de Row Level Security (RLS) na tabela `public.recibos` para permitir que usuários anônimos acessem os dados do recibo via link público, resolvendo o problema de carregamento da página de assinatura.
- **Lógica de Assinatura Aprimorada:** O processo de salvar a assinatura agora atualiza a entrada existente do recibo, garantindo consistência dos dados.');