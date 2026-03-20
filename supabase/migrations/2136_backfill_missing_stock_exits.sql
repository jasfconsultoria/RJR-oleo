-- Migração de Backfill para criar saídas de estoque ausentes
-- Alvo: Coletas de tipo 'Troca' que possuem recibo assinado, mas não possuem registro de saída de óleo novo.

DO $$
DECLARE
    v_coleta RECORD;
    v_oleo_so_novo_id UUID;
    v_entrada_saida_id UUID;
    v_formatted_numero_coleta TEXT;
    v_count_created INTEGER := 0;
BEGIN
    -- Obter o ID do produto de óleo novo
    v_oleo_so_novo_id := public.get_product_id_by_name_and_type('Óleo de soja novo (900ml)', 'novo');

    IF v_oleo_so_novo_id IS NULL THEN
        RAISE EXCEPTION 'Produto "Óleo de soja novo (900ml)" não encontrado no banco de dados. Abortando backfill.';
    END IF;

    RAISE NOTICE 'Iniciando backfill para produto ID: %', v_oleo_so_novo_id;

    -- Loop por todas as coletas de Troca que possuem recibo assinado
    FOR v_coleta IN (
        SELECT 
            c.id, c.data_coleta, c.numero_coleta, c.cliente_id, c.user_id, c.quantidade_entregue
        FROM public.coletas c
        JOIN public.recibos r ON c.id = r.coleta_id
        WHERE c.tipo_coleta = 'Troca'
          AND c.quantidade_entregue > 0
          AND r.assinatura_url IS NOT NULL
          -- Filtro para garantir que não temos uma saída vinculada a esta coleta para este produto
          AND NOT EXISTS (
              SELECT 1 
              FROM public.entrada_saida es
              JOIN public.itens_entrada_saida ies ON es.id = ies.entrada_saida_id
              WHERE es.coleta_id = c.id
                AND es.tipo = 'saida'
                AND ies.produto_id = v_oleo_so_novo_id
          )
        ORDER BY c.data_coleta ASC
    ) LOOP
        v_formatted_numero_coleta := LPAD(v_coleta.numero_coleta::text, 6, '0');

        RAISE NOTICE 'Criando saída ausente para Coleta Nº % (ID: %)', v_formatted_numero_coleta, v_coleta.id;

        -- Criar o cabeçalho da movimentação
        INSERT INTO public.entrada_saida (
            data, tipo, origem, cliente_id, observacao, user_id, document_number, coleta_id
        ) VALUES (
            v_coleta.data_coleta, 
            'saida', 
            'coleta', 
            v_coleta.cliente_id, 
            'Backfill: Saída de óleo soja novo referente à coleta Nº ' || v_formatted_numero_coleta || ' (Troca).', 
            v_coleta.user_id, 
            v_formatted_numero_coleta, 
            v_coleta.id
        ) RETURNING id INTO v_entrada_saida_id;

        -- Criar o item da movimentação
        INSERT INTO public.itens_entrada_saida (
            entrada_saida_id, produto_id, quantidade
        ) VALUES (
            v_entrada_saida_id, 
            v_oleo_so_novo_id, 
            v_coleta.quantidade_entregue
        );

        v_count_created := v_count_created + 1;
    END LOOP;

    RAISE NOTICE 'Backfill concluído. Total de saídas criadas: %', v_count_created;
END $$;
