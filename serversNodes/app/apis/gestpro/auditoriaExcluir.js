export default function registerAuditoriaExcluir(router, { oracledb }) {
  router.delete("/auditoria", async (req, res) => {
    const codAuditoriaRaw =
      req.query.codAuditoria ??
      req.query.codauditoria ??
      (req.body || {}).codAuditoria ??
      (req.body || {}).codauditoria;
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

      const result = await conn.execute(
        `DELETE FROM GESTPRO_AUDITORIA WHERE CODAUDITORIA = :codAuditoria`,
        { codAuditoria },
        { autoCommit: true }
      );

      if (!result.rowsAffected) {
        return res.status(404).json({ message: "Auditoria não encontrada" });
      }
      return res.json({ ok: true, rowsAffected: result.rowsAffected });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao excluir auditoria", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
