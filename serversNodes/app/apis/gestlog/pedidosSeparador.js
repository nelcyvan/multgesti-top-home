export default function registerPedidosSeparador(router, { oracledb }) {
  router.get("/pedidos-separador", async (req, res) => {
    const codigo = req.query.codigo;
    if (!codigo) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: codigo" });
    }
    const codigoNum = Number(codigo);
    if (!Number.isFinite(codigoNum)) {
      return res.status(400).json({ message: "Parâmetro inválido: codigo deve ser numérico" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `SELECT GESTLOG_APP_PEDIDOS_SEPARADOR_STATUS(:codigo) AS JSON_RESULT FROM DUAL`;
      const binds = { codigo: codigoNum };

      const result = await conn.execute(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: { JSON_RESULT: { type: oracledb.STRING } },
      });
      const v = (result.rows || [])[0]?.JSON_RESULT;

      async function readClob(value) {
        if (value == null) return null;
        if (typeof value === "string") return value;
        if (typeof value.getData === "function") {
          return await value.getData();
        }
        if (typeof value.on === "function") {
          return await new Promise((resolve, reject) => {
            let data = "";
            value.setEncoding("utf8");
            value.on("data", (chunk) => { data += chunk; });
            value.on("end", () => resolve(data));
            value.on("error", reject);
          });
        }
        return String(value);
      }

      const jsonTextRaw = await readClob(v);
      const jsonText = typeof jsonTextRaw === "string" ? jsonTextRaw.replace(/\u0000/g, "").trim() : null;
      if (!jsonText) {
        return res.json({ bloco_codigo: [], bloco_status: [] });
      }

      try {
        const parsed = JSON.parse(jsonText);
        const blocoCodigo = Array.isArray(parsed?.bloco_codigo) ? parsed.bloco_codigo : [];
        const blocoStatus = Array.isArray(parsed?.bloco_status) ? parsed.bloco_status : [];
        return res.json({ ...parsed, bloco_codigo: blocoCodigo, bloco_status: blocoStatus });
      } catch {
        res.type("application/json");
        return res.send(jsonText);
      }
    } catch (err) {
      console.error("Erro ao buscar pedidos por separador:", err);
      return res.status(500).json({
        message: "Erro interno no servidor",
        detalhe: err.message,
      });
    } finally {
      if (conn) {
        try { await conn.close(); } catch (err) {}
      }
    }
  });
}
