import express from "express";
import cors from "cors";
import oracledb from "oracledb";
import dotenv from "dotenv";

// Carrega variáveis de ambiente
dotenv.config({ path: "/home/multgesti/.env" });

// Inicializa o Oracle Client se informado
if (process.env.ORACLE_CLIENT_LIB) {
  try {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });
  } catch (e) {
    console.warn("Aviso: falha ao inicializar Oracle Client:", e?.message || e);
  }
}

const app = express();
const PORT = Number(process.env.GESTFIN_RECEBER_PORT);
if (!PORT) {
  console.error("[GestFIN Receber] Porta não configurada em GESTFIN_RECEBER_PORT");
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function getConnection() {
  return await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
  });
}

// Utilitários de formatação
function formatCurrencyBR(val) {
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "."));
  if (!Number.isFinite(n)) return String(val ?? "");
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatDateBR(d) {
  if (!d) return null;
  try {
    const date = d instanceof Date ? d : new Date(d);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return null;
  }
}

// Healthcheck
app.get("/api/gestfin/areceber/ping", (req, res) => {
  res.json({ ok: true, service: "gestfin-areceber", ts: new Date().toISOString() });
});

/**
 * Busca lançamentos à receber provenientes do OFX dentro do intervalo de datas.
 * POST /api/gestfin/lancamentos-areceber
 * Body: { dataInicio: 'DD/MM/YYYY', dataFim: 'DD/MM/YYYY' }
 */
app.post("/api/gestfin/lancamentos-areceber", async (req, res) => {
  const dataInicio = String(req.body?.dataInicio || "").trim();
  const dataFim = String(req.body?.dataFim || "").trim();

  if (!dataInicio || !dataFim) {
    return res.status(400).json({ error: "Parâmetros dataInicio e dataFim são obrigatórios (DD/MM/YYYY)" });
  }

  let conn;
  try {
    conn = await getConnection();
    const sql = `
      SELECT 
          A.ID_IMPORTACAO_OFX, 
          A.DATA_TRANSACAO, 
          A.HISTORICO, 
          A.VALOR_TRANSACAO, 
          A.NOME_BANCO_FILIAL, 
          B.DUPLIC, 
          B.PREST, 
          C.CLIENTE, 
          B.DTEMISSAO, 
          B.DTPAG, 
          B.VPAGO 
      FROM 
          MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS A 
      LEFT JOIN 
          PCPREST B ON B.DUPLIC = A.DUPLIC
      AND B.PREST = A.PREST 
      LEFT JOIN 
          PCCLIENT C ON C.CODCLI = B.CODCLI 
      WHERE 
          TRUNC(A.DATA_TRANSACAO) BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') 
          AND TO_DATE(:dataFim, 'DD/MM/YYYY') 
          AND A.MOVIMENTACAO_OFX = 'IN' 
      ORDER BY 
          A.ID_IMPORTACAO_OFX, 
          A.DATA_TRANSACAO ASC,
          A.VALOR_TRANSACAO ASC
          `;

    const result = await conn.execute(sql, { dataInicio, dataFim });
    const rows = (result.rows || []).map((r) => ({
      ID_IMPORTACAO_OFX: r.ID_IMPORTACAO_OFX,
      DATA_TRANSACAO: r.DATA_TRANSACAO instanceof Date ? r.DATA_TRANSACAO.toISOString() : r.DATA_TRANSACAO,
      DATA_TRANSACAO_BR: formatDateBR(r.DATA_TRANSACAO),
      HISTORICO: r.HISTORICO,
      VALOR_TRANSACAO: formatCurrencyBR(r.VALOR_TRANSACAO),
      NOME_BANCO_FILIAL: r.NOME_BANCO_FILIAL,
      DUPLIC: r.DUPLIC,
      PREST: r.PREST,
      CLIENTE: r.CLIENTE,
      DTEMISSAO: formatDateBR(r.DTEMISSAO),
      DTPAG: formatDateBR(r.DTPAG),
      VPAGO: formatCurrencyBR(r.VPAGO),
    }));

    res.json(rows);
  } catch (err) {
    console.error("Erro em /api/gestfin/lancamentos-areceber:", err);
    res.status(500).json({ error: "Falha ao buscar lançamentos à receber" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});

// Utilitário: converte texto pt-BR de moeda para número
function toNumberBR(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const str = String(val).trim();
  const m = str.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}/);
  if (m && m[0]) {
    const numStr = m[0].replace(/\./g, "").replace(/,/g, ".");
    const n = parseFloat(numStr);
    return Number.isNaN(n) ? 0 : n;
  }
  const cleaned = str.replace(/[^\d.,-]/g, "");
  if (cleaned.includes(",")) {
    const br = cleaned.replace(/\./g, "").replace(/,/g, ".");
    const n = parseFloat(br);
    return Number.isNaN(n) ? 0 : n;
  }
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Concilia lançamentos à receber: encontra primeira parcela com OBSTITULO NULL
 * e vincula DUPLIC/PREST ao OFX.
 * POST /api/gestfin/areceber/conciliar
 * Body: { idOfx: number, valor: number|string, data: 'DD/MM/YYYY' }
 */
app.post("/api/gestfin/areceber/conciliar", async (req, res) => {
  const rawValor = req.body?.valor;
  const data = String(req.body?.data || "").trim();
  const idOfx = req.body?.idOfx;

  const valor = Math.abs(toNumberBR(rawValor));
  if (!data || !Number.isFinite(valor) || valor <= 0 || !Number.isFinite(Number(idOfx))) {
    return res.status(400).json({ error: "Parâmetros inválidos: informe idOfx, valor (>0) e data (DD/MM/YYYY)" });
  }

  let conn;
  try {
    conn = await getConnection();

    const plsql = `DECLARE
      v_codcli PCPREST.CODCLI%TYPE;
      v_duplic PCPREST.DUPLIC%TYPE;
      v_prest  PCPREST.PREST%TYPE;
    BEGIN
      SELECT CODCLI, DUPLIC, PREST INTO v_codcli, v_duplic, v_prest
        FROM (
          SELECT CODCLI, DUPLIC, PREST,
                 ROW_NUMBER() OVER (PARTITION BY CODCLI, DUPLIC ORDER BY PREST) AS ordem,
                 MIN(CASE WHEN OBSTITULO IS NULL THEN PREST END) OVER (PARTITION BY CODCLI, DUPLIC) AS primeira_prest_nula
            FROM PCPREST
           WHERE VPAGO = :valor
             AND DTPAG = TO_DATE(:data, 'DD/MM/YYYY')
             AND DTDESD IS NULL
        )
       WHERE PREST = primeira_prest_nula
         AND ROWNUM = 1;

      UPDATE PCPREST
         SET OBSTITULO = ''
       WHERE DUPLIC = v_duplic
         AND PREST = v_prest;

      UPDATE MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS
         SET DUPLIC = v_duplic,
             PREST = v_prest
       WHERE ID_IMPORTACAO_OFX = :idOfx;

      :outDuplic := v_duplic;
      :outPrest  := v_prest;
    END;`;

    const binds = {
      valor,
      data,
      idOfx: Number(idOfx),
      outDuplic: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
      outPrest: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
    };

    const result = await conn.execute(plsql, binds, { autoCommit: false });
    await conn.commit();

    const outDuplic = result.outBinds?.outDuplic ?? null;
    const outPrest = result.outBinds?.outPrest ?? null;
    return res.json({ ok: true, duplic: outDuplic, prest: outPrest });
  } catch (err) {
    console.error("Erro em /api/gestfin/areceber/conciliar:", err);
    if (conn) {
      try { await conn.rollback(); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ error: "Falha ao conciliar à receber" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});
app.listen(PORT, () => {
  console.log(`Servidor Areceber GestFIN ouvindo em http://localhost:${PORT}`);
});