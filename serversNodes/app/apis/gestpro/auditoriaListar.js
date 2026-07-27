function validarDataISO(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split("-").map(Number);
  const dt = new Date(ano, mes - 1, dia);
  return dt.getFullYear() === ano && dt.getMonth() === mes - 1 && dt.getDate() === dia;
}

const FILTRO_DATA_AUDITORIA = `
  TRUNC(a.DTCADASTRO) = TO_DATE(:data, 'YYYY-MM-DD')
  OR TRUNC(a.DTINICIO) = TO_DATE(:data, 'YYYY-MM-DD')
  OR TRUNC(a.DTFINALIZACAO) = TO_DATE(:data, 'YYYY-MM-DD')
`;

export default function registerAuditoriaListar(router, { oracledb }) {
  router.get("/auditoria/usuario", async (req, res) => {
    const codUsuarioRaw =
      req.query.codUsuarioCriacao ??
      req.query.codUsuario ??
      req.query.codusur ??
      req.query.codigoDoUsuario;
    const codUsuario = Number(codUsuarioRaw);

    const codAuditoriaRaw = req.query.codAuditoria ?? req.query.codauditoria;
    const codAuditoria =
      codAuditoriaRaw == null || codAuditoriaRaw === "" ? null : Number(codAuditoriaRaw);

    const status = String(req.query.status || "").trim().toUpperCase() || null;
    const statusValidos = ["ABERTA", "EM_ANDAMENTO", "FINALIZADA", "CANCELADA"];
    if (status && !statusValidos.includes(status)) {
      return res.status(400).json({ message: "Parâmetro inválido: status" });
    }

    if (codAuditoriaRaw != null && codAuditoriaRaw !== "" && !Number.isFinite(codAuditoria)) {
      return res.status(400).json({ message: "Parâmetro inválido: codAuditoria" });
    }

    const data = String(req.query.data || "").trim();
    if (data && !validarDataISO(data)) {
      return res.status(400).json({ message: "Parâmetro inválido: data (use YYYY-MM-DD)" });
    }

    const whereParts = [];
    const binds = {};
    if (Number.isFinite(codUsuario)) {
      whereParts.push("a.CODUSUARIOCRIACAO = :codUsuario");
      binds.codUsuario = codUsuario;
    }
    if (codAuditoria != null) {
      whereParts.push("a.CODAUDITORIA = :codAuditoria");
      binds.codAuditoria = codAuditoria;
    }
    if (status) {
      whereParts.push("a.STATUS = :status");
      binds.status = status;
    }
    if (data) {
      whereParts.push(`(${FILTRO_DATA_AUDITORIA})`);
      binds.data = data;
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join("\n           AND ")}` : "";

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        SELECT a.CODAUDITORIA,
               a.DESCRICAO,
               a.SETOR,
               a.STATUS,
               a.CODUSUARIOCRIACAO,
               ec.MATRICULA AS MATRICULA_USUARIO_CRIACAO,
               ec.NOME AS NOME_USUARIO_CRIACAO,
               TO_CHAR(a.DTCADASTRO, 'DD/MM/YYYY HH24:MI:SS') AS DTCADASTRO,
               a.CODUSUARIOINI,
               ei.MATRICULA AS MATRICULA_USUARIO_INI,
               ei.NOME AS NOME_USUARIO_INI,
               TO_CHAR(a.DTINICIO, 'DD/MM/YYYY HH24:MI:SS') AS DTINICIO,
               a.CODUSUARIOFIM,
               ef.MATRICULA AS MATRICULA_USUARIO_FIM,
               ef.NOME AS NOME_USUARIO_FIM,
               TO_CHAR(a.DTFINALIZACAO, 'DD/MM/YYYY HH24:MI:SS') AS DTFINALIZACAO,
               a.OBSERVACAO,
               NVL((
                 SELECT COUNT(*)
                   FROM GESTPRO_AUDITORIA_PRODUTOS p
                  WHERE p.CODAUDITORIA = a.CODAUDITORIA
               ), 0) AS QTITENS,
               NVL((
                 SELECT COUNT(*)
                   FROM GESTPRO_AUDITORIA_PRODUTOS p
                  WHERE p.CODAUDITORIA = a.CODAUDITORIA
                    AND p.DIVERGENTE = 'S'
               ), 0) AS QTDIVERGENCIAS
          FROM GESTPRO_AUDITORIA a
          LEFT JOIN PCEMPR ec
                 ON ec.MATRICULA = a.CODUSUARIOCRIACAO
          LEFT JOIN PCEMPR ei
                 ON ei.MATRICULA = a.CODUSUARIOINI
          LEFT JOIN PCEMPR ef
                 ON ef.MATRICULA = a.CODUSUARIOFIM
         ${whereClause}
         ORDER BY a.CODAUDITORIA DESC
      `;

      const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return res.json({ rows: result.rows || [], count: (result.rows || []).length });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao listar auditorias", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
