export default function registerInventarioAvulsoUsuario(router, { oracledb }) {
  router.get("/inventario/avulso/usuario", async (req, res) => {
    const codigoRaw = req.query.codigoDoUsuario ?? req.query.codusur ?? req.query.codigoUsuario ?? req.query["códigoDoUsuario"];
    const codigoDoUsuarioNum = Number(codigoRaw);
    if (!Number.isFinite(codigoDoUsuarioNum)) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: codigoDoUsuario" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
      SELECT *
        FROM MULTGESTI_INVENTARIO_AVULSO
       WHERE CODUSUR = :codigoDoUsuario
       AND DATA_ENCERRAMENTO IS NULL
       ORDER BY ID_INVENTARIO ASC
    `;

      const result = await conn.execute(sql, { codigoDoUsuario: codigoDoUsuarioNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return res.json({ rows: result.rows || [], count: (result.rows || []).length });
    } catch (err) {
      return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
