import express from "express";
import oracledb from "oracledb";

const router = express.Router();

const normalizeString = (value) => {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
};

const normalizeNumber = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

router.get("/api/gestlog/motoristas", async (req, res) => {
  const qRaw = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  const idRaw = req.query?.id;
  const id = Number(idRaw);

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    let sql = `
      SELECT
        ID,
        NOME,
        CPF,
        CNH,
        TELEFONE,
        TO_CHAR(DATA_CRIACAO, 'YYYY-MM-DD HH24:MI:SS') AS DATA_CRIACAO,
        CODUSUR_CRIACAO
      FROM GESTLOG_MOTORISTAS
    `;
    const binds = {};
    const wheres = [];
    if (Number.isFinite(id)) {
      wheres.push("ID = :id");
      binds.id = id;
    } else if (qRaw) {
      wheres.push(
        "(UPPER(NOME) LIKE UPPER(:q) OR UPPER(CPF) LIKE UPPER(:q) OR UPPER(TELEFONE) LIKE UPPER(:q))"
      );
      binds.q = `%${qRaw}%`;
    }
    if (wheres.length) {
      sql += ` WHERE ${wheres.join(" AND ")}`;
    }
    sql += " ORDER BY NOME ASC FETCH FIRST 50 ROWS ONLY";

    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao listar motoristas GestLOG:", err);
    const msg = err instanceof Error ? err.message : "Erro interno no servidor";
    return res.status(500).json({ message: msg });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error("Erro ao fechar conexão:", err);
      }
    }
  }
});

router.post("/api/gestlog/motoristas", async (req, res) => {
  const body = req.body || {};

  const nome = normalizeString(body.nome ?? body.NOME);
  const cpfRaw = normalizeString(body.cpf ?? body.CPF);
  const cnhRaw = normalizeString(body.cnh ?? body.CNH);
  const telefoneRaw = normalizeString(body.telefone ?? body.TELEFONE);
  const codUsurCriacao = normalizeNumber(
    body.codUsurCriacao ?? body.codusurCriacao ?? body.CODUSUR_CRIACAO
  );

  const cpf = cpfRaw ? cpfRaw.substring(0, 14) : null;
  const cnh = cnhRaw ? cnhRaw.substring(0, 20) : null;
  const telefone = telefoneRaw ? telefoneRaw.substring(0, 20) : null;

  if (!nome) {
    return res.status(400).json({ message: "nome é obrigatório" });
  }
  if (!codUsurCriacao) {
    return res.status(400).json({ message: "codUsurCriacao é obrigatório" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const idResult = await conn.execute(
      "SELECT NVL(MAX(ID), 0) + 1 AS ID FROM GESTLOG_MOTORISTAS",
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const id = Number(idResult?.rows?.[0]?.ID);
    if (!Number.isFinite(id)) {
      return res.status(500).json({ message: "Falha ao gerar ID do motorista" });
    }

    if (cpf) {
      const dup = await conn.execute(
        "SELECT 1 AS OK FROM GESTLOG_MOTORISTAS WHERE UPPER(CPF) = UPPER(:cpf) AND ROWNUM = 1",
        { cpf },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (dup.rows && dup.rows.length > 0) {
        return res.status(409).json({ message: "CPF já cadastrado" });
      }
    }

    await conn.execute(
      `INSERT INTO GESTLOG_MOTORISTAS (
        ID,
        NOME,
        CPF,
        CNH,
        TELEFONE,
        DATA_CRIACAO,
        CODUSUR_CRIACAO
      ) VALUES (
        :id,
        :nome,
        :cpf,
        :cnh,
        :telefone,
        SYSDATE,
        :codUsurCriacao
      )`,
      { id, nome, cpf, cnh, telefone, codUsurCriacao },
      { autoCommit: true }
    );

    return res.status(201).json({
      success: true,
      id,
      motorista: { id, nome, cpf, cnh, telefone, codUsurCriacao },
    });
  } catch (err) {
    console.error("Erro ao criar motorista GestLOG:", err);
    const msg = err instanceof Error ? err.message : "Erro interno no servidor";
    return res.status(500).json({ message: msg });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error("Erro ao fechar conexão:", err);
      }
    }
  }
});

router.put("/api/gestlog/motoristas/:id", async (req, res) => {
  const id = Number(req.params?.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "id inválido" });
  }

  const body = req.body || {};

  const nome = normalizeString(body.nome ?? body.NOME);
  const cpfRaw = normalizeString(body.cpf ?? body.CPF);
  const cnhRaw = normalizeString(body.cnh ?? body.CNH);
  const telefoneRaw = normalizeString(body.telefone ?? body.TELEFONE);

  const cpf = cpfRaw ? cpfRaw.substring(0, 14) : null;
  const cnh = cnhRaw ? cnhRaw.substring(0, 20) : null;
  const telefone = telefoneRaw ? telefoneRaw.substring(0, 20) : null;

  if (!nome) {
    return res.status(400).json({ message: "nome é obrigatório" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    if (cpf) {
      const dup = await conn.execute(
        "SELECT 1 AS OK FROM GESTLOG_MOTORISTAS WHERE UPPER(CPF) = UPPER(:cpf) AND ID <> :id AND ROWNUM = 1",
        { cpf, id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (dup.rows && dup.rows.length > 0) {
        return res.status(409).json({ message: "CPF já cadastrado" });
      }
    }

    const result = await conn.execute(
      `UPDATE GESTLOG_MOTORISTAS
          SET NOME = :nome,
              CPF = :cpf,
              CNH = :cnh,
              TELEFONE = :telefone
        WHERE ID = :id`,
      { id, nome, cpf, cnh, telefone },
      { autoCommit: true }
    );

    if (!result.rowsAffected) {
      return res.status(404).json({ message: "Motorista não encontrado" });
    }

    return res.json({
      success: true,
      id,
      motorista: { id, nome, cpf, cnh, telefone },
    });
  } catch (err) {
    console.error("Erro ao editar motorista GestLOG:", err);
    const msg = err instanceof Error ? err.message : "Erro interno no servidor";
    return res.status(500).json({ message: msg });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error("Erro ao fechar conexão:", err);
      }
    }
  }
});

export default router;
