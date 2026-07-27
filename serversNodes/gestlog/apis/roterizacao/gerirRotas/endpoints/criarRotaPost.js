import express from "express";
import oracledb from "oracledb";
import criarRota from "./procedures/criarRota.js";

const router = express.Router();

const normalizeString = (v) => (typeof v === "string" ? v.trim() : "");
const normalizeNumber = (v) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const normalizeDate = (s) => {
  const raw = typeof s === "string" ? s.trim() : "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(y, mo - 1, d);
  return Number.isFinite(dt.getTime()) ? dt : null;
};
const normalizeTurno = (v) => {
  const t = normalizeString(v).toUpperCase();
  return t === "M" || t === "T" ? t : null;
};

router.post("/api/gestlog/rotas", async (req, res) => {
  const body = req.body || {};

  const descricaoRota = normalizeString(body.descricaoRota ?? body.descricao ?? body.DESCRICAO_ROTA);
  const codMotorista = normalizeNumber(body.codMotorista ?? body.COD_MOTORISTA);
  const codVeiculo = normalizeNumber(body.codVeiculo ?? body.COD_VEICULO);
  const codUsurCriacao = normalizeNumber(body.codUsurCriacao ?? body.codusurCriacao ?? body.CODUSUR_CRIACAO);
  const dataRota = normalizeDate(body.dataRota ?? body.DATA_ROTA);
  const turnoSeparacao = normalizeTurno(body.turnoSeparacao ?? body.turno_separacao ?? body.TURNO_SEPARACAO);

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

  if (!descricaoRota) {
    return res.status(400).json({ message: "descricaoRota é obrigatório" });
  }
  if (!codUsurCriacao) {
    return res.status(400).json({ message: "codUsurCriacao é obrigatório" });
  }
  if (!codMotorista) {
    return res.status(400).json({ message: "codMotorista é obrigatório" });
  }
  if (!codVeiculo) {
    return res.status(400).json({ message: "codVeiculo é obrigatório" });
  }
  if (!turnoSeparacao) {
    return res.status(400).json({ message: "turnoSeparacao inválido (M ou T)" });
  }
  if (!dataRota) {
    return res.status(400).json({ message: "dataRota é obrigatório" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const { status, message, idRota } = await criarRota(conn, {
      descricaoRota,
      bairro1,
      bairro2,
      bairro3,
      bairro4,
      bairro5,
      codMotorista,
      codVeiculo,
      dataRota,
      codUsurCriacao,
      turnoSeparacao,
    });

    if (!Number.isFinite(status)) {
      return res.status(500).json({ message: "Falha ao obter status da procedure" });
    }

    if (status === 201) {
      return res.status(201).json({
        success: true,
        idRota,
        rota: {
          idRota,
          descricaoRota,
          bairros: [bairro1, bairro2, bairro3, bairro4, bairro5].filter((b) => typeof b === "string" && b.length),
          codMotorista,
          codVeiculo,
          dataRota: dataRota ? dataRota.toISOString() : null,
          codUsurCriacao,
          turnoSeparacao,
        },
      });
    }

    if (status === 409 || status === 400 || status === 404) {
      return res.status(status).json({ message });
    }

    return res.status(500).json({ message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno no servidor";
    return res.status(500).json({ message: msg });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        void 0;
      }
    }
  }
});

export default router;
