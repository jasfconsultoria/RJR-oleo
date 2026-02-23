-- Migration para criar a tabela de logs de consulta de CNPJ

CREATE TABLE IF NOT EXISTS public.log_consultas_cnpj (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cnpj text NOT NULL,
    response jsonb NOT NULL,
    user_id uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.log_consultas_cnpj ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários autenticados vejam apenas seus próprios logs (opcional, mas boa prática)
CREATE POLICY "Users can insert their own logs" ON public.log_consultas_cnpj
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own logs" ON public.log_consultas_cnpj
    FOR SELECT USING (auth.uid() = user_id);

-- Comentário na tabela
COMMENT ON TABLE public.log_consultas_cnpj IS 'Tabela para armazenar o histórico de consultas realizadas na API OpenCNPJ para auditoria.';
