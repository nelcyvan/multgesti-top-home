

CREATE OR REPLACE PROCEDURE GESTLOG_INSERIR_PEDIDO_ROTA (
    p_id_rota        IN NUMBER,
    p_numped         IN NUMBER,
    p_codusur_add    IN NUMBER,

    p_status         OUT NUMBER,
    p_message        OUT VARCHAR2,
    p_id_item        OUT NUMBER
)
IS
    v_exists     NUMBER;
    v_dup        NUMBER;
    v_id_item    NUMBER;
    v_id_rota_vinc NUMBER;
BEGIN

    -- ?? 1. Validar rota
    SELECT COUNT(1)
    INTO v_exists
    FROM GESTLOG_ROTAS
    WHERE ID_ROTA = p_id_rota;

    IF v_exists = 0 THEN
        p_status  := 404;
        p_message := 'Rota não encontrada';
        RETURN;
    END IF;

    -- ?? 2. Verificar vínculo existente
    BEGIN
        SELECT ID_ROTA
        INTO v_id_rota_vinc
        FROM GESTLOG_ROTAS_PEDIDOS
        WHERE NUMPED = p_numped
        FETCH FIRST 1 ROWS ONLY;

        IF v_id_rota_vinc = p_id_rota THEN
            p_status  := 409;
            p_message := 'Pedido já está vinculado a esta rota';
            RETURN;
        ELSE
            p_status  := 409;
            p_message := 'Pedido já está vinculado a outra rota (ID ' || v_id_rota_vinc || ')';
            RETURN;
        END IF;

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            NULL; -- segue fluxo
    END;

    -- ?? 3. Verificar duplicidade
    SELECT COUNT(1)
    INTO v_dup
    FROM GESTLOG_ROTAS_PEDIDOS
    WHERE ID_ROTA = p_id_rota
      AND NUMPED = p_numped;

    IF v_dup > 0 THEN
        p_status  := 409;
        p_message := 'Pedido já está vinculado a esta rota';
        RETURN;
    END IF;

    -- ?? 4. Gerar ID_ITEM (?? não recomendado em alta concorrência)
    SELECT NVL(MAX(ID_ITEM), 0) + 1
    INTO v_id_item
    FROM GESTLOG_ROTAS_PEDIDOS;

    -- ?? 5. Inserir
    INSERT INTO GESTLOG_ROTAS_PEDIDOS (
        ID_ITEM,
        ID_ROTA,
        NUMPED,
        CODUSUR_ADD,
        DATA_ADD
    ) VALUES (
        v_id_item,
        p_id_rota,
        p_numped,
        p_codusur_add,
        SYSDATE
    );

    -- ? sucesso
    p_status  := 201;
    p_message := 'Pedido inserido com sucesso';
    p_id_item := v_id_item;

    COMMIT;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_status  := 500;
        p_message := 'Erro: ' || SQLERRM;
END;
/