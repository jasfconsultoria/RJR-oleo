-- TEST SCRIPT for deletion rules
-- Run this in Supabase SQL Editor AFTER applying the migration 2102_add_financeiro_deletion_rules.sql

DO $$
DECLARE
    v_lancamento_id uuid := gen_random_uuid();
    v_pessoa_id uuid;
BEGIN
    -- 1. Setup: Pegar um cliente qualquer
    SELECT id INTO v_pessoa_id FROM public.clientes LIMIT 1;
    
    -- 2. Inserir um documento com 3 parcelas (0, 1, 2)
    -- Simulando o que a função create_financeiro_lancamento faz
    INSERT INTO public.credito_debito (lancamento_id, type, document_number, client_fornecedor_name, description, issue_date, total_value, installment_value, installment_number, total_installments, status)
    VALUES 
    (v_lancamento_id, 'debito', 'TEST-DEL-001', 'TEST CLIENT', 'Test Document Deletion', CURRENT_DATE, 300, 100, 0, 3, 'paid'),
    (v_lancamento_id, 'debito', 'TEST-DEL-001', 'TEST CLIENT', 'Test Document Deletion', CURRENT_DATE + 30, 300, 100, 1, 3, 'pending'),
    (v_lancamento_id, 'debito', 'TEST-DEL-001', 'TEST CLIENT', 'Test Document Deletion', CURRENT_DATE + 60, 300, 100, 2, 3, 'pending');

    RAISE NOTICE 'Setup concluído: 3 parcelas inseridas para lancamento_id %', v_lancamento_id;

    -- 3. TESTE 1: Tentar excluir a parcela 2 (deve falhar)
    BEGIN
        DELETE FROM public.credito_debito WHERE lancamento_id = v_lancamento_id AND installment_number = 2;
        RAISE EXCEPTION 'TESTE 1 FALHOU: Parcela 2 foi excluída indevidamente.';
    EXCEPTION WHEN OTHERS THEN
        IF SQLSTATE = 'P0001' THEN
            RAISE NOTICE 'TESTE 1 SUCESSO: Exclusão da parcela 2 bloqueada como esperado: %', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Erro inesperado no TESTE 1: % (%)', SQLERRM, SQLSTATE;
        END IF;
    END;

    -- 4. TESTE 2: Excluir a Entrada (0) (deve excluir tudo)
    DELETE FROM public.credito_debito WHERE lancamento_id = v_lancamento_id AND installment_number = 0;
    
    IF EXISTS (SELECT 1 FROM public.credito_debito WHERE lancamento_id = v_lancamento_id) THEN
        RAISE EXCEPTION 'TESTE 2 FALHOU: Ainda existem parcelas relacionadas após excluir a entrada.';
    ELSE
        RAISE NOTICE 'TESTE 2 SUCESSO: Todas as parcelas foram excluídas ao remover a entrada.';
    END IF;

    -- 5. TESTE 3: Parcela única (1/1)
    v_lancamento_id := gen_random_uuid();
    INSERT INTO public.credito_debito (lancamento_id, type, document_number, client_fornecedor_name, description, issue_date, total_value, installment_value, installment_number, total_installments, status)
    VALUES (v_lancamento_id, 'debito', 'TEST-DEL-002', 'TEST CLIENT', 'Test Single Delete', CURRENT_DATE, 100, 100, 1, 1, 'pending');

    DELETE FROM public.credito_debito WHERE lancamento_id = v_lancamento_id;
    
    IF EXISTS (SELECT 1 FROM public.credito_debito WHERE lancamento_id = v_lancamento_id) THEN
        RAISE EXCEPTION 'TESTE 3 FALHOU: Parcela única (1/1) não foi excluída.';
    ELSE
        RAISE NOTICE 'TESTE 3 SUCESSO: Parcela única (1/1) excluída com sucesso.';
    END IF;

    RAISE NOTICE 'TODOS OS TESTES PASSARAM COM SUCESSO!';
END;
$$;
