-- PASSO 1: Ver a definição atual da função no banco
-- Execute primeiro e verifique o resultado
SELECT pg_get_functiondef(oid)
FROM pg_proc 
WHERE proname = 'create_financeiro_lancamento'
AND pronamespace = 'public'::regnamespace
LIMIT 1;
