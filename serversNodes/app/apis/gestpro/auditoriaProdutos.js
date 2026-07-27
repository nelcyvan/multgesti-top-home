import { SQL_JOIN_PRECO_PROMOCIONAL } from "./auditoriaPromoPreco.js";

export default function registerAuditoriaProdutos(router, { oracledb }) {
  router.get("/auditoria/produtos", async (req, res) => {
    const codAuditoriaRaw = req.query.codAuditoria ?? req.query.codauditoria;
    const codAuditoria = Number(codAuditoriaRaw);

    if (!Number.isFinite(codAuditoria)) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: codAuditoria" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        SELECT p.CODAUDITORIAPROD,
               p.CODAUDITORIA,
               p.CODPROD,
               p.CODAUXILIAR,
               p.PRECO_ETIQUETA,
               p.PRECO_SISTEMA,
               promo.PRECOFIXO AS PRECO_PROMOCIONAL,
               promo.CODPRECOPROM,
               CASE WHEN promo.CODPRECOPROM IS NOT NULL THEN 'ATIVA' END AS STATUS_CAMPANHA,
               TO_CHAR(promo.DTINICIOVIGENCIA, 'DD/MM/YYYY') AS DTINICIO_PROMOCAO,
               TO_CHAR(promo.DTFIMVIGENCIA, 'DD/MM/YYYY') AS DTFIM_PROMOCAO,
               p.DIVERGENTE,
               p.CODUSUARIOCONF,
               TO_CHAR(p.DTCONFERENCIA, 'DD/MM/YYYY HH24:MI:SS') AS DTCONFERENCIA,
               p.OBSERVACAO,
               p.QT_ETIQUETA,
               p.COD_BARRAS_ERRADO,
               p.COD_INTERNO_ERRADO,
               p.UN_MEDIDA_ERRADO,
               p.SEM_ETIQUETA
          FROM GESTPRO_AUDITORIA_PRODUTOS p
          ${SQL_JOIN_PRECO_PROMOCIONAL}
         WHERE p.CODAUDITORIA = :codAuditoria
         ORDER BY p.CODAUDITORIAPROD ASC
      `;

      const result = await conn.execute(sql, { codAuditoria }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return res.json({ rows: result.rows || [], count: (result.rows || []).length });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao listar produtos da auditoria", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
