-- Supabase Migration: 2024_08_15_add_version_1_8_9.sql
-- Esta migração atualiza a função RPC get_public_recibo_data para usar a view v_coletas_com_status
-- e registra a nova versão do sistema.

-- 1. Atualiza a função get_public_recibo_data para retornar a view v_coletas_com_status
-- Isso garante que todos os dados do cliente (nome, cnpj, etc.) estejam disponíveis diretamente
-- no objeto 'coleta' retornado, simplificando o consumo no frontend.
CREATE OR REPLACE FUNCTION get_public_recibo_data(p_coleta_id uuid)
RETURNS TABLE(coleta v_coletas_com_status, cliente clientes, empresa empresa, recibo recibos)
LANGUAGE plpgsql
AS $$
DECLARE
    v_coleta_view v_coletas_com_status;
    v_cliente clientes;
    v_empresa empresa;
    v_recibo recibos;
BEGIN
    -- Fetch data from the view
    SELECT * INTO v_coleta_view FROM v_coletas_com_status WHERE id = p_coleta_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Coleta not found or not accessible.';
    END IF;

    -- Fetch client data (still needed for the 'pessoa' object in Recibo.jsx, if mapped)
    SELECT * INTO v_cliente FROM clientes WHERE id = v_coleta_view.cliente_id;

    -- Fetch company data (assuming only one company)
    SELECT * INTO v_empresa FROM empresa LIMIT 1;

    -- Fetch recibo data
    SELECT * INTO v_recibo FROM recibos WHERE coleta_id = p_coleta_id;

    -- Return the data
    RETURN QUERY SELECT v_coleta_view, v_cliente, v_empresa, v_recibo;
END;
$$;

-- 2. Registra a nova versão na tabela public.versoes
INSERT INTO public.versoes (versao, hash, descricao)
VALUES ('1.8.9', 'k7l6m5n', '- **Correção Definitiva do Link Público de Assinatura de Recibo:** A função RPC `get_public_recibo_data` foi atualizada para retornar os dados da `v_coletas_com_status`, garantindo que o componente `Recibo.jsx` receba todas as informações necessárias do cliente e renderize corretamente a página de assinatura pública.
- **Aumento do Tamanho do Modal de Recibo:** A largura máxima do modal de visualização do recibo (`ReciboViewDialog`) foi aumentada para `sm:max-w-3xl` para melhor acomodação dos botões de ação.
- **Confirmação do Status de Recibo:** Reforçado que a funcionalidade de status de recibo (Em Andamento, Aguardando Assinatura, Finalizada) já está implementada na lista de coletas, fornecendo uma visão clara do fluxo de cada recibo.');