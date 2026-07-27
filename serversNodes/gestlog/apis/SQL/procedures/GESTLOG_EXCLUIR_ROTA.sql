CREATE OR REPLACE PROCEDURE GESTLOG_EXCLUIR_ROTA (
    p_id_rota    IN NUMBER,

    p_status     OUT NUMBER,
    p_message    OUT VARCHAR2
)
IS
    v_existente   NUMBER;
    v_qtd_pedidos NUMBER;
BEGIN

    -- 🔹 1. Validar ID
    IF p_id_rota IS NULL THEN
        p_status  := 400;
        p_message := 'idRota é obrigatório';
        RETURN;
    END IF;

    -- 🔹 2. Verificar se rota existe
    SELECT COUNT(1)
    INTO v_existente
    FROM GESTLOG_ROTAS
    WHERE ID_ROTA = p_id_rota;

    IF v_existente = 0 THEN
        p_status  := 404;
        p_message := 'Rota não encontrada';
        RETURN;
    END IF;

    -- 🔹 3. Verificar se existem pedidos vinculados
    SELECT COUNT(1)
    INTO v_qtd_pedidos
    FROM GESTLOG_ROTAS_PEDIDOS
    WHERE ID_ROTA = p_id_rota;

    IF v_qtd_pedidos > 0 THEN
        p_status  := 409;
        p_message := 'Não é possível excluir a rota: existem pedidos vinculados';
        RETURN;
    END IF;

    -- 🔹 4. Excluir rota
    DELETE FROM GESTLOG_ROTAS
    WHERE ID_ROTA = p_id_rota;

    COMMIT;

    -- ✅ sucesso
    p_status  := 200;
    p_message := 'Rota excluída com sucesso';

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_status  := 500;
        p_message := 'Erro: ' || SQLERRM;
END;
/