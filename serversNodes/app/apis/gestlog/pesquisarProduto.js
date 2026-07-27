export default function registerPesquisarProduto(router, { oracledb }) {
  router.get("/pesquisar-produto", async (req, res) => {
    const qRaw = String((req.query || {}).q || "").trim();
    const codFilial = String((req.query || {}).codFilial || "").trim();

    if (!qRaw) {
      return res.status(400).json({ message: "Parâmetro 'q' é obrigatório" });
    }
    if (!["1", "2", "3", "4"].includes(codFilial)) {
      return res.status(400).json({ message: "'codFilial' inválido. Valores: 1,2,3,4" });
    }

    const digitsOnly = (s) => String(s || "").replace(/\D+/g, "");
    const qDigits = digitsOnly(qRaw);
    const isNumeric = qDigits !== "" && /^\d+$/.test(qDigits);
    const codProd = isNumeric ? Number(qDigits) : null;
    const codAux = isNumeric ? Number(qDigits) : null;
    const descLike = qRaw;

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        SELECT 
          A.CODFILIAL,
          A.CODPROD,
          B.DESCRICAO,
          B.CODAUXILIAR,
          E.MARCA,
          ROUND((A.QTEST - A.QTRESERV - A.QTBLOQUEADA), 2) AS DISPONIVEL,
          ROUND((A.QTBLOQUEADA - A.QTINDENIZ), 2) AS BLOQUEADO,
          ROUND(A.QTINDENIZ, 2) AS AVARIA,
          ROUND((A.QTEST - A.QTRESERV - A.QTINDENIZ), 2) AS ESTOQUE_GERAL,
          TO_CHAR(A.DTULTSAIDA, 'DD/MM/YYYY') AS DTULTSAIDA,
          ROUND(A.CUSTOULTENT, 2) AS CUSTOULTENT,
          ROUND(D.PVENDA, 2) AS PRECO_VENDA
        FROM PCEST A 
        JOIN PCPRODUT B ON B.CODPROD = A.CODPROD 
        LEFT JOIN PCTABPR D ON D.CODPROD = A.CODPROD AND D.NUMREGIAO = '1' 
        LEFT JOIN PCMARCA E ON E.CODMARCA = B.CODMARCA 
        WHERE A.CODFILIAL = :codFilial 
          AND (
            (:codProd IS NOT NULL AND A.CODPROD = :codProd)
            OR (:codAux IS NOT NULL AND B.CODAUXILIAR = :codAux)
            OR (:descLike IS NOT NULL AND UPPER(B.DESCRICAO) LIKE '%' || UPPER(:descLike) || '%')
          )
        ORDER BY 
          CASE 
            WHEN (:codProd IS NOT NULL AND A.CODPROD = :codProd) THEN 1 
            WHEN (:codAux IS NOT NULL AND B.CODAUXILIAR = :codAux) THEN 2 
            WHEN (:descLike IS NOT NULL AND UPPER(B.DESCRICAO) LIKE '%' || UPPER(:descLike) || '%') THEN 3 
            ELSE 4 
          END
        FETCH FIRST 20 ROWS ONLY
      `;

      const result = await conn.execute(
        sql,
        {
          codFilial: Number(codFilial),
          codProd,
          codAux,
          descLike,
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const rows = result.rows || [];
      const mapped = rows.map((r) => ({
        ...r,
        NOVA_DTULTSAIDA: r.DTULTSAIDA,
        PVENDA: r.PRECO_VENDA,
      }));
      return res.json({ row: mapped[0] || null, rows: mapped, count: mapped.length });
    } catch (err) {
      return res.status(500).json({ message: "Erro interno ao pesquisar produto", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
