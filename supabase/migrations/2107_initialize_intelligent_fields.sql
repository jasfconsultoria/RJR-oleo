-- Migração para inicializar campos de inteligência de coletas
-- Prioriza a data real da última coleta na tabela 'coletas'
-- Se não houver coletas, usa CURRENT_TIMESTAMP as fallback
-- Define a média inicial como 10 dias

WITH UltimasColetas AS (
  SELECT 
    cliente_id, 
    MAX(data_coleta) as data_ultima
  FROM coletas
  GROUP BY cliente_id
)
UPDATE clientes c
SET 
  data_ultima_coleta = COALESCE(uc.data_ultima, CURRENT_TIMESTAMP),
  media_dias_coleta = 10,
  proxima_coleta_prevista = COALESCE(uc.data_ultima, CURRENT_TIMESTAMP) + INTERVAL '10 days'
FROM UltimasColetas uc
WHERE c.id = uc.cliente_id 
  AND (c.data_ultima_coleta IS NULL OR c.media_dias_coleta IS NULL);

-- Fallback para clientes sem nenhuma coleta na tabela 'coletas'
UPDATE clientes
SET 
  data_ultima_coleta = CURRENT_TIMESTAMP,
  media_dias_coleta = 10,
  proxima_coleta_prevista = CURRENT_TIMESTAMP + INTERVAL '10 days'
WHERE data_ultima_coleta IS NULL OR media_dias_coleta IS NULL;
