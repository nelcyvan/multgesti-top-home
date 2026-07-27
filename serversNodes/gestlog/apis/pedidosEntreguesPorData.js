import express from "express";
import oracledb from "oracledb";

const router = express.Router();

router.get("/api/gestlog/pedidos-entregues/por-data", async (req, res) => {
  const query = req.query || {};
  const dataInicioRaw = String(query.dataInicio ?? query.dataIni ?? "").trim();
  const dataFimRaw = String(query.dataFim ?? query.dataFinal ?? "").trim();

  if (!dataInicioRaw || !dataFimRaw) {
    return res.status(400).json({ message: "Parâmetros obrigatórios: dataInicio, dataFim (formato YYYY-MM-DD ou DD/MM/YYYY)" });
  }

  const parseDate = (s) => {
    const raw = String(s || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split("-").map((x) => Number(x));
      const dt = new Date(y, m - 1, d);
      return Number.isFinite(dt.getTime()) ? dt : null;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split("/").map((x) => Number(x));
      const dt = new Date(y, m - 1, d);
      return Number.isFinite(dt.getTime()) ? dt : null;
    }
    return null;
  };

  const dtIni = parseDate(dataInicioRaw);
  const dtFim = parseDate(dataFimRaw);
  if (!dtIni || !dtFim) {
    return res.status(400).json({ message: "Datas inválidas. Use YYYY-MM-DD ou DD/MM/YYYY" });
  }

  const start = new Date(dtIni.getFullYear(), dtIni.getMonth(), dtIni.getDate());
  const end = new Date(dtFim.getFullYear(), dtFim.getMonth(), dtFim.getDate());
  if (end < start) {
    return res.status(400).json({ message: "dataFim deve ser maior ou igual a dataInicio" });
  }

  const dtEndExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);

  const codEntregadorRaw = query.codEntregador ?? query.codUsuarioEntregador ?? query.codusur;
  const codEntregadorNum =
    codEntregadorRaw != null && String(codEntregadorRaw).trim() !== "" ? Number(codEntregadorRaw) : null;
  if (codEntregadorNum != null && (!Number.isFinite(codEntregadorNum) || codEntregadorNum <= 0)) {
    return res.status(400).json({ message: "Parâmetro inválido: codEntregador" });
  }

  const limitRaw = Number(query.limit ?? 50);
  const offsetRaw = Number(query.offset ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.trunc(limitRaw))) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.trunc(offsetRaw)) : 0;

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const whereEntregador = codEntregadorNum != null ? " AND COD_USUARIO_ENTREGADOR = :codEntregador" : "";
    const bindsBase =
      codEntregadorNum != null
        ? { dtIni: start, dtFim: dtEndExclusive, codEntregador: codEntregadorNum }
        : { dtIni: start, dtFim: dtEndExclusive };

    const sql = `
      WITH base AS (
        SELECT
          NUM_PEDIDO,
          COD_CLIENTE,
          CLIENTE,
          COD_USUARIO_ENTREGADOR,
          ENTREGADOR,
          DATA_HORA,
          CASE WHEN FOTO_NFE IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_NFE,
          CASE WHEN FOTO_MERCADORIA IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_MERCADORIA,
          CASE WHEN FOTO_LOCAL IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_LOCAL,
          CASE WHEN FOTO_RESIDENCIA IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_RESIDENCIA,
          CASE WHEN FOTO_VALOR_RECEBIDO IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_VALOR_RECEBIDO,
          CASE WHEN FOTO_COMPROVANTE IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_COMPROVANTE,
          ROW_NUMBER() OVER (PARTITION BY NUM_PEDIDO ORDER BY DATA_HORA DESC) AS RN
        FROM APP_GESTLOG_PEDIDOS_FOTOS
        WHERE DATA_HORA >= :dtIni
          AND DATA_HORA < :dtFim
          ${whereEntregador}
      )
      SELECT
        NUM_PEDIDO,
        COD_CLIENTE,
        CLIENTE,
        COD_USUARIO_ENTREGADOR,
        ENTREGADOR,
        TO_CHAR(DATA_HORA, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA,
        TEM_FOTO_NFE,
        TEM_FOTO_MERCADORIA,
        TEM_FOTO_LOCAL,
        TEM_FOTO_RESIDENCIA,
        TEM_FOTO_VALOR_RECEBIDO,
        TEM_FOTO_COMPROVANTE
      FROM base
      WHERE RN = 1
      ORDER BY DATA_HORA DESC
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    `;

    const result = await conn.execute(sql, { ...bindsBase, offset, limit }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    const sqlTotal = `
      SELECT COUNT(DISTINCT NUM_PEDIDO) AS TOTAL
      FROM APP_GESTLOG_PEDIDOS_FOTOS
      WHERE DATA_HORA >= :dtIni
        AND DATA_HORA < :dtFim
        ${whereEntregador}
    `;
    const resultTotal = await conn.execute(sqlTotal, bindsBase, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const total = Number((resultTotal.rows || [])[0]?.TOTAL ?? 0);

    const rows = result.rows || [];
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

    return res.json({ rows: mapped, count: mapped.length, total });
  } catch (err) {
    console.error("[GestLOG] Erro ao buscar pedidos entregues por data:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestLOG", detalhe: err?.message });
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
