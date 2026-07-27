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

const normalizeDate = (value) => {
  if (value == null) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const d = new Date(t);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
};

router.put("/api/gestlog/rotas/:idRota", async (req, res) => {
  const idRota = Number(req.params?.idRota);
  if (!Number.isFinite(idRota)) {
    return res.status(400).json({ message: "idRota inválido" });
  }

  const body = req.body || {};

  const descricaoRota = normalizeString(body.descricaoRota ?? body.descricao ?? body.DESCRICAO_ROTA);
  const codMotorista = normalizeNumber(body.codMotorista ?? body.COD_MOTORISTA);
  const codVeiculo = normalizeNumber(body.codVeiculo ?? body.COD_VEICULO);
  const dataRota = normalizeDate(body.dataRota ?? body.DATA_ROTA);

  const bairrosRaw = Array.isArray(body.bairros) ? body.bairros : null;
  const bairros = (bairrosRaw || [])
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter((b) => b.length)
    .slice(0, 5);

  const bairro1 = bairros[0] ?? null;
  const bairro2 = bairros[1] ?? null;
  const bairro3 = bairros[2] ?? null;
  const bairro4 = bairros[3] ?? null;
  const bairro5 = bairros[4] ?? null;

  const setParts = [];
  const binds = { idRota };

  if (descricaoRota !== null) {
    setParts.push("DESCRICAO_ROTA = :descricaoRota");
    binds.descricaoRota = descricaoRota;
  }
  if (Array.isArray(body.bairros)) {
    setParts.push(
      "BAIRRO_ROTA_1 = :bairro1",
      "BAIRRO_ROTA_2 = :bairro2",
      "BAIRRO_ROTA_3 = :bairro3",
      "BAIRRO_ROTA_4 = :bairro4",
      "BAIRRO_ROTA_5 = :bairro5"
    );
    binds.bairro1 = bairro1;
    binds.bairro2 = bairro2;
    binds.bairro3 = bairro3;
    binds.bairro4 = bairro4;
    binds.bairro5 = bairro5;
  }
  if (body.codMotorista !== undefined || body.COD_MOTORISTA !== undefined) {
    setParts.push("COD_MOTORISTA = :codMotorista");
    binds.codMotorista = codMotorista;
  }
  if (body.codVeiculo !== undefined || body.COD_VEICULO !== undefined) {
    setParts.push("COD_VEICULO = :codVeiculo");
    binds.codVeiculo = codVeiculo;
  }
  if (body.dataRota !== undefined || body.DATA_ROTA !== undefined) {
    setParts.push("DATA_ROTA = :dataRota");
    binds.dataRota = dataRota;
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

    const updateSql = `
      UPDATE GESTLOG_ROTAS
         SET ${setParts.join(", ")}
       WHERE ID_ROTA = :idRota
    `;

    const resultUpdate = await conn.execute(updateSql, binds, { autoCommit: true });
    if (!resultUpdate?.rowsAffected) {
      return res.status(404).json({ message: "Rota não encontrada" });
    }

    const resultSelect = await conn.execute(
      `
      SELECT
        ID_ROTA,
        DESCRICAO_ROTA,
        BAIRRO_ROTA_1,
        BAIRRO_ROTA_2,
        BAIRRO_ROTA_3,
        BAIRRO_ROTA_4,
        BAIRRO_ROTA_5,
        COD_MOTORISTA,
        COD_VEICULO,
        TO_CHAR(DATA_ROTA, 'YYYY-MM-DD') AS DATA_ROTA,
        CODUSUR_CRIACAO,
        TO_CHAR(DATA_CRIACAO, 'YYYY-MM-DD HH24:MI:SS') AS DATA_CRIACAO
      FROM GESTLOG_ROTAS
      WHERE ID_ROTA = :idRota
      `,
      { idRota },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json({
      success: true,
      rowsAffected: resultUpdate.rowsAffected ?? 0,
      rota: (resultSelect.rows && resultSelect.rows[0]) || null,
    });
  } catch (err) {
    console.error("Erro ao editar rota GestLOG:", err);
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
