export default function registerAuditoriaAtualizar(router, { oracledb }) {
  router.put("/auditoria", async (req, res) => {
    const body = req.body || {};
    const codAuditoria = Number(body.codAuditoria);
    const codUsuario = Number(body.codUsuario ?? body.codusur);

    if (!Number.isFinite(codAuditoria)) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: codAuditoria" });
    }

    const descricao =
      body.descricao !== undefined ? String(body.descricao || "").trim() : undefined;
    const setor = body.setor !== undefined ? String(body.setor || "").trim() : undefined;
    const observacao =
      body.observacao !== undefined ? String(body.observacao || "").trim() || null : undefined;
    const statusRaw = body.status !== undefined ? String(body.status || "").trim().toUpperCase() : undefined;
    const statusValidos = ["ABERTA", "EM_ANDAMENTO", "FINALIZADA", "CANCELADA"];
    if (statusRaw !== undefined && statusRaw && !statusValidos.includes(statusRaw)) {
      return res.status(400).json({ message: "Status inválido" });
    }

    const setParts = [];
    const binds = { codAuditoria };

    if (descricao !== undefined) {
      if (!descricao) {
        return res.status(400).json({ message: "descricao não pode ser vazia" });
      }
      setParts.push("DESCRICAO = :descricao");
      binds.descricao = descricao;
    }
    if (setor !== undefined) {
      if (!setor) {
        return res.status(400).json({ message: "setor não pode ser vazio" });
      }
      setParts.push("SETOR = :setor");
      binds.setor = setor;
    }
    if (observacao !== undefined) {
      setParts.push("OBSERVACAO = :observacao");
      binds.observacao = observacao;
    }
    if (statusRaw !== undefined) {
      if (!statusRaw) {
        return res.status(400).json({ message: "status não pode ser vazio" });
      }
      setParts.push("STATUS = :status");
      binds.status = statusRaw;

      if (statusRaw === "EM_ANDAMENTO") {
        if (!Number.isFinite(codUsuario)) {
          return res.status(400).json({
            message: "codUsuario obrigatório ao iniciar auditoria (EM_ANDAMENTO)",
          });
        }
        setParts.push("CODUSUARIOINI = :codUsuario");
        setParts.push("DTINICIO = NVL(DTINICIO, SYSDATE)");
        binds.codUsuario = codUsuario;
      }
      if (statusRaw === "FINALIZADA") {
        if (!Number.isFinite(codUsuario)) {
          return res.status(400).json({
            message: "codUsuario obrigatório ao finalizar auditoria (FINALIZADA)",
          });
        }
        setParts.push("CODUSUARIOFIM = :codUsuario");
        setParts.push("DTFINALIZACAO = SYSDATE");
        binds.codUsuario = codUsuario;
      }
    }

    if (setParts.length === 0) {
      return res.status(400).json({ message: "Nenhum campo para atualizar" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        UPDATE GESTPRO_AUDITORIA
           SET ${setParts.join(",\n               ")}
         WHERE CODAUDITORIA = :codAuditoria
      `;

      const result = await conn.execute(sql, binds, { autoCommit: true });
      if (!result.rowsAffected) {
        return res.status(404).json({ message: "Auditoria não encontrada" });
      }
      return res.json({ ok: true, rowsAffected: result.rowsAffected });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao atualizar auditoria", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
