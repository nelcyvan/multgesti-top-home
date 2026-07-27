export default function registerProdutoEstoque(router, { oracledb }) {
  router.get("/produto-estoque", async (req, res) => {
    const codAuxiliar = String((req.query.codAuxiliar ?? req.query.codauxiliar ?? "")).trim();
    if (!codAuxiliar) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: codAuxiliar" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
      SELECT aa.CODPROD,
             aa.DESCRICAO,
             aa.CODAUXILIAR,
             bb.MARCA,
             cc.FORNECEDOR,
             TO_CHAR(NVL(dd.PTABELA, 0), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS PTABELA,
             TO_CHAR(dd.DTULTALTPVENDA, 'DD/MM/YYYY') AS DTULTALTPVENDA,
             TO_CHAR((NVL(ee.QTEST,0) - NVL(ee.QTRESERV,0) - NVL(ee.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_DISPON_F1,
             TO_CHAR((NVL(ee.QTBLOQUEADA,0) - NVL(ee.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_BLOQ_F1,
             TO_CHAR((NVL(ff.QTEST,0) - NVL(ff.QTRESERV,0) - NVL(ff.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_DISPON_F3,
             TO_CHAR((NVL(ff.QTBLOQUEADA,0) - NVL(ff.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_BLOQ_F3,
             gg.CODPRECOPROM,
             TO_CHAR(gg.PRECOFIXO, 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS PRECOFIXO,
             TO_CHAR(gg.DTINICIOVIGENCIA, 'DD/MM/YYYY') AS DTINICIOVIGENCIA,
             TO_CHAR(gg.DTFIMVIGENCIA, 'DD/MM/YYYY') AS DTFIMVIGENCIA,
             CASE WHEN gg.CODPRECOPROM IS NOT NULL THEN 'ATIVA' END AS STATUS_CAMPANHA
        FROM PCPRODUT aa
        LEFT JOIN PCMARCA bb
               ON bb.CODMARCA = aa.CODMARCA
        LEFT JOIN PCFORNEC cc
               ON cc.CODFORNEC = aa.CODFORNEC
        LEFT JOIN PCTABPR dd
               ON dd.CODPROD = aa.CODPROD
              AND dd.NUMREGIAO = 1
        LEFT JOIN PCEST ee
               ON ee.CODFILIAL = 1
              AND ee.CODPROD = aa.CODPROD
        LEFT JOIN PCEST ff
               ON ff.CODFILIAL = 3
              AND ff.CODPROD = aa.CODPROD
        LEFT JOIN (
          SELECT CODPRECOPROM,
                 CODPROD,
                 PRECOFIXO,
                 DTINICIOVIGENCIA,
                 DTFIMVIGENCIA
            FROM (
              SELECT p.CODPRECOPROM,
                     p.CODPROD,
                     p.PRECOFIXO,
                     p.DTINICIOVIGENCIA,
                     p.DTFIMVIGENCIA,
                     ROW_NUMBER() OVER (
                       PARTITION BY p.CODPROD
                           ORDER BY p.DTFIMVIGENCIA DESC
                     ) AS RN
                FROM PCPRECOPROM p
               WHERE TRUNC(SYSDATE) BETWEEN TRUNC(p.DTINICIOVIGENCIA)
                                        AND TRUNC(p.DTFIMVIGENCIA)
            )
           WHERE RN = 1
        ) gg
               ON gg.CODPROD = aa.CODPROD
       WHERE aa.CODAUXILIAR = :codAuxiliar
    `;
      try {
        console.log("[apis/gestpro] SQL produto-estoque:", sql);
      } catch {}

      const result = await conn.execute(sql, { codAuxiliar }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return res.json({ rows: result.rows || [], count: (result.rows || []).length });
    } catch (err) {
      return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
