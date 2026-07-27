CREATE OR REPLACE PROCEDURE GESTLOG_CRIAR_ROTA (
    p_descricao_rota    IN VARCHAR2,
    p_bairro1           IN VARCHAR2,
    p_bairro2           IN VARCHAR2,
    p_bairro3           IN VARCHAR2,
    p_bairro4           IN VARCHAR2,
    p_bairro5           IN VARCHAR2,
    p_cod_motorista     IN NUMBER,
    p_cod_veiculo       IN NUMBER,
    p_data_rota         IN DATE,
    p_codusur_criacao   IN NUMBER,
    p_turno_separacao   IN VARCHAR2,

    p_status            OUT NUMBER,
    p_message           OUT VARCHAR2,
    p_id_rota           OUT NUMBER
)
IS
    v_id_rota        NUMBER;
    v_existente      NUMBER;
    v_conf           NUMBER;
BEGIN

    -- ?? 1. Validar obrigatórios
    IF p_descricao_rota IS NULL THEN
        p_status  := 400;
        p_message := 'descricaoRota é obrigatório';
        RETURN;
    END IF;

    IF p_codusur_criacao IS NULL THEN
        p_status  := 400;
        p_message := 'codUsurCriacao é obrigatório';
        RETURN;
    END IF;

    IF p_cod_motorista IS NULL THEN
        p_status  := 400;
        p_message := 'codMotorista é obrigatório';
        RETURN;
    END IF;

    IF p_cod_veiculo IS NULL THEN
        p_status  := 400;
        p_message := 'codVeiculo é obrigatório';
        RETURN;
    END IF;

    IF p_turno_separacao IS NULL OR p_turno_separacao NOT IN ('M','T') THEN
        p_status  := 400;
        p_message := 'turnoSeparacao inválido (M ou T)';
        RETURN;
    END IF;

    IF p_data_rota IS NULL THEN
        p_status  := 400;
        p_message := 'dataRota é obrigatório';
        RETURN;
    END IF;

    -- ?? 2. Conflito veículo com motorista diferente no mesmo dia
    SELECT COUNT(1)
    INTO v_existente
    FROM GESTLOG_ROTAS
    WHERE TRUNC(DATA_ROTA) = TRUNC(p_data_rota)
      AND COD_VEICULO = p_cod_veiculo
      AND NVL(COD_MOTORISTA, -1) <> p_cod_motorista;

    IF v_existente > 0 THEN
        SELECT ID_ROTA
        INTO v_conf
        FROM GESTLOG_ROTAS
        WHERE TRUNC(DATA_ROTA) = TRUNC(p_data_rota)
          AND COD_VEICULO = p_cod_veiculo
          AND NVL(COD_MOTORISTA, -1) <> p_cod_motorista
        FETCH FIRST 1 ROWS ONLY;

        p_status  := 409;
        p_message := 'Veículo já está em uma rota desse dia com outro motorista (ID ' || v_conf || ')';
        RETURN;
    END IF;

    -- ?? 3. Gerar ID_ROTA (?? ideal usar sequence)
    SELECT NVL(MAX(ID_ROTA), 0) + 1
    INTO v_id_rota
    FROM GESTLOG_ROTAS;

    IF v_id_rota IS NULL THEN
        p_status  := 500;
        p_message := 'Falha ao gerar ID_ROTA';
        RETURN;
    END IF;

    -- ?? 6. Inserir
    INSERT INTO GESTLOG_ROTAS (
        ID_ROTA,
        DESCRICAO_ROTA,
        BAIRRO_ROTA_1,
        BAIRRO_ROTA_2,
        BAIRRO_ROTA_3,
        BAIRRO_ROTA_4,
        BAIRRO_ROTA_5,
        COD_MOTORISTA,
        COD_VEICULO,
        DATA_ROTA,
        CODUSUR_CRIACAO,
        DATA_CRIACAO,
        TURNO_SEPARACAO
    ) VALUES (
        v_id_rota,
        p_descricao_rota,
        p_bairro1,
        p_bairro2,
        p_bairro3,
        p_bairro4,
        p_bairro5,
        p_cod_motorista,
        p_cod_veiculo,
        p_data_rota,
        p_codusur_criacao,
        SYSDATE,
        p_turno_separacao
    );

    COMMIT;

    -- ? sucesso
    p_status  := 201;
    p_message := 'Rota criada com sucesso';
    p_id_rota := v_id_rota;

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_status  := 500;
        p_message := 'Erro: ' || SQLERRM;
END;
/
