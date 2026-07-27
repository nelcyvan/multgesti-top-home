import express from "express";
import oracledb from "oracledb";
import buscarVinculoPedido from "./querys/buscarVinculoPedido.js";
import inserirPedidoRota from "./procedures/inserirPedidoRota.js";

const router = express.Router();

router.post("/api/gestlog/rotas/:idRota/pedidos", async (req, res) => {
  const idRota = Number(req.params?.idRota);
  if (!Number.isFinite(idRota)) {
    return res.status(400).json({ message: "idRota inválido" });
  }

  const { numped, codUsurAdd } = req.body || {};
  const nNumped = Number(numped);
  const nCodUsurAdd = Number(codUsurAdd);

  if (!Number.isFinite(nNumped)) {
    return res.status(400).json({ message: "numped é obrigatório e deve ser numérico" });
  }
  if (!Number.isFinite(nCodUsurAdd)) {
    return res.status(400).json({ message: "codUsurAdd é obrigatório e deve ser numérico" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const { status, message, idItem } = await inserirPedidoRota(conn, {
      idRota,
      numped: nNumped,
      codUsurAdd: nCodUsurAdd,
    });

    if (!Number.isFinite(status)) {
      return res.status(500).json({ message: "Falha ao obter status da procedure" });
    }

    if (status === 201) {
      return res.status(201).json({
        success: true,
        idItem: Number.isFinite(idItem) ? idItem : null,
        idRota,
        numped: nNumped,
        codUsurAdd: nCodUsurAdd,
      });
    }

    if (status === 409) {
      const vinculo = await buscarVinculoPedido(conn, nNumped);
      if (vinculo && Number.isFinite(Number(vinculo.idRota))) {
        return res.status(409).json({ message, rota: vinculo });
      }
      return res.status(409).json({ message });
    }

    if (status === 404) {
      return res.status(404).json({ message });
    }

    return res.status(500).json({ message });
  } catch (err) {
    console.error("Erro ao inserir pedido em rota GestLOG:", err);
    const msg = err instanceof Error ? err.message : "Erro interno no servidor";
    return res.status(500).json({ message: msg });
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

export default router;
