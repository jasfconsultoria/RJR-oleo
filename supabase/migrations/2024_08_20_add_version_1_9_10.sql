INSERT INTO public.versoes (versao, data_implantacao, descricao)
VALUES ('1.9.10', NOW(), 'Corrigido erro "supabase.auth.user is not a function" nas páginas de Entrada e Saída de Estoque, utilizando user.id do useAuth.')
ON CONFLICT (versao) DO UPDATE SET data_implantacao = NOW(), descricao = EXCLUDED.descricao;