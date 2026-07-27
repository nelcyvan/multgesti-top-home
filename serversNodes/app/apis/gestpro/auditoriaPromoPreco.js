export const SQL_JOIN_PRECO_PROMOCIONAL = `
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
           AND p.NUMREGIAO = 1
      )
     WHERE RN = 1
  ) promo ON promo.CODPROD = p.CODPROD
`;

export async function buscarPrecoPromocional(conn, oracledb, codProd, numRegiao = 1) {
  const r = await conn.execute(
    `SELECT CODPRECOPROM,
            PRECOFIXO,
            DTINICIOVIGENCIA,
            DTFIMVIGENCIA
       FROM (
         SELECT p.CODPRECOPROM,
                p.PRECOFIXO,
                p.DTINICIOVIGENCIA,
                p.DTFIMVIGENCIA,
                ROW_NUMBER() OVER (ORDER BY p.DTFIMVIGENCIA DESC) AS RN
           FROM PCPRECOPROM p
          WHERE p.CODPROD = :codProd
            AND p.NUMREGIAO = :numRegiao
            AND TRUNC(SYSDATE) BETWEEN TRUNC(p.DTINICIOVIGENCIA)
                                 AND TRUNC(p.DTFIMVIGENCIA)
       )
      WHERE RN = 1`,
    { codProd, numRegiao },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  const row = (r.rows || [])[0];
  if (!row) {
    return {
      codPrecoProm: null,
      precoPromocional: null,
      statusCampanha: null,
    };
  }

  return {
    codPrecoProm: row.CODPRECOPROM != null ? Number(row.CODPRECOPROM) : null,
    precoPromocional: row.PRECOFIXO != null ? Number(row.PRECOFIXO) : null,
    statusCampanha: "ATIVA",
  };
}
