function normalizeFlag(value, fieldName) {
  if (value === undefined || value === null || value === "") return { value: null };

  if (typeof value === "boolean") return { value: value ? "S" : "N" };

  if (typeof value === "number") {
    if (value === 1) return { value: "S" };
    if (value === 0) return { value: "N" };
    return { error: `${fieldName} deve ser 'S'/'N' (ou true/false, 1/0)` };
  }

  const text = String(value).trim().toUpperCase();
  if (["S", "SIM", "Y", "YES", "TRUE", "1"].includes(text)) return { value: "S" };
  if (["N", "NAO", "NÃO", "NO", "FALSE", "0"].includes(text)) return { value: "N" };

  return { error: `${fieldName} deve ser 'S'/'N' (ou true/false, 1/0)` };
}

async function fetchPermissoes(conn, { oracledb }, codusur) {
  const sql = `
    SELECT
      p.CODUSUR,
      e.MATRICULA,
      e.NOME,
      p.PERMISSAO_TELA_TRIAGEM,
      p.PERMISSAO_TELA_EXPEDICAO,
      p.PERMISSAO_TELA_CORTAR,
      p.PERMISSAO_TELA_ROTAS,
      p.PERMISSAO_TELA_ENVIAR,
      p.PERMISSAO_TELA_COLETAS,
      p.PERMISSAO_TELA_INVENTARIOS,
      p.PERMISSAO_TELA_ENTREGAS,
      p.ATIVO
    FROM GESTLOG_PERMISSAO_APP p
    LEFT JOIN PCEMPR e
      ON e.MATRICULA = p.CODUSUR
    WHERE p.CODUSUR = :codusur
  `;
  const result = await conn.execute(sql, { codusur }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const row = (result.rows || [])[0];
  if (!row) return null;

  return {
    codusur: row.CODUSUR,
    matricula: row.MATRICULA ?? null,
    nome: row.NOME ?? null,
    triagem: row.PERMISSAO_TELA_TRIAGEM,
    expedicao: row.PERMISSAO_TELA_EXPEDICAO,
    cortar: row.PERMISSAO_TELA_CORTAR,
    rotas: row.PERMISSAO_TELA_ROTAS,
    enviar: row.PERMISSAO_TELA_ENVIAR,
    coletas: row.PERMISSAO_TELA_COLETAS,
    inventarios: row.PERMISSAO_TELA_INVENTARIOS,
    entregas: row.PERMISSAO_TELA_ENTREGAS,
    ativo: row.ATIVO,
  };
}

async function resolveCodusur(conn, { oracledb }, identifier) {
  const idNum = Number(identifier);
  if (!Number.isFinite(idNum) || idNum <= 0) return null;

  const existsInPcempr = await conn.execute(
    `SELECT 1 AS OK
       FROM PCEMPR
      WHERE MATRICULA = :id
      FETCH FIRST 1 ROWS ONLY`,
    { id: idNum },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  if ((existsInPcempr.rows || []).length === 0) return null;
  return idNum;
}

async function fetchUsuario(conn, { oracledb }, matricula) {
  const result = await conn.execute(
    `SELECT MATRICULA, NOME
       FROM PCEMPR
      WHERE MATRICULA = :matricula`,
    { matricula },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  const row = (result.rows || [])[0];
  if (!row) return null;
  return { matricula: row.MATRICULA, nome: row.NOME };
}

async function callGerirPermissoes(conn, { oracledb }, binds) {
  const sql = `
    BEGIN
      GERIR_PERMISSOES(
        :p_acao,
        :p_codusur,
        :p_triagem,
        :p_expedicao,
        :p_cortar,
        :p_rotas,
        :p_enviar,
        :p_coletas,
        :p_inventarios,
        :p_entregas,
        :p_ativo
      );
    END;
  `;
  return await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: true });
}

export default function registerGerirPermissoesUsuario(router, { oracledb }) {
  router.get("/permissoes-usuario/:codusur", async (req, res) => {
    const identifierNum = Number(req.params.codusur);
    if (!Number.isFinite(identifierNum) || identifierNum <= 0) {
      return res.status(400).json({ message: "Parâmetro inválido: informe um número (>0)" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const codusurNum = await resolveCodusur(conn, { oracledb }, identifierNum);
      if (!codusurNum) {
        return res.status(404).json({ message: "Usuário não encontrado (CODUSUR/MATRICULA inválido)" });
      }

      const permissoes = await fetchPermissoes(conn, { oracledb }, codusurNum);
      if (!permissoes) {
        const usuario = await fetchUsuario(conn, { oracledb }, codusurNum);
        if (!usuario) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        return res.json({
          ok: true,
          cadastrado: false,
          permissoes: {
            codusur: codusurNum,
            matricula: usuario.matricula,
            nome: usuario.nome,
            triagem: null,
            expedicao: null,
            cortar: null,
            rotas: null,
            enviar: null,
            coletas: null,
            inventarios: null,
            entregas: null,
            ativo: null,
          },
        });
      }
      return res.json({ ok: true, cadastrado: true, permissoes });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao buscar permissões do usuário", detalhe: err.message });
    } finally {
      if (conn) {
        try { await conn.close(); } catch {}
      }
    }
  });

  router.post("/permissoes-usuario", async (req, res) => {
    const codusurBody = req.body?.codusur;
    const matriculaBody = req.body?.matricula;
    const codusurNumFromBody = Number(codusurBody);
    const matriculaNumFromBody = Number(matriculaBody);
    const hasCodusur = Number.isFinite(codusurNumFromBody) && codusurNumFromBody > 0;
    const hasMatricula = Number.isFinite(matriculaNumFromBody) && matriculaNumFromBody > 0;
    if (!hasCodusur && !hasMatricula) {
      return res.status(400).json({ message: "Informe codusur ou matricula (numérico >0)" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const codusurNum = hasCodusur ? codusurNumFromBody : await resolveCodusur(conn, { oracledb }, matriculaNumFromBody);
      if (!codusurNum) {
        return res.status(404).json({ message: "Usuário não encontrado a partir da matrícula informada" });
      }

      try {
        await callGerirPermissoes(conn, { oracledb }, {
          p_acao: "ADD",
          p_codusur: codusurNum,
          p_triagem: null,
          p_expedicao: null,
          p_cortar: null,
          p_rotas: null,
          p_enviar: null,
          p_coletas: null,
          p_inventarios: null,
          p_entregas: null,
          p_ativo: null,
        });
      } catch (err) {
        if (String(err?.message || "").includes("ORA-00001")) {
          const permissoes = await fetchPermissoes(conn, { oracledb }, codusurNum);
          return res.status(409).json({ message: "Permissões já cadastradas para este usuário", permissoes });
        }
        throw err;
      }

      const permissoes = await fetchPermissoes(conn, { oracledb }, codusurNum);
      return res.json({ ok: true, message: "Usuário adicionado em GESTLOG_PERMISSAO_APP", permissoes });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao adicionar permissões do usuário", detalhe: err.message });
    } finally {
      if (conn) {
        try { await conn.close(); } catch {}
      }
    }
  });

  router.put("/permissoes-usuario/:codusur", async (req, res) => {
    const identifierNum = Number(req.params.codusur);
    if (!Number.isFinite(identifierNum) || identifierNum <= 0) {
      return res.status(400).json({ message: "Parâmetro inválido: informe um número (>0)" });
    }

    const payload = req.body || {};
    const triagem = normalizeFlag(payload.triagem, "triagem");
    if (triagem.error) return res.status(400).json({ message: triagem.error });
    const expedicao = normalizeFlag(payload.expedicao, "expedicao");
    if (expedicao.error) return res.status(400).json({ message: expedicao.error });
    const cortar = normalizeFlag(payload.cortar, "cortar");
    if (cortar.error) return res.status(400).json({ message: cortar.error });
    const rotas = normalizeFlag(payload.rotas, "rotas");
    if (rotas.error) return res.status(400).json({ message: rotas.error });
    const enviar = normalizeFlag(payload.enviar, "enviar");
    if (enviar.error) return res.status(400).json({ message: enviar.error });
    const coletas = normalizeFlag(payload.coletas, "coletas");
    if (coletas.error) return res.status(400).json({ message: coletas.error });
    const inventarios = normalizeFlag(payload.inventarios, "inventarios");
    if (inventarios.error) return res.status(400).json({ message: inventarios.error });
    const entregas = normalizeFlag(payload.entregas, "entregas");
    if (entregas.error) return res.status(400).json({ message: entregas.error });

    const anyProvided =
      triagem.value !== null ||
      expedicao.value !== null ||
      cortar.value !== null ||
      rotas.value !== null ||
      enviar.value !== null ||
      coletas.value !== null ||
      inventarios.value !== null ||
      entregas.value !== null;

    if (!anyProvided) {
      return res.status(400).json({
        message:
          "Informe ao menos um campo para atualização: triagem, expedicao, cortar, rotas, enviar, coletas, inventarios, entregas.",
      });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const codusurNum = await resolveCodusur(conn, { oracledb }, identifierNum);
      if (!codusurNum) {
        return res.status(404).json({ message: "Usuário não encontrado (CODUSUR/MATRICULA inválido)" });
      }

      await callGerirPermissoes(conn, { oracledb }, {
        p_acao: "PERMISSAO",
        p_codusur: codusurNum,
        p_triagem: triagem.value,
        p_expedicao: expedicao.value,
        p_cortar: cortar.value,
        p_rotas: rotas.value,
        p_enviar: enviar.value,
        p_coletas: coletas.value,
        p_inventarios: inventarios.value,
        p_entregas: entregas.value,
        p_ativo: null,
      });

      const permissoes = await fetchPermissoes(conn, { oracledb }, codusurNum);
      return res.json({ ok: true, message: "Permissões atualizadas com sucesso", permissoes });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao atualizar permissões do usuário", detalhe: err.message });
    } finally {
      if (conn) {
        try { await conn.close(); } catch {}
      }
    }
  });

  router.patch("/permissoes-usuario/:codusur/ativo", async (req, res) => {
    const identifierNum = Number(req.params.codusur);
    if (!Number.isFinite(identifierNum) || identifierNum <= 0) {
      return res.status(400).json({ message: "Parâmetro inválido: informe um número (>0)" });
    }

    const ativo = normalizeFlag(req.body?.ativo, "ativo");
    if (ativo.error) return res.status(400).json({ message: ativo.error });
    if (ativo.value === null) return res.status(400).json({ message: "Campo obrigatório ausente: ativo" });

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const codusurNum = await resolveCodusur(conn, { oracledb }, identifierNum);
      if (!codusurNum) {
        return res.status(404).json({ message: "Usuário não encontrado (CODUSUR/MATRICULA inválido)" });
      }

      await callGerirPermissoes(conn, { oracledb }, {
        p_acao: "ATIVO",
        p_codusur: codusurNum,
        p_triagem: null,
        p_expedicao: null,
        p_cortar: null,
        p_rotas: null,
        p_enviar: null,
        p_coletas: null,
        p_inventarios: null,
        p_entregas: null,
        p_ativo: ativo.value,
      });

      const permissoes = await fetchPermissoes(conn, { oracledb }, codusurNum);
      return res.json({ ok: true, message: "Status ativo atualizado com sucesso", permissoes });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao atualizar status ativo do usuário", detalhe: err.message });
    } finally {
      if (conn) {
        try { await conn.close(); } catch {}
      }
    }
  });
}
