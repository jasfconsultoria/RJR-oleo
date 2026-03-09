-- Atualização da versão do sistema para 4.0.5
-- Data: 2026-03-08

-- Se a tabela 'versoes' existir, inserir ou atualizar a versão atual
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'versao_sistema') THEN
        -- Atualiza se já existir um registro, ou insere se estiver vazio
        IF EXISTS (SELECT 1 FROM versao_sistema LIMIT 1) THEN
            UPDATE versao_sistema 
            SET versao = '4.0.5', 
                data_atualizacao = NOW(),
                descricao = 'Módulo de Rotas, Mapas e Padronização de Filtros Mobile';
        ELSE
            INSERT INTO versao_sistema (versao, data_atualizacao, descricao)
            VALUES ('4.0.5', NOW(), 'Módulo de Rotas, Mapas e Padronização de Filtros Mobile');
        END IF;
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'configuracoes') THEN
        -- Algumas arquiteturas guardam a versão em uma tabela de configs
        UPDATE configuracoes SET valor = '4.0.5' WHERE chave = 'versao_sistema';
    END IF;
END $$;
