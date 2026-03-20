-- Migração para corrigir o nome do produto no trigger de estoque
-- Corrigindo de 'Óleo de soja novo (garrafa 900ml)' para 'Óleo de soja novo (900ml)'

CREATE OR REPLACE FUNCTION public.process_recibo_signature_actions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_coleta_data RECORD;
    v_oleo_fritura_id UUID;
    v_oleo_so_novo_id UUID; -- Variável para óleo novo
    v_entrada_saida_id UUID;
    v_existing_credito_debito_id UUID;
    v_current_timezone TEXT;
    v_existing_entrada_id UUID;
    v_existing_saida_id UUID;
    v_existing_entrada_item_id UUID;
    v_existing_saida_item_id UUID;

    -- Variables for financeiro calculation
    v_new_total_value NUMERIC;
    v_new_status public.pagamento_status;
    v_formatted_numero_coleta TEXT;

BEGIN
    -- Só processa se a assinatura foi adicionada AGORA ou alterada
    IF NEW.assinatura_url IS NULL OR (OLD.assinatura_url IS NOT NULL AND OLD.assinatura_url = NEW.assinatura_url) THEN
        RETURN NEW;
    END IF;

    RAISE NOTICE 'Trigger process_recibo_signature_actions (Product Name Fix) started for coleta_id: %', NEW.coleta_id;

    -- Fetch company timezone
    SELECT timezone INTO v_current_timezone FROM public.empresa LIMIT 1;
    IF v_current_timezone IS NULL THEN
        v_current_timezone := 'America/Sao_Paulo';
    END IF;

    -- Fetch coleta details
    SELECT
        c.id, c.data_coleta, c.tipo_coleta, c.quantidade_coletada, c.quantidade_entregue,
        c.valor_compra, c.total_pago, c.data_lancamento, c.user_id, c.estado, c.municipio,
        c.numero_coleta, cl.id AS cliente_id, cl.razao_social AS cliente_nome, cl.cnpj_cpf,
        cl.nome_fantasia AS cliente_nome_fantasia
    INTO v_coleta_data
    FROM public.coletas c
    LEFT JOIN public.clientes cl ON c.cliente_id = cl.id
    WHERE c.id = NEW.coleta_id;

    IF v_coleta_data IS NULL THEN
        RETURN NEW;
    END IF;

    v_formatted_numero_coleta := LPAD(v_coleta_data.numero_coleta::text, 6, '0');

    -- IDs dos produtos corrigidos
    v_oleo_fritura_id := public.get_product_id_by_name_and_type('Óleo de fritura', 'coletado');
    v_oleo_so_novo_id := public.get_product_id_by_name_and_type('Óleo de soja novo (900ml)', 'novo');

    -- Entrada Óleo Fritura (Sempre ocorre em Troca e Compra se houver quantidade coletada)
    IF v_oleo_fritura_id IS NOT NULL AND v_coleta_data.quantidade_coletada > 0 THEN
        SELECT es.id, ies.id INTO v_existing_entrada_id, v_existing_entrada_item_id
        FROM public.entrada_saida es JOIN public.itens_entrada_saida ies ON es.id = ies.entrada_saida_id
        WHERE es.coleta_id = v_coleta_data.id AND es.tipo = 'entrada' AND ies.produto_id = v_oleo_fritura_id;

        IF v_existing_entrada_id IS NOT NULL THEN
            UPDATE public.entrada_saida SET data = v_coleta_data.data_coleta, document_number = v_formatted_numero_coleta, updated_at = NOW() WHERE id = v_existing_entrada_id;
            UPDATE public.itens_entrada_saida SET quantidade = v_coleta_data.quantidade_coletada, updated_at = NOW() WHERE id = v_existing_entrada_item_id;
        ELSE
            INSERT INTO public.entrada_saida (data, tipo, origem, cliente_id, observacao, user_id, document_number, coleta_id)
            VALUES (v_coleta_data.data_coleta, 'entrada', 'coleta', v_coleta_data.cliente_id, 'Entrada de óleo de fritura coleta Nº ' || v_formatted_numero_coleta, v_coleta_data.user_id, v_formatted_numero_coleta, v_coleta_data.id)
            RETURNING id INTO v_entrada_saida_id;
            INSERT INTO public.itens_entrada_saida (entrada_saida_id, produto_id, quantidade) VALUES (v_entrada_saida_id, v_oleo_fritura_id, v_coleta_data.quantidade_coletada);
        END IF;
    END IF;

    -- Saída Óleo Novo (Apenas para Troca se houver quantidade entregue)
    IF v_coleta_data.tipo_coleta = 'Troca' AND v_oleo_so_novo_id IS NOT NULL AND v_coleta_data.quantidade_entregue > 0 THEN
        SELECT es.id, ies.id INTO v_existing_saida_id, v_existing_saida_item_id
        FROM public.entrada_saida es JOIN public.itens_entrada_saida ies ON es.id = ies.entrada_saida_id
        WHERE es.coleta_id = v_coleta_data.id AND es.tipo = 'saida' AND ies.produto_id = v_oleo_so_novo_id;

        IF v_existing_saida_id IS NOT NULL THEN
            UPDATE public.entrada_saida SET data = v_coleta_data.data_coleta, document_number = v_formatted_numero_coleta, updated_at = NOW() WHERE id = v_existing_saida_id;
            UPDATE public.itens_entrada_saida SET quantidade = v_coleta_data.quantidade_entregue, updated_at = NOW() WHERE id = v_existing_saida_item_id;
        ELSE
            INSERT INTO public.entrada_saida (data, tipo, origem, cliente_id, observacao, user_id, document_number, coleta_id)
            VALUES (v_coleta_data.data_coleta, 'saida', 'coleta', v_coleta_data.cliente_id, 'Saída de óleo soja novo coleta Nº ' || v_formatted_numero_coleta, v_coleta_data.user_id, v_formatted_numero_coleta, v_coleta_data.id)
            RETURNING id INTO v_entrada_saida_id;
            INSERT INTO public.itens_entrada_saida (entrada_saida_id, produto_id, quantidade) VALUES (v_entrada_saida_id, v_oleo_so_novo_id, v_coleta_data.quantidade_entregue);
        END IF;
    END IF;

    -- Lançamento Financeiro (Apenas para Compra)
    IF v_coleta_data.tipo_coleta = 'Compra' AND COALESCE(v_coleta_data.total_pago, 0) > 0 THEN
        DELETE FROM public.credito_debito WHERE coleta_id = v_coleta_data.id AND type = 'debito';
        v_new_total_value := COALESCE(v_coleta_data.total_pago, 0);
        v_new_status := 'pending'::pagamento_status;
        INSERT INTO public.credito_debito (
            lancamento_id, type, document_number, model, pessoa_id, 
            cliente_fornecedor_name, cliente_fornecedor_fantasy_name, cnpj_cpf, 
            description, issue_date, total_value, installment_value, 
            payment_method, cost_center, user_id, 
            installment_number, total_installments, 
            coleta_id, paid_amount, amount_balance, status
        )
        VALUES (
            v_coleta_data.id, 'debito', v_formatted_numero_coleta, 'Recibo', v_coleta_data.cliente_id, 
            v_coleta_data.cliente_nome, v_coleta_data.cliente_nome_fantasia, v_coleta_data.cnpj_cpf, 
            'Pagamento coleta Nº ' || v_formatted_numero_coleta, (v_coleta_data.data_coleta AT TIME ZONE v_current_timezone)::date, 
            v_new_total_value, v_new_total_value, 
            'cash'::public.payment_method, 'OPERACIONAL', v_coleta_data.user_id, 
            1, 1, 
            v_coleta_data.id, 0, v_new_total_value, v_new_status
        );
    END IF;

    -- Atualização de estatísticas do cliente
    IF v_coleta_data.cliente_id IS NOT NULL THEN
        PERFORM public.update_cliente_coleta_stats_by_id(v_coleta_data.cliente_id);
    END IF;

    RETURN NEW;
END;
$function$;
