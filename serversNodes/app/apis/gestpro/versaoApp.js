export default function registerVersaoApp(router, { oracledb }) {
  router.get("/versao-app", async (_req, res) => {
    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        SELECT
          VERSAOATUAL,
          VERSAOANTERIOR,
          TO_CHAR(DTULTATUALIZACAO, 'DD/MM/YYYY HH24:MI:SS') AS DTULTATUALIZACAO
        FROM GESTPRO_VERSAO_APP
        ORDER BY DTULTATUALIZACAO DESC NULLS LAST
        FETCH FIRST 1 ROWS ONLY
      `;

      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return res.json({ rows: result.rows || [], count: (result.rows || []).length });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao consultar versão do app", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
