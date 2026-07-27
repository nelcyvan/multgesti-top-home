export default function registerProdutoPromocionalEstoque(router, { oracledb }) {
  router.get("/produto-promocional-estoque", async (req, res) => {
    const codAuxiliar = String(req.query.codAuxiliar ?? req.query.codauxiliar ?? "").trim();
    const codProdRaw = req.query.codProd ?? req.query.codprod;
    const codFilialRaw = req.query.codFilial ?? req.query.codfilial;
    const numRegiaoRaw = req.query.numRegiao ?? req.query.numregiao ?? "1";

    const codProd = codProdRaw != null && String(codProdRaw).trim() !== "" ? Number(codProdRaw) : null;
    const codFilial = codFilialRaw != null && String(codFilialRaw).trim() !== "" ? String(codFilialRaw).trim() : null;
    const numRegiao = Number(numRegiaoRaw);

    if (codProd != null && !Number.isFinite(codProd)) {
      return res.status(400).json({ message: "Parâmetro inválido: codProd" });
    }
    if (!Number.isFinite(numRegiao)) {
      return res.status(400).json({ message: "Parâmetro inválido: numRegiao" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const binds = { numRegiao };
      const whereParts = [
        "TRUNC(SYSDATE) BETWEEN TRUNC(gg.DTINICIOVIGENCIA) AND TRUNC(gg.DTFIMVIGENCIA)",
        "gg.NUMREGIAO = :numRegiao",
      ];

      if (codAuxiliar) {
        binds.codAuxiliar = codAuxiliar;
        whereParts.push("aa.CODAUXILIAR = :codAuxiliar");
      }
      if (codProd != null) {
        binds.codProd = codProd;
        whereParts.push("gg.CODPROD = :codProd");
      }
      if (codFilial) {
        binds.codFilial = codFilial;
        whereParts.push("gg.CODFILIAL = :codFilial");
      }

      const sql = `
      SELECT gg.CODPRECOPROM,
             gg.CODPROD,
             gg.CODFILIAL,
             gg.NUMREGIAO,
             aa.DESCRICAO,
             aa.CODAUXILIAR,
             bb.MARCA,
             cc.FORNECEDOR,
             TO_CHAR(NVL(dd.PTABELA, 0), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS PTABELA,
             TO_CHAR(dd.DTULTALTPVENDA, 'DD/MM/YYYY') AS DTULTALTPVENDA,
             TO_CHAR(gg.PRECOFIXO, 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS PRECOFIXO,
             TO_CHAR(gg.DTINICIOVIGENCIA, 'DD/MM/YYYY') AS DTINICIOVIGENCIA,
             TO_CHAR(gg.DTFIMVIGENCIA, 'DD/MM/YYYY') AS DTFIMVIGENCIA,
             'ATIVA' AS STATUS_CAMPANHA,
             TO_CHAR((NVL(ee.QTEST,0) - NVL(ee.QTRESERV,0) - NVL(ee.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_DISPONIVEL_FILIAL_01,
             TO_CHAR((NVL(ee.QTBLOQUEADA,0) - NVL(ee.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_BLOQUEADO_FILIAL_01,
             TO_CHAR((NVL(ff.QTEST,0) - NVL(ff.QTRESERV,0) - NVL(ff.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_DISPONIVEL_FILIAL_03,
             TO_CHAR((NVL(ff.QTBLOQUEADA,0) - NVL(ff.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_BLOQUEADO_FILIAL_03,
             TO_CHAR((NVL(ee.QTEST,0) - NVL(ee.QTRESERV,0) - NVL(ee.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_DISPON_F1,
             TO_CHAR((NVL(ee.QTBLOQUEADA,0) - NVL(ee.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_BLOQ_F1,
             TO_CHAR((NVL(ff.QTEST,0) - NVL(ff.QTRESERV,0) - NVL(ff.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_DISPON_F3,
             TO_CHAR((NVL(ff.QTBLOQUEADA,0) - NVL(ff.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_BLOQ_F3
        FROM PCPRECOPROM gg
        INNER JOIN PCPRODUT aa
                ON aa.CODPROD = gg.CODPROD
        LEFT JOIN PCMARCA bb
               ON bb.CODMARCA = aa.CODMARCA
        LEFT JOIN PCFORNEC cc
               ON cc.CODFORNEC = aa.CODFORNEC
        LEFT JOIN PCTABPR dd
               ON dd.CODPROD = aa.CODPROD
              AND dd.NUMREGIAO = gg.NUMREGIAO
        LEFT JOIN PCEST ee
               ON ee.CODFILIAL = 1
              AND ee.CODPROD = aa.CODPROD
        LEFT JOIN PCEST ff
               ON ff.CODFILIAL = 3
              AND ff.CODPROD = aa.CODPROD
       WHERE ${whereParts.join("\n         AND ")}
       ORDER BY gg.DTFIMVIGENCIA ASC, gg.CODPROD ASC, gg.CODFILIAL ASC
    `;

      try {
        console.log("[apis/gestpro] SQL produto-promocional-estoque:", sql);
      } catch {}

      const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
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
