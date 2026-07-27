export default function registerLoginAppGestPRO(router, { oracledb }) {
  router.post("/login", async (req, res) => {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
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
        [String(usuario).toUpperCase()],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const userDB = result.rows[0];

      if (userDB.SENHA !== String(senha).toUpperCase()) {
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

      return res.json({
        message: "Login realizado com sucesso",
        nome: userDB.NOME,
        usuario: userDB.NOME_GUERRA,
        matricula: userDB.MATRICULA,
        codfilial: userDB.CODFILIAL,
        codusur: codusur,
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
