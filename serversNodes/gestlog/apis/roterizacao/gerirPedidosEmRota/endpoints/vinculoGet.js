import express from "express";
import oracledb from "oracledb";
import buscarVinculoPedido from "./querys/buscarVinculoPedido.js";

const router = express.Router();

router.get("/api/gestlog/rotas/pedidos/:numped/vinculo", async (req, res) => {
  const numped = Number(req.params?.numped);
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

    const vinculo = await buscarVinculoPedido(conn, numped);
    if (!vinculo || !Number.isFinite(Number(vinculo.idRota))) {
      return res.json({ found: false });
    }
    return res.json({ found: true, rota: vinculo });
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
