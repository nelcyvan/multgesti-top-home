export default function registerInventarioAvulsoProdutos(router, { oracledb }) {
  router.get("/inventario/avulso/produtos", async (req, res) => {
    const idRaw = req.query.idInventario ?? req.query.idinventario;
    const idInventarioNum = Number(idRaw);
    if (!Number.isFinite(idInventarioNum)) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: idInventario" });
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
        FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS
       WHERE ID_INVENTARIO = :idInventario
       ORDER BY ID_PRODUTO ASC`;

      const result = await conn.execute(sql, { idInventario: idInventarioNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
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
