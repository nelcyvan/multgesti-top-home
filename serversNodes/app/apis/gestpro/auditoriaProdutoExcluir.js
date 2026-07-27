async function recalcularTotaisAuditoria(conn, codAuditoria) {
  await conn.execute(
    `UPDATE GESTPRO_AUDITORIA a
        SET QTITENS = (
              SELECT COUNT(*)
                FROM GESTPRO_AUDITORIA_PRODUTOS p
               WHERE p.CODAUDITORIA = a.CODAUDITORIA
            ),
            QTDIVERGENCIAS = (
              SELECT COUNT(*)
                FROM GESTPRO_AUDITORIA_PRODUTOS p
               WHERE p.CODAUDITORIA = a.CODAUDITORIA
                 AND p.DIVERGENTE = 'S'
            )
      WHERE a.CODAUDITORIA = :codAuditoria`,
    { codAuditoria },
    { autoCommit: false }
  );
}

export default function registerAuditoriaProdutoExcluir(router, { oracledb }) {
  router.delete("/auditoria/produto", async (req, res) => {
    const codAuditoriaProdRaw =
      req.query.codAuditoriaProd ??
      req.query.codauditoriaprod ??
      (req.body || {}).codAuditoriaProd ??
      (req.body || {}).codauditoriaprod;
    const codAuditoriaProd = Number(codAuditoriaProdRaw);

    if (!Number.isFinite(codAuditoriaProd)) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: codAuditoriaProd" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const rAtual = await conn.execute(
        `SELECT p.CODAUDITORIA, a.STATUS
           FROM GESTPRO_AUDITORIA_PRODUTOS p
           JOIN GESTPRO_AUDITORIA a ON a.CODAUDITORIA = p.CODAUDITORIA
          WHERE p.CODAUDITORIAPROD = :codAuditoriaProd`,
        { codAuditoriaProd },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const atual = (rAtual.rows || [])[0];
      if (!atual) {
        return res.status(404).json({ message: "Produto da auditoria não encontrado" });
      }

      const status = String(atual.STATUS || "").toUpperCase();
      if (status === "FINALIZADA" || status === "CANCELADA") {
        return res.status(409).json({
          message: `Auditoria com status ${status} não permite exclusão de produtos`,
        });
      }

      const codAuditoria = Number(atual.CODAUDITORIA);
      const result = await conn.execute(
        `DELETE FROM GESTPRO_AUDITORIA_PRODUTOS WHERE CODAUDITORIAPROD = :codAuditoriaProd`,
        { codAuditoriaProd },
        { autoCommit: false }
      );

      if (!result.rowsAffected) {
        await conn.rollback();
        return res.status(404).json({ message: "Produto da auditoria não encontrado" });
      }

      await recalcularTotaisAuditoria(conn, codAuditoria);
      await conn.commit();

      return res.json({ ok: true, rowsAffected: result.rowsAffected });
    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (rollbackErr) {}
      }
      return res.status(500).json({ message: "Erro ao excluir produto da auditoria", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
