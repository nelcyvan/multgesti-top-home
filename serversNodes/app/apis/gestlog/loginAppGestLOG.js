export default function registerLoginAppGestLOG(router, { oracledb }) {
  router.post("/login", async (req, res) => {
    const { usuario, senha } = req.body;
    const versaoAtualUsuarioRaw =
      req.body?.versaoApp ??
      req.body?.versao_app ??
      req.body?.versao ??
      req.body?.versaoAtualUsuario ??
      req.body?.VERSAO_ATUAL_USUARIO ??
      null;
    const versaoAtualAppRaw =
      process.env.GESTLOG_VERSAO_ATUAL_APP ??
      req.body?.versaoAtualApp ??
      req.body?.VERSAO_ATUAL_APP ??
      null;

    const versaoAtualUsuario =
      versaoAtualUsuarioRaw === null || versaoAtualUsuarioRaw === undefined
        ? null
        : String(versaoAtualUsuarioRaw).trim();
    const versaoAtualApp =
      versaoAtualAppRaw === null || versaoAtualAppRaw === undefined
        ? (versaoAtualUsuario === "" ? null : versaoAtualUsuario)
        : String(versaoAtualAppRaw).trim();

    if (!usuario || !senha) {
      return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
    }

    if (versaoAtualUsuario && versaoAtualUsuario.length > 5) {
      return res.status(400).json({
        message: "Versão do usuário inválida: máximo de 5 caracteres (ex: 0.0.1)",
      });
    }
    if (versaoAtualApp && versaoAtualApp.length > 5) {
      return res.status(400).json({
        message: "Versão atual do app inválida: máximo de 5 caracteres (ex: 0.0.1)",
      });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const result = await conn.execute(
        `SELECT decrypt(senhabd, usuariobd) AS senha,
                nome,
                nome_guerra,
                matricula,
                codfilial
         FROM pcempr
         WHERE nome_guerra = :usuario`,
        [usuario.toUpperCase()],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const userDB = result.rows[0];

      if (userDB.SENHA !== senha.toUpperCase()) {
        return res.status(401).json({ message: "Senha incorreta" });
      }

      let codusur = null;
      try {
        const codRes = await conn.execute(
          `SELECT CODUSUR FROM PCUSUARI WHERE NOME_GUERRA = :usuario`,
          [userDB.NOME_GUERRA],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (codRes.rows && codRes.rows.length > 0) {
          codusur = codRes.rows[0].CODUSUR;
        }
      } catch (e) {
        console.error("Falha ao buscar CODUSUR:", e);
      }

      if (codusur && versaoAtualUsuario && versaoAtualApp) {
        try {
          const mergeSql = `
            MERGE INTO GESTLOG_PERMISSAO_APP p
            USING (
              SELECT :codusur AS codusur,
                     :versao_usuario AS versao_usuario,
                     :versao_app AS versao_app
                FROM dual
            ) s
               ON (p.CODUSUR = s.codusur)
            WHEN MATCHED THEN
              UPDATE SET
                p.VERSAO_ATUAL_USUARIO = s.versao_usuario,
                p.VERSAO_ATUAL_APP = s.versao_app
            WHEN NOT MATCHED THEN
              INSERT (
                CODUSUR,
                VERSAO_ATUAL_USUARIO,
                VERSAO_ATUAL_APP,
                PERMISSAO_TELA_TRIAGEM,
                PERMISSAO_TELA_EXPEDICAO,
                PERMISSAO_TELA_CORTAR,
                PERMISSAO_TELA_ROTAS,
                PERMISSAO_TELA_ENVIAR,
                PERMISSAO_TELA_COLETAS,
                PERMISSAO_TELA_INVENTARIOS,
                PERMISSAO_TELA_ENTREGAS,
                ATIVO
              )
              VALUES (
                s.codusur,
                s.versao_usuario,
                s.versao_app,
                'N','N','N','N','N','N','N','N',
                'S'
              )
          `;

          await conn.execute(
            mergeSql,
            {
              codusur,
              versao_usuario: versaoAtualUsuario,
              versao_app: versaoAtualApp,
            },
            { autoCommit: true }
          );
        } catch (e) {
          console.error("Falha ao salvar versão do app (GESTLOG_PERMISSAO_APP):", e);
        }
      }

      return res.json({
        message: "Login realizado com sucesso",
        nome: userDB.NOME,
        usuario: userDB.NOME_GUERRA,
        matricula: userDB.MATRICULA,
        codfilial: userDB.CODFILIAL,
        codusur: codusur,
        versao_atual_usuario: versaoAtualUsuario,
        versao_atual_app: versaoAtualApp,
        versao_ok: Boolean(versaoAtualUsuario && versaoAtualApp && versaoAtualUsuario === versaoAtualApp),
      });
    } catch (err) {
      console.error("Erro no login:", err);
      return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {
          console.error("Erro ao fechar conexão:", err);
        }
      }
    }
  });
}
