CREATE OR REPLACE PROCEDURE GESTLOG_GESTAO_CONFIRMACAO_ENTREGAS (
    p_num_nota             IN NUMBER,
    p_num_pedido_tv8       IN NUMBER,
    p_valor_despacho       IN NUMBER,
    p_sem_dinheiro         IN NUMBER, -- 0 = FALSE | 1 = TRUE
    p_codusur_ult_atual    IN NUMBER,
    p_id_lote              IN NUMBER,
    p_tipo_anterior_entrega_ou_retira IN VARCHAR2 DEFAULT NULL,
    p_novo_tipo_entrega_ou_retira     IN VARCHAR2 DEFAULT NULL
)
AS
    v_vldespacho           NUMBER(18,6);
    v_codcli               NUMBER;
    v_num_ped_tv7          NUMBER;
    v_data_hora            DATE := SYSDATE;
    v_exists               NUMBER;
BEGIN

    -- Validações
    IF p_num_nota IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'numNota é obrigatório');
    END IF;

    IF p_num_pedido_tv8 IS NULL THEN
        RAISE_APPLICATION_ERROR(-20002, 'numPedidoTv8 é obrigatório');
    END IF;

    IF p_id_lote IS NULL OR p_id_lote <= 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'ID_LOTE é obrigatório e deve ser maior que zero');
    END IF;

    -- Define valor despacho
    IF NVL(p_sem_dinheiro, 0) = 1 THEN
        v_vldespacho := 0;
    ELSE
        v_vldespacho := NVL(p_valor_despacho, 0);
    END IF;

    IF NVL(p_sem_dinheiro, 0) = 0
       AND (v_vldespacho IS NULL OR v_vldespacho <= 0) THEN
        RAISE_APPLICATION_ERROR(-20004, 'valorDespacho deve ser maior que zero');
    END IF;

    ----------------------------------------------------------------------
    -- UPDATE PCNFSAID
    ----------------------------------------------------------------------
    UPDATE PCNFSAID
       SET SITDOC     = 'S',
           VLDESPACHO = v_vldespacho
     WHERE NUMNOTA = p_num_nota
       AND NUMPED  = p_num_pedido_tv8;

    ----------------------------------------------------------------------
    -- PROCESSA SALDO / LOTE
    ----------------------------------------------------------------------
    IF v_vldespacho > 0 THEN

        IF p_codusur_ult_atual IS NULL
           OR p_codusur_ult_atual <= 0 THEN
            RAISE_APPLICATION_ERROR(-20005, 'codusurUltAtual inválido');
        END IF;

        ------------------------------------------------------------------
        -- BUSCA DADOS DA NOTA
        ------------------------------------------------------------------
        BEGIN
            SELECT
                nota.CODCLI,
                pedido.NUMPEDENTFUT
            INTO
                v_codcli,
                v_num_ped_tv7
            FROM PCNFSAID nota
            JOIN PCPEDC pedido
              ON pedido.NUMPED = nota.NUMPED
            WHERE nota.NUMNOTA = p_num_nota
              AND nota.NUMPED  = p_num_pedido_tv8;

        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RAISE_APPLICATION_ERROR(
                    -20006,
                    'Não foi possível localizar CODCLI/NUMPED_TV7'
                );
        END;

        ------------------------------------------------------------------
        -- UPDATE SALDO
        ------------------------------------------------------------------
        UPDATE MULTGESTI_FINANCEIRO_SALDO_DINHEIRO aa
           SET aa.VL_SALDO_DINHEIRO =
                    NVL(aa.VL_SALDO_DINHEIRO, 0) + v_vldespacho,
               aa.DATA_HORA_ULT_ATUAL = v_data_hora,
               aa.CODUSUR_ULT_ATUAL   = p_codusur_ult_atual,
               aa.ID_LOTE             = p_id_lote
         WHERE aa.CODFILIAL = 3
           AND aa.ID_LOTE = p_id_lote
           AND aa.DATA_HORA_SANGRIA IS NULL
           AND aa.CODUSUR_SANGRIA IS NULL;

        ------------------------------------------------------------------
        -- INSERT LOTE
        ------------------------------------------------------------------
        INSERT INTO MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES (
            ID_LOTE,
            CODFILIAL,
            NUMPED_TV7,
            NUMPED_TV8,
            NUMNOTA,
            CODCLI,
            VL_DINHEIRO,
            DATA_HORA,
            CODUSUR
        ) VALUES (
            p_id_lote,
            '3',
            v_num_ped_tv7,
            p_num_pedido_tv8,
            p_num_nota,
            v_codcli,
            v_vldespacho,
            v_data_hora,
            p_codusur_ult_atual
        );

    END IF;

    ----------------------------------------------------------------------
    -- AJUSTE TIPO ENTREGA/RETIRA (quando tipo anterior = 'EF')
    ----------------------------------------------------------------------
    IF UPPER(TRIM(NVL(p_tipo_anterior_entrega_ou_retira, ''))) IN ('EF', 'EN') THEN
        IF UPPER(TRIM(NVL(p_novo_tipo_entrega_ou_retira, ''))) NOT IN ('EN', 'RP') THEN
            RAISE_APPLICATION_ERROR(
                -20007,
                'NovoTipoEntregaOuRetira inválido (use EN ou RP)'
            );
        END IF;

        SELECT COUNT(1)
          INTO v_exists
          FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES
         WHERE ID_LOTE   = p_id_lote
           AND NUMPED_TV8 = p_num_pedido_tv8;

        IF v_exists > 0 THEN
            UPDATE MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES
               SET TIPO_ENTREGA_RETIRA_ANTERIOR = UPPER(TRIM(p_tipo_anterior_entrega_ou_retira))
             WHERE ID_LOTE   = p_id_lote
               AND NUMPED_TV8 = p_num_pedido_tv8;
        END IF;

        SELECT COUNT(1)
          INTO v_exists
          FROM PCPEDI
         WHERE NUMPED = p_num_pedido_tv8;

        IF v_exists = 0 THEN
            RAISE_APPLICATION_ERROR(
                -20009,
                'Pedido não encontrado em PCPEDI para o NUMPED informado'
            );
        END IF;

        UPDATE PCPEDI
           SET TIPOENTREGA = UPPER(TRIM(p_novo_tipo_entrega_ou_retira))
         WHERE NUMPED = p_num_pedido_tv8;
    END IF;

    COMMIT;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END GESTLOG_GESTAO_CONFIRMACAO_ENTREGAS;
/
