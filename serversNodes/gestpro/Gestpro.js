import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import oracledb from "oracledb";
import multer from "multer";
import fs from "fs";
import registerCanpanhaVendasMesAnterior from "./apis/CanpanhaVendasMesAnterior.js";
import registerComissoesPorFreteMesAtualTotal from "./apis/comissoesPorFreteMesAtualTotal.js";
import registerComissoesPorFreteMesAnteriorTotal from "./apis/comissoesPorFreteMesAnteriorTotal.js";
import registerComissoesPorFreteMesAnteriorEmAbertoTotal from "./apis/comissoesPorFreteMesAnteriorEmAbertoTotal.js";
import registerComissoesPorFreteMesAtualEmAbertoTotal from "./apis/comissoesPorFreteMesAtualEmAbertoTotal.js";

// Carrega o .env
dotenv.config({ path: "/home/multgesti/.env" });

// Inicializa o Oracle Client
oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

console.log("[GestPRO] Iniciando servidor a partir de:", import.meta.url);

const app = express();
const PORT = Number(process.env.GESTPRO_PORT);
if (!PORT) {
  console.error("[GestPRO] Porta não configurada em GESTPRO_PORT");
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger de requisições para depuração
app.use((req, _res, next) => {
  try {
    console.log(`[GestPRO] ${new Date().toISOString()} ${req.method} ${req.url}`);
  } catch {}
  next();
});

// Configuração de upload (comprovantes)
const uploadDir = "/home/multgesti/gestpro.out/comprovantes";
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch {}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${ts}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadFotos = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Healthcheck simples
app.get("/api/gestpro/ping", (req, res) => {
  console.log("[GestPRO] Rota registrada: GET /api/gestpro/ping");
  res.json({ ok: true, ts: Date.now() });
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/ping");

registerCanpanhaVendasMesAnterior(app, oracledb);

const gestproRouter = express.Router();
registerComissoesPorFreteMesAtualTotal(gestproRouter, { oracledb });
registerComissoesPorFreteMesAnteriorTotal(gestproRouter, { oracledb });
registerComissoesPorFreteMesAnteriorEmAbertoTotal(gestproRouter, { oracledb });
registerComissoesPorFreteMesAtualEmAbertoTotal(gestproRouter, { oracledb });
app.use("/api/gestpro", gestproRouter);

// Endpoint: Comissões por Liquidez
// SELECT QTTITULOS, CODUSUR, RCA, TIPOVEND, VALOR FROM MULTGESTI_COMISSOES_POR_LIQUIDEZ
app.get("/api/gestpro/comissao-por-liquidez", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/comissao-por-liquidez");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
        NVL(QTTITULOS, 0) AS QTTITULOS,
        NVL(CODUSUR, 0) AS CODUSUR,
        NVL(RCA, 'N/I') AS RCA,
        NVL(TIPOVEND, 'N/I') AS TIPOVEND,
        NVL(VALOR, 0) AS VALOR
      FROM MULTGESTI_COMISSOES_POR_LIQUIDEZ_MES_ATUAL
        WHERE CODUSUR NOT IN (100)
        ORDER BY VALOR DESC
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar Comissões por Liquidez:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/comissao-por-liquidez");

// Endpoint: Comissões por Liquidez (Mês Anterior)
// SELECT QTTITULOS, CODUSUR, RCA, TIPOVEND, VALOR FROM MULTGESTI_COMISSOES_POR_LIQUIDEZ_MES_ANTERIOR
app.get("/api/gestpro/comissao-por-liquidez-mes-anterior", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/comissao-por-liquidez-mes-anterior");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
        NVL(QTTITULOS, 0) AS QTTITULOS,
        NVL(CODUSUR, 0) AS CODUSUR,
        NVL(RCA, 'N/I') AS RCA,
        NVL(TIPOVEND, 'N/I') AS TIPOVEND,
        NVL(VALOR, 0) AS VALOR
      FROM MULTGESTI_COMISSOES_POR_LIQUIDEZ_MES_ANTERIOR
        WHERE CODUSUR NOT IN (100)
        ORDER BY VALOR DESC
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar Comissões por Liquidez (Mês Anterior):", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/comissao-por-liquidez-mes-anterior");

// Endpoint: Em Aberto Mês Atual
// SELECT * FROM MULTGESTI_EM_ABERTO_MES_ATUAL
app.get("/api/gestpro/em-aberto-mes-atual", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/em-aberto-mes-atual");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
        NVL(CODUSUR, 0) AS CODUSUR,
        NVL(NOME, 'N/I') AS RCA,
        NVL(TOTAL_EM_ABERTO, 0) AS VALOR
      FROM MULTGESTI_EM_ABERTO_MES_ATUAL
      WHERE CODUSUR NOT IN (100, 117)
      ORDER BY VALOR DESC 
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar Em Aberto Mês Atual:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/em-aberto-mes-atual");

// Endpoint: Em Aberto (Mês Anterior)
// SELECT CODUSUR, NOME AS RCA, TOTAL_EM_ABERTO AS VALOR FROM MULTGESTI_EM_ABERTO_MES_ANTERIOR
app.get("/api/gestpro/em-aberto-mes-anterior", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/em-aberto-mes-anterior");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
        NVL(CODUSUR, 0) AS CODUSUR,
        NVL(NOME, 'N/I') AS RCA,
        NVL(TOTAL_EM_ABERTO, 0) AS VALOR
      FROM MULTGESTI_EM_ABERTO_MES_ANTERIOR
      WHERE CODUSUR NOT IN (100, 117)
      ORDER BY VALOR DESC
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar Em Aberto (Mês Anterior):", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/em-aberto-mes-anterior");

// Endpoint: Duplicatas em Aberto (Mês Atual)
// SELECT DTEMISSAO, CODCLI, CLIENTE, NUMPED, VALOR, CODCOB, CODUSUR, NOME FROM MULTGESTI_DUPLICATAS_EM__ABERTO_MES_ATUAL
app.get("/api/gestpro/duplicatas-em-aberto-mes-atual", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/duplicatas-em-aberto-mes-atual");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT
        TO_CHAR(DTEMISSAO, 'DD/MM/YYYY') AS DTEMISSAO,
        NVL(CODCLI, 0) AS CODCLI,
        NVL(CLIENTE, 'N/I') AS CLIENTE,
        NVL(NUMPED, 0) AS NUMPED,
        NVL(VALOR, 0) AS VALOR,
        NVL(CODCOB, 'N/I') AS CODCOB,
        NVL(CODUSUR, 0) AS CODUSUR,
        NVL(NOME, 'N/I') AS NOME
      FROM MULTGESTI_DUPLICATAS_EM__ABERTO_MES_ATUAL
      WHERE CODUSUR NOT IN (100, 117)
      ORDER BY DTEMISSAO DESC
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar Duplicatas em Aberto (Mês Atual):", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/duplicatas-em-aberto-mes-atual");

// Endpoint: Duplicatas em Aberto (Mês Anterior)
// SELECT DTEMISSAO, CODCLI, CLIENTE, NUMPED, VALOR, CODCOB, CODUSUR, NOME FROM MULTGESTI_DUPLICATAS_EM__ABERTO_MES_ANTERIOR
app.get("/api/gestpro/duplicatas-em-aberto-mes-anterior", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/duplicatas-em-aberto-mes-anterior");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // Primeiro tenta com a view com dupla underscore (compatível com Mês Atual)
    const sqlPrimary = `
      SELECT
        TO_CHAR(DTEMISSAO, 'DD/MM/YYYY') AS DTEMISSAO,
        NVL(CODCLI, 0) AS CODCLI,
        NVL(CLIENTE, 'N/I') AS CLIENTE,
        NVL(NUMPED, 0) AS NUMPED,
        NVL(VALOR, 0) AS VALOR,
        NVL(CODCOB, 'N/I') AS CODCOB,
        NVL(CODUSUR, 0) AS CODUSUR,
        NVL(NOME, 'N/I') AS NOME
      FROM MULTGESTI_DUPLICATAS_EM__ABERTO_MES_ANTERIOR
      WHERE CODUSUR NOT IN (100, 117)
      ORDER BY DTEMISSAO DESC
    `;

    try {
      const result = await conn.execute(sqlPrimary, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return res.json({ rows: result.rows || [], count: (result.rows || []).length });
    } catch (err1) {
      const msg = String((err1 && err1.message) || "");
      // Caso a view com dupla underscore não exista, tenta com a versão com underscore simples
      if (msg.includes("ORA-00942")) {
        console.warn("[GestPRO] View MULTGESTI_DUPLICATAS_EM__ABERTO_MES_ANTERIOR não encontrada. Tentando com underscore simples.");
        const sqlFallback = `
          SELECT
            TO_CHAR(DTEMISSAO, 'DD/MM/YYYY') AS DTEMISSAO,
            NVL(CODCLI, 0) AS CODCLI,
            NVL(CLIENTE, 'N/I') AS CLIENTE,
            NVL(NUMPED, 0) AS NUMPED,
            NVL(VALOR, 0) AS VALOR,
            NVL(CODCOB, 'N/I') AS CODCOB,
            NVL(CODUSUR, 0) AS CODUSUR,
            NVL(NOME, 'N/I') AS NOME
          FROM MULTGESTI_DUPLICATAS_EM_ABERTO_MES_ANTERIOR
          WHERE CODUSUR NOT IN (100, 117)
          ORDER BY DTEMISSAO DESC
        `;
        const result2 = await conn.execute(sqlFallback, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return res.json({ rows: result2.rows || [], count: (result2.rows || []).length });
      }
      // Se for outro erro, propaga para o handler externo
      throw err1;
    }
  } catch (err) {
    console.error("Erro ao buscar Duplicatas em Aberto (Mês Anterior):", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/duplicatas-em-aberto-mes-anterior");



// Endpoint: Comissões por Frete (Mês Anterior)
// SELECT CODUSUR, VENDEDOR, QTD_VENDAS_FRETE, VALOR_FRETE_TOTAL FROM MULTGESTI_COMISSOES_POR_LIQUIDEZ_ANALITICO_MES_ANTERIOR ORDER BY VALOR_FRETE_TOTAL DESC
app.get("/api/gestpro/comissoes-por-frete-mes-anterior", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/comissoes-por-frete-mes-anterior");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
        NVL(CODUSUR, 0) AS CODUSUR, 
        NVL(VENDEDOR, 'N/I') AS VENDEDOR, 
        NVL(QTD_VENDAS_FRETE, 0) AS QTD_VENDAS_FRETE, 
        NVL(VALOR_FRETE_TOTAL, 0) AS VALOR_FRETE_TOTAL 
      FROM MULTGESTI_COMISSOES_POR_LIQUIDEZ_ANALITICO_MES_ANTERIOR 
      ORDER BY VALOR_FRETE_TOTAL DESC 
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar Comissões por Frete (Mês Anterior):", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/comissoes-por-frete-mes-anterior");

// Endpoint: Faturamento 111
// SELECT VLVENDA, VLDEVOLUCAO, VLMETA FROM EUNIX_FATURAMENTO_SUPERV
// SELECT VLVENDA, VLDEVOLUCAO, VLMETA FROM EUNIX_FATURAMENTO_SUPERV_DIARIO
app.get("/api/gestpro/faturamento-111", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/faturamento-111");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sqlMensal = `
      SELECT
        NVL(VLVENDA, 0) AS VLVENDA,
        NVL(VLDEVOLUCAO, 0) AS VLDEVOLUCAO,
        NVL(VLMETA, 0) AS VLMETA
      FROM EUNIX_FATURAMENTO_SUPERV
    `;

    const sqlDiario = `
      SELECT
        NVL(VLVENDA, 0) AS VLVENDA,
        NVL(VLDEVOLUCAO, 0) AS VLDEVOLUCAO,
        NVL(VLMETA, 0) AS VLMETA
      FROM EUNIX_FATURAMENTO_SUPERV_DIARIO
    `;

    const sqlNotas = `
      SELECT count(*) AS QTD_NOTAS 
      FROM PCNFSAID 
      WHERE DTSAIDA = TRUNC(SYSDATE) 
        AND CAIXA = 1001 
        AND DTCANCEL IS NULL 
        AND CODFISCAL = 512
    `;

    const [resultMensal, resultDiario, resultNotas] = await Promise.all([
      conn.execute(sqlMensal, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      conn.execute(sqlDiario, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      conn.execute(sqlNotas, [], { outFormat: oracledb.OUT_FORMAT_OBJECT }),
    ]);

    const mensal = resultMensal.rows || [];
    const diario = resultDiario.rows || [];
    const notas = resultNotas.rows || [];
    const qtdNotas = notas.length > 0 ? notas[0].QTD_NOTAS : 0;

    const vlVendaDiario = (diario.length > 0) ? Number(diario[0].VLVENDA) : 0;
    const ticketMedio = qtdNotas > 0 ? (vlVendaDiario / qtdNotas) : 0;

    return res.json({
      mensal,
      diario,
      qtdNotas,
      ticketMedio,
      countMensal: mensal.length,
      countDiario: diario.length,
    });
  } catch (err) {
    console.error("Erro ao buscar Faturamento 111:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/faturamento-111");




// Endpoint: Inventário Avulso por Usuário (Ajuste de Estoque)
app.get("/api/gestpro/inventario/avulso/usuario/ajusteEstoque", async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const query = req.query || {};
    const dataInicioRaw = String(query.dataInicio ?? "").trim();
    const dataFimRaw = String(query.dataFim ?? "").trim();
    const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
    const isDMY = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(String(s || ""));
    const toDMY = (iso) => {
      const [y, m, d] = String(iso).split("-");
      return `${d}/${m}/${y}`;
    };
    const normalizeToDMY = (s) => {
      if (!s) return "";
      if (isDMY(s)) return s;
      if (isISODate(s)) return toDMY(s);
      return null;
    };

    const dataInicioDMY = normalizeToDMY(dataInicioRaw);
    const dataFimDMY = normalizeToDMY(dataFimRaw);
    if (dataInicioRaw && !dataInicioDMY) {
      return res.status(400).json({ message: "'dataInicio' deve estar em DD/MM/YYYY ou YYYY-MM-DD" });
    }
    if (dataFimRaw && !dataFimDMY) {
      return res.status(400).json({ message: "'dataFim' deve estar em DD/MM/YYYY ou YYYY-MM-DD" });
    }

    const whereAvulso = [];
    const bindsAvulso = {};
    if (dataInicioDMY) {
      whereAvulso.push("aa.DATA >= TO_DATE(:dataInicio, 'DD/MM/YYYY')");
      bindsAvulso.dataInicio = dataInicioDMY;
    }
    if (dataFimDMY) {
      whereAvulso.push("aa.DATA < (TO_DATE(:dataFim, 'DD/MM/YYYY') + 1)");
      bindsAvulso.dataFim = dataFimDMY;
    }
    const whereAvulsoSql = whereAvulso.length ? `WHERE ${whereAvulso.join(" AND ")}` : "";

    // bloco inventarios de produtos pendentes
    const wherePendentes = [];
    const bindsPendentes = {};
    const pendentesDataRef = "NVL(DATA_HORA_ULTIMA_CONTAGEM, DATA_HORA_PRIMEIRA_CONTAGEM)";
    if (dataInicioDMY) {
      wherePendentes.push(`${pendentesDataRef} >= TO_DATE(:dataInicio, 'DD/MM/YYYY')`);
      bindsPendentes.dataInicio = dataInicioDMY;
    }
    if (dataFimDMY) {
      wherePendentes.push(`${pendentesDataRef} < (TO_DATE(:dataFim, 'DD/MM/YYYY') + 1)`);
      bindsPendentes.dataFim = dataFimDMY;
    }
    const wherePendentesSql = wherePendentes.length ? `WHERE ${wherePendentes.join(" AND ")}` : "";

    const sqlAvulso = `
SELECT 
    aa.ID_INVENTARIO,
    aa.FILIAL,
    aa.NOME_INVENTARIO,
    aa.LOCAL_CONTAGEM,
    aa.NOME_USUARIO,
    aa.RESPONSAVEL,
    TO_CHAR(aa.DATA, 'DD/MM/YYYY HH24:MI:SS') AS DATA,
    TO_CHAR(aa.DATA_ENCERRAMENTO, 'DD/MM/YYYY HH24:MI:SS') AS DATA_ENCERRAMENTO,
    bb.ID_PRODUTO,
    bb.CODPROD,
    bb.DESCRICAO,
    bb.CODAUXILIAR,
    bb.QT_CONTADA,
    TO_CHAR(bb.DATA_HORA_PRIMEIRA_CONTAGEM, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA_PRIMEIRA_CONTAGEM,
    TO_CHAR(bb.DATA_HORA_ULTIMA_CONTAGEM, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA_ULTIMA_CONTAGEM,
    TO_CHAR(bb.DATA_HOTA_PRIMEIRA_TRATATIVA, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA_PRIMEIRA_TRATATIVA,
    TO_CHAR(bb.DATA_HOTA_ULTIMA_TRATATIVA, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA_ULTIMA_TRATATIVA,
    bb.ADD_PED_REPOS,
    bb.ID_PED_REPOS
FROM MULTGESTI_INVENTARIO_AVULSO aa
LEFT JOIN MULTGESTI_INVENTARIO_AVULSO_PRODUTOS bb
       ON bb.ID_INVENTARIO = aa.ID_INVENTARIO
${whereAvulsoSql}
ORDER BY aa.ID_INVENTARIO ASC, bb.ID_PRODUTO ASC
    `;

    const sqlPendentes = `
SELECT 
    ID_PRODUTO, 
    CODPROD, 
    DESCRICAO, 
    CODAUXILIAR, 
    CODUSUR_ENVIO_CONTAGEM, 
    NOME_USUARIO_ENVIO_CONTAGEM, 
    QT_CONTADA, 
    TO_CHAR(DATA_HORA_PRIMEIRA_CONTAGEM, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA_PRIMEIRA_CONTAGEM, 
    TO_CHAR(DATA_HORA_ULTIMA_CONTAGEM, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA_ULTIMA_CONTAGEM, 
    TO_CHAR(DATA_HORA_PRIMEIRA_TRATATIVA, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA_PRIMEIRA_TRATATIVA, 
    TO_CHAR(DATA_HORA_ULTIMA_TRATATIVA, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA_ULTIMA_TRATATIVA, 
    LOGS_ENVIO_CONTAGENS 
FROM MULTGESTI_INVENTARIO_PRODUTOS_PENDENTES
${wherePendentesSql}
    `;

    const [resultAvulso, resultPendentes] = await Promise.all([
      conn.execute(sqlAvulso, bindsAvulso, { outFormat: oracledb.OUT_FORMAT_OBJECT }),
      conn.execute(sqlPendentes, bindsPendentes, { outFormat: oracledb.OUT_FORMAT_OBJECT })
    ]);

    const rowsAvulso = resultAvulso.rows || [];
    const rowsPendentes = resultPendentes.rows || [];

    return res.json({ 
      rows: rowsAvulso, // Mantendo compatibilidade imediata
      avulsos: rowsAvulso,
      pendentes: rowsPendentes,
      count: rowsAvulso.length,
      countPendentes: rowsPendentes.length
    });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/inventario/avulso/usuario/ajusteEstoque");




app.get("/api/gestpro/inventario/avulso/contagens-por-produto", async (req, res) => {
  const codProdutoStr = String((req.query || {}).codProduto || '').trim();
  const idInventarioStr = String((req.query || {}).idInventario || '').trim();
  const codProduto = Number(codProdutoStr);
  const idInventario = Number(idInventarioStr);
  if (!Number.isFinite(codProduto) || !Number.isFinite(idInventario)) {
    return res.status(400).json({ message: "Parâmetros obrigatórios: codProduto e idInventario (number)" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
        aa.ID_INVENTARIO,
        bb.NOME_INVENTARIO,
        bb.LOCAL_CONTAGEM,
        bb.NOME_USUARIO,
        bb.FILIAL,
        TO_CHAR(bb.DATA, 'DD/MM/YYYY HH24:MI:SS') AS DATA,
        TO_CHAR(bb.DATA_ENCERRAMENTO, 'DD/MM/YYYY HH24:MI:SS') AS DATA_ENCERRAMENTO,
        bb.RESPONSAVEL,
        aa.QT_CONTADA
      FROM 
        MULTGESTI_INVENTARIO_AVULSO_PRODUTOS aa 
      JOIN 
        MULTGESTI_INVENTARIO_AVULSO bb 
          ON bb.ID_INVENTARIO = aa.ID_INVENTARIO 
      WHERE 
        aa.CODPROD = :codProduto 
        AND aa.ID_INVENTARIO <> :idInventario
      ORDER BY aa.ID_INVENTARIO ASC
    `;

    const result = await conn.execute(sql, { codProduto, idInventario }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error("[GestPRO] Erro ao buscar contagens por produto:", err);
    return res.status(500).json({ message: "Erro interno ao buscar contagens por produto", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/inventario/avulso/contagens-por-produto");

app.post("/api/gestpro/inventario/avulso/reabrir", async (req, res) => {
  const idStr = String((req.body || {}).idInventario ?? (req.query || {}).idInventario ?? "").trim();
  const idInventario = Number(idStr);
  if (!idInventario || !Number.isFinite(idInventario)) {
    return res.status(400).json({ message: "Parâmetro obrigatório: idInventario (number)" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      UPDATE MULTGESTI_INVENTARIO_AVULSO
         SET DATA_ENCERRAMENTO = NULL
       WHERE ID_INVENTARIO = :idInventario
    `;

    const result = await conn.execute(sql, { idInventario }, { autoCommit: true });
    return res.json({ ok: true, idInventario, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("[GestPRO] Erro ao reabrir inventário avulso:", err);
    return res.status(500).json({ message: "Erro interno ao reabrir inventário avulso", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/inventario/avulso/reabrir");

app.post("/api/gestpro/inventario/avulso/marcar-primeira-tratativa", async (req, res) => {
  const idInventarioStr = String(((req.body || {}).idInventario ?? (req.query || {}).idInventario) || "").trim();
  const idCodProdutoStr = String(((req.body || {}).idCodProduto ?? (req.query || {}).idCodProduto) || "").trim();
  const idInventario = Number(idInventarioStr);
  const idCodProduto = Number(idCodProdutoStr);
  if (!Number.isFinite(idInventario) || !Number.isFinite(idCodProduto)) {
    return res.status(400).json({ message: "Parâmetros obrigatórios: idInventario e idCodProduto (number)" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      UPDATE MULTGESTI_INVENTARIO_AVULSO_PRODUTOS
         SET DATA_HOTA_PRIMEIRA_TRATATIVA = SYSTIMESTAMP
       WHERE ID_INVENTARIO = :idInventario
         AND ID_PRODUTO = :idCodProduto
    `;

    const result = await conn.execute(sql, { idInventario, idCodProduto }, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: Number(result.rowsAffected || 0) });
  } catch (err) {
    console.error("[GestPRO] Erro ao marcar primeira tratativa:", err);
    return res.status(500).json({ message: "Erro interno ao marcar primeira tratativa", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/inventario/avulso/marcar-primeira-tratativa");

app.get("/api/gestpro/estoque-e-movimentos", async (req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/estoque-e-movimentos");
  const q = req.query || {};
  const codFilial = String(q.codFilial || '').trim();
  const codProduto = String(q.codProduto || '').trim();
  const dataHoraInicio = String(q.dataHoraInicio || '').trim();
  if (!codFilial || !codProduto || !dataHoraInicio) {
    return res.status(400).json({ message: "Parâmetros obrigatórios: codFilial, codProduto, dataHoraInicio (DD/MM/YYYY HH24:MI:SS)" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });
    const sql = `
      SELECT 
        est.QTEST, 
        est.QTESTGER, 
        est.QTRESERV, 
        est.QTPENDENTE, 
        est.QTINDENIZ AS AVARIA, 
        (est.QTBLOQUEADA - est.QTINDENIZ) AS QT_BLOQUEADO, 
        (est.QTESTGER - est.QTRESERV - est.QTBLOQUEADA) AS DISPONIVEL, 
        TO_CHAR(mov.DTMOVLOG, 'DD/MM/YYYY HH24:MI:SS') AS DTMOVLOG,
        mov.QT, 
        mov.QTAVARIA,
        mov.CODOPER 
      FROM 
        PCEST est 
      LEFT JOIN 
        PCMOV mov 
          ON mov.CODPROD = est.CODPROD 
         AND mov.CODFILIAL = est.CODFILIAL 
         AND mov.STATUS IN ('AB', 'B')
         AND mov.DTMOVLOG >= TO_DATE(:dataHoraInicio, 'DD/MM/YYYY HH24:MI:SS') 
      WHERE 
        est.CODFILIAL = :codFilial 
        AND est.CODPROD = :codProduto
    `;
    const binds = {
      codFilial: Number(codFilial),
      codProduto: Number(codProduto),
      dataHoraInicio,
    };
    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar estoque e movimentos:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/estoque-e-movimentos");

app.post("/api/gestpro/enviar-comprovante", upload.single("file"), (req, res) => {
  try {
    const { NUMPED, CODCLI, CODUSUR, NOME } = req.body || {};
    if (!req.file) {
      return res.status(400).json({ message: "Arquivo não enviado" });
    }
    return res.json({
      ok: true,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      NUMPED: Number(NUMPED),
      CODCLI: Number(CODCLI),
      CODUSUR: Number(CODUSUR),
      NOME,
    });
  } catch (err) {
    console.error("[GestPRO] Falha no upload de comprovante:", err);
    return res.status(500).json({ message: "Falha ao salvar comprovante", detalhe: err.message });
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/enviar-comprovante");

app.post(
  "/api/gestpro/pedidos-fotos",
  uploadFotos.fields([
    { name: "fotoNfe", maxCount: 1 },
    { name: "fotoMercadoria", maxCount: 1 },
    { name: "fotoLocal", maxCount: 1 },
    { name: "fotoResidencia", maxCount: 1 },
    { name: "fotoValorRecebido", maxCount: 1 },
    { name: "fotoComprovante", maxCount: 1 },
    { name: "FOTO_NFE", maxCount: 1 },
    { name: "FOTO_MERCADORIA", maxCount: 1 },
    { name: "FOTO_LOCAL", maxCount: 1 },
    { name: "FOTO_RESIDENCIA", maxCount: 1 },
    { name: "FOTO_VALOR_RECEBIDO", maxCount: 1 },
    { name: "FOTO_COMPROVANTE", maxCount: 1 },
  ]),
  async (req, res) => {
    const body = req.body || {};

    const numPedidoNum = Number(body.NUM_PEDIDO ?? body.numPedido ?? body.numPedidoNum ?? body.num_pedido);
    const codClienteNum = Number(body.COD_CLIENTE ?? body.codCliente ?? body.codcli ?? body.CODCLI);
    const cliente = String(body.CLIENTE ?? body.cliente ?? "").trim();
    const codEntregadorNum = Number(body.COD_USUARIO_ENTREGADOR ?? body.codUsuarioEntregador ?? body.codusur ?? body.CODUSUR);
    const entregador = String(body.ENTREGADOR ?? body.entregador ?? "").trim();

    if (!Number.isFinite(numPedidoNum) || numPedidoNum <= 0) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: NUM_PEDIDO" });
    }
    if (!Number.isFinite(codClienteNum) || codClienteNum <= 0) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: COD_CLIENTE" });
    }
    if (!Number.isFinite(codEntregadorNum) || codEntregadorNum <= 0) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: COD_USUARIO_ENTREGADOR" });
    }
    if (!cliente) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: CLIENTE" });
    }
    if (!entregador) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: ENTREGADOR" });
    }

    const files = req.files || {};
    const pickBuffer = (keys) => {
      for (const k of keys) {
        const arr = files[k];
        const f = Array.isArray(arr) ? arr[0] : undefined;
        if (f && f.buffer) return f.buffer;
      }
      return null;
    };

    const fotoNfe = pickBuffer(["fotoNfe", "FOTO_NFE"]);
    const fotoMercadoria = pickBuffer(["fotoMercadoria", "FOTO_MERCADORIA"]);
    const fotoLocal = pickBuffer(["fotoLocal", "FOTO_LOCAL"]);
    const fotoResidencia = pickBuffer(["fotoResidencia", "FOTO_RESIDENCIA"]);
    const fotoValorRecebido = pickBuffer(["fotoValorRecebido", "FOTO_VALOR_RECEBIDO"]);
    const fotoComprovante = pickBuffer(["fotoComprovante", "FOTO_COMPROVANTE"]);

    if (!fotoNfe && !fotoMercadoria && !fotoLocal && !fotoResidencia && !fotoValorRecebido && !fotoComprovante) {
      return res.status(400).json({ message: "Nenhuma foto enviada" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        INSERT INTO APP_GESTLOG_PEDIDOS_FOTOS (
          NUM_PEDIDO,
          COD_CLIENTE,
          CLIENTE,
          COD_USUARIO_ENTREGADOR,
          ENTREGADOR,
          DATA_HORA,
          FOTO_NFE,
          FOTO_MERCADORIA,
          FOTO_LOCAL,
          FOTO_RESIDENCIA,
          FOTO_VALOR_RECEBIDO,
          FOTO_COMPROVANTE
        )
        SELECT
          :numPedido,
          :codCliente,
          :cliente,
          :codEntregador,
          :entregador,
          SYSTIMESTAMP,
          :fotoNfe,
          :fotoMercadoria,
          :fotoLocal,
          :fotoResidencia,
          :fotoValorRecebido,
          :fotoComprovante
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1
            FROM APP_GESTLOG_PEDIDOS_FOTOS
           WHERE NUM_PEDIDO = :numPedido
        )
      `;

      const result = await conn.execute(
        sql,
        {
          numPedido: numPedidoNum,
          codCliente: codClienteNum,
          cliente,
          codEntregador: codEntregadorNum,
          entregador,
          fotoNfe: { val: fotoNfe, type: oracledb.BLOB },
          fotoMercadoria: { val: fotoMercadoria, type: oracledb.BLOB },
          fotoLocal: { val: fotoLocal, type: oracledb.BLOB },
          fotoResidencia: { val: fotoResidencia, type: oracledb.BLOB },
          fotoValorRecebido: { val: fotoValorRecebido, type: oracledb.BLOB },
          fotoComprovante: { val: fotoComprovante, type: oracledb.BLOB },
        },
        { autoCommit: true }
      );

      const rowsAffected = result.rowsAffected || 0;
      if (rowsAffected <= 0) {
        return res.status(409).json({ ok: false, message: "Já existem fotos salvas para este pedido" });
      }
      return res.json({ ok: true, numPedido: numPedidoNum });
    } catch (err) {
      const msg = String(err?.message || "");
      if (err?.errorNum === 1 || /ORA-00001/.test(msg)) {
        return res.status(409).json({ ok: false, message: "Já existem fotos salvas para este pedido" });
      }
      console.error("[GestPRO] Erro ao salvar fotos do pedido:", err);
      return res.status(500).json({ ok: false, message: "Erro interno no servidor GestPRO", detalhe: err.message });
    } finally {
      if (conn) {
        try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
      }
    }
  }
);
console.log("[GestPRO] Registrada rota POST /api/gestpro/pedidos-fotos");

app.get("/api/gestpro/pedidos-fotos/por-entregador", async (req, res) => {
  const codEntregadorNum = Number(req.query.codEntregador ?? req.query.codUsuarioEntregador ?? req.query.codusur ?? 0);
  if (!Number.isFinite(codEntregadorNum) || codEntregadorNum <= 0) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: codEntregador" });
  }

  const includeFotosRaw = String(req.query.includeFotos ?? "N").trim().toUpperCase();
  const includeFotos = includeFotosRaw !== "N";

  const limitRaw = Number(req.query.limit ?? 10);
  const offsetRaw = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.trunc(limitRaw))) : 10;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.trunc(offsetRaw)) : 0;

  const lobToBuffer = (lob) =>
    new Promise((resolve, reject) => {
      if (!lob) return resolve(null);
      if (Buffer.isBuffer(lob)) return resolve(lob);
      const chunks = [];
      lob.on("data", (d) => chunks.push(d));
      lob.on("end", () => resolve(Buffer.concat(chunks)));
      lob.on("error", (e) => reject(e));
    });

  const lobToBase64 = async (lob) => {
    const buf = await lobToBuffer(lob);
    return buf ? buf.toString("base64") : null;
  };

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = includeFotos
      ? `
        SELECT
          NUM_PEDIDO,
          COD_CLIENTE,
          CLIENTE,
          COD_USUARIO_ENTREGADOR,
          ENTREGADOR,
          TO_CHAR(DATA_HORA, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA,
          FOTO_NFE,
          FOTO_MERCADORIA,
          FOTO_LOCAL,
          FOTO_RESIDENCIA,
          FOTO_VALOR_RECEBIDO,
          FOTO_COMPROVANTE
        FROM APP_GESTLOG_PEDIDOS_FOTOS
        WHERE COD_USUARIO_ENTREGADOR = :codEntregador
        ORDER BY DATA_HORA DESC
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
      `
      : `
        SELECT
          NUM_PEDIDO,
          COD_CLIENTE,
          CLIENTE,
          COD_USUARIO_ENTREGADOR,
          ENTREGADOR,
          TO_CHAR(DATA_HORA, 'DD/MM/YYYY HH24:MI:SS') AS DATA_HORA,
          CASE WHEN FOTO_NFE IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_NFE,
          CASE WHEN FOTO_MERCADORIA IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_MERCADORIA,
          CASE WHEN FOTO_LOCAL IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_LOCAL,
          CASE WHEN FOTO_RESIDENCIA IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_RESIDENCIA,
          CASE WHEN FOTO_VALOR_RECEBIDO IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_VALOR_RECEBIDO,
          CASE WHEN FOTO_COMPROVANTE IS NULL THEN 0 ELSE 1 END AS TEM_FOTO_COMPROVANTE
        FROM APP_GESTLOG_PEDIDOS_FOTOS
        WHERE COD_USUARIO_ENTREGADOR = :codEntregador
        ORDER BY DATA_HORA DESC
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
      `;

    const result = await conn.execute(
      sql,
      { codEntregador: codEntregadorNum, offset, limit },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows || [];
    if (!includeFotos) {
      const mapped = rows.map((r) => {
        const base = `/api/gestpro/pedidos-fotos/arquivo?numPedido=${encodeURIComponent(String(r.NUM_PEDIDO))}`;
        return {
          NUM_PEDIDO: r.NUM_PEDIDO,
          COD_CLIENTE: r.COD_CLIENTE,
          CLIENTE: r.CLIENTE,
          COD_USUARIO_ENTREGADOR: r.COD_USUARIO_ENTREGADOR,
          ENTREGADOR: r.ENTREGADOR,
          DATA_HORA: r.DATA_HORA,
          TEM_FOTO_NFE: Number(r.TEM_FOTO_NFE) === 1,
          TEM_FOTO_MERCADORIA: Number(r.TEM_FOTO_MERCADORIA) === 1,
          TEM_FOTO_LOCAL: Number(r.TEM_FOTO_LOCAL) === 1,
          TEM_FOTO_RESIDENCIA: Number(r.TEM_FOTO_RESIDENCIA) === 1,
          TEM_FOTO_VALOR_RECEBIDO: Number(r.TEM_FOTO_VALOR_RECEBIDO) === 1,
          TEM_FOTO_COMPROVANTE: Number(r.TEM_FOTO_COMPROVANTE) === 1,
          URL_FOTO_NFE: `${base}&tipo=FOTO_NFE`,
          URL_FOTO_MERCADORIA: `${base}&tipo=FOTO_MERCADORIA`,
          URL_FOTO_LOCAL: `${base}&tipo=FOTO_LOCAL`,
          URL_FOTO_RESIDENCIA: `${base}&tipo=FOTO_RESIDENCIA`,
          URL_FOTO_VALOR_RECEBIDO: `${base}&tipo=FOTO_VALOR_RECEBIDO`,
          URL_FOTO_COMPROVANTE: `${base}&tipo=FOTO_COMPROVANTE`,
        };
      });
      return res.json({ rows: mapped, count: mapped.length });
    }

    const mapped = [];
    for (const r of rows) {
      mapped.push({
        NUM_PEDIDO: r.NUM_PEDIDO,
        COD_CLIENTE: r.COD_CLIENTE,
        CLIENTE: r.CLIENTE,
        COD_USUARIO_ENTREGADOR: r.COD_USUARIO_ENTREGADOR,
        ENTREGADOR: r.ENTREGADOR,
        DATA_HORA: r.DATA_HORA,
        FOTO_NFE: await lobToBase64(r.FOTO_NFE),
        FOTO_MERCADORIA: await lobToBase64(r.FOTO_MERCADORIA),
        FOTO_LOCAL: await lobToBase64(r.FOTO_LOCAL),
        FOTO_RESIDENCIA: await lobToBase64(r.FOTO_RESIDENCIA),
        FOTO_VALOR_RECEBIDO: await lobToBase64(r.FOTO_VALOR_RECEBIDO),
        FOTO_COMPROVANTE: await lobToBase64(r.FOTO_COMPROVANTE),
      });
    }
    return res.json({ rows: mapped, count: mapped.length });
  } catch (err) {
    console.error("[GestPRO] Erro ao buscar fotos por entregador:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/pedidos-fotos/por-entregador");

app.get("/api/gestpro/pedidos-fotos/arquivo", async (req, res) => {
  const numPedidoNum = Number(req.query.numPedido ?? req.query.NUM_PEDIDO ?? req.query.numped ?? 0);
  if (!Number.isFinite(numPedidoNum) || numPedidoNum <= 0) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: numPedido" });
  }

  const tipoRaw = String(req.query.tipo ?? "").trim().toUpperCase();
  const colMap = {
    FOTO_NFE: "FOTO_NFE",
    FOTO_MERCADORIA: "FOTO_MERCADORIA",
    FOTO_LOCAL: "FOTO_LOCAL",
    FOTO_RESIDENCIA: "FOTO_RESIDENCIA",
    FOTO_VALOR_RECEBIDO: "FOTO_VALOR_RECEBIDO",
    FOTO_COMPROVANTE: "FOTO_COMPROVANTE",
  };
  const col = colMap[tipoRaw];
  if (!col) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: tipo" });
  }

  const codEntregadorNum = req.query.codEntregador != null
    ? Number(req.query.codEntregador ?? req.query.codusur ?? 0)
    : null;
  if (codEntregadorNum != null && (!Number.isFinite(codEntregadorNum) || codEntregadorNum <= 0)) {
    return res.status(400).json({ message: "Parâmetro inválido: codEntregador" });
  }

  const lobToBuffer = (lob) =>
    new Promise((resolve, reject) => {
      if (!lob) return resolve(null);
      if (Buffer.isBuffer(lob)) return resolve(lob);
      const chunks = [];
      lob.on("data", (d) => chunks.push(d));
      lob.on("end", () => {
        try { if (typeof lob.close === "function") lob.close(() => {}); } catch {}
        resolve(Buffer.concat(chunks));
      });
      lob.on("error", (e) => reject(e));
    });

  const sniffMime = (buf) => {
    if (!buf || buf.length < 4) return "application/octet-stream";
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
    if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
    return "application/octet-stream";
  };

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const whereEntregador = codEntregadorNum != null ? " AND COD_USUARIO_ENTREGADOR = :codEntregador" : "";
    const sql = `SELECT ${col} AS FOTO FROM APP_GESTLOG_PEDIDOS_FOTOS WHERE NUM_PEDIDO = :numPedido${whereEntregador}`;
    const binds = codEntregadorNum != null
      ? { numPedido: numPedidoNum, codEntregador: codEntregadorNum }
      : { numPedido: numPedidoNum };

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const row = (result.rows || [])[0];
    if (!row) return res.status(404).json({ message: "Registro não encontrado" });

    const buf = await lobToBuffer(row.FOTO);
    if (!buf) return res.status(404).json({ message: "Foto não encontrada" });

    const mime = sniffMime(buf);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Content-Disposition", `inline; filename="${numPedidoNum}-${col}.${mime.split("/")[1] || "bin"}"`);
    return res.status(200).send(buf);
  } catch (err) {
    console.error("[GestPRO] Erro ao baixar foto do pedido:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/pedidos-fotos/arquivo");



// Endpoint agregado: Produtos promoção para todas campanhas (GestMKT) filtrado por mês
// Exige query param `mes` no formato YYYY-MM e retorna resultado agrupado por tipo
app.get("/api/gestmkt/produtos-promocao", async (req, res) => {
  const mes = String((req.query || {}).mes || '').trim();
  console.log(`[GestPRO] Acessando /api/gestmkt/produtos-promocao (agregado) mes=${mes || 'N/A'}`);

  if (!mes) {
    return res.status(400).json({ message: "Parâmetro 'mes' é obrigatório (formato YYYY-MM)" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sqlBase = `
      SELECT 
        A.ID, 
        NVL(A.CODFILIAL, 0)                        AS CODFILIAL, 
        TO_CHAR(A.DT_ADD, 'DD/MM/YYYY')            AS DT_ADD, 
        NVL(A.CODUSUR_ADD, 0)                      AS CODUSUR_ADD, 
        A.STATUS_ENCARTE,
        NVL(A.TIPO_CAMPANHA, 'N/I')                AS TIPOCAMPANHA, 
        NVL(A.CODPROD, 0)                          AS CODPROD, 
        NVL(B.DESCRICAO, 'N/I')                    AS DESCRICAO, 
        NVL(TO_CHAR(B.CODAUXILIAR), 'N/I')         AS CODAUXILIAR, 
        NVL(TO_CHAR(D.MARCA), 'N/I')               AS MARCA, 
        NVL(A.PRECOFICTICIO, 0)                    AS PRECOFICTICIO, 
        NVL(A.PRECOFIXO , 0)                       AS PRECOFIXO, 
        A.MES_DATA_PROMOCAO, 
        A.DT_INICIO_CAMPANHA, 
        A.DT_FIM_CAMPANHA, 
        C.CODPRECOPROM, 
        NVL(E.CUSTOULTENT, 0)                      AS CUSTOULTENT, 
        NVL(E.CUSTOULTENTLIQ, 0)                   AS CUSTOULTENTLIQ, 
        NVL(E.CUSTOREAL, 0)                        AS CUSTOREAL, 
        NVL(F.PVENDA, 0)                           AS PVENDA, 
        NVL(G.PCOMINT1, 0)                         AS PCOMINT1, 

        -- Comissão em valor 
        ROUND( 
          NVL(F.PVENDA, 0) * (NVL(G.PCOMINT1, 0) / 100), 
          6 
        ) AS COMISSAO_VALOR, 

        -- Custo base (WinThor prioriza o CUSTOREAL) 
        ROUND( 
          NVL(NVL(E.CUSTOREAL, E.CUSTOULTENTLIQ), 0), 
          6 
        ) AS CUSTO_BASE, 

        -- CMV calculado (Custo + Comissão) 
        ROUND( 
          NVL(NVL(E.CUSTOREAL, E.CUSTOULTENTLIQ), 0) 
          + (NVL(F.PVENDA, 0) * (NVL(G.PCOMINT1, 0) / 100)), 
          6 
        ) AS CMV_CALCULADO, 

        -- Margem de Precificação com duas casas decimais (igual à rotina PCSIS201)
        ROUND(
          CASE
            WHEN NVL(F.PVENDA, 0) > 0 THEN
              (
                (NVL(F.PVENDA, 0)
                 - ROUND(
                     NVL(NVL(E.CUSTOREAL, E.CUSTOULTENTLIQ), 0)
                     + (NVL(F.PVENDA, 0) * (NVL(G.PCOMINT1, 0) / 100)),
                     6
                   )
                ) / NVL(F.PVENDA, 0)
              ) * 100
            ELSE 0
          END,
          2
        ) AS MARGEM_PRECIFICACAO
        ,
        -- Estoque da Filial 01 com formatação brasileira
        REPLACE(TO_CHAR(E.QTINDENIZ, '9999999990D99'), '.', ',') AS QT_ESTOQUE_AVARIA_FILIAL_01,
        REPLACE(TO_CHAR((E.QTBLOQUEADA - E.QTINDENIZ), '9999999990D99'), '.', ',') AS QT_ESTOQUE_BLOQUEADO_FILIAL_01,
        REPLACE(TO_CHAR((E.QTEST - E.QTBLOQUEADA - E.QTRESERV), '9999999990D99'), '.', ',') AS QT_ESTOQUE_DISPONIVEL_FILIAL_01,

        -- Estoque da Filial 03 (CD) com formatação brasileira
        REPLACE(TO_CHAR(H.QTINDENIZ, '9999999990D99'), '.', ',') AS QT_ESTOQUE_AVARIA_FILIAL_03,
        REPLACE(TO_CHAR((H.QTBLOQUEADA - H.QTINDENIZ), '9999999990D99'), '.', ',') AS QT_ESTOQUE_BLOQUEADO_FILIAL_03,
        REPLACE(TO_CHAR((H.QTEST - H.QTBLOQUEADA - H.QTRESERV), '9999999990D99'), '.', ',') AS QT_ESTOQUE_DISPONIVEL_FILIAL_03
        

      FROM MULTGESTI_MARKETING_PRODUTOS_PROMOCAO A 
      LEFT JOIN PCPRODUT B 
             ON B.CODPROD = A.CODPROD 
      LEFT JOIN PCPRECOPROM C 
             ON C.CODPROD = A.CODPROD 
            AND C.NUMREGIAO = 1 
            AND C.CODFILIAL = A.CODFILIAL 
            AND TRUNC(C.DTINICIOVIGENCIA) = TRUNC(A.DT_INICIO_CAMPANHA) 
            AND TRUNC(C.DTFIMVIGENCIA) = TRUNC(A.DT_FIM_CAMPANHA)  
      LEFT JOIN PCMARCA D 
             ON D.CODMARCA = B.CODMARCA 
      LEFT JOIN PCEST E 
             ON E.CODFILIAL = A.CODFILIAL 
            AND E.CODPROD = A.CODPROD 
      LEFT JOIN PCTABPR F 
             ON F.NUMREGIAO = 1 
            AND F.CODPROD = A.CODPROD 
      LEFT JOIN PCPRODFILIAL G 
             ON G.CODPROD = A.CODPROD 
            AND G.CODFILIAL = A.CODFILIAL 
      LEFT JOIN PCEST H 
             ON H.CODFILIAL = 3 
            AND H.CODPROD = A.CODPROD 
      WHERE A.TIPO_CAMPANHA = :tipo 
        AND TRUNC(A.MES_DATA_PROMOCAO, 'MM') = TRUNC(TO_DATE(:mes, 'YYYY-MM'), 'MM') 
      ORDER BY 
            C.DTINICIOVIGENCIA ASC 
    `;

    const tipos = ["PQ", "PE", "PP", "PA"];
    const resultados = {};

    for (const t of tipos) {
      const r = await conn.execute(sqlBase, { tipo: t, mes }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const rows = r.rows || [];
      resultados[t] = { rows, count: rows.length };
    }

    return res.json(resultados);
  } catch (err) {
    console.error("Erro ao buscar produtos promoção (agregado por mês):", err);
    return res.status(500).json({ message: "Erro interno ao buscar produtos promoção (agregado por mês)", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestmkt/produtos-promocao (agregado por mês)");

// Endpoint: Registrar produto em promoção (GestMKT)
// Verifica existência por (CODFILIAL, CODPROD, MES_DATA_PROMOCAO mês, TIPO_CAMPANHA)
// Se não existir, insere um novo registro com DT_ADD = SYSDATE
app.post("/api/gestmkt/produtos-promocao/registrar", async (req, res) => {
  console.log("[GestPRO] Acessando POST /api/gestmkt/produtos-promocao/registrar");
  const body = req.body || {};
  const codFilial = String(body.codFilial ?? '').trim();
  const codProdStr = String(body.codProd ?? '').trim();
  const tipoCampanha = String(body.tipoCampanha ?? '').trim();
  const mesDataPromocaoRaw = String(body.mesDataPromocao ?? '').trim(); // aceita YYYY-MM ou DD/MM/YYYY
  const codUsurAddStr = String(body.codUsurAdd ?? '').trim();

  try {
    // Validações básicas
    if (!["1","2","3","4"].includes(codFilial)) {
      return res.status(400).json({ message: "'codFilial' inválido. Valores: 1,2,3,4" });
    }
    if (!codProdStr || isNaN(Number(codProdStr))) {
      return res.status(400).json({ message: "'codProd' é obrigatório e numérico" });
    }
    if (!tipoCampanha || !["PE","PQ","PP","PA"].includes(tipoCampanha)) {
      return res.status(400).json({ message: "'tipoCampanha' inválido. Valores: PE,PQ,PP,PA" });
    }
    if (!codUsurAddStr || isNaN(Number(codUsurAddStr))) {
      return res.status(400).json({ message: "'codUsurAdd' (matricula) é obrigatório e numérico" });
    }

    let mesDataDMY = "";
    if (/^\d{4}-\d{2}$/.test(mesDataPromocaoRaw)) {
      const [y, m] = mesDataPromocaoRaw.split("-");
      mesDataDMY = `01/${m}/${y}`;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(mesDataPromocaoRaw)) {
      mesDataDMY = mesDataPromocaoRaw;
    } else {
      return res.status(400).json({ message: "'mesDataPromocao' deve ser YYYY-MM ou DD/MM/YYYY" });
    }

    const codProd = Number(codProdStr);
    const codUsurAdd = Number(codUsurAddStr);

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sqlCheck = `
        SELECT COUNT(1) AS QTD
          FROM MULTGESTI_MARKETING_PRODUTOS_PROMOCAO
         WHERE CODFILIAL = :codFilial
           AND CODPROD = :codProd
           AND TIPO_CAMPANHA = :tipoCampanha
           AND TRUNC(MES_DATA_PROMOCAO, 'MM') = TRUNC(TO_DATE(:mesData, 'DD/MM/YYYY'), 'MM')
      `;
      const check = await conn.execute(sqlCheck, { codFilial, codProd, tipoCampanha, mesData: mesDataDMY }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const qtd = Number(check.rows?.[0]?.QTD ?? 0);
      if (qtd > 0) {
        return res.json({ ok: true, exists: true, message: "Registro já existe para este mês e campanha" });
      }

      const sqlInsert = `
        INSERT INTO MULTGESTI_MARKETING_PRODUTOS_PROMOCAO
          (CODFILIAL, CODPROD, MES_DATA_PROMOCAO, DT_ADD, CODUSUR_ADD, TIPO_CAMPANHA)
        VALUES
          (:codFilial, :codProd, TO_DATE(:mesData, 'DD/MM/YYYY'), SYSDATE, :codUsurAdd, :tipoCampanha)
      `;
      const insertResult = await conn.execute(
        sqlInsert,
        { codFilial, codProd, mesData: mesDataDMY, codUsurAdd, tipoCampanha },
        { autoCommit: true }
      );

      return res.json({ ok: true, inserted: true, rowsAffected: insertResult.rowsAffected || 0 });
    } catch (err) {
      console.error("[GestPRO] Erro ao registrar promoção:", err);
      return res.status(500).json({ message: "Erro interno ao registrar promoção", detalhe: err.message });
    } finally {
      if (conn) {
        try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
      }
    }
  } catch (err) {
    console.error("[GestPRO] Falha na validação de payload para registrar promoção:", err);
    return res.status(400).json({ message: "Payload inválido", detalhe: err.message });
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/produtos-promocao/registrar");

// Endpoint: Atualizar dados da promoção (GestMKT)
// Atualiza PRECOFICTICIO, PRECOFIXO, DT_INICIO_CAMPANHA, DT_FIM_CAMPANHA, DT_SALVO, CODUSUR_SALVOU
// WHERE ID = :id
app.post("/api/gestmkt/produtos-promocao/atualizar", async (req, res) => {
  console.log("[GestPRO] Acessando POST /api/gestmkt/produtos-promocao/atualizar");
  const body = req.body || {};
  const idStr = String(body.id ?? '').trim();
  const precoFicticioStr = String(body.precoFicticio ?? '').trim();
  const precoFixoStr = String(body.precoFixo ?? '').trim();
  const dataInicioCampanhaDMY = String(body.dataInicioCampanha ?? '').trim(); // DD/MM/YYYY
  const dataFimCampanhaDMY = String(body.dataFimCampanha ?? '').trim();       // DD/MM/YYYY
  const dataSalvouDMY = String(body.dataSalvou ?? '').trim();                 // DD/MM/YYYY
  const codUsurSalvouStr = String(body.codigoUsuarioSalvou ?? '').trim();

  // Validações básicas
  if (!idStr || isNaN(Number(idStr))) {
    return res.status(400).json({ message: "'id' é obrigatório e numérico" });
  }

  const isDMY = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(String(s || ''));
  if (dataInicioCampanhaDMY && !isDMY(dataInicioCampanhaDMY)) {
    return res.status(400).json({ message: "'dataInicioCampanha' deve estar em DD/MM/YYYY" });
  }
  if (dataFimCampanhaDMY && !isDMY(dataFimCampanhaDMY)) {
    return res.status(400).json({ message: "'dataFimCampanha' deve estar em DD/MM/YYYY" });
  }
  if (dataSalvouDMY && !isDMY(dataSalvouDMY)) {
    return res.status(400).json({ message: "'dataSalvou' deve estar em DD/MM/YYYY" });
  }
  if (codUsurSalvouStr && isNaN(Number(codUsurSalvouStr))) {
    return res.status(400).json({ message: "'codigoUsuarioSalvou' deve ser numérico" });
  }

  const id = Number(idStr);
  const precoFicticio = precoFicticioStr === '' ? null : Number(precoFicticioStr);
  const precoFixo = precoFixoStr === '' ? null : Number(precoFixoStr);
  const codUsurSalvou = codUsurSalvouStr === '' ? null : Number(codUsurSalvouStr);

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      UPDATE MULTGESTI_MARKETING_PRODUTOS_PROMOCAO a
         SET a.PRECOFICTICIO = :precoFicticio,
             a.PRECOFIXO = :precoFixo,
             a.DT_INICIO_CAMPANHA = CASE WHEN :dataInicioCampanha IS NOT NULL THEN TO_DATE(:dataInicioCampanha, 'DD/MM/YYYY') ELSE NULL END,
             a.DT_FIM_CAMPANHA = CASE WHEN :dataFimCampanha IS NOT NULL THEN TO_DATE(:dataFimCampanha, 'DD/MM/YYYY') ELSE NULL END,
             a.DT_SALVO = CASE WHEN :dataSalvou IS NOT NULL THEN TO_DATE(:dataSalvou, 'DD/MM/YYYY') ELSE SYSDATE END,
             a.CODUSUR_SALVOU = :codUsurSalvou
       WHERE a.ID = :id
    `;

    const binds = {
      precoFicticio,
      precoFixo,
      dataInicioCampanha: dataInicioCampanhaDMY || null,
      dataFimCampanha: dataFimCampanhaDMY || null,
      dataSalvou: dataSalvouDMY || null,
      codUsurSalvou,
      id,
    };

    const result = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("[GestPRO] Erro ao atualizar promoção:", err);
    return res.status(500).json({ message: "Erro interno ao atualizar promoção", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/produtos-promocao/atualizar");


// Endpoint: Excluir promoção (GestMKT)
// DELETE FROM MULTGESTI_MARKETING_PRODUTOS_PROMOCAO WHERE ID = :id
app.post("/api/gestmkt/produtos-promocao/excluir", async (req, res) => {
  console.log("[GestPRO] Acessando POST /api/gestmkt/produtos-promocao/excluir");
  const body = req.body || {};
  const idStr = String(body.id ?? '').trim();
  const codFilialStr = body.codFilial !== undefined && body.codFilial !== null
    ? String(body.codFilial).trim()
    : (body.CODFILIAL !== undefined && body.CODFILIAL !== null ? String(body.CODFILIAL).trim() : '');
  const codProdStr = body.codProd !== undefined && body.codProd !== null
    ? String(body.codProd).trim()
    : (body.CODPROD !== undefined && body.CODPROD !== null ? String(body.CODPROD).trim() : '');
  const codPrecoPromStrRaw = body.codPrecoPromocional !== undefined && body.codPrecoPromocional !== null
    ? String(body.codPrecoPromocional).trim()
    : String(body.CODPRECOPROM || body.codprecoProm || '').trim();

  const id = idStr && !isNaN(Number(idStr)) ? Number(idStr) : null;
  const codProd = codProdStr && !isNaN(Number(codProdStr)) ? Number(codProdStr) : null;
  const codPrecoProm = codPrecoPromStrRaw && !isNaN(Number(codPrecoPromStrRaw)) ? Number(codPrecoPromStrRaw) : null;

  if (id === null && codPrecoProm === null) {
    return res.status(400).json({ message: "Informe 'id' (numérico) ou 'codPrecoPromocional' (numérico)" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // 0) Inserção no histórico (se enviado)
    const historico = body.historico;
    if (historico && typeof historico === 'object') {
      try {
        const sqlHist = `
          INSERT INTO MULTGESTI_MARKETING_PRODUTOS_PROMOCAO_HISTORICO_CAMPANHAS
          (
            CODFILIAL, CODPROD, MES_DATA_PROMOCAO, DT_ADD, CODUSUR_ADD, 
            TIPO_CAMPANHA, PRECOFICTICIO, ID, DT_INICIO_CAMPANHA, DT_FIM_CAMPANHA, 
            PRECOFIXO, DT_SALVO, CODUSUR_SALVOU, CODIGO_PROMOCAO, STATUS_ENCARTE
          )
          VALUES
          (
            :codfilial, :codprod, TO_DATE(:mesData, 'MM-YYYY'), TO_DATE(:dtAdd, 'DD/MM/YYYY'), :codUsurAdd,
            :tipoCampanha, :precoFicticio, :idOrigem, TO_DATE(:dtInicio, 'YYYY-MM-DD'), TO_DATE(:dtFim, 'YYYY-MM-DD'),
            :precoFixo, SYSDATE, :codUsurSalvou, :codPrecoProm, :statusEncarte
          )
        `;

        const n = (v) => v === undefined || v === null || String(v).trim() === '' ? null : Number(v);
        const s = (v) => v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim();

        await conn.execute(sqlHist, {
          codfilial: s(historico.CODFILIAL),
          codprod: n(historico.CODPROD),
          mesData: s(historico.MES_DATA_PROMOCAO),
          dtAdd: s(historico.DT_ADD),
          codUsurAdd: n(historico.CODUSUR_ADD),
          tipoCampanha: s(historico.TIPO_CAMPANHA),
          precoFicticio: n(historico.PRECOFICTICIO),
          idOrigem: n(historico.ID_ORIGEM) || id,
          dtInicio: s(historico.DT_INICIO_CAMPANHA),
          dtFim: s(historico.DT_FIM_CAMPANHA),
          precoFixo: n(historico.PRECOFIXO),
          codUsurSalvou: n(historico.CODUSUR_SALVOU),
          codPrecoProm: n(historico.CODIGO_PROMOCAO),
          statusEncarte: s(historico.STATUS_ENCARTE)
        }, { autoCommit: false });
      } catch (histErr) {
        console.error("[GestPRO] Erro ao salvar histórico de campanha:", histErr);
        // Não impede a exclusão, apenas loga o erro? Ou deve impedir? 
        // Geralmente log de histórico é crítico, mas se falhar a exclusão é pior.
        // Vou assumir que não deve impedir a exclusão principal, mas logar erro.
      }
    }

    // 1) Exclui registro da PCPRECOPROM quando informado CODPRECOPROM
    let rowsAffectedTotal = 0;
    if (codPrecoProm !== null) {
      const sqlDeletePCPRECOPROM = `
        DELETE FROM PCPRECOPROM
         WHERE CODPRECOPROM = :cod
      `;
      const r1 = await conn.execute(sqlDeletePCPRECOPROM, { cod: codPrecoProm }, { autoCommit: false });
      rowsAffectedTotal += Number(r1.rowsAffected || 0);
    }

    // 2) Exclui registro da tabela de controle MULTGESTI
    if (id !== null) {
      const sqlDeleteControle = `
        DELETE FROM MULTGESTI_MARKETING_PRODUTOS_PROMOCAO
         WHERE ID = :id
      `;
      const r2 = await conn.execute(sqlDeleteControle, { id }, { autoCommit: true });
      rowsAffectedTotal += Number(r2.rowsAffected || 0);
    } else if (codPrecoProm !== null) {
      const binds = { cod: codPrecoProm };
      if (codFilialStr) binds.codFilial = codFilialStr;
      if (codProd !== null) binds.codProd = codProd;
      const sqlDeleteControleByCodigo = `
        DELETE FROM MULTGESTI_MARKETING_PRODUTOS_PROMOCAO
         WHERE CODIGO_PROMOCAO = :cod
           ${codFilialStr ? "AND CODFILIAL = :codFilial" : ""}
           ${codProd !== null ? "AND CODPROD = :codProd" : ""}
      `;
      const r2 = await conn.execute(sqlDeleteControleByCodigo, binds, { autoCommit: true });
      rowsAffectedTotal += Number(r2.rowsAffected || 0);
    }

    return res.json({ ok: true, rowsAffected: rowsAffectedTotal });
  } catch (err) {
    console.error("[GestPRO] Erro ao excluir promoção:", err);
    return res.status(500).json({ message: "Erro interno ao excluir promoção", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/produtos-promocao/excluir");


app.post("/api/gestmkt/pcprecoprom/excluir", async (req, res) => {
  console.log("[GestPRO] Acessando POST /api/gestmkt/pcprecoprom/excluir");
  const body = req.body || {};
  const codPrecoPromStr = body.codPrecoPromocional !== undefined && body.codPrecoPromocional !== null
    ? String(body.codPrecoPromocional).trim()
    : String(body.CODPRECOPROM || body.codPrecoProm || body.cod || "").trim();

  if (!codPrecoPromStr || isNaN(Number(codPrecoPromStr))) {
    return res.status(400).json({ message: "Informe 'codPrecoPromocional' (numérico)" });
  }

  const codPrecoProm = Number(codPrecoPromStr);

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sqlDeletePCPRECOPROM = `
      DELETE FROM PCPRECOPROM
       WHERE CODPRECOPROM = :cod
    `;

    const result = await conn.execute(sqlDeletePCPRECOPROM, { cod: codPrecoProm }, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("[GestPRO] Erro ao excluir PCPRECOPROM:", err);
    return res.status(500).json({ message: "Erro interno ao excluir PCPRECOPROM", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/pcprecoprom/excluir");


// Endpoint: Confirmar Encarte (GestMKT)
// UPDATE MULTGESTI_MARKETING_PRODUTOS_PROMOCAO SET STATUS_ENCARTE = 'S' WHERE ID = :id
app.post("/api/gestmkt/produtos-promocao/confirmar-encarte", async (req, res) => {
  console.log("[GestPRO] Acessando POST /api/gestmkt/produtos-promocao/confirmar-encarte");
  const body = req.body || {};
  const idStr = String(body.id ?? '').trim();

  if (!idStr || isNaN(Number(idStr))) {
    return res.status(400).json({ message: "'id' é obrigatório e numérico" });
  }

  const id = Number(idStr);
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sqlUpdate = `
      UPDATE MULTGESTI_MARKETING_PRODUTOS_PROMOCAO
         SET STATUS_ENCARTE = 'S'
       WHERE ID = :id
    `;
    const result = await conn.execute(sqlUpdate, { id }, { autoCommit: true });
    
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("[GestPRO] Erro ao confirmar encarte:", err);
    return res.status(500).json({ message: "Erro interno ao confirmar encarte", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/produtos-promocao/confirmar-encarte");

// Log de rotas registradas para depuração
function logRoutes() {
  const stack = app._router && app._router.stack ? app._router.stack : [];
  console.log("Rotas registradas (método caminho):");
  stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).join(",");
      console.log(`${methods.toUpperCase()} ${layer.route.path}`);
    }
  });
}


app.post("/api/gestmkt/produtos-venda-baixa", async (req, res) => {
  const body = req.body || {};
  const dataInicioISO = String(body.dataInicio || "").trim();  // YYYY-MM-DD
  const dataFimISO = String(body.dataFim || "").trim();        // YYYY-MM-DD
  const codFilial = String(body.codFilial || "").trim();       // "1","2","3","4"
  const estoqueMinimoStr = String(body.estoqueMinimo ?? "").trim(); // opcional
  const vendasMaxStr = String(body.vendasMax || "").trim();          // obrigatório
  const categoria = String(body.categoria || "").trim();             // "1","2","3"
  const mesDataISO = String(body.mesData || "").trim();              // YYYY-MM-DD (novo)

  console.log(`[GestPRO] /produtos-venda-baixa (POST)\n  filial=${codFilial || 'N/A'}\n  de=${dataInicioISO || 'N/A'} até=${dataFimISO || 'N/A'}\n  vendamax=${vendasMaxStr || 'N/A'}\n  cat=${categoria || 'N/A'}\n  estoqueMin=${estoqueMinimoStr || 'N/A'}\n  mesData=${mesDataISO || 'N/A'}`);

  // Validações básicas
  const filialValida = ["1","2","3","4"].includes(codFilial);
  const categoriaValida = ["1","2","3"].includes(categoria);
  const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

  if (!filialValida)
    return res.status(400).json({ message: "'codFilial' inválido. Valores: 1,2,3,4" });
  if (!categoriaValida)
    return res.status(400).json({ message: "'categoria' inválida. Valores: 1 (Geral), 2 (Mix), 3 (Pisos e Revestimentos)" });
  if (!isISODate(dataInicioISO) || !isISODate(dataFimISO))
    return res.status(400).json({ message: "Datas devem estar no formato YYYY-MM-DD" });
  if (!isISODate(mesDataISO))
    return res.status(400).json({ message: "'mesData' deve estar no formato YYYY-MM-DD" });
  if (vendasMaxStr === "" || isNaN(parseFloat(vendasMaxStr)))
    return res.status(400).json({ message: "'vendasMax' é obrigatório e deve ser numérico" });

  // Conversões de datas
  const toDMY = (iso) => {
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
  };
  const dataInicioDMY = toDMY(dataInicioISO);
  const dataFimDMY = toDMY(dataFimISO);
  const mesDataDMY = toDMY(mesDataISO);

  const qTVendidaMenorIgualQue = parseFloat(vendasMaxStr);
  const qtEstoqueGeralMaiorIgual = estoqueMinimoStr !== "" && !isNaN(parseFloat(estoqueMinimoStr))
    ? parseFloat(estoqueMinimoStr)
    : undefined;

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    let sql = `
    SELECT 
        A.CODFILIAL, 
        A.CODPROD, 
        B.DESCRICAO, 
        B.CODAUXILIAR, 
        E.MARCA, 
        ROUND((A.QTEST - A.QTRESERV - A.QTBLOQUEADA), 2) AS DISPONIVEL, 
        ROUND((A.QTBLOQUEADA - A.QTINDENIZ), 2) AS BLOQUEADO, 
        ROUND(A.QTINDENIZ, 2) AS AVARIA, 
        ROUND((A.QTEST - A.QTRESERV - A.QTINDENIZ), 2) AS ESTOQUE_GERAL, 
        TO_CHAR(( 
            SELECT MAX(M.DTMOV) 
              FROM PCMOV M 
             WHERE M.CODPROD   = A.CODPROD 
               AND M.CODFILIAL = A.CODFILIAL 
               AND M.CODOPER   = 'S' 
               AND M.STATUS    = 'AB' 
               AND M.DTCANCEL IS NULL 
        ), 'DD/MM/YYYY') AS NOVA_DTULTSAIDA, 
        ROUND(A.CUSTOULTENT, 2) AS CUSTOULTENT, 
        ROUND(D.PVENDA, 2) AS PVENDA, 
        SUM( 
          CASE 
            WHEN C.CODOPER = 'S' 
             AND C.DTCANCEL IS NULL 
             AND C.STATUS = 'AB' 
             AND C.DTMOV BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') 
                             AND TO_DATE(:dataFim, 'DD/MM/YYYY') 
            THEN C.QT 
            ELSE 0 
          END 
        ) AS VENDA_TOTAL, 
        NVL(PP.QTD_PROMOCOES, 0) AS QTD_PROMOCOES, 
        TRIM(PP.TIPO_CAMPANHA) AS TIPO_CAMPANHA 
    FROM PCEST A 
        JOIN PCPRODUT B ON B.CODPROD = A.CODPROD 
        LEFT JOIN PCMOV C ON C.CODPROD = A.CODPROD AND C.CODFILIAL = A.CODFILIAL 
        LEFT JOIN PCTABPR D ON D.CODPROD = A.CODPROD AND D.NUMREGIAO = '1' 
        LEFT JOIN PCMARCA E ON E.CODMARCA = B.CODMARCA 
        LEFT JOIN ( 
          SELECT 
              CODFILIAL, 
              CODPROD, 
              COUNT(1) AS QTD_PROMOCOES, 
              TRIM( 
                MAX(TIPO_CAMPANHA) KEEP ( 
                  DENSE_RANK LAST ORDER BY MES_DATA_PROMOCAO 
                )
              ) AS TIPO_CAMPANHA 
            FROM MULTGESTI_MARKETING_PRODUTOS_PROMOCAO 
           WHERE TRUNC(MES_DATA_PROMOCAO, 'MM') = TRUNC(TO_DATE(:mesData, 'DD/MM/YYYY'), 'MM') 
           GROUP BY CODFILIAL, CODPROD 
        ) PP ON PP.CODFILIAL = A.CODFILIAL AND PP.CODPROD = A.CODPROD 
    WHERE A.CODFILIAL = :codFilial 
      AND A.DTULTSAIDA IS NOT NULL 
    `;

    // Filtros
    if (categoria === "2") sql += ` AND B.CODEPTO <> 10000`;
    else if (categoria === "3") sql += ` AND B.CODEPTO = 10000`;

    if (qtEstoqueGeralMaiorIgual !== undefined) {
      sql += ` AND (A.QTEST - A.QTRESERV - A.QTINDENIZ) >= :qtEstoqueGeralMaiorIgual`;
    }

    sql += ` 
    GROUP BY 
        A.CODFILIAL, A.CODPROD, B.DESCRICAO, B.CODAUXILIAR, E.MARCA, 
        ROUND((A.QTEST - A.QTRESERV - A.QTBLOQUEADA), 2), 
        ROUND((A.QTBLOQUEADA - A.QTINDENIZ), 2), 
        ROUND(A.QTINDENIZ, 2), 
        ROUND((A.QTEST - A.QTRESERV - A.QTINDENIZ), 2), 
        ROUND(A.CUSTOULTENT, 2), ROUND(D.PVENDA, 2), 
        NVL(PP.QTD_PROMOCOES, 0), PP.TIPO_CAMPANHA 
    HAVING SUM( 
        CASE 
          WHEN C.CODOPER = 'S' 
           AND C.DTCANCEL IS NULL 
           AND C.STATUS = 'AB' 
           AND C.DTMOV BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') 
                           AND TO_DATE(:dataFim, 'DD/MM/YYYY') 
          THEN C.QT 
          ELSE 0 
        END 
    ) <= :qTVendidaMenorIgualQue 
    ORDER BY ROUND((A.QTEST - A.QTRESERV - A.QTINDENIZ), 2) DESC 
    `;

    const binds = {
      dataInicio: dataInicioDMY,
      dataFim: dataFimDMY,
      codFilial,
      mesData: mesDataDMY,
      qTVendidaMenorIgualQue,
    };
    if (qtEstoqueGeralMaiorIgual !== undefined)
      binds.qtEstoqueGeralMaiorIgual = qtEstoqueGeralMaiorIgual;

    console.log("SQL Final (POST):", sql);
    console.log("Binds Finais (POST):", binds);

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error("Erro ao buscar Produtos com venda baixa (POST):", err);
    return res.status(500).json({ message: "Erro interno ao buscar Produtos com venda baixa", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/produtos-venda-baixa");

// Novo Endpoint (GestMKT): Calcular margem para preço fixo
// Recebe: precoFixo, pcomint1 (percentual), e uma das bases de custo (custoBase | custoReal | custoUltEntLiq | custoUltEnt)
// Retorna: margemPercent (duas casas decimais), comissaoValor, cmvCalculado e custoBase resolvido
app.post("/api/gestmkt/calcular-margem-preco-fixo", async (req, res) => {
  try {
    const body = req.body || {};
    const precoFixoStr = String(body.precoFixo ?? '').trim();
    const pcomint1Str = String(body.pcomint1 ?? '').trim();
    const custoBaseStr = String(body.custoBase ?? '').trim();
    const custoRealStr = String(body.custoReal ?? '').trim();
    const custoUltEntLiqStr = String(body.custoUltEntLiq ?? '').trim();
    const custoUltEntStr = String(body.custoUltEnt ?? '').trim();

    const toNum = (s) => {
      const n = parseFloat(String(s || '').replace(',', '.'));
      return isNaN(n) ? undefined : n;
    };

    const precoFixo = toNum(precoFixoStr);
    if (precoFixo === undefined || precoFixo <= 0) {
      return res.status(400).json({ message: "'precoFixo' é obrigatório e deve ser numérico positivo" });
    }

    const pcomint1 = toNum(pcomint1Str) ?? 0; // percentual
    let custoBase = toNum(custoBaseStr);
    const custoReal = toNum(custoRealStr);
    const custoUltEntLiq = toNum(custoUltEntLiqStr);
    const custoUltEnt = toNum(custoUltEntStr);

    // Resolve custoBase pela preferência: custoBase informado > custoReal > custoUltEntLiq > custoUltEnt > 0
    if (custoBase === undefined) {
      if (custoReal !== undefined) custoBase = custoReal;
      else if (custoUltEntLiq !== undefined) custoBase = custoUltEntLiq;
      else if (custoUltEnt !== undefined) custoBase = custoUltEnt;
      else custoBase = 0;
    }

    const comissaoValor = precoFixo * (pcomint1 / 100);
    const cmvCalculado = custoBase + comissaoValor;
    const margemPercent = Number((((precoFixo - cmvCalculado) / precoFixo) * 100).toFixed(2));

    return res.json({
      ok: true,
      precoFixo,
      pcomint1,
      custoBase,
      comissaoValor: Number(comissaoValor.toFixed(2)),
      cmvCalculado: Number(cmvCalculado.toFixed(2)),
      margemPercent,
    });
  } catch (err) {
    console.error("[GestPRO] Falha ao calcular margem para preço fixo:", err);
    return res.status(500).json({ message: "Erro interno ao calcular margem", detalhe: err.message });
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/calcular-margem-preco-fixo");

// Endpoint: Produtos sem Venda (GestMKT)
// Retorna itens da filial onde DTULTSAIDA é NULL
// SELECT conforme especificado pelo cliente
app.get("/api/gestmkt/produtos-sem-venda", async (req, res) => {
  console.log("[GestPRO] Acessando GET /api/gestmkt/produtos-sem-venda");
  const q = req.query || {};
  const codFilial = String(q.codFilial || "").trim();
  const tipoProduto = String(q.tipoProduto || "").trim(); // "1" Geral, "2" Mix, "3" Pisos/Revestimentos
  const estoqueMinimoStr = String(q.estoqueMinimo ?? '').trim(); // opcional
  const mesData = String(q.mesData || "").trim(); // novo parâmetro para promoções (DD/MM/YYYY)

  const filialValida = ["1", "2", "3", "4"].includes(codFilial);
  if (!filialValida) {
    return res.status(400).json({ message: "'codFilial' inválido. Valores: 1,2,3,4" });
  }

  // Validação do mesData (formato DD/MM/YYYY)
  if (!mesData || !/^\d{2}\/\d{2}\/\d{4}$/.test(mesData)) {
    return res.status(400).json({ message: "'mesData' é obrigatório no formato DD/MM/YYYY" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    let sql = `
      SELECT 
        A.CODFILIAL, 
        A.CODPROD, 
        B.DESCRICAO, 
        B.CODAUXILIAR, 
        E.MARCA, 
        (A.QTEST - A.QTRESERV - A.QTBLOQUEADA) AS DISPONIVEL, 
        (A.QTBLOQUEADA - A.QTINDENIZ) AS BLOQUEADO, 
        A.QTINDENIZ AS AVARIA, 
        (A.QTEST - A.QTRESERV - A.QTINDENIZ) AS ESTOQUE_GERAL, 
        TO_CHAR(A.DTULTSAIDA, 'DD/MM/YYYY') AS DTULTSAIDA, 
        ROUND(A.CUSTOULTENT, 2) AS CUSTOULTENT, 
        ROUND(D.PVENDA, 2) AS PRECO_VENDA, 
        NVL(PP.QTD_PROMOCOES, 0) AS QTD_PROMOCOES, 
        PP.TIPO_CAMPANHA 
       FROM PCEST A 
       JOIN PCPRODUT B 
         ON B.CODPROD = A.CODPROD 
       LEFT JOIN PCTABPR D 
         ON D.CODPROD = A.CODPROD 
        AND D.NUMREGIAO = '1' 
       LEFT JOIN PCMARCA E 
         ON E.CODMARCA = B.CODMARCA 
       LEFT JOIN ( 
          SELECT 
              CODFILIAL, 
              CODPROD, 
              COUNT(1) AS QTD_PROMOCOES, 
              TRIM( 
                MAX(TIPO_CAMPANHA) KEEP ( 
                  DENSE_RANK LAST ORDER BY MES_DATA_PROMOCAO 
                ) 
              ) AS TIPO_CAMPANHA 
            FROM MULTGESTI_MARKETING_PRODUTOS_PROMOCAO 
           WHERE TRUNC(MES_DATA_PROMOCAO, 'MM') = TRUNC(TO_DATE(:mesData, 'DD/MM/YYYY'), 'MM') 
           GROUP BY CODFILIAL, CODPROD 
        ) PP ON PP.CODFILIAL = A.CODFILIAL AND PP.CODPROD = A.CODPROD 
       WHERE A.CODFILIAL = :codFilial 
         AND A.CODPROD NOT IN (65101)
         AND A.DTULTSAIDA IS NULL 
    `;

    const binds = { 
      codFilial: parseInt(codFilial, 10), 
      mesData: mesData 
    };

    if (tipoProduto === "2") {
      sql += ` AND B.CODEPTO <> 10000`;
    } else if (tipoProduto === "3") {
      sql += ` AND B.CODEPTO = 10000`;
    }

    const estoqueMinVal = estoqueMinimoStr !== '' && !isNaN(Number(estoqueMinimoStr)) ? Number(estoqueMinimoStr) : undefined;
    if (estoqueMinVal !== undefined) {
      sql += ` AND (A.QTEST - A.QTRESERV - A.QTINDENIZ) >= :estoqueMinimo`;
      binds.estoqueMinimo = estoqueMinVal;
    }

    sql += ` ORDER BY (A.QTEST - A.QTRESERV - A.QTINDENIZ) DESC`;

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error("Erro ao buscar Produtos sem Venda:", err);
    return res.status(500).json({ message: "Erro interno ao buscar Produtos sem Venda", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestmkt/produtos-sem-venda");

// Endpoint: Buscar produto por código, código de barras (auxiliar) ou descrição (GestMKT)
// Exemplo de priorização: código exato > auxiliar exato > descrição LIKE
app.get("/api/gestmkt/buscar-produto", async (req, res) => {
  const qRaw = String((req.query || {}).q || '').trim();
  const codFilial = String((req.query || {}).codFilial || '').trim();
  console.log(`[GestPRO] Acessando /api/gestmkt/buscar-produto q=${qRaw || 'N/A'} filial=${codFilial || 'N/A'}`);

  if (!qRaw) {
    return res.status(400).json({ message: "Parâmetro 'q' é obrigatório" });
  }
  if (!["1","2","3","4"].includes(codFilial)) {
    return res.status(400).json({ message: "'codFilial' inválido. Valores: 1,2,3,4" });
  }

  const digitsOnly = (s) => String(s || '').replace(/\D+/g, '');
  const qDigits = digitsOnly(qRaw);
  const isNumeric = qDigits !== '' && /^\d+$/.test(qDigits);
  const codProd = isNumeric ? Number(qDigits) : null;
  const codAux = isNumeric ? Number(qDigits) : null;
  const descLike = qRaw;

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      WITH REPO_ABERTA AS (
        SELECT
          p.CODFORNEC,
          i.CODPROD,
          MAX(p.NUMPEDREPOSICAO) AS NUMPEDREPOSICAO_ABERTO
        FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO p
        JOIN MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO_ITENS i
          ON i.IDPEDIDO = p.ID
        WHERE UPPER(TRIM(p.STATUSPEDIDO)) = 'ABERTO'
        GROUP BY p.CODFORNEC, i.CODPROD
      )
      SELECT 
        A.CODFILIAL,
        A.CODPROD,
        B.DESCRICAO,
        B.CODAUXILIAR,
        E.MARCA,
        C.CODFORNEC,
        C.FORNECEDOR,
        ROUND((A.QTEST - A.QTRESERV - A.QTBLOQUEADA), 2) AS DISPONIVEL,
        ROUND((A.QTBLOQUEADA - A.QTINDENIZ), 2) AS BLOQUEADO,
        ROUND(A.QTINDENIZ, 2) AS AVARIA,
        ROUND((A.QTEST - A.QTRESERV - A.QTINDENIZ), 2) AS ESTOQUE_GERAL,
        ROUND((F.QTEST - F.QTRESERV - F.QTBLOQUEADA), 2) AS DISPONIVEL_FILIAL_03,
        ROUND((F.QTBLOQUEADA - F.QTINDENIZ), 2) AS BLOQUEADO_FILIAL_03,
        ROUND(F.QTINDENIZ, 2) AS AVARIA_FILIAL_03,
        NVL(A.ESTMIN, 0) AS ESTMIN,
        NVL(A.ESTMAX, 0) AS ESTMAX,
        NVL(A.QTVENDMES, 0) + NVL(A.QTVENDMES1, 0) + NVL(A.QTVENDMES2, 0) + NVL(A.QTVENDMES3, 0) AS VENDAS_ULTS_MESES,
        TO_CHAR(A.DTULTENT, 'DD/MM/YYYY') AS DTULTENT,
        TO_CHAR(A.DTULTSAIDA, 'DD/MM/YYYY') AS DTULTSAIDA,
        ra.NUMPEDREPOSICAO_ABERTO,
        CAST(NULL AS NUMBER) AS QT,
        ROUND(A.CUSTOULTENT, 2) AS CUSTOULTENT,
        ROUND(D.PVENDA, 2) AS PRECO_VENDA
      FROM PCEST A 
      JOIN PCPRODUT B ON B.CODPROD = A.CODPROD 
      LEFT JOIN PCTABPR D ON D.CODPROD = A.CODPROD AND D.NUMREGIAO = '1' 
      LEFT JOIN PCMARCA E ON E.CODMARCA = B.CODMARCA 
      LEFT JOIN PCEST F ON F.CODFILIAL = 3 AND F.CODPROD = A.CODPROD 
      LEFT JOIN PCFORNEC C ON C.CODFORNEC = B.CODFORNEC
      LEFT JOIN REPO_ABERTA ra ON ra.CODFORNEC = B.CODFORNEC AND ra.CODPROD = B.CODPROD
      WHERE A.CODFILIAL = :codFilial 
        AND (
          (:codProd IS NOT NULL AND A.CODPROD = :codProd)
          OR (:codAux IS NOT NULL AND B.CODAUXILIAR = :codAux)
          OR (:descLike IS NOT NULL AND UPPER(B.DESCRICAO) LIKE '%' || UPPER(:descLike) || '%')
        )
      ORDER BY 
        CASE 
          WHEN (:codProd IS NOT NULL AND A.CODPROD = :codProd) THEN 1 
          WHEN (:codAux IS NOT NULL AND B.CODAUXILIAR = :codAux) THEN 2 
          WHEN (:descLike IS NOT NULL AND UPPER(B.DESCRICAO) LIKE '%' || UPPER(:descLike) || '%') THEN 3 
          ELSE 4 
        END
      FETCH FIRST 20 ROWS ONLY
    `;

    const result = await conn.execute(
      sql,
      {
        codFilial: Number(codFilial),
        codProd,
        codAux,
        descLike,
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows || [];
    // Compatibilidade: também devolve NOVA_DTULTSAIDA quando aplicável
    const mapped = rows.map((r) => ({
      ...r,
      NOVA_DTULTSAIDA: r.DTULTSAIDA,
      PVENDA: r.PRECO_VENDA,
    }));
    return res.json({ row: mapped[0] || null, rows: mapped, count: mapped.length });
  } catch (err) {
    console.error("[GestPRO] Erro ao buscar produto:", err);
    return res.status(500).json({ message: "Erro interno ao buscar produto", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestmkt/buscar-produto");

// Endpoint: Busca avançada por descrição com múltiplos termos (GestMKT)
// Exemplo: q="notebook dell i7 16gb ssd" exige todos os termos na descrição (ordem livre)
// Limite: 15 linhas
app.get("/api/gestmkt/busca-avancada-descricao", async (req, res) => {
  const qRaw = String((req.query || {}).q || '').trim();
  const codFilial = String((req.query || {}).codFilial || '').trim();
  const marcaRaw = String((req.query || {}).marca || '').trim();
  console.log(`[GestPRO] Acessando /api/gestmkt/busca-avancada-descricao q=${qRaw || 'N/A'} filial=${codFilial || 'N/A'} marca=${marcaRaw || 'N/A'}`);

  if (!qRaw) {
    return res.status(400).json({ message: "Parâmetro 'q' é obrigatório" });
  }
  if (!["1","2","3","4"].includes(codFilial)) {
    return res.status(400).json({ message: "'codFilial' inválido. Valores: 1,2,3,4" });
  }

  // Divide em termos, removendo múltiplos espaços e pontuação simples
  const termos = qRaw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (termos.length === 0) {
    return res.status(400).json({ message: "Informe ao menos um termo na descrição" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // Monta cláusula dinâmica dos termos
    const whereTermos = termos
      .map((_, idx) => `UPPER(B.DESCRICAO) LIKE '%' || UPPER(:t${idx}) || '%'`)
      .join(' AND ');

    const baseSelect = `
      SELECT 
        A.CODFILIAL,
        A.CODPROD,
        B.DESCRICAO,
        B.CODAUXILIAR,
        E.MARCA,
        ROUND((A.QTEST - A.QTRESERV - A.QTBLOQUEADA), 2) AS DISPONIVEL,
        ROUND((A.QTBLOQUEADA - A.QTINDENIZ), 2) AS BLOQUEADO,
        ROUND(A.QTINDENIZ, 2) AS AVARIA,
        TO_CHAR(A.DTULTSAIDA, 'DD/MM/YYYY') AS DTULTSAIDA,
        ROUND(A.CUSTOULTENT, 2) AS CUSTOULTENT,
        ROUND(D.PVENDA, 2) AS PRECO_VENDA
      FROM PCEST A 
      JOIN PCPRODUT B ON B.CODPROD = A.CODPROD 
      LEFT JOIN PCTABPR D ON D.CODPROD = A.CODPROD AND D.NUMREGIAO = '1' 
      LEFT JOIN PCMARCA E ON E.CODMARCA = B.CODMARCA 
    `;

    const sqlTermos = `
      ${baseSelect}
      WHERE A.CODFILIAL = :codFilial 
        AND ${whereTermos}
      ORDER BY B.DESCRICAO ASC
      FETCH FIRST 15 ROWS ONLY
    `;

    const bindsTermos = { codFilial: Number(codFilial) };
    termos.forEach((t, idx) => { bindsTermos[`t${idx}`] = t; });

    const resultTermos = await conn.execute(sqlTermos, bindsTermos, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let rows = (resultTermos.rows || []).map((r) => ({
      ...r,
      NOVA_DTULTSAIDA: r.DTULTSAIDA,
      PVENDA: r.PRECO_VENDA,
    }));

    // Fallback: se não houver resultados pelos termos e há marca informada, buscar por marca
    if (rows.length === 0 && marcaRaw) {
      const sqlMarca = `
        ${baseSelect}
        WHERE A.CODFILIAL = :codFilial 
          AND UPPER(E.MARCA) LIKE '%' || UPPER(:marca) || '%'
        ORDER BY B.DESCRICAO ASC
        FETCH FIRST 15 ROWS ONLY
      `;
      const bindsMarca = { codFilial: Number(codFilial), marca: marcaRaw };
      const resultMarca = await conn.execute(sqlMarca, bindsMarca, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      rows = (resultMarca.rows || []).map((r) => ({
        ...r,
        NOVA_DTULTSAIDA: r.DTULTSAIDA,
        PVENDA: r.PRECO_VENDA,
      }));
    }

    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error("[GestPRO] Erro na busca avançada por descrição:", err);
    return res.status(500).json({ message: "Erro interno na busca avançada por descrição", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestmkt/busca-avancada-descricao");



// Endpoint: Verificar se já existe campanha ativa no mês para um produto
// Recebe: { codProd: number }
// Retorna: { ok: true, exists: boolean, count: number }
app.post("/api/gestmkt/campanha-existe", async (req, res) => {
  console.log("[GestPRO] Acessando POST /api/gestmkt/campanha-existe");
  let conn;
  try {
    const { codProd, codProds, codFilial } = req.body || {};

    // Normaliza inputs
    const listaCods = Array.isArray(codProds)
      ? codProds.filter((v) => !isNaN(Number(v))).map((v) => Number(v))
      : [];
    const nCodProd = Number(codProd || 0);
    const codFilialStr = (codFilial !== undefined && codFilial !== null) ? String(codFilial).trim() : '';

    if (!nCodProd && listaCods.length === 0) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: informe 'codProd' (number) ou 'codProds' (array de numbers)" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const refDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const refDateExpr = `TO_DATE(:refDate, 'YYYY-MM-DD')`;
    const condVigencia = `TRUNC(DTINICIOVIGENCIA) <= LAST_DAY(${refDateExpr}) AND TRUNC(DTFIMVIGENCIA) >= TRUNC(${refDateExpr})`;

    if (listaCods.length > 0) {
      // Consulta em lote: retorna itens detalhados para marcação no frontend
      const placeholders = listaCods.map((_, i) => `:p${i}`);
      const binds = { refDate };
      listaCods.forEach((val, i) => { binds[`p${i}`] = Number(val); });
      if (codFilialStr) binds.codFilial = codFilialStr;

      const sql = `
        SELECT 
          CODPROD, 
          CODFILIAL, 
          CODPRECOPROM, 
          TO_CHAR(DTINICIOVIGENCIA, 'DD/MM/YYYY') AS DTINICIOVIGENCIA, 
          TO_CHAR(DTFIMVIGENCIA, 'DD/MM/YYYY')   AS DTFIMVIGENCIA
        FROM PCPRECOPROM
        WHERE CODPROD IN (${placeholders.join(",")})
          ${codFilialStr ? "AND CODFILIAL = :codFilial" : ""}
          AND ${condVigencia}
      `;
      const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const items = (result.rows || []).map((r) => ({
        CODPROD: Number(r.CODPROD),
        CODFILIAL: String(r.CODFILIAL),
        CODPRECOPROM: Number(r.CODPRECOPROM || 0),
        DTINICIOVIGENCIA: String(r.DTINICIOVIGENCIA || ''),
        DTFIMVIGENCIA: String(r.DTFIMVIGENCIA || ''),
      }));
      return res.json({ ok: true, items, count: items.length });
    }

    // Caso simples: um único produto
    const sqlSingle = `
      SELECT COUNT(*) AS QTD FROM PCPRECOPROM
       WHERE CODPROD = :codProd
         ${codFilialStr ? "AND CODFILIAL = :codFilial" : ""}
         AND ${condVigencia}
    `;
    const bindsSingle = { codProd: nCodProd, refDate };
    if (codFilialStr) bindsSingle.codFilial = codFilialStr;
    const resultSingle = await conn.execute(sqlSingle, bindsSingle, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const qtd = Number(((resultSingle.rows || [])[0] || {}).QTD || 0);
    return res.json({ ok: true, exists: qtd > 0, count: qtd });
  } catch (err) {
    console.error("[GestPRO] Erro ao verificar campanha existente:", err);
    return res.status(500).json({ message: "Erro interno ao verificar campanha existente", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/campanha-existe");





app.post("/api/gestmkt/produtos-disponiveis", async (req, res) => {
  let conn;
  try {
    const body = req.body || {};
    const qtRaw = body.qtDinponivel ?? body.qtDisponivel ?? body.qtDisponivelMinimo ?? body.disponivel;
    const pisos = Number(body.pisos ?? 0);
    const mix = Number(body.mix ?? 0);

    if (!(pisos === 1 || mix === 2)) {
      return res.status(400).json({ message: "Informe 'pisos=1' ou 'mix=2'" });
    }

    const qtNum = Number(qtRaw);
    if (!Number.isFinite(qtNum)) {
      return res.status(400).json({ message: "Parâmetro 'qtDinponivel' inválido" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
          bb.CODFILIAL, 
          aa.CODPROD, 
          aa.DESCRICAO, 
          aa.CODAUXILIAR, 
          cc.MARCA, 
          bb.QTBLOQUEADA, 
          (bb.QTBLOQUEADA - bb.QTINDENIZ) AS AVARIA, 
          bb.QTRESERV, 
          (bb.QTESTGER - bb.QTRESERV - bb.QTBLOQUEADA) AS DISPONIVEL 
      FROM 
          PCPRODUT aa 
      JOIN 
          PCEST bb 
            ON bb.CODPROD = aa.CODPROD 
      LEFT JOIN 
          PCMARCA cc 
            ON cc.CODMARCA = aa.CODMARCA 
      WHERE 
          (bb.QTESTGER - bb.QTRESERV - bb.QTBLOQUEADA) >= :qtDinponivel 
          AND ( 
                CASE 
                  WHEN :pisos = 1 THEN 
                      CASE WHEN aa.CODEPTO = 10000 THEN 1 ELSE 0 END 
                  WHEN :mix = 2 THEN 
                      CASE WHEN aa.CODEPTO <> 10000 THEN 1 ELSE 0 END 
                END 
              ) = 1 
      GROUP BY 
          bb.CODFILIAL, 
          aa.CODPROD, 
          aa.DESCRICAO, 
          aa.CODAUXILIAR, 
          cc.MARCA, 
          bb.QTBLOQUEADA, 
          bb.QTINDENIZ, 
          bb.QTRESERV, 
          bb.QTESTGER 
      ORDER BY 
          (bb.QTESTGER - bb.QTRESERV - bb.QTBLOQUEADA)
    `;

    const binds = { qtDinponivel: qtNum, pisos, mix };
    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar produtos disponíveis:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/produtos-disponiveis");




// Endpoint: Histórico de Movimentações do Produto (por período)
// Recebe: { codigoDoProduto: number, filialDoPrduto: string, dataInicio: 'DD/MM/YYYY', dataFinal: 'DD/MM/YYYY' }
// Retorna agregados por período conforme SELECT informado
app.post("/api/gestpro/historico-produto", async (req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/historico-produto");
  let conn;
  try {
    const { codigoDoProduto, filialDoPrduto, dataInicio, dataFinal } = req.body || {};

    if (!codigoDoProduto || !filialDoPrduto || !dataInicio || !dataFinal) {
      return res.status(400).json({ message: "Parâmetros obrigatórios ausentes: codigoDoProduto, filialDoPrduto, dataInicio, dataFinal" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
          M.CODFILIAL, 
          M.CODPROD, 
          B.DESCRICAO, 
          B.CODAUXILIAR, 
          E.MARCA, 
          COUNT(M.NUMNOTA) AS QTD_MOVIMENTACOES, 
          SUM(M.QT) AS QUANTIDADE_TOTAL, 
          ROUND(AVG(M.PUNIT), 2) AS PRECO_MEDIO, 
          ROUND(SUM(M.QT * M.PUNIT), 2) AS VALOR_TOTAL, 
          MIN(TO_CHAR(M.DTMOV, 'DD/MM/YYYY')) AS PRIMEIRA_SAIDA, 
          MAX(TO_CHAR(M.DTMOV, 'DD/MM/YYYY')) AS ULTIMA_SAIDA, 
          A.QTEST AS ESTOQUE_ATUAL, 
          ROUND((A.QTEST - A.QTRESERV - A.QTBLOQUEADA), 2) AS DISPONIVEL, 
          ROUND((A.QTEST - A.QTRESERV - A.QTINDENIZ), 2) AS ESTOQUE_GERAL 
      FROM PCMOV M 
          JOIN PCPRODUT B ON B.CODPROD = M.CODPROD 
          LEFT JOIN PCEST A ON A.CODPROD = M.CODPROD AND A.CODFILIAL = M.CODFILIAL 
          LEFT JOIN PCMARCA E ON E.CODMARCA = B.CODMARCA 
      WHERE M.CODPROD = :codigoDoProduto 
        AND M.CODFILIAL = :filialDoPrduto 
        AND M.DTMOV BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') 
                        AND TO_DATE(:dataFinal, 'DD/MM/YYYY') 
        AND M.CODOPER = 'S' 
        AND M.STATUS = 'AB' 
        AND M.DTCANCEL IS NULL 
      GROUP BY 
          M.CODFILIAL, 
          M.CODPROD, 
          B.DESCRICAO, 
          B.CODAUXILIAR, 
          E.MARCA, 
          A.QTEST, 
          ROUND((A.QTEST - A.QTRESERV - A.QTBLOQUEADA), 2), 
          ROUND((A.QTEST - A.QTRESERV - A.QTINDENIZ), 2)
    `;

    const binds = {
      codigoDoProduto: Number(codigoDoProduto),
      filialDoPrduto: String(filialDoPrduto),
      dataInicio: String(dataInicio),
      dataFinal: String(dataFinal),
    };

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar histórico do produto:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/historico-produto");



app.post("/api/gestmkt/subir-campanha", async (req, res) => {
  console.log("[GestPRO] Acessando POST /api/gestmkt/subir-campanha");
  const {
    id,
    produtos, // Array de produtos { codProd }
    codFilial,
    precoFixo,
    dtInicio,
    dtFim,
    codFuncUltAlter,
  } = req.body || {};

  // Validação dos parâmetros obrigatórios
  if (!id || !produtos || !Array.isArray(produtos) || produtos.length === 0 ||
      !codFilial || !precoFixo || !dtInicio || !dtFim || !codFuncUltAlter) {
    return res.status(400).json({
      ok: false,
      message: "Parâmetros obrigatórios ausentes: id, produtos (array), codFilial, precoFixo, dtInicio, dtFim, codFuncUltAlter",
    });
  }

  // Validação do formato das datas
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(String(dtInicio)) || !isoDateRegex.test(String(dtFim))) {
    return res.status(400).json({ ok: false, message: "Datas inválidas. Formato esperado: YYYY-MM-DD" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const resultados = [];
    const produtosComErro = [];

    // Processar cada produto
    for (const produto of produtos) {
      try {
        const plsql = `
          DECLARE
            v_prox_codprecoprom NUMBER(10);
          BEGIN
            SELECT NVL(MAX(CODPRECOPROM), 0) + 1 INTO v_prox_codprecoprom FROM TOPHC.PCPRECOPROM;

            UPDATE MULTGESTI_MARKETING_PRODUTOS_PROMOCAO a
               SET a.CODIGO_PROMOCAO = v_prox_codprecoprom
             WHERE a.ID = :v_id_promocao
               AND a.CODPROD = :v_codprod;

            IF SQL%ROWCOUNT = 0 THEN
              :out_cod := NULL;
              :out_erro := 'Produto não encontrado na promoção';
              RETURN;
            END IF;

            INSERT INTO TOPHC.PCPRECOPROM (
              CODPROD, NUMREGIAO, PRECOFIXO, DTINICIOVIGENCIA, DTFIMVIGENCIA, CODPRECOPROM,
              FRENTECX, CONSIDERACALCGIRO, UTILIZAPRECOFIXOREDE, UTILIZAPRECOFIXOFAMILIA,
              CODFUNCULTALTER, APENASPLPAGMAX, ENVIAFV, DTULTALTER, ORIGEMPED, CODFILIAL,
              APLICADESCONTOSIMPLES, AGREGARST, CONSIDERACALCGIROMEDIC, CONSIDERAPRECOSEMIMPOSTO,
              PERCFORNEC, PERCCUSTFORNEC, DTALTERC5
            ) VALUES (
              :v_codprod, 1, :v_precofixo,
              TO_DATE(:v_dt_inicio, 'YYYY-MM-DD'), TO_DATE(:v_dt_fim, 'YYYY-MM-DD'), v_prox_codprecoprom,
              'S','N','N','N', :v_codfunc, 'N','N', SYSDATE, 'O', :v_codfilial,
              'N','N','N','N', 0, 0, SYSTIMESTAMP
            );

            :out_cod := v_prox_codprecoprom;
            :out_erro := NULL;
          EXCEPTION
            WHEN OTHERS THEN
              :out_cod := NULL;
              :out_erro := SQLERRM;
          END;
        `;

        const binds = {
          v_id_promocao: Number(id),
          v_codprod: Number(produto.codProd),
          v_codfilial: String(codFilial),
          v_precofixo: Number(precoFixo),
          v_dt_inicio: String(dtInicio),
          v_dt_fim: String(dtFim),
          v_codfunc: Number(codFuncUltAlter),
          out_cod: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          out_erro: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 1000 }
        };

        const result = await conn.execute(plsql, binds, { autoCommit: true });
        const outCod = result?.outBinds?.out_cod ? Number(result.outBinds.out_cod) : null;
        const outErro = result?.outBinds?.out_erro || null;

        if (outCod) {
          resultados.push({
            codProd: produto.codProd,
            codPrecoProm: outCod,
            sucesso: true
          });
        } else {
          produtosComErro.push({
            codProd: produto.codProd,
            erro: outErro || 'Erro desconhecido ao processar produto'
          });
        }
      } catch (err) {
        console.error(`[GestPRO] Erro ao processar produto ${produto.codProd}:`, err);
        produtosComErro.push({
          codProd: produto.codProd,
          erro: err.message
        });
      }
    }

    return res.json({
      ok: true,
      message: `Processamento concluído: ${resultados.length} sucesso(s), ${produtosComErro.length} erro(s)`,
      resultados,
      erros: produtosComErro
    });

  } catch (err) {
    console.error("[GestPRO] Erro ao subir campanha:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro interno ao subir campanha",
      detalhe: err.message
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestmkt/subir-campanha");

app.get("/api/gestpro/pcpedc-log2-gestpro", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/pcpedc-log2-gestpro");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 1 AS ONE
      FROM PCPEDC
      WHERE LOG2 IN ('13', '14', '17', '21')
      AND POSICAO NOT IN ('F', 'C')
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error("Erro ao consultar PCPEDC LOG2=13:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/pcpedc-log2-gestpro");

app.get("/api/gestpro/pedido-por-numped", async (req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/pedido-por-numped");
  const numpedNum = Number(req.query.numped);
  if (!Number.isFinite(numpedNum) || numpedNum <= 0) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: numped" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
SELECT DISTINCT 
    TO_CHAR(A.DATA, 'DD/MM/YYYY') AS DATA, 
    A.CODCOB, 
    A.CODFILIAL, 
    B.CODFILIALRETIRA, 
    A.CONDVENDA, 
    A.POSICAO, 
    A.NUMVIASMAPASEP, 
    B.TIPOENTREGA, 
    E.CODCLI, 
    E.CLIENTE, 
    A.NUMPED AS NUMERO_DO_PEDIDO_TV8, 
    A.NUMPEDENTFUT AS NUMERO_DO_PEDIDO_TV7, 
    B.CODPROD, 
    C.DESCRICAO, 
    C.CODAUXILIAR AS CODIGO_DE_BARRAS, 
    B.QT AS QUANTIDADE_ITEM_PEDIDO, 
    D.QTEST AS ESTOQUE_ATUAL_LOJA, 
    J.COBRANCA, 
    A.OBSENTREGA1, 
    A.OBSENTREGA2, 
    A.OBSENTREGA3, 
    A.OBS, 
    A.OBS1, 
    A.OBS2, 
    F.NOME AS VENDEDOR, 
    E.ENDERENT AS ENDERENT, 
    E.NUMEROENT AS NUMEROENT, 
    E.BAIRROENT AS BAIRROENT, 
    E.MUNICENT AS MUNICENT, 
    E.CODPRACA,  
    E.TELENT, 
    G.NUMNOTA AS NUMNOTA, 
    G.DTSAIDA, 
    G.CODEMITENTE, 
    A.VLFRETE, 
    G.VLOUTRASDESP, 
    H.NOME_GUERRA AS NOME_EMITENTE, 
    K.NOME AS EMITENTE_MAPA, 
    C.MULTIPLO,
    C.EMBALAGEM,
    CASE
        WHEN C.MULTIPLO < 1 THEN 'Multiplo errado'
        WHEN ABS((B.QT / C.MULTIPLO) - ROUND(B.QT / C.MULTIPLO)) < 0.0001 
        THEN TO_CHAR(ROUND(B.QT / C.MULTIPLO)) || ' ' || C.EMBALAGEMMASTER
    ELSE 'Multiplo errado'
    END AS QT_TOTAL,
    A.LOG1 AS STATUS_PEDIDO,
    A.LOG3,
    A.ULTIMASITUACAOCFAT AS ULTIMASITUACAOCFAT,
    A.CODUSUR AS MATRICULA_RCA,
    S.STATUS_PRIORIDADE AS STATUS_ESPECIAL_PRIORIDADE,
    A.DTINICIALSEP
FROM PCPEDC A 
JOIN PCPEDI B ON B.NUMPED = A.NUMPED 
JOIN PCPEDC I ON I.NUMPED = A.NUMPEDENTFUT 
JOIN PCPRODUT C ON C.CODPROD = B.CODPROD 
JOIN PCEST D ON D.CODPROD = B.CODPROD AND D.CODFILIAL = A.CODFILIAL 
JOIN PCCLIENT E ON E.CODCLI = B.CODCLI 
JOIN PCUSUARI F ON F.CODUSUR = A.CODUSUR 
LEFT JOIN PCEMPR K ON K.MATRICULA = A.CODFUNCEMISSAOMAPA 
LEFT JOIN PCNFSAID G ON G.NUMPED = A.NUMPED 
LEFT JOIN PCEMPR H ON H.MATRICULA = G.CODEMITENTE 
JOIN PCCOB J ON J.CODCOB = A.CODCOB 
LEFT JOIN MULTGESTI_STATUS_ESPECIAL_PEDIDOS S ON S.NUMPED = A.NUMPED 

WHERE A.NUMPED = :numped

ORDER BY B.TIPOENTREGA, A.NUMPED, A.NUMVIASMAPASEP
    `;

    const result = await conn.execute(sql, { numped: numpedNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar pedido por NUMPED:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/pedido-por-numped");

// Endpoint: Buscar pedidos prioridade (Status 23)
app.get("/api/gestpro/pedidos-prioridade", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/pedidos-prioridade");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
       SELECT DISTINCT
             ped.NUMPED, 
             ped.NUMPEDENTFUT,
             ped.OBS,
             ped.OBS1,
             ped.OBS2,
             ped.OBSENTREGA1,
             ped.OBSENTREGA2,
             ped.OBSENTREGA3, 
             ped.CODCLI, 
             cli.CLIENTE, 
             ped.VLTOTAL, 
             ped.CODFILIAL, 
             ped.DATA, 
             ped.CODUSUR,
             usur.NOME, 
             cli.ENDERENT AS ENDERENT,
             cli.NUMEROENT AS NUMEROENT,
             cli.BAIRROENT AS BAIRROENT,
             cli.MUNICENT AS MUNICENT,
             cli.CEPENT AS CEP,
             ped.LOG2,
             ped.LOG2 AS LOG2_REAL, 
             pedItem.TIPOENTREGA, 
             pedItem.CODFILIALRETIRA, 
             pedItem.POSICAO, 
             pedItem.CODPROD, 
             pedItem.QT, 
             pedItem.CODFUNCSEP,
             funcSep.NOME AS SEPERADOR_ITEM,
             prod.DESCRICAO, 
             prod.CODAUXILIAR, 
             prod.MULTIPLO,
             prod.EMBALAGEMMASTER,
             motivCorte.MOTIVO_CORTE,
             sep.NOME AS SEPERADOR,
             ped.NUMVIASMAPASEP,
             emissMapa.NOME AS EMISSOR_MAPA,
             pedItem.IMPRIME
         FROM 
             PCPEDC ped 
         JOIN 
             PCPEDI pedItem 
           ON  
             pedItem.NUMPED = ped.NUMPED 
         JOIN 
             PCCLIENT cli 
           ON 
             cli.CODCLI = ped.CODCLI 
         JOIN 
             PCPRODUT prod 
           ON   
             prod.CODPROD = pedItem.CODPROD 
         LEFT 
         JOIN 
             MULTGESTI_LOGS_PEDIDOS_CORTE motivCorte 
           ON 
             motivCorte.NUMPED = ped.NUMPED 
        JOIN
            PCUSUARI usur
          ON
           usur.CODUSUR = ped.CODUSUR
        LEFT
        JOIN
            PCUSUARI sep
          ON
           sep.CODUSUR = ped.CODFUNCSEP
        LEFT
        JOIN
            PCUSUARI emissMapa
          ON
           emissMapa.CODUSUR = ped.CODFUNCEMISSAOMAPA
        LEFT
        JOIN
            PCUSUARI funcSep
          ON
           funcSep.CODUSUR = pedItem.CODFUNCSEP
        WHERE 
             ped.LOG2 IN ('23') 
          AND 
             ped.POSICAO NOT IN ('F', 'C') 
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error("Erro ao consultar PCPEDC LOG2=23:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/pedidos-prioridade");

// Endpoint: Definir prioridade (Status 23)
app.post("/api/gestpro/definir-prioridade", async (req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/definir-prioridade", req.body);
  let conn;
  try {
    const { numped } = req.body;
    if (!numped) {
      return res.status(400).json({ message: "Número do pedido é obrigatório." });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // Atualiza LOG2 para '23'
    const sql = `UPDATE PCPEDC SET LOG2 = '23' WHERE NUMPED = :numped`;
    
    const result = await conn.execute(sql, { numped }, { autoCommit: true });

    if (result.rowsAffected > 0) {
      return res.json({ message: `Pedido ${numped} atualizado para prioridade (Status 23).`, success: true });
    } else {
      return res.status(404).json({ message: `Pedido ${numped} não encontrado ou não atualizado.` });
    }

  } catch (err) {
    console.error("Erro ao definir prioridade:", err);
    return res.status(500).json({ message: "Erro interno ao definir prioridade", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/definir-prioridade");

// Endpoint: Histórico de Campanhas por Produto
app.get("/api/gestpro/historico-campanhas/:codProd", async (req, res) => {
  const codProdStr = req.params.codProd;
  console.log(`[GestPRO] Acessando /api/gestpro/historico-campanhas/${codProdStr}`);
  
  if (!codProdStr || isNaN(Number(codProdStr))) {
      return res.status(400).json({ message: "Parâmetro 'codProd' inválido ou ausente." });
  }

  const codProd = Number(codProdStr);
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
        CODFILIAL, 
        CODPROD, 
        MES_DATA_PROMOCAO, 
        DT_ADD, 
        CODUSUR_ADD, 
        TIPO_CAMPANHA, 
        PRECOFICTICIO, 
        ID, 
        DT_INICIO_CAMPANHA, 
        DT_FIM_CAMPANHA, 
        PRECOFIXO, 
        DT_SALVO, 
        CODUSUR_SALVOU, 
        CODIGO_PROMOCAO, 
        STATUS_ENCARTE 
      FROM 
         MULTGESTI_MARKETING_PRODUTOS_PROMOCAO_HISTORICO_CAMPANHAS 
      WHERE CODPROD = :codProd
      ORDER BY DT_ADD DESC
    `;

    const result = await conn.execute(sql, { codProd }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];
    return res.json({ rows, count: rows.length });
  } catch (err) {
    console.error("Erro ao buscar histórico de campanhas:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/historico-campanhas/:codProd");

// Endpoint: Pendencias Gestpro
app.get("/api/gestpro/pendenciasGestpro", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/pendenciasGestpro");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
       SELECT DISTINCT
             ped.NUMPED, 
             ped.NUMPEDENTFUT,
             ped.OBS,
             ped.OBS1,
             ped.OBS2,
             ped.OBSENTREGA1,
             ped.OBSENTREGA2,
             ped.OBSENTREGA3, 
             ped.CODCLI, 
             cli.CLIENTE, 
             ped.VLTOTAL, 
             ped.CODFILIAL, 
             ped.DATA, 
             ped.CODUSUR,
             usur.NOME, 
             cli.ENDERENT AS ENDERENT,
             cli.NUMEROENT AS NUMEROENT,
             cli.BAIRROENT AS BAIRROENT,
             cli.MUNICENT AS MUNICENT,
             cli.CEPENT AS CEP,
             ped.LOG2,
             ped.LOG2 AS LOG2_REAL, 
             pedItem.TIPOENTREGA, 
             pedItem.CODFILIALRETIRA, 
             pedItem.POSICAO, 
             pedItem.CODPROD, 
             pedItem.QT, 
             pedItem.CODFUNCSEP,
             funcSep.NOME AS SEPERADOR_ITEM,
             prod.DESCRICAO, 
             prod.CODAUXILIAR, 
             prod.MULTIPLO,
             prod.EMBALAGEMMASTER,
             CASE
                 WHEN NVL(prod.MULTIPLO, 0) < 1 THEN 'Multiplo errado'
                 WHEN ABS((pedItem.QT / prod.MULTIPLO) - ROUND(pedItem.QT / prod.MULTIPLO)) < 0.0001
                 THEN RTRIM(TO_CHAR(ROUND(pedItem.QT / prod.MULTIPLO)) || ' ' || NVL(prod.EMBALAGEMMASTER, ''))
                 ELSE 'Multiplo errado'
             END AS QTD_TOTAL,
             motivCorte.MOTIVO_CORTE,
             sep.NOME AS SEPERADOR,
             ped.NUMVIASMAPASEP,
             emissMapa.NOME AS EMISSOR_MAPA,
             pedItem.IMPRIME
         FROM 
             PCPEDC ped 
         JOIN 
             PCPEDI pedItem 
           ON  
             pedItem.NUMPED = ped.NUMPED 
         JOIN 
             PCCLIENT cli 
           ON 
             cli.CODCLI = ped.CODCLI 
         JOIN 
             PCPRODUT prod 
           ON   
             prod.CODPROD = pedItem.CODPROD 
         LEFT 
         JOIN 
             MULTGESTI_LOGS_PEDIDOS_CORTE motivCorte 
           ON 
             motivCorte.NUMPED = ped.NUMPED 
        JOIN
            PCUSUARI usur
          ON
           usur.CODUSUR = ped.CODUSUR
        LEFT
        JOIN
            PCUSUARI sep
          ON
           sep.CODUSUR = ped.CODFUNCSEP
        LEFT
        JOIN
            PCUSUARI emissMapa
          ON
           emissMapa.CODUSUR = ped.CODFUNCEMISSAOMAPA
        LEFT
        JOIN
            PCUSUARI funcSep
          ON
           funcSep.CODUSUR = pedItem.CODFUNCSEP
        WHERE 
             ped.LOG2 IN ('13', '17', '21', '22') 
          AND 
             ped.POSICAO NOT IN ('F', 'C') 
        UNION ALL
       SELECT DISTINCT 
             ped.NUMPED, 
             ped.NUMPEDENTFUT, 
             ped.OBS, 
             ped.OBS1, 
             ped.OBS2, 
             ped.OBSENTREGA1, 
             ped.OBSENTREGA2, 
             ped.OBSENTREGA3, 
             ped.CODCLI, 
             cli.CLIENTE, 
             ped.VLTOTAL, 
             ped.CODFILIAL, 
             ped.DATA, 
             ped.CODUSUR, 
             usur.NOME, 
             cli.ENDERENT AS ENDERENT, 
             cli.NUMEROENT AS NUMEROENT, 
             cli.BAIRROENT AS BAIRROENT, 
             cli.MUNICENT AS MUNICENT, 
             cli.CEPENT AS CEP, 
             '14' AS LOG2,
             ped.LOG2 AS LOG2_REAL, 
             pedItem.TIPOENTREGA, 
             pedItem.CODFILIALRETIRA, 
             pedItem.POSICAO, 
             pedItem.CODPROD, 
             pedItem.QT, 
             pedItem.CODFUNCSEP,
             funcSep.NOME AS SEPERADOR_ITEM,
             prod.DESCRICAO, 
             prod.CODAUXILIAR, 
             prod.MULTIPLO,
             prod.EMBALAGEMMASTER,
             CASE
                 WHEN NVL(prod.MULTIPLO, 0) < 1 THEN 'Multiplo errado'
                 WHEN ABS((pedItem.QT / prod.MULTIPLO) - ROUND(pedItem.QT / prod.MULTIPLO)) < 0.01
                 THEN RTRIM(TO_CHAR(ROUND(pedItem.QT / prod.MULTIPLO)) || ' ' || NVL(prod.EMBALAGEMMASTER, ''))
                 ELSE 'Multiplo errado'
             END AS QTD_TOTAL,
             motivCorte.MOTIVO_CORTE, 
             sep.NOME AS SEPERADOR, 
             ped.NUMVIASMAPASEP, 
             emissMapa.NOME AS EMISSOR_MAPA,
             pedItem.IMPRIME
         FROM 
             PCPEDC ped 
         JOIN 
             PCPEDI pedItem 
           ON  
             pedItem.NUMPED = ped.NUMPED 
         JOIN 
             PCCLIENT cli 
           ON 
             cli.CODCLI = ped.CODCLI 
         JOIN 
             PCPRODUT prod 
           ON   
             prod.CODPROD = pedItem.CODPROD 
         LEFT 
         JOIN 
             MULTGESTI_LOGS_PEDIDOS_CORTE motivCorte 
           ON 
             motivCorte.NUMPED = ped.NUMPED 
        JOIN 
            PCUSUARI usur 
          ON 
            usur.CODUSUR = ped.CODUSUR 
        LEFT 
        JOIN 
            PCUSUARI sep 
          ON 
            sep.CODUSUR = ped.CODFUNCSEP 
        LEFT 
        JOIN 
            PCUSUARI emissMapa 
          ON 
            emissMapa.CODUSUR = ped.CODFUNCEMISSAOMAPA 
        LEFT
        JOIN
            PCUSUARI funcSep
          ON
           funcSep.CODUSUR = pedItem.CODFUNCSEP
        JOIN
            MULTGESTI_LOGS_PEDIDOS_LOCALIZACAO loc
          ON
            loc.NUMPED = ped.NUMPED
        WHERE 
             loc.LOCALIZACAO_ATUAL IS NULL 
          AND 
             ped.POSICAO NOT IN ('F', 'C')
        UNION ALL
       SELECT DISTINCT 
             ped.NUMPED, 
             ped.NUMPEDENTFUT, 
             ped.OBS, 
             ped.OBS1, 
             ped.OBS2, 
             ped.OBSENTREGA1, 
             ped.OBSENTREGA2, 
             ped.OBSENTREGA3, 
             ped.CODCLI, 
             cli.CLIENTE, 
             ped.VLTOTAL, 
             ped.CODFILIAL, 
             ped.DATA, 
             ped.CODUSUR, 
             usur.NOME, 
             cli.ENDERENT AS ENDERENT, 
             cli.NUMEROENT AS NUMEROENT, 
             cli.BAIRROENT AS BAIRROENT, 
             cli.MUNICENT AS MUNICENT, 
             cli.CEPENT AS CEP, 
             ped.LOG2,
             ped.LOG2 AS LOG2_REAL, 
             pedItem.TIPOENTREGA, 
             pedItem.CODFILIALRETIRA, 
             pedItem.POSICAO, 
             pedItem.CODPROD, 
             pedItem.QT, 
             pedItem.CODFUNCSEP,
             funcSep.NOME AS SEPERADOR_ITEM,
             prod.DESCRICAO, 
             prod.CODAUXILIAR, 
             prod.MULTIPLO,
             prod.EMBALAGEMMASTER,
             CASE
                 WHEN NVL(prod.MULTIPLO, 0) < 1 THEN 'Multiplo errado'
                 WHEN ABS((pedItem.QT / prod.MULTIPLO) - ROUND(pedItem.QT / prod.MULTIPLO)) < 0.01
                 THEN RTRIM(TO_CHAR(ROUND(pedItem.QT / prod.MULTIPLO)) || ' ' || NVL(prod.EMBALAGEMMASTER, ''))
                 ELSE 'Multiplo errado'
             END AS QTD_TOTAL,
             motivCorte.MOTIVO_CORTE, 
             sep.NOME AS SEPERADOR, 
             ped.NUMVIASMAPASEP, 
             emissMapa.NOME AS EMISSOR_MAPA,
             pedItem.IMPRIME
         FROM 
             PCPEDC ped 
         JOIN 
             PCPEDI pedItem 
           ON  
             pedItem.NUMPED = ped.NUMPED 
         JOIN 
             PCCLIENT cli 
           ON 
             cli.CODCLI = ped.CODCLI 
         JOIN 
             PCPRODUT prod 
           ON   
             prod.CODPROD = pedItem.CODPROD 
         LEFT 
         JOIN 
             MULTGESTI_LOGS_PEDIDOS_CORTE motivCorte 
           ON 
             motivCorte.NUMPED = ped.NUMPED 
        JOIN 
            PCUSUARI usur 
          ON 
            usur.CODUSUR = ped.CODUSUR 
        LEFT 
        JOIN 
            PCUSUARI sep 
          ON 
            sep.CODUSUR = ped.CODFUNCSEP 
        LEFT 
        JOIN 
            PCUSUARI emissMapa 
          ON 
            emissMapa.CODUSUR = ped.CODFUNCEMISSAOMAPA 
        LEFT
        JOIN
            PCUSUARI funcSep
          ON
           funcSep.CODUSUR = pedItem.CODFUNCSEP
        WHERE 
             ped.LOG2 IN ('10') 
          AND 
             ped.POSICAO NOT IN ('F', 'C')
          AND 
             pedItem.CODFILIALRETIRA = 1 
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar Pendencias Gestpro:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/pendenciasGestpro");




app.get("/api/gestpro/clientes-sem-venda", async (_req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/clientes-sem-venda");
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
         c.CODCLI, 
         c.CLIENTE, 
         c.MUNICENT, 
         c.BAIRROENT, 
         c.TELENT, 
         c.TELCOB, 
         u.DTSAIDA AS DATA_ULTIMA_COMPRA, 
         u.VLTOTAL AS VALOR_ULTIMA_COMPRA, 
         v.NOME AS VENDEDOR_ULT_VENDA,
         m.CODUSUR_RESPONSAVEL_CLINTE AS CODUSUR_RESPONSAVEL_CLIENTE,
         m.NOME_RESPONSAVEL, 
         TO_CHAR(m.CONTACTADO, 'DD/MM/YYYY') AS CONTACTADO, 
         m.STATUS_ATUAL
      FROM 
         PCCLIENT c 
      JOIN ( 
             SELECT 
                 CODCLI, 
                 MAX(DTSAIDA) AS DTSAIDA 
             FROM 
                 PCNFSAID 
             WHERE 
                 DTCANCEL IS NULL 
             GROUP BY 
                 CODCLI 
          ) x 
         ON x.CODCLI = c.CODCLI 
      JOIN PCNFSAID u 
         ON u.CODCLI = x.CODCLI 
        AND u.DTSAIDA = x.DTSAIDA 
      LEFT JOIN PCUSUARI v
             ON v.CODUSUR = u.CODUSUR
      LEFT JOIN MULTGESTI_CLIENTES_SEM_VENDA m 
             ON m.CODCLI = c.CODCLI 
      WHERE 
         x.DTSAIDA < ADD_MONTHS(TRUNC(SYSDATE), -3) 
         AND u.VLTOTAL >= 1000 
      ORDER BY 
         u.VLTOTAL DESC
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar Clientes sem Venda:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/clientes-sem-venda");




// Endpoint: Salvar/Atualizar Contato de Cliente sem Venda (Upsert)
app.post("/api/gestpro/salvar-cliente-sem-venda", async (req, res) => {
  console.log("[GestPRO] Acessando POST /api/gestpro/salvar-cliente-sem-venda");
  const { codcli, codusur, contactado, status, ultimaData, nomeResponsavel } = req.body;

  if (!codcli) {
    return res.status(400).json({ message: "CODCLI é obrigatório." });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // Validação: Verifica se o cliente já possui registro com outro usuário
    const checkSql = `
      SELECT CODUSUR_RESPONSAVEL_CLINTE, NOME_RESPONSAVEL 
      FROM MULTGESTI_CLIENTES_SEM_VENDA 
      WHERE CODCLI = :codcli
    `;
    const checkResult = await conn.execute(
      checkSql,
      { codcli: Number(codcli) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (checkResult.rows && checkResult.rows.length > 0) {
      const existing = checkResult.rows[0];
      const dbCodUsur = existing.CODUSUR_RESPONSAVEL_CLINTE;
      const dbNome = existing.NOME_RESPONSAVEL;
      const reqCodUsur = codusur ? Number(codusur) : null;

      // Se existe um responsável e é diferente do usuário atual
      if (dbCodUsur && reqCodUsur && dbCodUsur !== reqCodUsur) {
        return res.status(409).json({
          message: `Este cliente já está sendo atendido por: ${dbNome || 'Outro usuário'}.`,
          conflict: true,
          responsavel: dbNome
        });
      }
    }

    const sql = `
      MERGE INTO MULTGESTI_CLIENTES_SEM_VENDA t
      USING (SELECT :codcli AS CODCLI FROM dual) s
      ON (t.CODCLI = s.CODCLI)
      WHEN MATCHED THEN
        UPDATE SET
          CODUSUR_RESPONSAVEL_CLINTE = :codusur,
          CONTACTADO = :contactado,
          STATUS_ATUAL = :status,
          ULTIMA_DATA_CONTACTADO = :ultimaData,
          NOME_RESPONSAVEL = :nomeResponsavel
      WHEN NOT MATCHED THEN
        INSERT (
          CODCLI,
          CODUSUR_RESPONSAVEL_CLINTE,
          CONTACTADO,
          STATUS_ATUAL,
          ULTIMA_DATA_CONTACTADO,
          NOME_RESPONSAVEL
        ) VALUES (
          :codcli,
          :codusur,
          :contactado,
          :status,
          :ultimaData,
          :nomeResponsavel
        )
    `;

    // Converte strings de data para objetos Date se necessário, ou null
    const bindVars = {
      codcli: Number(codcli),
      codusur: codusur ? Number(codusur) : null,
      contactado: contactado ? new Date(contactado) : null,
      status: status ? Number(status) : null,
      ultimaData: ultimaData ? new Date(ultimaData) : null,
      nomeResponsavel: nomeResponsavel ? String(nomeResponsavel).substring(0, 50) : null
    };

    await conn.execute(sql, bindVars, { autoCommit: true });

    return res.json({ message: "Dados salvos com sucesso." });
  } catch (err) {
    console.error("Erro ao salvar Cliente sem Venda:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/salvar-cliente-sem-venda");






// Endpoint: Buscar notas para Conciliação TV7 (Notas de Entrada OE - CodFiscal 132)
// SELECT * FROM PCNFENT WHERE OBS1 IS NULL AND DTENT BETWEEN to_date(:dataInicio, 'DD/MM/YYYY') AND to_date(:dataFim, 'DD/MM/YYYY') AND ESPECIE = 'OE' AND CODFISCAL = 132
app.post("/api/gestpro/conciliacao-tv7/buscar-notas", async (req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/conciliacao-tv7/buscar-notas", req.body);
  let conn;
  try {
    const { dataInicio, dataFim } = req.body;

    // Se não informar datas, usa o padrão do dia 27/01/2026 (conforme solicitado no exemplo)
    // Mas o ideal é que o frontend envie.
    // Formato esperado das datas: 'DD/MM/YYYY' ou 'YYYY-MM-DD'.
    // O banco espera DD/MM/YYYY no to_date do exemplo, mas vamos garantir o formato.

    const dInicio = dataInicio || '27/01/2026';
    const dFim = dataFim || '27/01/2026';

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // Nota: O usuário pediu exatamente esse SELECT.
    // SELECT * FROM PCNFENT WHERE OBS1 IS NULL AND DTENT BETWEEN to_date('27/01/2026', 'DD/MM/YYYY') AND to_date('27/01/2026', 'DD/MM/YYYY') AND ESPECIE = 'OE' AND CODFISCAL = 132
    
    // Vamos usar bind parameters para segurança, mas mantendo a lógica.
    // Se a data vier YYYY-MM-DD, precisamos converter ou alterar a máscara do to_date.
    // Assumindo que o front vai mandar YYYY-MM-DD (padrão input date), vamos tratar.
    
    // Helper para converter YYYY-MM-DD para DD/MM/YYYY se necessário
    const formatToBR = (dtStr) => {
       if (!dtStr) return '27/01/2026';
       if (dtStr.includes('/')) return dtStr; // já está em DD/MM/YYYY ou similar
       const parts = dtStr.split('-');
       if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
       return dtStr;
    };

    const dInicioBR = formatToBR(dInicio);
    const dFimBR = formatToBR(dFim);

    const sql = `
       SELECT 
            dev.NUMNOTA, 
            TO_CHAR(dev.DTEMISSAO, 'DD/MM/YYYY') AS DTEMISSAO, 
            dev.CODUSURDEVOL, 
            TO_CHAR(dev.DTENT, 'DD/MM/YYYY') AS DTENT, 
            dev.CODFORNEC AS CODCLI, 
            cli.CLIENTE, 
            dev.VLTOTAL, 
            dev.CODFILIAL, 
            dev.NUMTRANSENT, 
            TO_CHAR(mov.DTMOV, 'DD/MM/YYYY') AS DTMOV, 
            mov.CODPROD, 
            prod.DESCRICAO, 
            prod.CODAUXILIAR, 
            mov.QT, 
            mov.PUNIT, 
            mov.NUMPED, 
            ped.POSICAO, 
            ped.CONDVENDA, 
            TO_CHAR(ped.DATA, 'DD/MM/YYYY') AS DATA_PEDIDO_TV7, 
            ped.NUMTRANSVENDA 
        FROM PCNFENT dev 
        JOIN PCCLIENT cli ON cli.CODCLI = dev.CODFORNEC 
        JOIN PCMOV mov ON mov.NUMNOTA = dev.NUMNOTA AND mov.CODFILIAL = dev.CODFILIAL AND mov.CODOPER = 'ED' 
        JOIN PCPRODUT prod ON prod.CODPROD = mov.CODPROD 
        LEFT JOIN PCPEDC ped ON ped.NUMPED = mov.NUMPED AND ped.CODFILIAL = mov.CODFILIAL 
        WHERE dev.OBS1 IS NULL 
          AND dev.DTENT BETWEEN TO_DATE(:dInicio, 'DD/MM/YYYY') AND TO_DATE(:dFim, 'DD/MM/YYYY') 
          AND dev.ESPECIE = 'OE' 
          AND dev.CODFISCAL = 132
    `;

    const result = await conn.execute(
      sql, 
      { dInicio: dInicioBR, dFim: dFimBR }, 
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json({ rows: result.rows || [], count: (result.rows || []).length });

  } catch (err) {
    console.error("Erro ao buscar notas Conciliação TV7:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/conciliacao-tv7/buscar-notas");

// Endpoint: Buscar detalhes do pedido para Conciliação TV7
app.post("/api/gestpro/conciliacao-tv7/buscar-pedido", async (req, res) => {
  console.log("[GestPRO] Acessando /api/gestpro/conciliacao-tv7/buscar-pedido", req.body);
  let conn;
  try {
    const { numped } = req.body;

    if (!numped) {
      return res.status(400).json({ message: "Número do pedido (numped) é obrigatório." });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
       SELECT 
           ped.NUMPED, 
           ped.LOG2 AS STATUS_PEDIDO,
           ped.NUMPEDENTFUT AS TV7, 
           ped.CODUSUR, 
           usuar.NOME, 
           ped.DATA, 
           ped.CODCLI, 
           cli.CLIENTE,
           ped.CODFILIAL, 
           ped.VLTOTAL, 
           ite.CODPROD, 
           prod.DESCRICAO, 
           prod.CODAUXILIAR, 
           ite.QT, 
           ite.PVENDA 
       FROM 
           PCPEDC ped 
       JOIN 
           PCPEDI ite 
         ON 
           ite.NUMPED = ped.NUMPED 
       JOIN 
           PCPRODUT prod 
         ON  
           prod.CODPROD = ite.CODPROD 
       JOIN 
           PCUSUARI usuar 
         ON 
           usuar.CODUSUR = ped.CODUSUR 
       JOIN
           PCCLIENT cli
         ON
           cli.CODCLI = ped.CODCLI
      WHERE 
           ped.NUMPED = :numped 
    `;

    const result = await conn.execute(
      sql, 
      { numped: numped }, 
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return res.json({ rows: result.rows || [], count: (result.rows || []).length });

  } catch (err) {
    console.error("Erro ao buscar detalhes do pedido Conciliação TV7:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/conciliacao-tv7/buscar-pedido");

// Endpoint: Reposição - Produtos (por fornecedor ou por transação de entrada)
app.get("/api/gestpro/reposicao/produtos", async (req, res) => {
  let conn;
  try {
    const query = req.query || {};
    const codFilialStr = String(query.codFilial ?? query.codfilial ?? "").trim();
    const codFornecStr = String(query.codFornec ?? query.codfornec ?? "").trim();
    const numTransEntStr = String(query.numTransEnt ?? query.numtransent ?? "").trim();
    const dtIniRaw = String(query.dtIni ?? query.dtini ?? "").trim();
    const dtFimRaw = String(query.dtFim ?? query.dtfim ?? "").trim();

    const codFilial = Number(codFilialStr);
    const codFornec = codFornecStr ? Number(codFornecStr) : null;
    const numTransEnt = numTransEntStr ? Number(numTransEntStr) : null;
    const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
    const isDMY = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(String(s || ""));
    const toDMY = (iso) => {
      const [y, m, d] = String(iso).split("-");
      return `${d}/${m}/${y}`;
    };
    const normalizeToDMY = (s) => {
      if (!s) return "";
      if (isDMY(s)) return s;
      if (isISODate(s)) return toDMY(s);
      return null;
    };
    const dtIniDMY = normalizeToDMY(dtIniRaw);
    const dtFimDMY = normalizeToDMY(dtFimRaw);

    if (!Number.isFinite(codFilial)) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: codFilial" });
    }
    if (codFornecStr && !Number.isFinite(codFornec)) {
      return res.status(400).json({ message: "Parâmetro inválido: codFornec" });
    }
    if (numTransEntStr && !Number.isFinite(numTransEnt)) {
      return res.status(400).json({ message: "Parâmetro inválido: numTransEnt" });
    }
    if (!Number.isFinite(numTransEnt) && !Number.isFinite(codFornec)) {
      return res.status(400).json({ message: "Informe codFornec ou numTransEnt" });
    }
    if (numTransEntStr) {
      if (dtIniRaw && !dtIniDMY) return res.status(400).json({ message: "'dtIni' deve estar em DD/MM/YYYY ou YYYY-MM-DD" });
      if (dtFimRaw && !dtFimDMY) return res.status(400).json({ message: "'dtFim' deve estar em DD/MM/YYYY ou YYYY-MM-DD" });
      if (!dtIniDMY || !dtFimDMY) return res.status(400).json({ message: "Para busca por transação, informe dtIni e dtFim" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      WITH PARAMS AS (
        SELECT
          :codFilial   AS CODFILIAL,
          :codFornec   AS CODFORNEC,
          :numTransEnt AS NUMTRANSENT,
          TO_DATE(:dtIni, 'DD/MM/YYYY') AS DTINI,
          TO_DATE(:dtFim, 'DD/MM/YYYY') AS DTFIM
        FROM DUAL
      ),
      REPO_ABERTA AS (
        SELECT
          p.CODFORNEC,
          i.CODPROD,
          MAX(p.NUMPEDREPOSICAO) AS NUMPEDREPOSICAO_ABERTO
        FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO p
        JOIN MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO_ITENS i
          ON i.IDPEDIDO = p.ID
        WHERE UPPER(TRIM(p.STATUSPEDIDO)) = 'ABERTO'
        GROUP BY
          p.CODFORNEC,
          i.CODPROD
      )
      SELECT *
      FROM (
        SELECT
          prod.CODPROD,
          prod.DESCRICAO,
          prod.CODAUXILIAR,
          (NVL(est.QTEST,0) - NVL(est.QTRESERV,0) - NVL(est.QTBLOQUEADA,0)) AS ESTOQUE_DISPONIVEL,
          (NVL(est.QTBLOQUEADA,0) - NVL(est.QTINDENIZ,0)) AS ESTOQUE_BLOQUEADO,
          NVL(est.QTINDENIZ,0) AS ESTOQUE_AVARIA,
          NVL(est.ESTMIN,0) AS ESTMIN,
          NVL(est.ESTMAX,0) AS ESTMAX,
          forn.CODFORNEC,
          forn.FORNECEDOR,
          NVL(est.QTVENDMES,0)
            + NVL(est.QTVENDMES1,0)
            + NVL(est.QTVENDMES2,0)
            + NVL(est.QTVENDMES3,0) AS VENDAS_ULTS_MESES,
          NVL(est.QTESTANT,0) AS QTESTANT,
          NVL(est.QTULTENT,0) AS QTULTENT,
          est.DTULTENT,
          est.DTULTSAIDA,
          ra.NUMPEDREPOSICAO_ABERTO AS NUMPEDREPOSICAO_ABERTO,
          CAST(NULL AS NUMBER) AS QT,
          CAST(NULL AS NUMBER) AS NUMNOTA,
          CAST(NULL AS DATE) AS DTEMISSAO,
          CAST(NULL AS DATE) AS DTENT
        FROM PCEST est
        JOIN PCPRODUT prod
          ON prod.CODPROD = est.CODPROD
        JOIN PCFORNEC forn
          ON forn.CODFORNEC = prod.CODFORNEC
        LEFT JOIN REPO_ABERTA ra
          ON ra.CODFORNEC = prod.CODFORNEC
         AND ra.CODPROD = prod.CODPROD
        CROSS JOIN PARAMS P
        WHERE P.NUMTRANSENT IS NULL
          AND est.CODFILIAL = P.CODFILIAL
          AND prod.CODFORNEC = P.CODFORNEC
        UNION ALL
        SELECT
          prod.CODPROD,
          prod.DESCRICAO,
          prod.CODAUXILIAR,
          (NVL(est.QTEST,0) - NVL(est.QTRESERV,0) - NVL(est.QTBLOQUEADA,0)) AS ESTOQUE_DISPONIVEL,
          (NVL(est.QTBLOQUEADA,0) - NVL(est.QTINDENIZ,0)) AS ESTOQUE_BLOQUEADO,
          NVL(est.QTINDENIZ,0) AS ESTOQUE_AVARIA,
          NVL(est.ESTMIN,0) AS ESTMIN,
          NVL(est.ESTMAX,0) AS ESTMAX,
          forn.CODFORNEC,
          forn.FORNECEDOR,
          NVL(est.QTVENDMES,0)
            + NVL(est.QTVENDMES1,0)
            + NVL(est.QTVENDMES2,0)
            + NVL(est.QTVENDMES3,0) AS VENDAS_ULTS_MESES,
          NVL(est.QTESTANT,0) AS QTESTANT,
          NVL(est.QTULTENT,0) AS QTULTENT,
          est.DTULTENT,
          est.DTULTSAIDA,
          ra.NUMPEDREPOSICAO_ABERTO AS NUMPEDREPOSICAO_ABERTO,
          mov.QT,
          nf.NUMNOTA,
          nf.DTEMISSAO,
          nf.DTENT
        FROM PCMOV mov
        JOIN PCPRODUT prod
          ON prod.CODPROD = mov.CODPROD
        LEFT JOIN PCEST est
          ON est.CODPROD = mov.CODPROD
         AND est.CODFILIAL = (SELECT CODFILIAL FROM PARAMS)
        LEFT JOIN PCFORNEC forn
          ON forn.CODFORNEC = prod.CODFORNEC
        LEFT JOIN REPO_ABERTA ra
          ON ra.CODFORNEC = prod.CODFORNEC
         AND ra.CODPROD = prod.CODPROD
        LEFT JOIN PCNFENT nf
          ON nf.NUMTRANSENT = mov.NUMTRANSENT
         AND nf.DTCANCEL IS NULL
        CROSS JOIN PARAMS P
        WHERE P.NUMTRANSENT IS NOT NULL
          AND mov.NUMTRANSENT = P.NUMTRANSENT
          AND nf.DTENT BETWEEN P.DTINI AND P.DTFIM
      )
      ORDER BY ESTOQUE_DISPONIVEL
    `;

    const binds = {
      codFilial,
      codFornec: Number.isFinite(codFornec) ? codFornec : null,
      numTransEnt: Number.isFinite(numTransEnt) ? numTransEnt : null,
      dtIni: dtIniDMY || null,
      dtFim: dtFimDMY || null,
    };

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = result.rows || [];

    let fornecedorNome = null;
    const codFornecResolved =
      Number.isFinite(codFornec) ? codFornec : rows.length ? Number(rows[0]?.CODFORNEC) : null;
    if (Number.isFinite(codFornecResolved)) {
      const rF = await conn.execute(
        `SELECT FORNECEDOR FROM PCFORNEC WHERE CODFORNEC = :codFornec`,
        { codFornec: codFornecResolved },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      fornecedorNome = rF.rows?.[0]?.FORNECEDOR ?? null;
    }

    let transacaoInfo = null;
    if (Number.isFinite(numTransEnt)) {
      const rT = await conn.execute(
        `
          SELECT
            NUMNOTA,
            DTEMISSAO,
            DTENT
          FROM PCNFENT
          WHERE NUMTRANSENT = :numTransEnt
            AND DTCANCEL IS NULL
            AND DTENT BETWEEN TO_DATE(:dtIni, 'DD/MM/YYYY') AND TO_DATE(:dtFim, 'DD/MM/YYYY')
        `,
        { numTransEnt, dtIni: dtIniDMY || null, dtFim: dtFimDMY || null },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const h = rT.rows?.[0] || null;
      transacaoInfo = h
        ? { numNota: h.NUMNOTA ?? null, dtEmissao: h.DTEMISSAO ?? null, dtEnt: h.DTENT ?? null }
        : { numNota: null, dtEmissao: null, dtEnt: null };
    }

    return res.json({
      rows,
      count: rows.length,
      fornecedor: codFornecResolved ? { codFornec: codFornecResolved, fornecedor: fornecedorNome } : null,
      transacaoInfo,
    });
  } catch (err) {
    console.error("Erro ao buscar produtos para reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/reposicao/produtos");

// Endpoint: Reposição - Buscar fornecedor
app.get("/api/gestpro/reposicao/fornecedor", async (req, res) => {
  let conn;
  try {
    const codFornecStr = String((req.query || {}).codFornec ?? (req.query || {}).codfornec ?? "").trim();
    const codFornec = Number(codFornecStr);
    if (!Number.isFinite(codFornec)) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: codFornec" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT CODFORNEC, FORNECEDOR FROM PCFORNEC WHERE CODFORNEC = :codFornec`,
      { codFornec },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const fornecedor = result.rows?.[0] || null;
    if (!fornecedor) {
      return res.status(404).json({ message: "Fornecedor não encontrado" });
    }

    return res.json({ fornecedor });
  } catch (err) {
    console.error("Erro ao buscar fornecedor de reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/reposicao/fornecedor");

// Endpoint: Reposição - Buscar fornecedores por descrição
app.get("/api/gestpro/reposicao/fornecedores", async (req, res) => {
  let conn;
  try {
    const qRaw = String((req.query || {}).q ?? (req.query || {}).descricao ?? "").trim();
    if (!qRaw) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: q" });
    }

    const normalized = qRaw
      .replace(/[%_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: q" });
    }

    const tokens = normalized.split(" ").map((t) => t.trim()).filter(Boolean);
    const descricaoFiltro = `%${tokens.join("%").toUpperCase()}%`;

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `
        SELECT *
        FROM (
          SELECT
            CODFORNEC,
            FORNECEDOR
          FROM PCFORNEC
          WHERE REGEXP_REPLACE(UPPER(TRIM(FORNECEDOR)), '\s+', ' ') LIKE :descricaoFiltro
          ORDER BY FORNECEDOR
        )
        WHERE ROWNUM <= 50
      `,
      { descricaoFiltro },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const rows = result.rows || [];
    return res.json({ rows, count: rows.length, q: normalized });
  } catch (err) {
    console.error("Erro ao buscar fornecedores por descrição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/reposicao/fornecedores");

app.get("/api/gestpro/reposicao/pedidos", async (req, res) => {
  let conn;
  try {
    const codFornecStr = String((req.query || {}).codFornec ?? (req.query || {}).codfornec ?? "").trim();
    const statusStr = String((req.query || {}).status ?? "").trim().toUpperCase();
    const codFornec = codFornecStr ? Number(codFornecStr) : null;
    if (codFornecStr && !Number.isFinite(codFornec)) {
      return res.status(400).json({ message: "Parâmetro inválido: codFornec" });
    }
    if (statusStr && !["ABERTO", "ENCERRADO"].includes(statusStr)) {
      return res.status(400).json({ message: "Parâmetro inválido: status" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const where = [];
    const binds = {};
    if (Number.isFinite(codFornec)) {
      where.push("p.CODFORNEC = :codFornec");
      binds.codFornec = codFornec;
    }
    if (statusStr) {
      where.push("UPPER(TRIM(p.STATUSPEDIDO)) = :status");
      binds.status = statusStr;
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        p.ID,
        p.NUMPEDREPOSICAO,
        p.STATUSPEDIDO,
        p.CODFORNEC,
        f.FORNECEDOR,
        TO_CHAR(p.DATACRIACAO, 'DD/MM/YYYY HH24:MI:SS') AS DATACRIACAO,
        p.USUARIOCRIACAO,
        p.OBSERVACAO,
        NVL(i.QTITENS, 0) AS QTITENS,
        NVL(i.QTTOTAL, 0) AS QTTOTAL
      FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO p
      LEFT JOIN PCFORNEC f
        ON f.CODFORNEC = p.CODFORNEC
      LEFT JOIN (
        SELECT
          IDPEDIDO,
          COUNT(*) AS QTITENS,
          SUM(NVL(QTREPOSICAO, 0)) AS QTTOTAL
        FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO_ITENS
        GROUP BY IDPEDIDO
      ) i
        ON i.IDPEDIDO = p.ID
      ${whereSql}
      ORDER BY p.NUMPEDREPOSICAO DESC
    `;

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao listar pedidos de reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/reposicao/pedidos");

// Endpoint: Reposição - Criar pedido
app.post("/api/gestpro/reposicao/pedidos", async (req, res) => {
  let conn;
  try {
    const body = req.body || {};
    const codFornec = Number(body.codFornec);
    const observacao = String(body.observacao ?? "").trim() || null;
    const usuarioCriacao = String(body.usuarioCriacao ?? "").trim();

    if (!Number.isFinite(codFornec)) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: codFornec" });
    }
    if (!usuarioCriacao) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: usuarioCriacao" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const nextPedidoResult = await conn.execute(
      `SELECT NVL(MAX(NUMPEDREPOSICAO), 0) + 1 AS NUMPEDREPOSICAO FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const numPedReposicao = Number(nextPedidoResult.rows?.[0]?.NUMPEDREPOSICAO ?? 0);

    const insertResult = await conn.execute(
      `
        INSERT INTO MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO (
          NUMPEDREPOSICAO,
          STATUSPEDIDO,
          CODFORNEC,
          USUARIOCRIACAO,
          DATACRIACAO,
          OBSERVACAO
        ) VALUES (
          :numPedReposicao,
          'ABERTO',
          :codFornec,
          :usuarioCriacao,
          SYSDATE,
          :observacao
        )
      `,
      {
        numPedReposicao,
        codFornec,
        usuarioCriacao,
        observacao,
      },
      { autoCommit: true }
    );

    const idResult = await conn.execute(
      `SELECT ID FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO WHERE NUMPEDREPOSICAO = :numPedReposicao`,
      { numPedReposicao },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const idPedido = idResult.rows?.[0]?.ID ?? null;

    return res.status(201).json({
      success: true,
      message: "Pedido de reposicao criado com sucesso",
      idPedido,
      numPedReposicao,
      rowsAffected: insertResult.rowsAffected || 0,
    });
  } catch (err) {
    console.error("Erro ao criar pedido de reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/reposicao/pedidos");

app.post("/api/gestpro/reposicao/pedidos/:idPedido/itens", async (req, res) => {
  let conn;
  try {
    const idPedido = Number(String(req.params?.idPedido ?? "").trim());
    const body = req.body || {};
    const codProd = Number(body.codProd);
    const codFornecBody = body.codFornec != null ? Number(body.codFornec) : null;
    const codAuxiliar = String(body.codAuxiliar ?? "").trim() || null;
    const qtReposicao = Number(body.qtReposicao);
    const usuarioCriacao = String(body.usuarioCriacao ?? "").trim();
    const idInventarioRaw = body.idInventario != null ? Number(body.idInventario) : null;
    const idProdutoRaw = body.idProduto != null
      ? Number(body.idProduto)
      : (body.idCodProduto != null ? Number(body.idCodProduto) : null);
    const idInventario = Number.isFinite(idInventarioRaw) ? idInventarioRaw : null;
    const idProduto = Number.isFinite(idProdutoRaw) ? idProdutoRaw : null;

    if (!Number.isFinite(idPedido)) return res.status(400).json({ message: "Parâmetro inválido: idPedido" });
    if (!Number.isFinite(codProd)) return res.status(400).json({ message: "Parâmetro obrigatório inválido: codProd" });
    if (!Number.isFinite(qtReposicao) || qtReposicao <= 0) return res.status(400).json({ message: "Parâmetro obrigatório inválido: qtReposicao" });
    if (!usuarioCriacao) return res.status(400).json({ message: "Parâmetro obrigatório inválido: usuarioCriacao" });
    if (codFornecBody != null && !Number.isFinite(codFornecBody)) return res.status(400).json({ message: "Parâmetro inválido: codFornec" });

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const pedidoResult = await conn.execute(
      `SELECT ID, CODFORNEC, NUMPEDREPOSICAO FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO WHERE ID = :idPedido`,
      { idPedido },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const pedido = pedidoResult.rows?.[0] || null;
    if (!pedido) return res.status(404).json({ message: "Pedido de reposicao não encontrado" });

    const codFornec = codFornecBody != null ? codFornecBody : (pedido.CODFORNEC != null ? Number(pedido.CODFORNEC) : null);
    if (!Number.isFinite(codFornec)) return res.status(400).json({ message: "Pedido não possui fornecedor e codFornec não foi informado" });
    if (pedido.CODFORNEC != null && Number.isFinite(Number(pedido.CODFORNEC)) && Number(pedido.CODFORNEC) !== Number(codFornec)) {
      return res.status(400).json({ message: "Fornecedor do item não corresponde ao fornecedor do pedido" });
    }

    const insertResult = await conn.execute(
      `
        INSERT INTO MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO_ITENS (
          IDPEDIDO,
          CODPROD,
          CODAUXILIAR,
          CODFORNEC,
          QTREPOSICAO,
          USUARIOCRIACAO,
          DATACRIACAO
        ) VALUES (
          :idPedido,
          :codProd,
          :codAuxiliar,
          :codFornec,
          :qtReposicao,
          :usuarioCriacao,
          SYSDATE
        )
      `,
      { idPedido, codProd, codAuxiliar, codFornec, qtReposicao, usuarioCriacao },
      { autoCommit: false }
    );

    let inventarioRowsAffected = 0;
    if (idInventario != null && idProduto != null) {
      const updateInvResult = await conn.execute(
        `
          UPDATE MULTGESTI_INVENTARIO_AVULSO_PRODUTOS
             SET ADD_PED_REPOS = 'S',
                 ID_PED_REPOS = :idPedido
           WHERE ID_INVENTARIO = :idInventario
             AND ID_PRODUTO = :idProduto
        `,
        { idPedido, idInventario, idProduto },
        { autoCommit: false }
      );
      inventarioRowsAffected = Number(updateInvResult.rowsAffected || 0);
    }

    await conn.commit();

    return res.status(201).json({
      success: true,
      rowsAffected: insertResult.rowsAffected || 0,
      inventarioRowsAffected,
      idPedido,
      numPedReposicao: pedido.NUMPEDREPOSICAO ?? null,
    });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (errRollback) { console.error("Erro ao rollback:", errRollback); }
    }
    console.error("Erro ao adicionar item no pedido de reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/reposicao/pedidos/:idPedido/itens");

app.get("/api/gestpro/reposicao/pedidos/:idPedido/itens", async (req, res) => {
  let conn;
  try {
    const idPedido = Number(String(req.params?.idPedido ?? "").trim());
    if (!Number.isFinite(idPedido)) {
      return res.status(400).json({ message: "Parâmetro inválido: idPedido" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT
        i.ID,
        i.IDPEDIDO,
        i.CODPROD,
        p.DESCRICAO,
        i.CODAUXILIAR,
        i.CODFORNEC,
        i.QTREPOSICAO,
        i.USUARIOCRIACAO,
        TO_CHAR(i.DATACRIACAO, 'DD/MM/YYYY HH24:MI:SS') AS DATACRIACAO
      FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO_ITENS i
      LEFT JOIN PCPRODUT p
        ON p.CODPROD = i.CODPROD
      WHERE i.IDPEDIDO = :idPedido
      ORDER BY i.ID DESC
    `;

    const result = await conn.execute(sql, { idPedido }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao listar itens do pedido de reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota GET /api/gestpro/reposicao/pedidos/:idPedido/itens");

app.post("/api/gestpro/reposicao/pedidos/:idPedido/itens/:idItem/atualizar-qt", async (req, res) => {
  let conn;
  try {
    const idPedido = Number(String(req.params?.idPedido ?? "").trim());
    const idItem = Number(String(req.params?.idItem ?? "").trim());
    if (!Number.isFinite(idPedido)) return res.status(400).json({ message: "Parâmetro inválido: idPedido" });
    if (!Number.isFinite(idItem)) return res.status(400).json({ message: "Parâmetro inválido: idItem" });

    const body = req.body || {};
    const qtReposicao = Number(body.qtReposicao);
    const usuarioAlteracao = String(body.usuarioAlteracao ?? "").trim();
    if (!Number.isFinite(qtReposicao) || qtReposicao <= 0) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: qtReposicao" });
    }
    if (!usuarioAlteracao) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: usuarioAlteracao" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const exists = await conn.execute(
      `SELECT ID FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO_ITENS WHERE ID = :idItem AND IDPEDIDO = :idPedido`,
      { idItem, idPedido },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!exists.rows?.length) {
      return res.status(404).json({ message: "Item não encontrado para este pedido" });
    }

    const result = await conn.execute(
      `UPDATE MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO_ITENS SET QTREPOSICAO = :qtReposicao WHERE ID = :idItem AND IDPEDIDO = :idPedido`,
      { qtReposicao, idItem, idPedido },
      { autoCommit: true }
    );

    return res.json({ success: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("Erro ao atualizar quantidade do item de reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/reposicao/pedidos/:idPedido/itens/:idItem/atualizar-qt");

app.post("/api/gestpro/reposicao/pedidos/:idPedido/itens/:idItem/excluir", async (req, res) => {
  let conn;
  try {
    const idPedido = Number(String(req.params?.idPedido ?? "").trim());
    const idItem = Number(String(req.params?.idItem ?? "").trim());
    if (!Number.isFinite(idPedido)) return res.status(400).json({ message: "Parâmetro inválido: idPedido" });
    if (!Number.isFinite(idItem)) return res.status(400).json({ message: "Parâmetro inválido: idItem" });

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const exists = await conn.execute(
      `SELECT ID FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO_ITENS WHERE ID = :idItem AND IDPEDIDO = :idPedido`,
      { idItem, idPedido },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!exists.rows?.length) {
      return res.status(404).json({ message: "Item não encontrado para este pedido" });
    }

    const result = await conn.execute(
      `DELETE FROM MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO_ITENS WHERE ID = :idItem AND IDPEDIDO = :idPedido`,
      { idItem, idPedido },
      { autoCommit: true }
    );

    return res.json({ success: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("Erro ao excluir item do pedido de reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/reposicao/pedidos/:idPedido/itens/:idItem/excluir");

app.post("/api/gestpro/reposicao/pedidos/:idPedido/encerrar", async (req, res) => {
  let conn;
  try {
    const idPedido = Number(String(req.params?.idPedido ?? "").trim());
    if (!Number.isFinite(idPedido)) {
      return res.status(400).json({ message: "Parâmetro inválido: idPedido" });
    }

    const body = req.body || {};
    const usuarioAlteracao = String(body.usuarioAlteracao ?? "").trim();
    if (!usuarioAlteracao) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: usuarioAlteracao" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `
        UPDATE MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO
           SET STATUSPEDIDO = 'ENCERRADO',
               USUARIOALTERACAO = :usuarioAlteracao,
               DATAALTERACAO = SYSDATE
         WHERE ID = :idPedido
           AND UPPER(TRIM(STATUSPEDIDO)) <> 'ENCERRADO'
      `,
      { idPedido, usuarioAlteracao },
      { autoCommit: true }
    );

    if (!result.rowsAffected) {
      return res.status(404).json({ message: "Pedido não encontrado ou já encerrado" });
    }

    return res.json({ success: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("Erro ao encerrar pedido de reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/reposicao/pedidos/:idPedido/encerrar");

app.post("/api/gestpro/reposicao/pedidos/:idPedido/reabrir", async (req, res) => {
  let conn;
  try {
    const idPedido = Number(String(req.params?.idPedido ?? "").trim());
    if (!Number.isFinite(idPedido)) {
      return res.status(400).json({ message: "Parâmetro inválido: idPedido" });
    }

    const body = req.body || {};
    const usuarioAlteracao = String(body.usuarioAlteracao ?? "").trim();
    if (!usuarioAlteracao) {
      return res.status(400).json({ message: "Parâmetro obrigatório inválido: usuarioAlteracao" });
    }

    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `
        UPDATE MULTGESTI_COMPRAS_PEDIDOS_REPOSICAO
           SET STATUSPEDIDO = 'ABERTO',
               USUARIOALTERACAO = :usuarioAlteracao,
               DATAALTERACAO = SYSDATE
         WHERE ID = :idPedido
           AND UPPER(TRIM(STATUSPEDIDO)) = 'ENCERRADO'
      `,
      { idPedido, usuarioAlteracao },
      { autoCommit: true }
    );

    if (!result.rowsAffected) {
      return res.status(404).json({ message: "Pedido não encontrado ou não está encerrado" });
    }

    return res.json({ success: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("Erro ao reabrir pedido de reposição:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err2) { console.error("Erro ao fechar conexão:", err2); }
    }
  }
});
console.log("[GestPRO] Registrada rota POST /api/gestpro/reposicao/pedidos/:idPedido/reabrir");

// Handler 404 explícito para depuração
app.use((req, res) => {
  console.log(`[GestPRO] 404 para ${req.method} ${req.url}`);
  res.status(404).json({ message: "Rota não encontrada no GestPRO", path: req.url });
});

app.listen(PORT, () => {
  console.log(`Servidor GestPRO rodando na porta ${PORT}`);
  try { logRoutes(); } catch (e) { console.error("Falha ao listar rotas:", e); }
});
