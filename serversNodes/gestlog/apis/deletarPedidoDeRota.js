import express from "express";
import oracledb from "oracledb";

const router = express.Router();

router.delete("/api/gestlog/rotas/:idRota/pedidos/:numped", async (req, res) => {
  const idRota = Number(req.params?.idRota);
  const numped = Number(req.params?.numped);
  if (!Number.isFinite(idRota)) {
    return res.status(400).json({ message: "idRota inválido" });
  }
  if (!Number.isFinite(numped)) {
    return res.status(400).json({ message: "numped inválido" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const exists = await conn.execute(
      "SELECT 1 AS OK FROM GESTLOG_ROTAS_PEDIDOS WHERE ID_ROTA = :idRota AND NUMPED = :numped",
      { idRota, numped },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!exists.rows || exists.rows.length === 0) {
      return res.status(404).json({ message: "Vínculo pedido/rota não encontrado" });
    }

    const del = await conn.execute(
      "DELETE FROM GESTLOG_ROTAS_PEDIDOS WHERE ID_ROTA = :idRota AND NUMPED = :numped",
      { idRota, numped },
      { autoCommit: true }
    );

    return res.json({
      success: true,
      rowsAffected: del?.rowsAffected ?? 0,
      idRota,
      numped,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno no servidor";
    return res.status(500).json({ message: msg });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (_) {}
    }
  }
});

export default router;

