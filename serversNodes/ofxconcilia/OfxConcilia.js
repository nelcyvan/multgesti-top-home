import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import oracledb from "oracledb";

// Carrega o .env
dotenv.config({ path: "/home/multgesti/.env" });

// Inicializa o Oracle Client
oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

const app = express();
const PORT = Number(process.env.OFXCONCILIA_PORT);
if (!PORT) {
  console.error("[OFX-Concilia] Porta não configurada em OFXCONCILIA_PORT");
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function gerarPlaceholders(arr, prefix) {
  return arr.map((_, idx) => `:${prefix}${idx}`).join(", ");
}

app.post("/api/ofxconcilia/gestlog/buscar-pedidos", async (req, res) => {
  const {
    filiais = [],
    tiposEntrega = [],
    filiaisRetira = [],
    dataInicio,
    dataFim,
    posicoesPedido = [],
  } = req.body || {};

  if (!dataInicio || !dataFim) {
    return res.status(400).json({ message: "dataInicio e dataFim são obrigatórios" });
  }
  if (!Array.isArray(filiais) || filiais.length === 0) {
    return res.status(400).json({ message: "filiais é obrigatório e deve conter pelo menos um item" });
  }
  if (!Array.isArray(tiposEntrega) || tiposEntrega.length === 0) {
    return res.status(400).json({ message: "tiposEntrega é obrigatório e deve conter pelo menos um item" });
  }
  if (!Array.isArray(posicoesPedido) || posicoesPedido.length === 0) {
    return res.status(400).json({ message: "posicoesPedido é obrigatório e deve conter pelo menos um item" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // Mantém o formato do frontend: 'YYYY-MM-DD'
    const binds = {
      dataInicio,
      dataFim,
    };

    // Adiciona binds dinâmicos
    filiais.forEach((v, i) => (binds[`fil${i}`] = v));
    tiposEntrega.forEach((v, i) => (binds[`tp${i}`] = v));
    posicoesPedido.forEach((v, i) => (binds[`pos${i}`] = v));
    if (Array.isArray(filiaisRetira) && filiaisRetira.length) {
      filiaisRetira.forEach((v, i) => (binds[`ret${i}`] = v));
    }

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
      WHERE A.CODFILIAL IN (${gerarPlaceholders(filiais, 'fil')}) 
        AND B.TIPOENTREGA IN (${gerarPlaceholders(tiposEntrega, 'tp')}) 
        ${Array.isArray(filiaisRetira) && filiaisRetira.length ? `AND B.CODFILIALRETIRA IN (${gerarPlaceholders(filiaisRetira, 'ret')})` : ''} 
        AND A.DATA BETWEEN TO_DATE(:dataInicio, 'YYYY-MM-DD') AND TO_DATE(:dataFim, 'YYYY-MM-DD') 
        AND I.POSICAO = 'F' 
        AND A.CONDVENDA IN (8) 
        AND A.POSICAO IN (${gerarPlaceholders(posicoesPedido, 'pos')}) 
      ORDER BY B.TIPOENTREGA, A.NUMPED, A.NUMVIASMAPASEP 
    `;

    console.log("binds datas (YYYY-MM-DD):", { dataInicio: binds.dataInicio, dataFim: binds.dataFim });

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    
    res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar pedidos GestLOG:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

async function fetchAllRows(resultSet, batchSize = 500) {
  const rows = [];
  while (true) {
    const batch = await resultSet.getRows(batchSize);
    if (!batch || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < batchSize) break;
  }
  return rows;
}

function normalizeDateInput(value) {
  if (value == null) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const d = new Date(`${t}T00:00:00`);
      return Number.isFinite(d.getTime()) ? d : null;
    }
    const d = new Date(t);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

app.post("/api/ofxconcilia/sangria-lotes/finalizados", async (req, res) => {
  const body = req.body || {};
  const dataInicio = normalizeDateInput(body.dataInicio ?? body.data_inicio ?? body.inicio);
  const dataFim = normalizeDateInput(body.dataFim ?? body.data_fim ?? body.fim);

  if (!dataInicio || !dataFim) {
    return res.status(400).json({ message: "dataInicio e dataFim são obrigatórios (YYYY-MM-DD, ISO 8601 ou timestamp)" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `BEGIN
         GESTLOG_GESTAO_SANGRIA_LOTES(
           :p_id_lote,
           :p_data_hora_sangria,
           :p_codusur_sangria,
           :p_data_hora_ult_atual,
           :p_codusur_ult_atual,
           :consultar_lote,
           :p_result
         );
       END;`,
      {
        p_id_lote: null,
        p_data_hora_sangria: dataInicio,
        p_codusur_sangria: 0,
        p_data_hora_ult_atual: dataFim,
        p_codusur_ult_atual: 0,
        consultar_lote: "consultar_lotes_finalizados",
        p_result: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const resultSet = result.outBinds.p_result;
    try {
      const rows = await fetchAllRows(resultSet);
      return res.json({ rows, count: rows.length });
    } finally {
      await resultSet.close();
    }
  } catch (err) {
    console.error("Erro ao buscar lotes finalizados (sangria):", err);
    const msg = err instanceof Error ? err.message : "Erro interno no servidor";
    return res.status(500).json({ message: msg });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.post("/api/ofxconcilia/carteira/buscar", async (req, res) => {
  const { dataInicio, dataFim } = req.body || {};

  if (!dataInicio || !dataFim) {
    return res.status(400).json({ message: "dataInicio e dataFim são obrigatórios" });
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
        TO_CHAR(A.DTEMISSAO, 'DD/MM/YYYY') AS DTEMISSAO, 
        A.CODCLI, 
        B.CLIENTE, 
        A.NUMPED, 
        A.VALOR, 
        A.CODCOB, 
        A.CODUSUR, 
        C.NOME 
      FROM PCPREST A 
      JOIN PCCLIENT B ON B.CODCLI = A.CODCLI 
      JOIN PCUSUARI C ON C.CODUSUR = A.CODUSUR 
      WHERE A.DTEMISSAO BETWEEN TO_DATE(:dataInicio, 'YYYY-MM-DD') AND TO_DATE(:dataFim, 'YYYY-MM-DD') 
      AND A.DTPAG IS NULL 
      AND A.CODCOB IN ('CTP', 'CTDP', 'CTDI', 'CTD', 'CTC', 'CTB', 'CART', 'C')
    `;

    const binds = { dataInicio, dataFim };

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    
    res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar carteira:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor OFX-Concilia rodando na porta ${PORT}`);
});
