-- Migração para Controle Inteligente de Coletas
-- Adiciona colunas de inteligência e geolocalização à tabela clientes

ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS data_ultima_coleta TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS media_dias_coleta INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS proxima_coleta_prevista TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Função para atualizar as estatísticas de coleta do cliente
CREATE OR REPLACE FUNCTION update_cliente_coleta_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_media INTEGER;
    v_ultima_data TIMESTAMPTZ;
    v_penultima_data TIMESTAMPTZ;
    v_diff INTEGER;
BEGIN
    -- Só processa se a coleta for nova ou se a data/status mudou para concluir
    -- Consideramos apenas coletas concluídas (assumo que status existe ou apenas a existência da linha basta se for o fluxo padrão)
    
    -- Pegar a data da coleta mais recente deste cliente
    SELECT data_coleta INTO v_ultima_data
    FROM coletas
    WHERE cliente_id = NEW.cliente_id
    ORDER BY data_coleta DESC
    LIMIT 1;

    -- Pegar a data da coleta anterior para calcular o intervalo recente
    SELECT data_coleta INTO v_penultima_data
    FROM coletas
    WHERE cliente_id = NEW.cliente_id
      AND data_coleta < v_ultima_data
    ORDER BY data_coleta DESC
    LIMIT 1;

    -- Cálculo simplificado da média (podemos evoluir para média das últimas 4 coletas conforme o plano)
    -- Por enquanto, vamos calcular o intervalo entre as duas últimas
    IF v_penultima_data IS NOT NULL THEN
        v_diff := EXTRACT(DAY FROM (v_ultima_data - v_penultima_data));
        
        -- Ignorar intervalos muito curtos (< 2 dias) conforme o plano
        IF v_diff >= 2 THEN
            -- Se já tiver uma média, faz uma média ponderada ou apenas atualiza com base no histórico
            -- Vamos pegar a média das últimas 4 coletas reais
            SELECT AVG(diff)::INTEGER INTO v_media
            FROM (
                SELECT 
                    EXTRACT(DAY FROM (data_coleta - LAG(data_coleta) OVER (ORDER BY data_coleta))) as diff
                FROM coletas
                WHERE cliente_id = NEW.cliente_id
                ORDER BY data_coleta DESC
                LIMIT 4
            ) as intervals
            WHERE diff >= 2;
        END IF;
    END IF;

    -- Se não conseguiu calcular média, mantém a atual ou define um padrão se for a primeira
    IF v_media IS NULL THEN
        SELECT media_dias_coleta INTO v_media FROM clientes WHERE id = NEW.cliente_id;
    END IF;

    -- Atualizar o cliente
    UPDATE clientes
    SET 
        data_ultima_coleta = v_ultima_data,
        media_dias_coleta = COALESCE(v_media, 0),
        proxima_coleta_prevista = CASE 
            WHEN v_media > 0 THEN v_ultima_data + (v_media || ' days')::INTERVAL
            ELSE NULL
        END
    WHERE id = NEW.cliente_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para disparar após insert ou update na tabela coletas
DROP TRIGGER IF EXISTS trg_update_cliente_coleta_stats ON coletas;
CREATE TRIGGER trg_update_cliente_coleta_stats
AFTER INSERT OR UPDATE OF data_coleta ON coletas
FOR EACH ROW
EXECUTE FUNCTION update_cliente_coleta_stats();
