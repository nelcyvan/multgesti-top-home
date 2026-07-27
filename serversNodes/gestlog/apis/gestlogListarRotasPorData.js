import express from "express";
import oracledb from "oracledb";

const router = express.Router();

const readClobAsString = async (value) => {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value.getData === "function") {
    const data = await value.getData();
    return typeof data === "string" ? data : data?.toString?.("utf8") ?? String(data);
  }
  if (typeof value.on === "function" && typeof value.setEncoding === "function") {
    return await new Promise((resolve, reject) => {
      let out = "";
      value.setEncoding("utf8");
      value.on("data", (chunk) => {
        out += chunk;
      });
      value.on("end", () => resolve(out));
      value.on("error", reject);
    });
  }
  return String(value);
};

router.get("/api/gestlog/rotas", async (req, res) => {
  const dataRota = typeof req.query?.dataRota === "string" ? req.query.dataRota.trim() : "";
  if (!dataRota) {
    return res.status(400).json({ message: "dataRota é obrigatório (YYYY-MM-DD)" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRota)) {
    return res.status(400).json({ message: "dataRota inválido. Use YYYY-MM-DD" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT GESTLOG_APP_ROTAS_PEDIDOS_FULL(TO_DATE(:dataRota, 'YYYY-MM-DD')) AS JSON_RESULT
      FROM dual
    `;

    const result = await conn.execute(sql, { dataRota }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const jsonRaw = result?.rows?.[0]?.JSON_RESULT ?? null;
    const jsonStr = await readClobAsString(jsonRaw);
    const parsed = jsonStr ? JSON.parse(jsonStr) : [];
    const normNumOrNull = (v) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const rows = (Array.isArray(parsed) ? parsed : []).map((r) => {
      if (!r || typeof r !== "object") return r;
      return {
        ...r,
        cod_motorista: normNumOrNull(r.cod_motorista),
        cod_veiculo: normNumOrNull(r.cod_veiculo),
        veiculo_capacidade_cimento: normNumOrNull(r.veiculo_capacidade_cimento),
      };
    });

    return res.json({
      rows,
      count: rows.length,
    });
  } catch (err) {
    console.error("Erro ao listar rotas/pedidos full GestLOG:", err);
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
