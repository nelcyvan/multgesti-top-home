CREATE OR REPLACE FUNCTION GESTLOG_APP_ROTAS_PEDIDOS_FULL (
    p_data_rota IN DATE
) RETURN CLOB
IS
    v_json CLOB;
BEGIN

    WITH ROTAS_FILTRADAS AS (
        SELECT *
        FROM GESTLOG_ROTAS
        WHERE DATA_ROTA >= p_data_rota
          AND DATA_ROTA < p_data_rota + 1
    ),

    BASE AS (
        SELECT
            -- ROTAS
            r.ID_ROTA,
            r.DESCRICAO_ROTA,
            r.BAIRRO_ROTA_1,
            r.BAIRRO_ROTA_2,
            r.BAIRRO_ROTA_3,
            r.BAIRRO_ROTA_4,
            r.BAIRRO_ROTA_5,
            r.COD_MOTORISTA,
            r.COD_VEICULO,
            r.DATA_ROTA,
            r.CODUSUR_CRIACAO,
            r.DATA_CRIACAO,
            r.TURNO_SEPARACAO,
            mot.NOME AS MOTORISTA_NOME,
            vei.DESCRICAO_VEICULO AS VEICULO_DESCRICAO,
            vei.PLACA_VEICULO AS VEICULO_PLACA,
            vei.CAPACIDADE_CIMENTO AS VEICULO_CAPACIDADE_CIMENTO,

            -- RELAÇÃO (pode não existir ainda)
            rp.ID_ITEM,
            rp.CODUSUR_ADD,
            rp.DATA_ADD,

            -- PEDIDO
            ee.NUMPED,
            ee.POSICAO,
            ee.CODUSUR,
            ee.CODFUNCSEP,
            ee.ULTIMASITUACAOCFAT,
            ee.OBS,
            ee.OBS1,
            ee.OBS2,
            ee.OBSENTREGA1,
            ee.OBSENTREGA2,
            ee.OBSENTREGA3,
            ee.LOG2,

            -- ITEM
            aa.CODFILIALRETIRA,
            aa.DATA AS DATA_PEDIDO,
            aa.CODCLI,
            aa.CODPROD,
            aa.QT,
            aa.PVENDA,
            aa.CODFUNCSEP AS CODFUNCSEP_ITEM,

            -- CLIENTE
            bb.CLIENTE,

            -- PRODUTO
            cc.DESCRICAO,
            cc.CODAUXILIAR,
            cc.MULTIPLO,
            cc.EMBALAGEMMASTER,

            -- MARCA
            dd.MARCA,

            -- USUÁRIO
            ff.NOME AS NOME_USUARIO,

            -- SEPARADORES
            sepPed.NOME AS NOME_SEPARADOR_PEDIDO,
            sepItem.NOME AS NOME_SEPARADOR_ITEM,

            -- STATUS ESPECIAL
            NVL(esp.STATUS_PRIORIDADE, 'N') AS STATUS_PRIORIDADE,
            NVL(esp.STATUS_SEPARADO, 'N') AS STATUS_SEPARADO,
            NVL(esp.STATUS_COLETA, 'N') AS STATUS_COLETA,
            NVL(esp.STATUS_ROTA, 'N') AS STATUS_ROTA,
            NVL(esp.STATUS_LOCALIZACAO, 'N') AS STATUS_LOCALIZACAO,
            NVL(esp.STATUS_FATURA, 'N') AS STATUS_FATURA,
            NVL(esp.STATUS_CORTE, 'N') AS STATUS_CORTE,
            NVL(esp.STATUS_ENV_MESSEJANA, 'N') AS STATUS_ENV_MESSEJANA,

            -- CAMPOS CALCULADOS
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
                WHEN aa.QT IS NULL OR cc.MULTIPLO IS NULL THEN NULL
                WHEN cc.MULTIPLO < 1 THEN 'Multiplo errado'
                WHEN ABS((aa.QT / cc.MULTIPLO) - ROUND(aa.QT / cc.MULTIPLO)) < 0.0001
                    THEN TO_CHAR(ROUND(aa.QT / cc.MULTIPLO)) || ' ' || cc.EMBALAGEMMASTER
                ELSE 'Multiplo errado'
            END QT_TOTAL

        FROM ROTAS_FILTRADAS r
        LEFT JOIN GESTLOG_ROTAS_PEDIDOS rp
               ON rp.ID_ROTA = r.ID_ROTA
        LEFT JOIN GESTLOG_MOTORISTAS mot
               ON mot.ID = r.COD_MOTORISTA
        LEFT JOIN GESTLOG_VEICULOS vei
               ON vei.ID = r.COD_VEICULO
        LEFT JOIN PCPEDC ee
               ON ee.NUMPED = rp.NUMPED
              AND ee.POSICAO IN ('L','M','P', 'F')
        LEFT JOIN PCPEDI aa
               ON aa.NUMPED = ee.NUMPED
        LEFT JOIN PCCLIENT bb
               ON bb.CODCLI = aa.CODCLI
        LEFT JOIN PCPRODUT cc
               ON cc.CODPROD = aa.CODPROD
        LEFT JOIN PCMARCA dd
               ON dd.CODMARCA = cc.CODMARCA
        LEFT JOIN PCUSUARI ff
               ON ff.CODUSUR = ee.CODUSUR
        LEFT JOIN PCEMPR sepPed
               ON sepPed.MATRICULA = ee.CODFUNCSEP
        LEFT JOIN PCEMPR sepItem
               ON sepItem.MATRICULA = aa.CODFUNCSEP
        LEFT JOIN MULTGESTI_STATUS_ESPECIAL_PEDIDOS esp
               ON esp.NUMPED = ee.NUMPED
    )

    SELECT COALESCE(
        JSON_ARRAYAGG(
            JSON_OBJECT(
        'id_rota' VALUE ID_ROTA,
        'descricao_rota' VALUE DESCRICAO_ROTA,
        'bairro1' VALUE BAIRRO_ROTA_1,
        'bairro2' VALUE BAIRRO_ROTA_2,
        'bairro3' VALUE BAIRRO_ROTA_3,
        'bairro4' VALUE BAIRRO_ROTA_4,
        'bairro5' VALUE BAIRRO_ROTA_5,
        'cod_motorista' VALUE COD_MOTORISTA,
        'cod_veiculo' VALUE COD_VEICULO,
        'motorista_nome' VALUE MOTORISTA_NOME,
        'veiculo_descricao' VALUE VEICULO_DESCRICAO,
        'veiculo_placa' VALUE VEICULO_PLACA,
        'veiculo_capacidade_cimento' VALUE VEICULO_CAPACIDADE_CIMENTO,
        'data_rota' VALUE DATA_ROTA,
        'turno_separacao' VALUE TURNO_SEPARACAO,

        'id_item_rota' VALUE ID_ITEM,
        'data_add_rota' VALUE DATA_ADD,

        'numped' VALUE NUMPED,
        'posicao' VALUE POSICAO,
        'status_log' VALUE LOG2,
        'status_descricao' VALUE STATUS_AUXILIAR,

        'codcli' VALUE CODCLI,
        'cliente' VALUE CLIENTE,

        'codprod' VALUE CODPROD,
        'descricao_produto' VALUE DESCRICAO,
        'codauxiliar' VALUE CODAUXILIAR,
        'marca' VALUE MARCA,

        'qt' VALUE QT,
        'multiplo' VALUE MULTIPLO,
        'qt_total' VALUE QT_TOTAL,
        'pvenda' VALUE PVENDA,

        'separador_pedido' VALUE NOME_SEPARADOR_PEDIDO,
        'separador_item' VALUE NOME_SEPARADOR_ITEM,

        'obs' VALUE OBS,
        'obs1' VALUE OBS1,
        'obs2' VALUE OBS2,
        'obs_entrega1' VALUE OBSENTREGA1,
        'obs_entrega2' VALUE OBSENTREGA2,
        'obs_entrega3' VALUE OBSENTREGA3,

        'prioridade' VALUE STATUS_PRIORIDADE,
        'separado' VALUE STATUS_SEPARADO,
        'coleta' VALUE STATUS_COLETA,
        'rota_status' VALUE STATUS_ROTA,
        'localizacao' VALUE STATUS_LOCALIZACAO,
        'fatura' VALUE STATUS_FATURA,
        'corte' VALUE STATUS_CORTE,
        'env_messejana' VALUE STATUS_ENV_MESSEJANA
            RETURNING CLOB
            )
            ORDER BY ID_ROTA, NUMPED NULLS LAST, CODPROD NULLS LAST
            RETURNING CLOB
        ),
        TO_CLOB('[]')
    )
    INTO v_json
    FROM BASE;

    RETURN v_json;

END;
/
