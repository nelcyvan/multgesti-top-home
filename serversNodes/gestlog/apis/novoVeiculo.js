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

router.get("/api/gestlog/veiculos", async (req, res) => {
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
        DESCRICAO_VEICULO,
        PLACA_VEICULO,
        CAPACIDADE_CIMENTO,
        TO_CHAR(DATA_CRIACAO, 'YYYY-MM-DD HH24:MI:SS') AS DATA_CRIACAO,
        CODUSUR_CRIACAO
      FROM GESTLOG_VEICULOS
    `;
    const binds = {};
    const wheres = [];
    if (Number.isFinite(id)) {
      wheres.push("ID = :id");
      binds.id = id;
    } else if (qRaw) {
      wheres.push(
        "(UPPER(DESCRICAO_VEICULO) LIKE UPPER(:q) OR UPPER(PLACA_VEICULO) LIKE UPPER(:q))"
      );
      binds.q = `%${qRaw}%`;
    }
    if (wheres.length) {
      sql += ` WHERE ${wheres.join(" AND ")}`;
    }
    sql += " ORDER BY DESCRICAO_VEICULO ASC FETCH FIRST 50 ROWS ONLY";

    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao listar veículos GestLOG:", err);
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

router.post("/api/gestlog/veiculos", async (req, res) => {
  const body = req.body || {};

  const descricaoVeiculo = normalizeString(
    body.descricaoVeiculo ?? body.descricao ?? body.DESCRICAO_VEICULO
  );
  const placaVeiculoRaw = normalizeString(body.placaVeiculo ?? body.PLACA_VEICULO);
  const placaVeiculo = placaVeiculoRaw ? placaVeiculoRaw.substring(0, 10) : null;
  const codUsurCriacao = normalizeNumber(
    body.codUsurCriacao ?? body.codusurCriacao ?? body.CODUSUR_CRIACAO
  );
  const capacidadeCimento =
    normalizeNumber(body.capacidadeCimento ?? body.CAPACIDADE_CIMENTO) ?? 0;

  if (!descricaoVeiculo) {
    return res.status(400).json({ message: "descricaoVeiculo é obrigatório" });
  }
  if (!codUsurCriacao) {
    return res.status(400).json({ message: "codUsurCriacao é obrigatório" });
  }
  if (!Number.isFinite(capacidadeCimento) || capacidadeCimento < 0) {
    return res.status(400).json({ message: "capacidadeCimento inválida" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const idResult = await conn.execute(
      "SELECT NVL(MAX(ID), 0) + 1 AS ID FROM GESTLOG_VEICULOS",
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const id = Number(idResult?.rows?.[0]?.ID);
    if (!Number.isFinite(id)) {
      return res.status(500).json({ message: "Falha ao gerar ID do veículo" });
    }

    if (placaVeiculo) {
      const dup = await conn.execute(
        "SELECT 1 AS OK FROM GESTLOG_VEICULOS WHERE UPPER(PLACA_VEICULO) = UPPER(:placaVeiculo) AND ROWNUM = 1",
        { placaVeiculo },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (dup.rows && dup.rows.length > 0) {
        return res.status(409).json({ message: "Placa já cadastrada" });
      }
    }

    await conn.execute(
      `INSERT INTO GESTLOG_VEICULOS (
        ID,
        DESCRICAO_VEICULO,
        PLACA_VEICULO,
        DATA_CRIACAO,
        CODUSUR_CRIACAO,
        CAPACIDADE_CIMENTO
      ) VALUES (
        :id,
        :descricaoVeiculo,
        :placaVeiculo,
        SYSDATE,
        :codUsurCriacao,
        :capacidadeCimento
      )`,
      { id, descricaoVeiculo, placaVeiculo, codUsurCriacao, capacidadeCimento },
      { autoCommit: true }
    );

    return res.status(201).json({
      success: true,
      id,
      veiculo: { id, descricaoVeiculo, placaVeiculo, codUsurCriacao, capacidadeCimento },
    });
  } catch (err) {
    console.error("Erro ao criar veículo GestLOG:", err);
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

router.put("/api/gestlog/veiculos/:id", async (req, res) => {
  const id = Number(req.params?.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "id inválido" });
  }

  const body = req.body || {};

  const descricaoVeiculo = normalizeString(
    body.descricaoVeiculo ?? body.descricao ?? body.DESCRICAO_VEICULO
  );
  const capacidadeCimento = normalizeNumber(body.capacidadeCimento ?? body.CAPACIDADE_CIMENTO);

  const hasPlacaKey =
    Object.prototype.hasOwnProperty.call(body, "placaVeiculo") ||
    Object.prototype.hasOwnProperty.call(body, "PLACA_VEICULO");
  const placaVeiculoRaw = hasPlacaKey
    ? normalizeString(body.placaVeiculo ?? body.PLACA_VEICULO)
    : null;
  const placaVeiculo = hasPlacaKey
    ? placaVeiculoRaw
      ? placaVeiculoRaw.substring(0, 10)
      : null
    : null;

  if (!descricaoVeiculo) {
    return res.status(400).json({ message: "descricaoVeiculo é obrigatório" });
  }
  if (capacidadeCimento == null || !Number.isFinite(capacidadeCimento) || capacidadeCimento < 0) {
    return res.status(400).json({ message: "capacidadeCimento é obrigatório e deve ser >= 0" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    if (hasPlacaKey && placaVeiculo) {
      const dup = await conn.execute(
        "SELECT 1 AS OK FROM GESTLOG_VEICULOS WHERE UPPER(PLACA_VEICULO) = UPPER(:placaVeiculo) AND ID <> :id AND ROWNUM = 1",
        { placaVeiculo, id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (dup.rows && dup.rows.length > 0) {
        return res.status(409).json({ message: "Placa já cadastrada" });
      }
    }

    const sets = ["DESCRICAO_VEICULO = :descricaoVeiculo", "CAPACIDADE_CIMENTO = :capacidadeCimento"];
    const binds = { id, descricaoVeiculo, capacidadeCimento };
    if (hasPlacaKey) {
      sets.push("PLACA_VEICULO = :placaVeiculo");
      binds.placaVeiculo = placaVeiculo;
    }

    const result = await conn.execute(
      `UPDATE GESTLOG_VEICULOS SET ${sets.join(", ")} WHERE ID = :id`,
      binds,
      { autoCommit: true }
    );

    if (!result.rowsAffected) {
      return res.status(404).json({ message: "Veículo não encontrado" });
    }

    return res.json({
      success: true,
      id,
      veiculo: {
        id,
        descricaoVeiculo,
        placaVeiculo: hasPlacaKey ? placaVeiculo : undefined,
        capacidadeCimento,
      },
    });
  } catch (err) {
    console.error("Erro ao editar veículo GestLOG:", err);
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
