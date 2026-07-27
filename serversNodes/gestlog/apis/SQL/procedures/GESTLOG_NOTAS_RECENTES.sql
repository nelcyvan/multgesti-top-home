CREATE OR REPLACE PROCEDURE GESTLOG_NOTAS_RECENTES (
    p_data_inicio            IN VARCHAR2,
    p_data_fim               IN VARCHAR2,
    p_tipo_entrega           IN VARCHAR2 DEFAULT NULL,
    p_result                 OUT SYS_REFCURSOR,
    p_vl_saldo_dinheiro      OUT NUMBER,
    p_vl_saldo_dinheiro_avulso OUT NUMBER,
    p_vl_saldo_fundo_cx      OUT NUMBER,
    p_id_lote                OUT NUMBER
)
AS
    v_count        NUMBER := 0;
    v_sql          CLOB;
BEGIN

    /*
      Cria saldo automaticamente caso não exista
    */
    SELECT COUNT(*)
      INTO v_count
      FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO
     WHERE CODFILIAL = 3
       AND DATA_HORA_SANGRIA IS NULL;

    IF v_count = 0 THEN

        SELECT NVL(MAX(ID_LOTE), 0) + 1
          INTO p_id_lote
          FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO;

        BEGIN
            EXECUTE IMMEDIATE '
                INSERT INTO MULTGESTI_FINANCEIRO_SALDO_DINHEIRO (
                    ID_LOTE,
                    CODFILIAL,
                    VL_SALDO_DINHEIRO,
                    VL_SALDO_DINHEIRO_AVULSO
                ) VALUES (
                    :p_id_lote,
                    3,
                    0,
                    0
                )'
            USING p_id_lote;
        EXCEPTION
            WHEN OTHERS THEN
                EXECUTE IMMEDIATE '
                    INSERT INTO MULTGESTI_FINANCEIRO_SALDO_DINHEIRO (
                        ID_LOTE,
                        CODFILIAL,
                        VL_SALDO_DINHEIRO
                    ) VALUES (
                        :p_id_lote,
                        3,
                        0
                    )'
                USING p_id_lote;
        END;

        COMMIT;

    END IF;

    /*
      Busca saldo atual
    */
    BEGIN
        EXECUTE IMMEDIATE '
            SELECT VL_SALDO_DINHEIRO,
                   NVL(VL_SALDO_DINHEIRO_AVULSO, 0) AS VL_SALDO_DINHEIRO_AVULSO,
                   NVL(VL_SALDO_FUNDO_CX, 0) AS VL_SALDO_FUNDO_CX,
                   ID_LOTE
              FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO
             WHERE CODFILIAL = 3
               AND DATA_HORA_SANGRIA IS NULL
               AND ROWNUM = 1'
        INTO p_vl_saldo_dinheiro,
             p_vl_saldo_dinheiro_avulso,
             p_vl_saldo_fundo_cx,
             p_id_lote;
    EXCEPTION
        WHEN OTHERS THEN
            EXECUTE IMMEDIATE '
                SELECT VL_SALDO_DINHEIRO,
                       ID_LOTE
                  FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO
                 WHERE CODFILIAL = 3
                   AND DATA_HORA_SANGRIA IS NULL
                   AND ROWNUM = 1'
            INTO p_vl_saldo_dinheiro,
                 p_id_lote;
            p_vl_saldo_dinheiro_avulso := 0;
            p_vl_saldo_fundo_cx := 0;
    END;

    /*
      SQL principal
    */
    v_sql := '
        SELECT 
               nota.NUMNOTA, 
               TO_CHAR(nota.DTSAIDA, ''DD/MM/YYYY'') AS DTSAIDA,
               itens.TIPOENTREGA,
               nota.CODCLI, 
               cliente.CLIENTE, 
               pedido.NUMPEDENTFUT AS TV7, 
               pedido.NUMPED AS TV8, 
               lotes.ID_LOTE AS ID_LOTE_PEDIDO,
               itens.CODPROD, 
               produtos.DESCRICAO, 
               produtos.CODAUXILIAR, 
               itens.QT, 
               rca.NOME, 
               itens.CODFILIALRETIRA,
               nota.SITDOC,
               nota.VLDESPACHO AS VALOR_DINHEIRO,
               nota.VLTOTAL AS VLTOTAL
          FROM PCNFSAID nota
          JOIN PCPEDC pedido
            ON pedido.NUMPED = nota.NUMPED
          JOIN PCPEDI itens
            ON itens.NUMPED = nota.NUMPED
          JOIN PCPRODUT produtos
            ON produtos.CODPROD = itens.CODPROD
          JOIN PCCLIENT cliente
            ON cliente.CODCLI = nota.CODCLI
          JOIN PCUSUARI rca
            ON rca.CODUSUR = nota.CODUSUR
          LEFT JOIN (
                SELECT
                       l.CODFILIAL,
                       l.NUMNOTA,
                       l.NUMPED_TV7,
                       MAX(l.ID_LOTE) KEEP (DENSE_RANK LAST ORDER BY l.DATA_HORA) AS ID_LOTE
                  FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES l
                 WHERE l.CODFILIAL = ''3''
                 GROUP BY l.CODFILIAL, l.NUMNOTA, l.NUMPED_TV7
          ) lotes
            ON lotes.NUMNOTA = nota.NUMNOTA
           AND lotes.NUMPED_TV7 = pedido.NUMPEDENTFUT
         WHERE TRUNC(nota.DTSAIDA)
               BETWEEN TO_DATE(:p_data_inicio, ''YYYY-MM-DD'')
                   AND TO_DATE(:p_data_fim, ''YYYY-MM-DD'')
           AND nota.ESPECIE = ''NF''
           AND nota.SERIE = ''1''
           AND nota.DTCANCEL IS NULL
           AND nota.CODFISCAL = ''599''
           AND itens.CODFILIALRETIRA = 3
    ';

    /*
      Filtro tipo entrega
    */
    IF p_tipo_entrega IS NOT NULL THEN
        v_sql := v_sql || '
           AND itens.TIPOENTREGA = :p_tipo_entrega
        ';
    ELSE
        v_sql := v_sql || '
           AND itens.TIPOENTREGA <> ''RP''
        ';
    END IF;

    v_sql := v_sql || '
        ORDER BY nota.DTSAIDA DESC
    ';

    /*
      Abre cursor
    */
    IF p_tipo_entrega IS NOT NULL THEN

        OPEN p_result FOR v_sql
            USING p_data_inicio,
                  p_data_fim,
                  p_tipo_entrega;

    ELSE

        OPEN p_result FOR v_sql
            USING p_data_inicio,
                  p_data_fim;

    END IF;

END;
/
