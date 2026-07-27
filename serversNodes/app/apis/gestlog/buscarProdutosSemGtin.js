export default function registerBuscarProdutosSemGtin(router, { oracledb }) {
  router.get("/produtos-sem-gtin/buscar", async (req, res) => {
    const q = req.query || {};

    const codprodStr = String(q.codprod || "").trim();
    const busca = String(q.q || "").trim();

    const limitRaw = Number(q.limit ?? 100);
    const offsetRaw = Number(q.offset ?? 0);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 100;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

    const digitsOnly = (s) => String(s || "").replace(/\D+/g, "");

    const binds = {};
    const where = [];

    if (codprodStr) {
      const codprodNum = Number(digitsOnly(codprodStr));
      if (!Number.isFinite(codprodNum) || codprodNum <= 0) {
        return res.status(400).json({ message: "Parâmetro 'codprod' inválido" });
      }
      binds.codprod = codprodNum;
      where.push("CODPROD = :codprod");
    }

    if (busca) {
      const qDigits = digitsOnly(busca);
      const isNumeric = qDigits !== "" && /^\d+$/.test(qDigits);
      if (isNumeric) {
        binds.qnum = Number(qDigits);
        where.push("(CODPROD = :qnum OR CODAUXILIAR = TO_CHAR(:qnum))");
      } else {
        binds.qdesc = busca;
        where.push("UPPER(DESCRICAO) LIKE '%' || UPPER(:qdesc) || '%'");
      }
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sqlCount = `
        SELECT COUNT(*) AS TOTAL
          FROM GESTLOG_PRODUTOS_SEM_GTIN
          ${whereSql}
      `;

      const countRes = await conn.execute(sqlCount, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const total = Number((countRes.rows || [])[0]?.TOTAL || 0);

      const sql = `
        SELECT
          ID,
          CODPROD,
          DESCRICAO,
          CODAUXILIAR,
          TO_CHAR(DATA_ADD, 'DD/MM/YYYY HH24:MI:SS') AS DATA_ADD,
          CODIGO_USUARIO_ADD
        FROM GESTLOG_PRODUTOS_SEM_GTIN
        ${whereSql}
        ORDER BY DATA_ADD DESC, ID DESC
        OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
      `;

      const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const rows = result.rows || [];
      return res.json({ rows, count: rows.length, total, limit, offset });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao buscar produtos sem GTIN", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch {}
      }
    }
  });
}
