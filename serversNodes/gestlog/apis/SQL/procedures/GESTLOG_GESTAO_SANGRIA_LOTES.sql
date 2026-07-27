CREATE OR REPLACE PROCEDURE GESTLOG_GESTAO_SANGRIA_LOTES (
    p_id_lote              IN NUMBER,
    p_data_hora_sangria    IN DATE,
    p_codusur_sangria      IN NUMBER,
    p_data_hora_ult_atual  IN DATE,
    p_codusur_ult_atual    IN NUMBER,
    consultar_lote         IN VARCHAR2 DEFAULT NULL,
    p_result               OUT SYS_REFCURSOR,
    p_codcli               IN NUMBER DEFAULT NULL,
    p_vl_dinheiro_avulso   IN NUMBER DEFAULT NULL,
    p_codfilial            IN VARCHAR2 DEFAULT NULL,
    p_codusur              IN NUMBER DEFAULT NULL,
    p_numped_tv7           IN NUMBER DEFAULT NULL,
    p_numped_tv8           IN NUMBER DEFAULT NULL,
    p_vl_saldo_fundo_cx    IN NUMBER DEFAULT NULL
)
AS
    v_novo_id_lote NUMBER;
    v_codfilial    MULTGESTI_FINANCEIRO_SALDO_DINHEIRO.CODFILIAL%TYPE;
BEGIN
    p_result := NULL;

    IF consultar_lote = 'atualizar_saldo_avulso' THEN
        IF p_id_lote IS NULL OR p_id_lote <= 0 THEN
            RAISE_APPLICATION_ERROR(-20011, 'ID_LOTE é obrigatório e deve ser maior que zero');
        END IF;
        IF p_vl_dinheiro_avulso IS NULL OR p_vl_dinheiro_avulso <= 0 THEN
            RAISE_APPLICATION_ERROR(-20013, 'VL_DINHEIRO_AVULSO deve ser maior que zero');
        END IF;
        IF p_codusur IS NULL OR p_codusur <= 0 THEN
            RAISE_APPLICATION_ERROR(-20014, 'CODUSUR é obrigatório e deve ser maior que zero');
        END IF;

        IF p_codfilial IS NOT NULL AND TRIM(p_codfilial) IS NOT NULL THEN
            v_codfilial := TRIM(p_codfilial);
        ELSE
            SELECT s.CODFILIAL
              INTO v_codfilial
              FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO s
             WHERE s.ID_LOTE = p_id_lote
               AND ROWNUM = 1;
        END IF;

        UPDATE MULTGESTI_FINANCEIRO_SALDO_DINHEIRO s
           SET s.VL_SALDO_DINHEIRO_AVULSO = NVL(s.VL_SALDO_DINHEIRO_AVULSO, 0) + NVL(p_vl_dinheiro_avulso, 0),
               s.DATA_HORA_ULT_ATUAL = SYSDATE,
               s.CODUSUR_ULT_ATUAL = p_codusur
         WHERE s.CODFILIAL = v_codfilial
           AND s.ID_LOTE = p_id_lote
        ;

        IF SQL%ROWCOUNT = 0 THEN
            RAISE_APPLICATION_ERROR(-20015, 'Saldo não encontrado para atualização (lote/filial)');
        END IF;

        INSERT INTO MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_AVULSO (
            ID_LOTE,
            CODFILIAL,
            NUMPED_TV7,
            NUMPED_TV8,
            CODCLI,
            VL_DINHEIRO_AVULSO,
            DATA_HORA,
            CODUSUR
        ) VALUES (
            p_id_lote,
            v_codfilial,
            NVL(p_numped_tv7, 0),
            NVL(p_numped_tv8, 0),
            NVL(p_codcli, 0),
            p_vl_dinheiro_avulso,
            SYSDATE,
            p_codusur
        );

        COMMIT;

        OPEN p_result FOR
            SELECT
                s.ID_LOTE,
                s.CODFILIAL,
                NVL(s.VL_SALDO_DINHEIRO_AVULSO, 0) AS VL_SALDO_DINHEIRO_AVULSO
            FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO s
            WHERE s.CODFILIAL = v_codfilial
              AND s.ID_LOTE = p_id_lote
            ;
        RETURN;
    END IF;

    IF consultar_lote = 'listar_avulsos' THEN
        OPEN p_result FOR
            SELECT
                a.ID_LOTE,
                a.CODFILIAL,
                a.NUMPED_TV7,
                a.NUMPED_TV8,
                a.CODCLI,
                a.VL_DINHEIRO_AVULSO,
                TO_CHAR(a.DATA_HORA, 'YYYY-MM-DD"T"HH24:MI:SS') || '-03:00' AS DATA_HORA,
                a.CODUSUR
            FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_AVULSO a
            WHERE a.ID_LOTE = p_id_lote
              AND (p_codfilial IS NULL OR TRIM(p_codfilial) IS NULL OR a.CODFILIAL = TRIM(p_codfilial))
            ORDER BY a.DATA_HORA DESC;
        RETURN;
    END IF;

    IF consultar_lote = 'consultar_lote' THEN
        OPEN p_result FOR
            SELECT 
                princ.ID_LOTE, 
                princ.CODFILIAL, 
                princ.NUMPED_TV7, 
                princ.NUMNOTA, 
                princ.CODCLI, 
                cli.CLIENTE, 
                princ.VL_DINHEIRO, 
                princ.DATA_HORA, 
                princ.CODUSUR, 
                NVL(usur.NOME, emp.NOME) AS NOME,
                princ.CONCILIADO,
                princ.CODUSUR_CONCILIACAO,
                princ.DATA_HORA_CONCILIACAO,
                (
                    SELECT LISTAGG(x.DUPLIC, ', ') WITHIN GROUP (ORDER BY x.DUPLIC)
                      FROM (
                            SELECT DISTINCT p.DUPLIC
                              FROM PCPREST p
                             WHERE p.NUMPED = princ.NUMPED_TV7
                               AND p.DUPLIC IS NOT NULL
                      ) x
                ) AS DUPLICATA
            FROM 
                MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES princ 
            JOIN 
                PCCLIENT cli 
              ON 
                cli.CODCLI = princ.CODCLI 
            LEFT JOIN PCUSUARI usur
              ON usur.CODUSUR = princ.CODUSUR
            LEFT JOIN PCEMPR emp
              ON emp.MATRICULA = princ.CODUSUR
            WHERE 
                princ.ID_LOTE = p_id_lote;
        RETURN;
    END IF;

    IF consultar_lote = 'conciliar_lote' THEN
        UPDATE MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES
           SET CONCILIADO = 'S',
               CODUSUR_CONCILIACAO = p_codusur_ult_atual,
               DATA_HORA_CONCILIACAO = SYSDATE
         WHERE ID_LOTE = p_id_lote
           AND NVL(CONCILIADO, 'N') <> 'S';

        COMMIT;

        OPEN p_result FOR
            SELECT 
                princ.ID_LOTE, 
                princ.CODFILIAL, 
                princ.NUMPED_TV7, 
                princ.NUMNOTA, 
                princ.CODCLI, 
                cli.CLIENTE, 
                princ.VL_DINHEIRO, 
                princ.DATA_HORA, 
                princ.CODUSUR, 
                NVL(usur.NOME, emp.NOME) AS NOME,
                princ.CONCILIADO,
                princ.CODUSUR_CONCILIACAO,
                princ.DATA_HORA_CONCILIACAO,
                (
                    SELECT LISTAGG(x.DUPLIC, ', ') WITHIN GROUP (ORDER BY x.DUPLIC)
                      FROM (
                            SELECT DISTINCT p.DUPLIC
                              FROM PCPREST p
                             WHERE p.NUMPED = princ.NUMPED_TV7
                               AND p.DUPLIC IS NOT NULL
                      ) x
                ) AS DUPLICATA
            FROM 
                MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES princ 
            JOIN 
                PCCLIENT cli 
              ON 
                cli.CODCLI = princ.CODCLI 
            LEFT JOIN PCUSUARI usur
              ON usur.CODUSUR = princ.CODUSUR
            LEFT JOIN PCEMPR emp
              ON emp.MATRICULA = princ.CODUSUR
            WHERE 
                princ.ID_LOTE = p_id_lote;
        RETURN;
    END IF;

    IF consultar_lote = 'consultar_lotes_finalizados' THEN
        OPEN p_result FOR
            SELECT
                s.ID_LOTE,
                s.CODFILIAL,
                s.VL_SALDO_DINHEIRO,
                NVL(s.VL_SALDO_DINHEIRO_AVULSO, 0) AS VL_SALDO_DINHEIRO_AVULSO,
                NVL(s.VL_SALDO_FUNDO_CX, 0) AS VL_SALDO_FUNDO_CX,
                s.DATA_HORA_SANGRIA,
                s.CODUSUR_SANGRIA,
                NVL(us_sang.NOME, emp_sang.NOME) AS NOME_SANGRIA,
                s.DATA_HORA_ULT_ATUAL,
                s.CODUSUR_ULT_ATUAL,
                NVL(us_ult.NOME, emp_ult.NOME) AS NOME_ULT_ATUAL,
                NVL(lotes.TOTAL_DINHEIRO, 0) AS TOTAL_DINHEIRO,
                NVL(lotes.QTD_REGISTROS, 0) AS QTD_REGISTROS
            FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO s
            LEFT JOIN PCUSUARI us_sang
              ON us_sang.CODUSUR = s.CODUSUR_SANGRIA
            LEFT JOIN PCUSUARI us_ult
              ON us_ult.CODUSUR = s.CODUSUR_ULT_ATUAL
            LEFT JOIN PCEMPR emp_sang
              ON emp_sang.MATRICULA = s.CODUSUR_SANGRIA
            LEFT JOIN PCEMPR emp_ult
              ON emp_ult.MATRICULA = s.CODUSUR_ULT_ATUAL
            LEFT JOIN (
                SELECT
                    l.ID_LOTE,
                    SUM(NVL(l.VL_DINHEIRO, 0)) AS TOTAL_DINHEIRO,
                    COUNT(1) AS QTD_REGISTROS
                FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES l
                GROUP BY l.ID_LOTE
            ) lotes
              ON lotes.ID_LOTE = s.ID_LOTE
            WHERE s.DATA_HORA_SANGRIA IS NOT NULL
              AND s.CODUSUR_SANGRIA IS NOT NULL
              AND s.DATA_HORA_SANGRIA >= TRUNC(p_data_hora_sangria)
              AND s.DATA_HORA_SANGRIA < TRUNC(NVL(p_data_hora_ult_atual, p_data_hora_sangria)) + 1
            ORDER BY s.DATA_HORA_SANGRIA DESC, s.ID_LOTE DESC;
        RETURN;
    END IF;

    SELECT aa.CODFILIAL
      INTO v_codfilial
      FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO aa
     WHERE aa.ID_LOTE = p_id_lote
       AND aa.DATA_HORA_SANGRIA IS NULL
       AND aa.CODUSUR_SANGRIA IS NULL;

    -- Atualiza o lote atual
    UPDATE MULTGESTI_FINANCEIRO_SALDO_DINHEIRO aa
       SET aa.DATA_HORA_SANGRIA   = SYSDATE,
           aa.CODUSUR_SANGRIA     = p_codusur_sangria,
           aa.DATA_HORA_ULT_ATUAL = SYSDATE,
           aa.CODUSUR_ULT_ATUAL   = p_codusur_ult_atual
     WHERE aa.ID_LOTE = p_id_lote
       AND aa.DATA_HORA_SANGRIA IS NULL
       AND aa.CODUSUR_SANGRIA IS NULL;

    -- Busca o próximo ID
    SELECT NVL(MAX(ID_LOTE), 0) + 1
      INTO v_novo_id_lote
      FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO;

    -- Cria novo lote
    INSERT INTO MULTGESTI_FINANCEIRO_SALDO_DINHEIRO (
        ID_LOTE,
        CODFILIAL,
        VL_SALDO_DINHEIRO,
        VL_SALDO_DINHEIRO_AVULSO,
        VL_SALDO_FUNDO_CX
    ) VALUES (
        v_novo_id_lote,
        v_codfilial,
        0,
        0,
        NVL(p_vl_saldo_fundo_cx, 0)
    );

    COMMIT;

    OPEN p_result FOR
        SELECT
            p_id_lote AS ID_LOTE_ANTERIOR,
            v_novo_id_lote AS ID_LOTE_NOVO,
            v_codfilial AS CODFILIAL,
            SYSDATE AS DATA_HORA_SANGRIA,
            p_codusur_sangria AS CODUSUR_SANGRIA,
            p_codusur_ult_atual AS CODUSUR_ULT_ATUAL
        FROM DUAL;
    RETURN;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20010, 'Lote não encontrado para sangria');
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END GESTLOG_GESTAO_SANGRIA_LOTES;
/
