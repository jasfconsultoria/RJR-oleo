CREATE OR REPLACE FUNCTION get_public_recibo_data(p_coleta_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_data json;
BEGIN
    SELECT
        json_build_object(
            'coleta', row_to_json(c.*),
            'cliente', row_to_json(cl.*),
            'recibo', row_to_json(r.*),
            'empresa', (SELECT row_to_json(e.*) FROM empresa e LIMIT 1)
        )
    INTO result_data
    FROM coletas c
    LEFT JOIN clientes cl ON c.cliente_id = cl.id
    LEFT JOIN recibos r ON c.id = r.coleta_id
    WHERE c.id = p_coleta_id;

    RETURN result_data;
END;
$$;