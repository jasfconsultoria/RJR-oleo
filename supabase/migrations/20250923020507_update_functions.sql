CREATE OR OR REPLACE FUNCTION public.process_recibo_signature_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_coleta_data RECORD;
    v_oleo_fritura_id UUID;
    v_oleo_soja_novo_id UUID;
    v_entrada_saida_id UUID;
    v_financeiro_lancamento_id UUID := gen_random_uuid();
    v_rpc_result jsonb;
BEGIN
    RAISE NOTICE 'Trigger process_recibo_signature_actions started for coleta_id: %', NEW.coleta_id;

    IF NEW.assinatura_url IS NOT NULL AND (OLD.assinatura_url IS NULL OR OLD.assinatura_url <> NEW.assinatura_url) THEN
        RAISE NOTICE 'Signature added/updated. Fetching coleta details.';
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
            cl.nome_fantasia AS cliente_nome_fantasia -- Adicionado nome_fantasia
        INTO v_coleta_data
        FROM public.coletas c
        LEFT JOIN public.clientes cl ON c.cliente_id = cl.id
        WHERE c.id = NEW.coleta_id;

        IF v_coleta_data IS NULL THEN
            RAISE WARNING 'Coleta % não encontrada para processar ações de assinatura. Returning NEW.', NEW.coleta_id;
            RETURN NEW;
        END IF;

        RAISE NOTICE 'Coleta data fetched. Coleta ID: %, Tipo: %', v_coleta_data.id, v_coleta_data.tipo_coleta;

        -- Get product IDs
        v_oleo_fritura_id := public.get_product_id_by_name_and_type('Óleo de fritura', 'coletado');
        v_oleo_soja_novo_id := public.get_product_id_by_name_and_type('Óleo de soja novo (garrafa 900ml)', 'novo');

        IF v_oleo_fritura_id IS NULL THEN
            RAISE WARNING 'Produto \\\"Óleo de fritura\\\" (coletado) não encontrado.';
        END IF;
        IF v_oleo_soja_novo_id IS NULL THEN
            RAISE WARNING 'Produto \\\"Óleo de soja novo (garrafa 900ml)\\\" (novo) não encontrado.';
        END IF;

        -- --- Processa movimentações de estoque ---\\
        -- Entrada de \\\"Óleo de fritura\\\" (Tipo Coletado) para ambos os tipos de coleta
        IF v_oleo_fritura_id IS NOT NULL AND v_coleta_data.quantidade_coletada > 0 THEN
            RAISE NOTICE 'Processing stock entry for Óleo de fritura. Qtd: %', v_coleta_data.quantidade_coletada;
            INSERT INTO public.entrada_saida (
                data, tipo, origem, cliente_id, observacao, user_id, document_number, coleta_id
            ) VALUES (
                v_coleta_data.data_coleta, 'entrada', 'coleta', v_coleta_data.cliente_id,
                'Entrada de óleo de fritura referente à coleta Nº ' || v_coleta_data.numero_coleta || '.',
                v_coleta_data.user_id, v_coleta_data.numero_coleta::text, v_coleta_data.id
            ) RETURNING id INTO v_entrada_saida_id;

            INSERT INTO public.itens_entrada_saida (
                entrada_saida_id, produto_id, quantidade
            ) VALUES (
                v_entrada_saida_id, v_oleo_fritura_id, v_coleta_data.quantidade_coletada
            );
            RAISE NOTICE 'Stock entry created with ID: %', v_entrada_saida_id;
        END IF;

        IF v_coleta_data.tipo_coleta = 'Troca' THEN
            RAISE NOTICE 'Coleta type is Troca.';
            -- Saída de \\\"Óleo de soja novo\\\" (Tipo Novo) para coleta tipo 'Troca'
            IF v_oleo_soja_novo_id IS NOT NULL AND v_coleta_data.quantidade_entregue > 0 THEN
                RAISE NOTICE 'Processing stock exit for Óleo de soja novo. Qtd: %', v_coleta_data.quantidade_entregue;
                INSERT INTO public.entrada_saida (
                    data, tipo, origem, cliente_id, observacao, user_id, document_number, coleta_id
                ) VALUES (
                    v_coleta_data.data_coleta, 'saida', 'coleta', v_coleta_data.cliente_id,
                    'Saída de óleo de soja novo referente à coleta Nº ' || v_coleta_data.numero_coleta || ' (Troca).',
                    v_coleta_data.user_id, v_coleta_data.numero_coleta::text, v_coleta_data.id
                ) RETURNING id INTO v_entrada_saida_id;

                INSERT INTO public.itens_entrada_saida (
                    entrada_saida_id, produto_id, quantidade
                ) VALUES (
                    v_entrada_saida_id, v_oleo_soja_novo_id, v_coleta_data.quantidade_entregue
                );
                RAISE NOTICE 'Stock exit created with ID: %', v_entrada_saida_id;
            END IF;

        ELSIF v_coleta_data.tipo_coleta = 'Compra' THEN
            RAISE NOTICE 'Coleta type is Compra. Total pago: %', v_coleta_data.total_pago;
            -- --- Processa lançamento financeiro (Débito) para coleta tipo 'Compra' ---\\
            IF v_coleta_data.total_pago > 0 THEN
                RAISE NOTICE 'Calling create_financeiro_lancamento for Compra.';
                SELECT public.create_financeiro_lancamento(
                    p_lancamento_id := v_financeiro_lancamento_id,
                    p_type := 'debito',
                    p_document_number := v_coleta_data.numero_coleta::text,
                    p_model := 'Recibo',
                    p_pessoa_id := v_coleta_data.cliente_id,
                    p_cliente_fornecedor_name := v_coleta_data.cliente_nome,
                    p_cliente_fornecedor_fantasy_name := v_coleta_data.cliente_nome_fantasia,
                    p_cnpj_cpf := v_coleta_data.cnpj_cpf,
                    p_description := 'Pagamento de coleta Nº ' || v_coleta_data.numero_coleta || ' (' || v_coleta_data.quantidade_coletada || ' kg).',
                    p_payment_method := 'cash',
                    p_cost_center := 'OPERACIONAL',
                    p_notes := 'Lançamento automático referente à coleta Nº ' || v_coleta_data.numero_coleta || '.',
                    p_user_id := v_coleta_data.user_id,
                    p_total_installments := 1,
                    p_down_payment := NULL,
                    p_installments := ARRAY[jsonb_build_object('amount', v_coleta_data.total_pago, 'date', public.get_date_in_company_timezone(v_coleta_data.data_coleta), 'number', 1)]
                ) INTO v_rpc_result;

                IF NOT (v_rpc_result->>'success')::boolean THEN
                    RAISE EXCEPTION 'Erro ao criar lançamento financeiro para coleta %: %', v_coleta_data.id, v_rpc_result->>'message';
                END IF;
                RAISE NOTICE 'Financeiro lancamento created with ID: %', v_financeiro_lancamento_id;
            ELSE
                RAISE NOTICE 'Total pago is 0, skipping financeiro lancamento creation.';
            END IF;
        END IF;
    ELSE
        RAISE NOTICE 'Signature not added/updated or already processed. Returning NEW.';
    END IF;

    RETURN NEW;
END;
$function$;