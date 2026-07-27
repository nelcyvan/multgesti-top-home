import express from "express";
import oracledb from "oracledb";
import excluirRota from "./procedures/excluirRota.js";

const router = express.Router();

router.delete("/api/gestlog/rotas/:idRota", async (req, res) => {
  const idRota = Number(req.params?.idRota);
  if (!Number.isFinite(idRota)) {
    return res.status(400).json({ message: "idRota inválido" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const { status, message } = await excluirRota(conn, { idRota });

    if (!Number.isFinite(status)) {
      return res.status(500).json({ message: "Falha ao obter status da procedure" });
    }

    if (status === 200) {
      return res.json({ success: true, idRota, message });
    }

    if (status === 400 || status === 404 || status === 409) {
      return res.status(status).json({ message });
    }

    return res.status(500).json({ message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno no servidor";
    return res.status(500).json({ message: msg });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        void 0;
      }
    }
  }
});

export default router;
