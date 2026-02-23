CREATE OR REPLACE FUNCTION public.process_recibo_signature_actions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_coleta_data RECORD;
    v_oleo_fritura_id UUID;
    v_oleo_soja_novo_id UUID;
    v_entrada_saida_id UUID;
    v_existing_credito_debito_id UUID;
    v_current_timezone TEXT;
    v_existing_entrada_id UUID;
    v_existing_saida_id UUID;
    v_existing_entrada_item_id UUID;
    v_existing_saida_item_id UUID;

    -- Variables for financeiro calculation (now used only for the new insert)
    v_new_total_value NUMERIC;
    v_new_status public.pagamento_status;
    v_formatted_numero_coleta TEXT; -- Nova variável para o número da coleta formatado

BEGIN
    RAISE NOTICE $$Trigger process_recibo_signature_actions started for coleta_id: %$$, NEW.coleta_id;

    -- Fetch company timezone
    SELECT timezone INTO v_current_timezone FROM public.empresa LIMIT 1;
    IF v_current_timezone IS NULL THEN
        v_current_timezone := 'America/Sao_Paulo'; -- Fallback timezone
    END IF;

    -- Fetch coleta details, including client CNPJ/CPF and nome_fantasia
    SELECT
        c.id,
        c.data_coleta,
        c.tipo_coleta,
        c.quantidade_coletada,
        c.quantidade_entregue,
        c.valor_compra,
        c.total_pago,
        c.data_lancamento,
        c.user_id,
        c.estado,
        c.municipio,
        c.numero_coleta,
        cl.id AS cliente_id,
        cl.nome AS cliente_nome,
        cl.cnpj_cpf,
        cl.nome_fantasia AS cliente_nome_fantasia
    INTO v_coleta_data
    FROM public.coletas c
    LEFT JOIN public.clientes cl ON c.cliente_id = cl.id
    WHERE c.id = NEW.coleta_id;

    IF v_coleta_data IS NULL THEN
        RAISE WARNING $$Coleta % não encontrada para processar ações de assinatura. Returning NEW.$$, NEW.coleta_id;
        RETURN NEW;
    END IF;

    RAISE NOTICE $$Coleta data fetched. Coleta ID: %, Tipo: %, Qtd Coletada: %, Total Pago: %$$, v_coleta_data.id, v_coleta_data.tipo_coleta, v_coleta_data.quantidade_coletada, v_coleta_data.total_pago;
    RAISE NOTICE $$Debug: v_coleta_data.total_pago = %$$, v_coleta_data.total_pago;

    -- Formata o numero_coleta com zeros à esquerda para 6 dígitos
    v_formatted_numero_coleta := LPAD(v_coleta_data.numero_coleta::text, 6, '0');

    -- Get product IDs
    v_oleo_fritura_id := public.get_product_id_by_name_and_type('Óleo de fritura', 'coletado');
    v_oleo_soja_novo_id := public.get_product_id_by_name_and_type('Óleo de soja novo (900ml)', 'novo');

    IF v_oleo_fritura_id IS NULL THEN
        RAISE WARNING $$Produto \"Óleo de fritura\" (coletado) não encontrado.$$;
    END IF;
    IF v_oleo_soja_novo_id IS NULL THEN
        RAISE WARNING $$Produto \"Óleo de soja novo (900ml)\" (novo) não encontrado. A saída de estoque para troca não será registrada.$$;
    END IF;

    RAISE NOTICE $$Debug antes da entrada de estoque: v_oleo_fritura_id: %, v_coleta_data.quantidade_coletada: %$$, v_oleo_fritura_id, v_coleta_data.quantidade_coletada;

    -- --- Processa movimentações de estoque ---
    -- Entrada de \"Óleo de fritura\" (Tipo Coletado) para ambos os tipos de coleta
    IF v_oleo_fritura_id IS NOT NULL AND v_coleta_data.quantidade_coletada > 0 THEN
        -- Tenta encontrar uma entrada existente para esta coleta e produto
        SELECT es.id, ies.id INTO v_existing_entrada_id, v_existing_entrada_item_id
        FROM public.entrada_saida es
        JOIN public.itens_entrada_saida ies ON es.id = ies.entrada_saida_id
        WHERE es.coleta_id = v_coleta_data.id
          AND es.tipo = 'entrada'
          AND ies.produto_id = v_oleo_fritura_id;

        IF v_existing_entrada_id IS NOT NULL THEN
            RAISE NOTICE $$Updating existing stock entry for Óleo de fritura (ID: %). Qtd: %$$, v_existing_entrada_id, v_coleta_data.quantidade_coletada;
            UPDATE public.entrada_saida
            SET
                data = v_coleta_data.data_coleta,
                observacao = $$Entrada de óleo de fritura referente à coleta Nº $$ || v_formatted_numero_coleta || $$.$$,
                user_id = v_coleta_data.user_id,
                document_number = v_formatted_numero_coleta, -- Usando o número formatado
                updated_at = NOW()
            WHERE id = v_existing_entrada_id;

            UPDATE public.itens_entrada_saida
            SET
                quantidade = v_coleta_data.quantidade_coletada,
                updated_at = NOW()
            WHERE id = v_existing_entrada_item_id;
        ELSE
            RAISE NOTICE $$Creating new stock entry for Óleo de fritura. Qtd: %$$, v_coleta_data.quantidade_coletada;
            INSERT INTO public.entrada_saida (
                data, tipo, origem, cliente_id, observacao, user_id, document_number, coleta_id
            ) VALUES (
                v_coleta_data.data_coleta, 'entrada', 'coleta', v_coleta_data.cliente_id,
                $$Entrada de óleo de fritura referente à coleta Nº $$ || v_formatted_numero_coleta || $$.$$,
                v_coleta_data.user_id, v_formatted_numero_coleta, -- Usando o número formatado
                v_coleta_data.id
            ) RETURNING id INTO v_entrada_saida_id;

            INSERT INTO public.itens_entrada_saida (
                entrada_saida_id, produto_id, quantidade
            ) VALUES (
                v_entrada_saida_id, v_oleo_fritura_id, v_coleta_data.quantidade_coletada
            );
            RAISE NOTICE $$Stock entry created with ID: %$$, v_entrada_saida_id;
        END IF;
    ELSE
        -- Se a quantidade coletada for 0 ou o produto não for encontrado, delete qualquer entrada existente
        DELETE FROM public.itens_entrada_saida ies
        USING public.entrada_saida es
        WHERE ies.entrada_saida_id = es.id
          AND es.coleta_id = v_coleta_data.id
          AND es.tipo = 'entrada'
          AND ies.produto_id = v_oleo_fritura_id;

        DELETE FROM public.entrada_saida
        WHERE coleta_id = v_coleta_data.id
          AND tipo = 'entrada'
          AND NOT EXISTS (SELECT 1 FROM public.itens_entrada_saida WHERE entrada_saida_id = entrada_saida.id);
    END IF;

    -- Saída de \"Óleo de soja novo\" (Tipo Novo) para coleta tipo 'Troca'
    IF v_coleta_data.tipo_coleta = 'Troca' AND v_oleo_soja_novo_id IS NOT NULL AND v_coleta_data.quantidade_entregue > 0 THEN
        RAISE NOTICE $$Coleta type is Troca. Processing stock exit for Óleo de soja novo. Qtd: %$$, v_coleta_data.quantidade_entregue;
        -- Tenta encontrar uma saída existente para esta coleta e produto
        SELECT es.id, ies.id INTO v_existing_saida_id, v_existing_saida_item_id
        FROM public.entrada_saida es
        JOIN public.itens_entrada_saida ies ON es.id = ies.entrada_saida_id
        WHERE es.coleta_id = v_coleta_data.id
          AND es.tipo = 'saida'
          AND ies.produto_id = v_oleo_soja_novo_id;

        IF v_existing_saida_id IS NOT NULL THEN
            RAISE NOTICE $$Updating existing stock exit for Óleo de soja novo (ID: %). Qtd: %$$, v_existing_saida_id, v_coleta_data.quantidade_entregue;
            UPDATE public.entrada_saida
            SET
                data = v_coleta_data.data_coleta,
                observacao = $$Saída de óleo de soja novo referente à coleta Nº $$ || v_formatted_numero_coleta || $$ (Troca).$$,
                user_id = v_coleta_data.user_id,
                document_number = v_formatted_numero_coleta, -- Usando o número formatado
                updated_at = NOW()
            WHERE id = v_existing_saida_id;

            UPDATE public.itens_entrada_saida
            SET
                quantidade = v_coleta_data.quantidade_entregue,
                updated_at = NOW()
            WHERE id = v_existing_saida_item_id;
        ELSE
            RAISE NOTICE $$Creating new stock exit for Óleo de soja novo. Qtd: %$$, v_coleta_data.quantidade_entregue;
            INSERT INTO public.entrada_saida (
                data, tipo, origem, cliente_id, observacao, user_id, document_number, coleta_id
            ) VALUES (
                v_coleta_data.data_coleta, 'saida', 'coleta', v_coleta_data.cliente_id,
                $$Saída de óleo de soja novo referente à coleta Nº $$ || v_formatted_numero_coleta || $$ (Troca).$$,
                v_coleta_data.user_id, v_formatted_numero_coleta, -- Usando o número formatado
                v_coleta_data.id
            ) RETURNING id INTO v_entrada_saida_id;

            INSERT INTO public.itens_entrada_saida (
                entrada_saida_id, produto_id, quantidade
            ) VALUES (
                v_entrada_saida_id, v_oleo_soja_novo_id, v_coleta_data.quantidade_entregue
            );
            RAISE NOTICE $$Stock exit created with ID: %$$, v_entrada_saida_id;
        END IF;
    ELSE
        -- Se não for tipo 'Troca' ou quantidade entregue for 0, delete qualquer saída existente para este produto
        DELETE FROM public.itens_entrada_saida ies
        USING public.entrada_saida es
        WHERE ies.entrada_saida_id = es.id
          AND es.coleta_id = v_coleta_data.id
          AND es.tipo = 'saida'
          AND ies.produto_id = v_oleo_soja_novo_id;

        DELETE FROM public.entrada_saida
        WHERE coleta_id = v_coleta_data.id
          AND tipo = 'saida'
          AND NOT EXISTS (SELECT 1 FROM public.itens_entrada_saida WHERE entrada_saida_id = entrada_saida.id);
    END IF;

    -- --- Processa lançamento financeiro (Débito) para coleta tipo 'Compra' ---
    -- Sempre exclui lançamentos de débito existentes para esta coleta_id antes de reinserir
    RAISE NOTICE $$Deleting any existing debit entries for coleta_id: %$$, v_coleta_data.id;
    DELETE FROM public.credito_debito
    WHERE coleta_id = v_coleta_data.id
      AND type = 'debito';
    -- Pagamentos associados serão excluídos via CASCADE devido à restrição de chave estrangeira.

    IF v_coleta_data.tipo_coleta = 'Compra' AND COALESCE(v_coleta_data.total_pago, 0) > 0 THEN
        RAISE NOTICE $$Coleta type is Compra and total_pago > 0. Inserting new debit entry.$$;
        
        v_new_total_value := COALESCE(v_coleta_data.total_pago, 0);
        v_new_status := CASE
            WHEN v_new_total_value = 0 THEN 'paid'::pagamento_status
            ELSE 'pending'::pagamento_status
        END;

        -- Insere um novo lançamento de débito
        INSERT INTO public.credito_debito (
            lancamento_id, type, document_number, model, pessoa_id,
            cliente_fornecedor_name, cliente_fornecedor_fantasy_name,
            cnpj_cpf, description, issue_date, total_value, payment_method,
            cost_center, notes, user_id, installment_number, total_installments,
            coleta_id, paid_amount, amount_balance, status
        )
        VALUES (
            v_coleta_data.id, -- lancamento_id é o ID da coleta
            'debito',
            v_formatted_numero_coleta, -- Usando o número formatado
            'Recibo',
            v_coleta_data.cliente_id,
            v_coleta_data.cliente_nome,
            v_coleta_data.cliente_nome_fantasia,
            v_coleta_data.cnpj_cpf,
            $$Pagamento de coleta Nº $$ || v_formatted_numero_coleta || $$ ($$ || v_coleta_data.quantidade_coletada || $$ kg).$$,
            (v_coleta_data.data_coleta AT TIME ZONE v_current_timezone)::date, -- Data de emissão
            v_new_total_value,
            'cash'::public.payment_method,
            'OPERACIONAL',
            $$Lançamento automático referente à coleta Nº $$ || v_formatted_numero_coleta || $$.$$,
            v_coleta_data.user_id,
            1, -- installment_number
            1, -- total_installments
            v_coleta_data.id, -- coleta_id
            0, -- Initially 0 paid
            v_new_total_value, -- initial amount_balance is total_value
            v_new_status -- status inicial
        ) RETURNING id INTO v_existing_credito_debito_id;
        RAISE NOTICE $$Inserted new credito_debito entry with ID: %$$, v_existing_credito_debito_id;
    ELSE
        RAISE NOTICE $$Coleta type is not Compra or total_pago is 0. No debit entry inserted.$$;
        -- Não é necessário fazer mais nada aqui, pois as entradas existentes já foram excluídas.
    END IF;

    RETURN NEW;
END;
$function$