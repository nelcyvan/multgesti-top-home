CREATE OR REPLACE PROCEDURE GERIR_PERMISSOES (
    p_acao        IN VARCHAR2,  -- ADD | PERMISSAO | ATIVO
    p_codusur     IN NUMBER,

    -- Permissões (opcionais)
    p_triagem     IN VARCHAR2 DEFAULT NULL,
    p_expedicao   IN VARCHAR2 DEFAULT NULL,
    p_cortar      IN VARCHAR2 DEFAULT NULL,
    p_rotas       IN VARCHAR2 DEFAULT NULL,
    p_enviar      IN VARCHAR2 DEFAULT NULL,
    p_coletas     IN VARCHAR2 DEFAULT NULL,
    p_inventarios IN VARCHAR2 DEFAULT NULL,
    p_entregas    IN VARCHAR2 DEFAULT NULL,

    -- Ativar / Desativar
    p_ativo       IN VARCHAR2 DEFAULT NULL
) AS
BEGIN

    ------------------------------------------------------------------
    -- 1. ADICIONAR USUÁRIO
    ------------------------------------------------------------------
    IF p_acao = 'ADD' THEN

        INSERT INTO GESTLOG_PERMISSAO_APP (
            CODUSUR,
            PERMISSAO_TELA_TRIAGEM,
            PERMISSAO_TELA_EXPEDICAO,
            PERMISSAO_TELA_CORTAR,
            PERMISSAO_TELA_ROTAS,
            PERMISSAO_TELA_ENVIAR,
            PERMISSAO_TELA_COLETAS,
            PERMISSAO_TELA_INVENTARIOS,
            PERMISSAO_TELA_ENTREGAS,
            ATIVO
        ) VALUES (
            p_codusur,
            'N','N','N','N','N','N','N','N',
            'S'
        );

    ------------------------------------------------------------------
    -- 2. GERIR PERMISSÕES
    ------------------------------------------------------------------
    ELSIF p_acao = 'PERMISSAO' THEN

        UPDATE GESTLOG_PERMISSAO_APP
        SET
            PERMISSAO_TELA_TRIAGEM     = NVL(p_triagem, PERMISSAO_TELA_TRIAGEM),
            PERMISSAO_TELA_EXPEDICAO   = NVL(p_expedicao, PERMISSAO_TELA_EXPEDICAO),
            PERMISSAO_TELA_CORTAR      = NVL(p_cortar, PERMISSAO_TELA_CORTAR),
            PERMISSAO_TELA_ROTAS       = NVL(p_rotas, PERMISSAO_TELA_ROTAS),
            PERMISSAO_TELA_ENVIAR      = NVL(p_enviar, PERMISSAO_TELA_ENVIAR),
            PERMISSAO_TELA_COLETAS     = NVL(p_coletas, PERMISSAO_TELA_COLETAS),
            PERMISSAO_TELA_INVENTARIOS = NVL(p_inventarios, PERMISSAO_TELA_INVENTARIOS),
            PERMISSAO_TELA_ENTREGAS    = NVL(p_entregas, PERMISSAO_TELA_ENTREGAS)
        WHERE CODUSUR = p_codusur;

    ------------------------------------------------------------------
    -- 3. ATIVAR / DESATIVAR
    ------------------------------------------------------------------
    ELSIF p_acao = 'ATIVO' THEN

        UPDATE GESTLOG_PERMISSAO_APP
        SET ATIVO = p_ativo
        WHERE CODUSUR = p_codusur;

    ------------------------------------------------------------------
    -- AÇÃO INVÁLIDA
    ------------------------------------------------------------------
    ELSE
        RAISE_APPLICATION_ERROR(-20001, 'AÇÃO INVÁLIDA. USE: ADD, PERMISSAO OU ATIVO');
    END IF;

    COMMIT;

END;