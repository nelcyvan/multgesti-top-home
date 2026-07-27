export default function registerInventarioAvulsoEncerrar(router, { oracledb }) {
  router.post("/inventario/avulso/encerrar", async (req, res) => {
    const body = req.body || {};
    const idInventarioNum = Number(body.idInventario);

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

      const sql = `UPDATE MULTGESTI_INVENTARIO_AVULSO SET DATA_ENCERRAMENTO = SYSDATE WHERE ID_INVENTARIO = :idInventario`;
      const binds = { idInventario: idInventarioNum };
      const result = await conn.execute(sql, binds, { autoCommit: true });
      return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao encerrar inventário", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
