export default function registerAuditoriaCriar(router, { oracledb }) {
  router.post("/auditoria", async (req, res) => {
    const body = req.body || {};
    const descricao = String(body.descricao || "").trim();
    const setor = String(body.setor || "").trim();
    const codUsuarioCriacao = Number(body.codUsuarioCriacao ?? body.codusur);
    const observacao = String(body.observacao || "").trim() || null;

    if (!descricao || !setor || !Number.isFinite(codUsuarioCriacao)) {
      return res.status(400).json({
        message: "Parâmetros obrigatórios ausentes: descricao, setor, codUsuarioCriacao",
      });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        INSERT INTO GESTPRO_AUDITORIA (
          DESCRICAO,
          SETOR,
          CODUSUARIOCRIACAO,
          OBSERVACAO
        ) VALUES (
          :descricao,
          :setor,
          :codUsuarioCriacao,
          :observacao
        )
        RETURNING CODAUDITORIA INTO :codAuditoria
      `;

      const result = await conn.execute(
        sql,
        {
          descricao,
          setor,
          codUsuarioCriacao,
          observacao,
          codAuditoria: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: true }
      );

      const codAuditoria = Number(result.outBinds?.codAuditoria ?? 0);
      return res.json({ ok: true, codAuditoria });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao criar auditoria", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
