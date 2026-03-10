-- Migração para Automatizar Atualização de Estatísticas de Coleta na Assinatura do Recibo
-- Esta migração garante que os campos de inteligência do cliente (última coleta, média e próxima prevista) 
-- sejam atualizados no momento em que a coleta é considerada FINALIZADA (assinada).

-- 1. Refatorar a função para ser puramente baseada no cliente_id
CREATE OR REPLACE FUNCTION public.update_cliente_coleta_stats_by_id(p_cliente_id UUID)
RETURNS VOID AS $$
DECLARE
    v_media INTEGER;
    v_ultima_data TIMESTAMPTZ;
    v_penultima_data TIMESTAMPTZ;
    v_diff INTEGER;
    v_current_timezone TEXT;
BEGIN
    -- Buscar timezone da empresa para garantir cálculos de data precisos
    SELECT timezone INTO v_current_timezone FROM public.empresa LIMIT 1;
    IF v_current_timezone IS NULL THEN
        v_current_timezone := 'America/Sao_Paulo';
    END IF;

    -- Pegar a data da coleta mais recente deste cliente que tenha recibo assinado
    SELECT c.data_coleta INTO v_ultima_data
    FROM public.coletas c
    JOIN public.recibos r ON c.id = r.coleta_id
    WHERE c.cliente_id = p_cliente_id
      AND r.assinatura_url IS NOT NULL
    ORDER BY c.data_coleta DESC
    LIMIT 1;

    -- Se não houver coletas assinadas, não temos o que calcular
    IF v_ultima_data IS NULL THEN
        RETURN;
    END IF;

    -- Cálculo da média das últimas 4 coletas assinadas
    SELECT AVG(diff)::INTEGER INTO v_media
    FROM (
        SELECT 
            EXTRACT(DAY FROM (c.data_coleta - LAG(c.data_coleta) OVER (ORDER BY c.data_coleta))) as diff
        FROM public.coletas c
        JOIN public.recibos r ON c.id = r.coleta_id
        WHERE c.cliente_id = p_cliente_id
          AND r.assinatura_url IS NOT NULL
        ORDER BY c.data_coleta DESC
        LIMIT 4
    ) as intervals
    WHERE diff >= 2; -- Ignorar intervalos muito curtos (< 2 dias)

    -- Atualizar o cliente (Utilizando timezone para o cálculo da próxima data)
    UPDATE public.clientes
    SET 
        data_ultima_coleta = v_ultima_data,
        media_dias_coleta = COALESCE(v_media, media_dias_coleta, 0),
        proxima_coleta_prevista = CASE 
            WHEN COALESCE(v_media, media_dias_coleta, 0) > 0 THEN 
                -- Garante que o cálculo da próxima data respeite o fuso horário da empresa
                (v_ultima_data AT TIME ZONE v_current_timezone + (COALESCE(v_media, media_dias_coleta, 0) || ' days')::INTERVAL) AT TIME ZONE v_current_timezone
            ELSE NULL
        END
    WHERE id = p_cliente_id;

    RAISE NOTICE 'Estatísticas do cliente % atualizadas. Última: %, Média: %, Timezone: %', p_cliente_id, v_ultima_data, v_media, v_current_timezone;
END;
$$ LANGUAGE plpgsql;

-- 2. Modificar a função process_recibo_signature_actions para chamar a atualização de estatísticas
-- Precisamos garantir que a função use a versão mais recente que analisamos anteriormente (2029_...)
-- E adicione a chamada para update_cliente_coleta_stats_by_id(v_coleta_data.cliente_id)

-- NOTA: O arquivo 2029_... já define process_recibo_signature_actions.
-- Vamos criar um novo trigger ou envolver a chamada lá.
-- Como process_recibo_signature_actions dispara no UPDATE de recibos quando a assinatura é adicionada,
-- faz sentido adicionar a chamada de estatísticas no final daquela função.

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

    -- Variables for financeiro calculation
    v_new_total_value NUMERIC;
    v_new_status public.pagamento_status;
    v_formatted_numero_coleta TEXT;

BEGIN
    -- Só processa se a assinatura foi adicionada AGORA ou alterada
    IF NEW.assinatura_url IS NULL OR (OLD.assinatura_url IS NOT NULL AND OLD.assinatura_url = NEW.assinatura_url) THEN
        RETURN NEW;
    END IF;

    RAISE NOTICE 'Trigger process_recibo_signature_actions (Stats Fix) started for coleta_id: %', NEW.coleta_id;

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

    -- --- 1. Movimentações de Estoque e Financeiro (Código Existente Preservado) ---
    -- (Omitido aqui por brevidade na migração, mas mantendo a lógica funcional do sistema)
    -- ... [Lógica de estoque e financeiro que já funciona] ...
    
    -- RE-IMPLEMENTANDO A LÓGICA DE ESTOQUE/FINANCEIRO PARA NÃO QUEBRAR O FLUXO ATUAL
    v_oleo_fritura_id := public.get_product_id_by_name_and_type('Óleo de fritura', 'coletado');
    v_oleo_soja_novo_id := public.get_product_id_by_name_and_type('Óleo de soja novo (900ml)', 'novo');

    -- Entrada Óleo Fritura
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

    -- Saída Óleo Novo (Troca)
    IF v_coleta_data.tipo_coleta = 'Troca' AND v_oleo_soja_novo_id IS NOT NULL AND v_coleta_data.quantidade_entregue > 0 THEN
        SELECT es.id, ies.id INTO v_existing_saida_id, v_existing_saida_item_id
        FROM public.entrada_saida es JOIN public.itens_entrada_saida ies ON es.id = ies.entrada_saida_id
        WHERE es.coleta_id = v_coleta_data.id AND es.tipo = 'saida' AND ies.produto_id = v_oleo_soja_novo_id;

        IF v_existing_saida_id IS NOT NULL THEN
            UPDATE public.entrada_saida SET data = v_coleta_data.data_coleta, document_number = v_formatted_numero_coleta, updated_at = NOW() WHERE id = v_existing_saida_id;
            UPDATE public.itens_entrada_saida SET quantidade = v_coleta_data.quantidade_entregue, updated_at = NOW() WHERE id = v_existing_saida_item_id;
        ELSE
            INSERT INTO public.entrada_saida (data, tipo, origem, cliente_id, observacao, user_id, document_number, coleta_id)
            VALUES (v_coleta_data.data_coleta, 'saida', 'coleta', v_coleta_data.cliente_id, 'Saída de óleo soja novo coleta Nº ' || v_formatted_numero_coleta, v_coleta_data.user_id, v_formatted_numero_coleta, v_coleta_data.id)
            RETURNING id INTO v_entrada_saida_id;
            INSERT INTO public.itens_entrada_saida (entrada_saida_id, produto_id, quantidade) VALUES (v_entrada_saida_id, v_oleo_soja_novo_id, v_coleta_data.quantidade_entregue);
        END IF;
    END IF;

    -- Lançamento Financeiro (Compra)
    DELETE FROM public.credito_debito WHERE coleta_id = v_coleta_data.id AND type = 'debito';
    IF v_coleta_data.tipo_coleta = 'Compra' AND COALESCE(v_coleta_data.total_pago, 0) > 0 THEN
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

    -- --- 2. ATUALIZAÇÃO DE ESTATÍSTICAS DO CLIENTE (ADICIONADO) ---
    IF v_coleta_data.cliente_id IS NOT NULL THEN
        PERFORM public.update_cliente_coleta_stats_by_id(v_coleta_data.cliente_id);
    END IF;

    RETURN NEW;
END;
$function$;

-- Reinserir o trigger para garantir que ele aponta para a função atualizada
-- DROP TRIGGER IF EXISTS trg_process_recibo_signature_actions ON public.recibos;
-- CREATE TRIGGER trg_process_recibo_signature_actions
-- AFTER UPDATE ON public.recibos
-- FOR EACH ROW
-- EXECUTE FUNCTION process_recibo_signature_actions();

-- 3. Atualizar a versão
INSERT INTO public.versoes (versao, hash, descricao)
VALUES ('4.0.6', 'stats_fix', 'Ajuste no trigger de finalização de coleta para garantir atualização das estatísticas do cliente após assinatura do recibo.');
