-- 🔥 ÍNDICES SUGERIDOS (APLIQUE FORA DA FUNÇÃO, UMA ÚNICA VEZ)
-- CREATE INDEX IDX_STATUS_ESPECIAL_NUMPED ON MULTGESTI_STATUS_ESPECIAL_PEDIDOS (NUMPED);
-- CREATE INDEX IDX_PCPEDI_FULL            ON PCPEDI (NUMPED, CODFUNCSEP, CODPROD);
-- CREATE INDEX IDX_PCPRODUT_BASIC         ON PCPRODUT (CODPROD, CODMARCA, MULTIPLO);
-- CREATE INDEX IDX_PCPEDC_PERF            ON PCPEDC (POSICAO, LOG2, CODFUNCSEP, NUMPED);

CREATE OR REPLACE FUNCTION GESTLOG_APP_PEDIDOS_SEPARADOR_STATUS (
    p_codigo IN NUMBER
) RETURN CLOB
IS
    v_json CLOB;
BEGIN

    WITH
    ESPECIAL AS (
        SELECT
            NUMPED,
            MAX(STATUS_PRIORIDADE) AS STATUS_PRIORIDADE,
            MAX(STATUS_SEPARADO) AS STATUS_SEPARADO,
            MAX(STATUS_COLETA) AS STATUS_COLETA,
            MAX(STATUS_ROTA) AS STATUS_ROTA,
            MAX(STATUS_LOCALIZACAO) AS STATUS_LOCALIZACAO,
            MAX(STATUS_FATURA) AS STATUS_FATURA,
            MAX(STATUS_CORTE) AS STATUS_CORTE,
            MAX(STATUS_ENV_MESSEJANA) AS STATUS_ENV_MESSEJANA
        FROM MULTGESTI_STATUS_ESPECIAL_PEDIDOS
        GROUP BY NUMPED
    ),
    -- 🔥 BASE COMPLETA (COBERTURA TOTAL, COM JOIN NA TABELA ESPECIAL)
    BASE_TODOS AS (
        SELECT
            aa.NUMPED,
            aa.CODFILIALRETIRA,
            aa.DATA,
            aa.CODCLI,
            bb.CLIENTE,
            aa.CODPROD,
            cc.DESCRICAO,
            cc.CODAUXILIAR,
            dd.MARCA,
            aa.QT,
            cc.MULTIPLO,
            aa.PVENDA,
            ee.CODFUNCSEP,
            aa.CODFUNCSEP AS SEPARADOR_ITEM,
            sepPed.NOME AS NOME_SEPARADOR,
            sepItem.NOME AS NOME_SEPARADOR_ITEM,
            ee.OBS,
            ee.OBS1,
            ee.OBS2,
            ee.OBSENTREGA1,
            ee.OBSENTREGA2,
            ee.OBSENTREGA3,
            ff.NOME,
            ee.LOG2,

            NVL(esp.STATUS_PRIORIDADE, 'N') AS STATUS_ESPECIAL_PRIORIDADE,
            NVL(esp.STATUS_SEPARADO, 'N') AS STATUS_ESPECIAL_SEPARADO,
            NVL(esp.STATUS_COLETA, 'N') AS STATUS_ESPECIAL_COLETA,
            NVL(esp.STATUS_ROTA, 'N') AS STATUS_ESPECIAL_ROTA,
            NVL(esp.STATUS_LOCALIZACAO, 'N') AS STATUS_ESPECIAL_LOCALIZACAO,
            NVL(esp.STATUS_FATURA, 'N') AS STATUS_ESPECIAL_FATURA,
            NVL(esp.STATUS_CORTE, 'N') AS STATUS_ESPECIAL_CORTE,
            NVL(esp.STATUS_ENV_MESSEJANA, 'N') AS STATUS_ESPECIAL_ENV_MESSEJANA,

            CASE ee.LOG2
                WHEN '2' THEN 'Separando'
                WHEN '3' THEN 'Separado'
                WHEN '13' THEN 'Corte'
                WHEN '16' THEN 'Separação Cancelada'
                WHEN '17' THEN 'Coleta'
                WHEN '25' THEN 'Retira Posterior'
                WHEN '20' THEN 'Enviar p/ Messejana'
                WHEN '22' THEN 'Corte Realizado'
                WHEN '23' THEN 'Pedidos Prioridade'
                ELSE 'Outro'
            END STATUS_AUXILIAR,

            CASE
                WHEN cc.MULTIPLO < 1 THEN 'Multiplo errado'
                WHEN ABS((aa.QT / cc.MULTIPLO) - ROUND(aa.QT / cc.MULTIPLO)) < 0.0001
                    THEN TO_CHAR(ROUND(aa.QT / cc.MULTIPLO)) || ' ' || cc.EMBALAGEMMASTER
                ELSE 'Multiplo errado'
            END QT_TOTAL

        FROM PCPEDC ee
        JOIN PCPEDI aa ON aa.NUMPED = ee.NUMPED
        JOIN PCCLIENT bb ON bb.CODCLI = aa.CODCLI
        JOIN PCPRODUT cc ON cc.CODPROD = aa.CODPROD
        LEFT JOIN PCMARCA dd ON dd.CODMARCA = cc.CODMARCA
        JOIN PCUSUARI ff ON ff.CODUSUR = ee.CODUSUR
        LEFT JOIN PCEMPR sepPed ON sepPed.MATRICULA = ee.CODFUNCSEP
        LEFT JOIN PCEMPR sepItem ON sepItem.MATRICULA = aa.CODFUNCSEP
        LEFT JOIN ESPECIAL esp ON esp.NUMPED = ee.NUMPED

        WHERE
            ee.POSICAO IN ('L','M','P')
            AND ee.LOG2 IN ('2','3','13','16','17','25','20','22','23')
    ),

    -- 🔥 SUB-BLOCOS FILTRADOS PARA PERFORMANCE
    BASE_CODIGO AS (
        SELECT * FROM BASE_TODOS
        WHERE CODFUNCSEP = p_codigo
          AND LOG2 IN ('2','3')
    ),
    BASE_OUTROS AS (
        SELECT * FROM BASE_TODOS
        WHERE (CODFUNCSEP IS NULL OR CODFUNCSEP <> p_codigo)
          AND LOG2 IN ('2','3')
    ),
    BASE_STATUS AS (
        SELECT * FROM BASE_TODOS
        WHERE LOG2 NOT IN ('2','3')
    ),

    -- 🔥 ITENS AGRUPADOS POR BLOCO (REDUZ O VOLUME AGRUPADO)
    ITENS_AGRUPADOS_CODIGO AS (
        SELECT
            NUMPED,
            CODFUNCSEP,
            LOG2,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'codprod' VALUE CODPROD,
                    'descricao' VALUE DESCRICAO,
                    'codauxiliar' VALUE CODAUXILIAR,
                    'marca' VALUE MARCA,
                    'qt' VALUE QT,
                    'multiplo' VALUE MULTIPLO,
                    'qt_total' VALUE QT_TOTAL,
                    'pvenda' VALUE PVENDA
                RETURNING CLOB)
            RETURNING CLOB) AS ITENS_JSON
        FROM BASE_CODIGO
        GROUP BY NUMPED, CODFUNCSEP, LOG2
    ),
    ITENS_AGRUPADOS_OUTROS AS (
        SELECT
            NUMPED,
            CODFUNCSEP,
            LOG2,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'codprod' VALUE CODPROD,
                    'descricao' VALUE DESCRICAO,
                    'codauxiliar' VALUE CODAUXILIAR,
                    'marca' VALUE MARCA,
                    'qt' VALUE QT,
                    'multiplo' VALUE MULTIPLO,
                    'qt_total' VALUE QT_TOTAL,
                    'pvenda' VALUE PVENDA
                RETURNING CLOB)
            RETURNING CLOB) AS ITENS_JSON
        FROM BASE_OUTROS
        GROUP BY NUMPED, CODFUNCSEP, LOG2
    ),
    ITENS_AGRUPADOS_STATUS AS (
        SELECT
            NUMPED,
            LOG2,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'codprod' VALUE CODPROD,
                    'descricao' VALUE DESCRICAO,
                    'codauxiliar' VALUE CODAUXILIAR,
                    'marca' VALUE MARCA,
                    'qt' VALUE QT,
                    'multiplo' VALUE MULTIPLO,
                    'qt_total' VALUE QT_TOTAL,
                    'pvenda' VALUE PVENDA
                RETURNING CLOB)
            RETURNING CLOB) AS ITENS_JSON
        FROM BASE_STATUS
        GROUP BY NUMPED, LOG2
    )

    SELECT JSON_OBJECT(

        -- 🔹 BLOCO CODIGO (PARIDADE COM FUNÇÃO ATUAL)
        'bloco_codigo' VALUE NVL(
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'numped' VALUE b.NUMPED,
                        'codfilialretira' VALUE b.CODFILIALRETIRA,
                        'data' VALUE b.DATA,
                        'codcli' VALUE b.CODCLI,
                        'cliente' VALUE b.CLIENTE,
                        'usuario' VALUE b.NOME,
                        'status' VALUE b.STATUS_AUXILIAR,
                        'log2' VALUE b.LOG2,
                        'status_especial_prioridade' VALUE b.STATUS_ESPECIAL_PRIORIDADE,
                        'status_especial_separado' VALUE b.STATUS_ESPECIAL_SEPARADO,
                        'status_especial_coleta' VALUE b.STATUS_ESPECIAL_COLETA,
                        'status_especial_rota' VALUE b.STATUS_ESPECIAL_ROTA,
                        'status_especial_localizacao' VALUE b.STATUS_ESPECIAL_LOCALIZACAO,
                        'status_especial_fatura' VALUE b.STATUS_ESPECIAL_FATURA,
                        'status_especial_corte' VALUE b.STATUS_ESPECIAL_CORTE,
                        'status_especial_env_messejana' VALUE b.STATUS_ESPECIAL_ENV_MESSEJANA,
                        'obs' VALUE b.OBS,
                        'obs1' VALUE b.OBS1,
                        'obs2' VALUE b.OBS2,
                        'obsentrega1' VALUE b.OBSENTREGA1,
                        'obsentrega2' VALUE b.OBSENTREGA2,
                        'obsentrega3' VALUE b.OBSENTREGA3,
                        'separador_item' VALUE b.SEPARADOR_ITEM,
                        'nome_separador' VALUE b.NOME_SEPARADOR,
                        'nome_separador_item' VALUE b.NOME_SEPARADOR_ITEM,
                        'itens' VALUE ia.ITENS_JSON FORMAT JSON
                    RETURNING CLOB)
                RETURNING CLOB)
                FROM (
                    SELECT DISTINCT
                        NUMPED,
                        CODFILIALRETIRA,
                        DATA,
                        CODCLI,
                        CLIENTE,
                        NOME,
                        STATUS_AUXILIAR,
                        LOG2,
                        STATUS_ESPECIAL_PRIORIDADE,
                        STATUS_ESPECIAL_SEPARADO,
                        STATUS_ESPECIAL_COLETA,
                        STATUS_ESPECIAL_ROTA,
                        STATUS_ESPECIAL_LOCALIZACAO,
                        STATUS_ESPECIAL_FATURA,
                        STATUS_ESPECIAL_CORTE,
                        STATUS_ESPECIAL_ENV_MESSEJANA,
                        OBS,
                        OBS1,
                        OBS2,
                        OBSENTREGA1,
                        OBSENTREGA2,
                        OBSENTREGA3,
                        CODFUNCSEP,
                        SEPARADOR_ITEM,
                        NOME_SEPARADOR,
                        NOME_SEPARADOR_ITEM
                    FROM BASE_CODIGO
                ) b
                JOIN ITENS_AGRUPADOS_CODIGO ia
                  ON ia.NUMPED = b.NUMPED
                 AND ia.CODFUNCSEP = b.CODFUNCSEP
                 AND ia.LOG2 = b.LOG2
            ),
            '[]'
        ) FORMAT JSON,

        -- 🔹 BLOCO CODIGO OUTROS (PARIDADE COM FUNÇÃO ATUAL)
        'bloco_codigo_outros' VALUE NVL(
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'numped' VALUE b.NUMPED,
                        'codfilialretira' VALUE b.CODFILIALRETIRA,
                        'data' VALUE b.DATA,
                        'codcli' VALUE b.CODCLI,
                        'cliente' VALUE b.CLIENTE,
                        'usuario' VALUE b.NOME,
                        'status' VALUE b.STATUS_AUXILIAR,
                        'log2' VALUE b.LOG2,
                        'status_especial_prioridade' VALUE b.STATUS_ESPECIAL_PRIORIDADE,
                        'status_especial_separado' VALUE b.STATUS_ESPECIAL_SEPARADO,
                        'status_especial_coleta' VALUE b.STATUS_ESPECIAL_COLETA,
                        'status_especial_rota' VALUE b.STATUS_ESPECIAL_ROTA,
                        'status_especial_localizacao' VALUE b.STATUS_ESPECIAL_LOCALIZACAO,
                        'status_especial_fatura' VALUE b.STATUS_ESPECIAL_FATURA,
                        'status_especial_corte' VALUE b.STATUS_ESPECIAL_CORTE,
                        'status_especial_env_messejana' VALUE b.STATUS_ESPECIAL_ENV_MESSEJANA,
                        'obs' VALUE b.OBS,
                        'obs1' VALUE b.OBS1,
                        'obs2' VALUE b.OBS2,
                        'obsentrega1' VALUE b.OBSENTREGA1,
                        'obsentrega2' VALUE b.OBSENTREGA2,
                        'obsentrega3' VALUE b.OBSENTREGA3,
                        'separador_item' VALUE b.SEPARADOR_ITEM,
                        'nome_separador' VALUE b.NOME_SEPARADOR,
                        'nome_separador_item' VALUE b.NOME_SEPARADOR_ITEM,
                        'itens' VALUE ia.ITENS_JSON FORMAT JSON
                    RETURNING CLOB)
                RETURNING CLOB)
                FROM (
                    SELECT DISTINCT
                        NUMPED,
                        CODFILIALRETIRA,
                        DATA,
                        CODCLI,
                        CLIENTE,
                        NOME,
                        STATUS_AUXILIAR,
                        LOG2,
                        STATUS_ESPECIAL_PRIORIDADE,
                        STATUS_ESPECIAL_SEPARADO,
                        STATUS_ESPECIAL_COLETA,
                        STATUS_ESPECIAL_ROTA,
                        STATUS_ESPECIAL_LOCALIZACAO,
                        STATUS_ESPECIAL_FATURA,
                        STATUS_ESPECIAL_CORTE,
                        STATUS_ESPECIAL_ENV_MESSEJANA,
                        OBS,
                        OBS1,
                        OBS2,
                        OBSENTREGA1,
                        OBSENTREGA2,
                        OBSENTREGA3,
                        CODFUNCSEP,
                        SEPARADOR_ITEM,
                        NOME_SEPARADOR,
                        NOME_SEPARADOR_ITEM
                    FROM BASE_OUTROS
                ) b
                JOIN ITENS_AGRUPADOS_OUTROS ia
                  ON ia.NUMPED = b.NUMPED
                 AND ia.CODFUNCSEP = b.CODFUNCSEP
                 AND ia.LOG2 = b.LOG2
            ),
            '[]'
        ) FORMAT JSON,

        -- 🔹 BLOCO STATUS (PARIDADE COM FUNÇÃO ATUAL)
        'bloco_status' VALUE NVL(
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'numped' VALUE b.NUMPED,
                        'codfilialretira' VALUE b.CODFILIALRETIRA,
                        'data' VALUE b.DATA,
                        'codcli' VALUE b.CODCLI,
                        'cliente' VALUE b.CLIENTE,
                        'usuario' VALUE b.NOME,
                        'status' VALUE b.STATUS_AUXILIAR,
                        'log2' VALUE b.LOG2,
                        'status_especial_prioridade' VALUE b.STATUS_ESPECIAL_PRIORIDADE,
                        'status_especial_separado' VALUE b.STATUS_ESPECIAL_SEPARADO,
                        'status_especial_coleta' VALUE b.STATUS_ESPECIAL_COLETA,
                        'status_especial_rota' VALUE b.STATUS_ESPECIAL_ROTA,
                        'status_especial_localizacao' VALUE b.STATUS_ESPECIAL_LOCALIZACAO,
                        'status_especial_fatura' VALUE b.STATUS_ESPECIAL_FATURA,
                        'status_especial_corte' VALUE b.STATUS_ESPECIAL_CORTE,
                        'status_especial_env_messejana' VALUE b.STATUS_ESPECIAL_ENV_MESSEJANA,
                        'obs' VALUE b.OBS,
                        'obs1' VALUE b.OBS1,
                        'obs2' VALUE b.OBS2,
                        'obsentrega1' VALUE b.OBSENTREGA1,
                        'obsentrega2' VALUE b.OBSENTREGA2,
                        'obsentrega3' VALUE b.OBSENTREGA3,
                        'separador_item' VALUE b.SEPARADOR_ITEM,
                        'nome_separador' VALUE b.NOME_SEPARADOR,
                        'nome_separador_item' VALUE b.NOME_SEPARADOR_ITEM,
                        'itens' VALUE ia.ITENS_JSON FORMAT JSON
                    RETURNING CLOB)
                RETURNING CLOB)
                FROM (
                    SELECT DISTINCT
                        NUMPED,
                        CODFILIALRETIRA,
                        DATA,
                        CODCLI,
                        CLIENTE,
                        NOME,
                        STATUS_AUXILIAR,
                        LOG2,
                        STATUS_ESPECIAL_PRIORIDADE,
                        STATUS_ESPECIAL_SEPARADO,
                        STATUS_ESPECIAL_COLETA,
                        STATUS_ESPECIAL_ROTA,
                        STATUS_ESPECIAL_LOCALIZACAO,
                        STATUS_ESPECIAL_FATURA,
                        STATUS_ESPECIAL_CORTE,
                        STATUS_ESPECIAL_ENV_MESSEJANA,
                        OBS,
                        OBS1,
                        OBS2,
                        OBSENTREGA1,
                        OBSENTREGA2,
                        OBSENTREGA3,
                        SEPARADOR_ITEM,
                        NOME_SEPARADOR,
                        NOME_SEPARADOR_ITEM
                    FROM BASE_STATUS
                ) b
                JOIN ITENS_AGRUPADOS_STATUS ia
                  ON ia.NUMPED = b.NUMPED
                 AND ia.LOG2 = b.LOG2
            ),
            '[]'
        ) FORMAT JSON

    RETURNING CLOB)
    INTO v_json
    FROM DUAL;

    RETURN v_json;

END;
