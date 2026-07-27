import express from "express";
import oracledb from "oracledb";

const router = express.Router();

router.get("/api/gestlog/pedidos-fotos/por-pedido", async (req, res) => {
  const numPedidoNum = Number(req.query.numPedido ?? req.query.NUM_PEDIDO ?? req.query.numped ?? 0);
  if (!Number.isFinite(numPedidoNum) || numPedidoNum <= 0) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: numPedido" });
  }

  const includeFotosRaw = String(req.query.includeFotos ?? "N").trim().toUpperCase();
  const includeFotos = includeFotosRaw !== "N";

  const codEntregadorNum = req.query.codEntregador != null ? Number(req.query.codEntregador ?? req.query.codusur ?? 0) : null;
  if (codEntregadorNum != null && (!Number.isFinite(codEntregadorNum) || codEntregadorNum <= 0)) {
    return res.status(400).json({ message: "Parâmetro inválido: codEntregador" });
  }

  const lobToBuffer = (lob) =>
    new Promise((resolve, reject) => {
      if (!lob) return resolve(null);
      if (Buffer.isBuffer(lob)) return resolve(lob);
      const chunks = [];
      lob.on("data", (d) => chunks.push(d));
      lob.on("end", () => resolve(Buffer.concat(chunks)));
      lob.on("error", (e) => reject(e));
    });

  const lobToBase64 = async (lob) => {
    const buf = await lobToBuffer(lob);
    return buf ? buf.toString("base64") : null;
  };

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const whereEntregador = codEntregadorNum != null ? " AND COD_USUARIO_ENTREGADOR = :codEntregador" : "";
    const binds = codEntregadorNum != null ? { numPedido: numPedidoNum, codEntregador: codEntregadorNum } : { numPedido: numPedidoNum };

    const sql = includeFotos
      ? `
        SELECT
          NUM_PEDIDO,
          COD_CLIENTE,
          CLIENTE,
          COD_USUARIO_ENTREGADOR,
          ENTREGADOR,
          TO_CHAR(DATA_HORA, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA,
          FOTO_NFE,
          FOTO_MERCADORIA,
          FOTO_LOCAL,
          FOTO_RESIDENCIA,
          FOTO_VALOR_RECEBIDO,
          FOTO_COMPROVANTE
        FROM APP_GESTLOG_PEDIDOS_FOTOS
        WHERE NUM_PEDIDO = :numPedido${whereEntregador}
        ORDER BY DATA_HORA DESC
      `
      : `
        SELECT
          NUM_PEDIDO,
          COD_CLIENTE,
          CLIENTE,
          COD_USUARIO_ENTREGADOR,
          ENTREGADOR,
          TO_CHAR(DATA_HORA, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA,
          CASE WHEN FOTO_NFE IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_NFE,
          CASE WHEN FOTO_MERCADORIA IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_MERCADORIA,
          CASE WHEN FOTO_LOCAL IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_LOCAL,
          CASE WHEN FOTO_RESIDENCIA IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_RESIDENCIA,
          CASE WHEN FOTO_VALOR_RECEBIDO IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_VALOR_RECEBIDO,
          CASE WHEN FOTO_COMPROVANTE IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_COMPROVANTE
        FROM APP_GESTLOG_PEDIDOS_FOTOS
        WHERE NUM_PEDIDO = :numPedido${whereEntregador}
        ORDER BY DATA_HORA DESC
      `;

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    if (!includeFotos) {
      const mapped = rows.map((r) => {
        const base = `/api/gestlog/pedidos-fotos/arquivo?numPedido=${encodeURIComponent(String(r.NUM_PEDIDO))}`;
        return {
          NUM_PEDIDO: r.NUM_PEDIDO,
          COD_CLIENTE: r.COD_CLIENTE,
          CLIENTE: r.CLIENTE,
          COD_USUARIO_ENTREGADOR: r.COD_USUARIO_ENTREGADOR,
          ENTREGADOR: r.ENTREGADOR,
          DATA_HORA: r.DATA_HORA,
          TEM_FOTO_NFE: Number(r.TEM_FOTO_NFE) === 1,
          TEM_FOTO_MERCADORIA: Number(r.TEM_FOTO_MERCADORIA) === 1,
          TEM_FOTO_LOCAL: Number(r.TEM_FOTO_LOCAL) === 1,
          TEM_FOTO_RESIDENCIA: Number(r.TEM_FOTO_RESIDENCIA) === 1,
          TEM_FOTO_VALOR_RECEBIDO: Number(r.TEM_FOTO_VALOR_RECEBIDO) === 1,
          TEM_FOTO_COMPROVANTE: Number(r.TEM_FOTO_COMPROVANTE) === 1,
          URL_FOTO_NFE: `${base}&tipo=FOTO_NFE`,
          URL_FOTO_MERCADORIA: `${base}&tipo=FOTO_MERCADORIA`,
          URL_FOTO_LOCAL: `${base}&tipo=FOTO_LOCAL`,
          URL_FOTO_RESIDENCIA: `${base}&tipo=FOTO_RESIDENCIA`,
          URL_FOTO_VALOR_RECEBIDO: `${base}&tipo=FOTO_VALOR_RECEBIDO`,
          URL_FOTO_COMPROVANTE: `${base}&tipo=FOTO_COMPROVANTE`,
        };
      });
      return res.json({ rows: mapped, count: mapped.length });
    }

    const mapped = [];
    for (const r of rows) {
      mapped.push({
        NUM_PEDIDO: r.NUM_PEDIDO,
        COD_CLIENTE: r.COD_CLIENTE,
        CLIENTE: r.CLIENTE,
        COD_USUARIO_ENTREGADOR: r.COD_USUARIO_ENTREGADOR,
        ENTREGADOR: r.ENTREGADOR,
        DATA_HORA: r.DATA_HORA,
        FOTO_NFE: await lobToBase64(r.FOTO_NFE),
        FOTO_MERCADORIA: await lobToBase64(r.FOTO_MERCADORIA),
        FOTO_LOCAL: await lobToBase64(r.FOTO_LOCAL),
        FOTO_RESIDENCIA: await lobToBase64(r.FOTO_RESIDENCIA),
        FOTO_VALOR_RECEBIDO: await lobToBase64(r.FOTO_VALOR_RECEBIDO),
        FOTO_COMPROVANTE: await lobToBase64(r.FOTO_COMPROVANTE),
      });
    }
    return res.json({ rows: mapped, count: mapped.length });
  } catch (err) {
    console.error("[GestLOG] Erro ao buscar fotos por pedido:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestLOG", detalhe: err.message });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err2) {
        console.error("Erro ao fechar conexão:", err2);
      }
    }
  }
});

export default router;

