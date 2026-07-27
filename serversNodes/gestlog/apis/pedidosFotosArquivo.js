import express from "express";
import oracledb from "oracledb";
import crypto from "crypto";
import sharp from "sharp";

const router = express.Router();

const colMap = {
  FOTO_NFE: "FOTO_NFE",
  FOTO_MERCADORIA: "FOTO_MERCADORIA",
  FOTO_LOCAL: "FOTO_LOCAL",
  FOTO_RESIDENCIA: "FOTO_RESIDENCIA",
  FOTO_VALOR_RECEBIDO: "FOTO_VALOR_RECEBIDO",
  FOTO_COMPROVANTE: "FOTO_COMPROVANTE",
};

const lobToBuffer = (lob) =>
  new Promise((resolve, reject) => {
    if (!lob) return resolve(null);
    if (Buffer.isBuffer(lob)) return resolve(lob);
    const chunks = [];
    lob.on("data", (d) => chunks.push(d));
    lob.on("end", () => {
      try {
        if (typeof lob.close === "function") lob.close(() => {});
      } catch {}
      resolve(Buffer.concat(chunks));
    });
    lob.on("error", (e) => reject(e));
  });

const sniffMime = (buf) => {
  if (!buf || buf.length < 4) return "application/octet-stream";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return "application/octet-stream";
};

const etagFor = (buf) => `"${crypto.createHash("sha1").update(buf).digest("hex")}"`;

async function fetchFotoBuffer({ numPedidoNum, col, codEntregadorNum }) {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });
    const whereEntregador = codEntregadorNum != null ? " AND COD_USUARIO_ENTREGADOR = :codEntregador" : "";
    const sql = `SELECT ${col} AS FOTO FROM APP_GESTLOG_PEDIDOS_FOTOS WHERE NUM_PEDIDO = :numPedido${whereEntregador}`;
    const binds = codEntregadorNum != null
      ? { numPedido: numPedidoNum, codEntregador: codEntregadorNum }
      : { numPedido: numPedidoNum };
    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const row = (result.rows || [])[0];
    if (!row) return { notFound: "Registro não encontrado", buf: null };
    const buf = await lobToBuffer(row.FOTO);
    if (!buf) return { notFound: "Foto não encontrada", buf: null };
    return { notFound: null, buf };
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {}
    }
  }
}

router.get("/api/gestlog/pedidos-fotos/arquivo", async (req, res) => {
  const numPedidoNum = Number(req.query.numPedido ?? req.query.NUM_PEDIDO ?? req.query.numped ?? 0);
  if (!Number.isFinite(numPedidoNum) || numPedidoNum <= 0) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: numPedido" });
  }

  const tipoRaw = String(req.query.tipo ?? "").trim().toUpperCase();
  const col = colMap[tipoRaw];
  if (!col) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: tipo" });
  }

  const codEntregadorNum = req.query.codEntregador != null ? Number(req.query.codEntregador ?? req.query.codusur ?? 0) : null;
  if (codEntregadorNum != null && (!Number.isFinite(codEntregadorNum) || codEntregadorNum <= 0)) {
    return res.status(400).json({ message: "Parâmetro inválido: codEntregador" });
  }

  try {
    const { notFound, buf } = await fetchFotoBuffer({ numPedidoNum, col, codEntregadorNum });
    if (notFound) return res.status(404).json({ message: notFound });
    if (!buf) return res.status(404).json({ message: "Foto não encontrada" });

    const mime = sniffMime(buf);
    const etag = etagFor(buf);
    const inm = String(req.headers["if-none-match"] || "");
    if (inm && inm === etag) return res.status(304).end();
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("ETag", etag);
    res.setHeader("Content-Disposition", `inline; filename="${numPedidoNum}-${col}.${mime.split("/")[1] || "bin"}"`);
    return res.status(200).send(buf);
  } catch (err) {
    console.error("[GestLOG] Erro ao baixar foto do pedido:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestLOG", detalhe: err.message });
  }
});

router.get("/api/gestlog/pedidos-fotos/arquivo-thumb", async (req, res) => {
  const numPedidoNum = Number(req.query.numPedido ?? req.query.NUM_PEDIDO ?? req.query.numped ?? 0);
  if (!Number.isFinite(numPedidoNum) || numPedidoNum <= 0) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: numPedido" });
  }

  const tipoRaw = String(req.query.tipo ?? "").trim().toUpperCase();
  const col = colMap[tipoRaw];
  if (!col) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: tipo" });
  }

  const codEntregadorNum = req.query.codEntregador != null ? Number(req.query.codEntregador ?? req.query.codusur ?? 0) : null;
  if (codEntregadorNum != null && (!Number.isFinite(codEntregadorNum) || codEntregadorNum <= 0)) {
    return res.status(400).json({ message: "Parâmetro inválido: codEntregador" });
  }

  const wRaw = Number(req.query.w ?? req.query.width ?? 420);
  const qRaw = Number(req.query.q ?? req.query.quality ?? 55);
  const w = Number.isFinite(wRaw) ? Math.max(160, Math.min(900, Math.trunc(wRaw))) : 420;
  const q = Number.isFinite(qRaw) ? Math.max(35, Math.min(80, Math.trunc(qRaw))) : 55;
  const fmtRaw = String(req.query.fmt ?? "jpeg").trim().toLowerCase();
  const fmt = fmtRaw === "webp" ? "webp" : "jpeg";

  try {
    const { notFound, buf } = await fetchFotoBuffer({ numPedidoNum, col, codEntregadorNum });
    if (notFound) return res.status(404).json({ message: notFound });
    if (!buf) return res.status(404).json({ message: "Foto não encontrada" });

    const mimeIn = sniffMime(buf);
    if (!mimeIn.startsWith("image/")) {
      return res.status(415).json({ message: "Formato de imagem não suportado" });
    }

    let outBuf;
    if (fmt === "webp") {
      outBuf = await sharp(buf).resize({ width: w, withoutEnlargement: true, fit: "inside" }).webp({ quality: q }).toBuffer();
    } else {
      outBuf = await sharp(buf).resize({ width: w, withoutEnlargement: true, fit: "inside" }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    }

    const etag = etagFor(outBuf);
    const inm = String(req.headers["if-none-match"] || "");
    if (inm && inm === etag) return res.status(304).end();

    res.setHeader("Content-Type", fmt === "webp" ? "image/webp" : "image/jpeg");
    res.setHeader("Content-Length", String(outBuf.length));
    res.setHeader("Cache-Control", "private, max-age=604800");
    res.setHeader("ETag", etag);
    res.setHeader("Content-Disposition", `inline; filename="${numPedidoNum}-${col}-thumb.${fmt === "webp" ? "webp" : "jpg"}"`);
    return res.status(200).send(outBuf);
  } catch (err) {
    console.error("[GestLOG] Erro ao gerar thumbnail do pedido:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestLOG", detalhe: err.message });
  }
});

export default router;
