import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import oracledb from "oracledb";
import https from "https";
import http from "http";
import createZapHubInstanciasRouter from "./apis/zaphubInstancias.js";
import { createDatabasePool, vincularZapHubInstanceResponsavel } from "./apis/zaphubInstancias.db.js";

dotenv.config({ path: "/home/multgesti/.env" });
oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

const app = express();
const PORT = Number(process.env.EVOLUTION_PORT);
if (!PORT) {
  console.error("[Evolution] Porta não configurada em EVOLUTION_PORT");
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const EV_API_BASE = "http://localhost:8888";
const EV_INSTANCE = process.env.EVOLUTION_INSTANCE || "nelcyvan";
const EV_TARGET_STATUS_PEDIDOS_ID = "120363199240715295"; 

const STATUS_LABELS = {
  0: "Aguardando Visualização",
  1: "Visualizado",
  2: "Separando",
  3: "Separado",
  4: "Aguardando rota",
  5: "Incluído em rota",
  6: "Saindo em rota",
  7: "Entregue",
  8: "Retornou",
  9: "Entrega em dia Específico",
  10: "Aguardando Fornecedor",
  11: "Entrega Fracionada",
  12: "Entrega em horário Específico",
  13: "Corte",
  14: "Pegar Localização",
  15: "Faturar",
  16: "Separação Cancelada",
  17: "Coleta",
  18: "Localização Inserida",
  19: "Coleta Separada",
  20: "Enviar p/ Messejana",
  21: "Coleta Separando",
  22: "Corte Realizado",
  23: "Pedidos Prioridade",
  24: "Entrega Futura",
  25: "Retira Posterior",
};

const nativeFetch = globalThis.fetch;
const databasePool = createDatabasePool(process.env.DATABASE_URL);

async function fetchCompat(url, opts) {
  if (typeof nativeFetch === "function") return nativeFetch(url, opts);
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      u,
      {
        method: (opts && opts.method) || "GET",
        headers: (opts && opts.headers) || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: async () => body,
            json: async () => JSON.parse(body),
          });
        });
      }
    );
    req.on("error", reject);
    if (opts && opts.body) {
      const b = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
      req.write(b);
    }
    req.end();
  });
}

app.use(createZapHubInstanciasRouter({ fetchCompat }));

app.post("/api/zaphub/permissao", async (req, res) => {
  const codigoUsuarioRaw = req.body?.codigoUsuario;
  const codigoUsuario = Number(codigoUsuarioRaw);
  if (!Number.isFinite(codigoUsuario)) {
    return res.status(400).json({ message: "codigoUsuario é obrigatório" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT PERMISSAO_TELA_ZAPHUB FROM MULTGESTI_PERMISSOES WHERE CODUSUR = :codUsuario`,
      { codUsuario: codigoUsuario },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Permissões não encontradas" });
    }

    const permitido = String(result.rows[0].PERMISSAO_TELA_ZAPHUB || "N").toUpperCase() === "S";

    if (!permitido) {
      return res.status(403).json({ permitido: false, message: "Usuário sem permissão para ZapHub" });
    }

    return res.json({ permitido: true, message: "Permissão validada com sucesso para ZapHub" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno no servidor";
    return res.status(500).json({ message });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {}
    }
  }
});

app.get("/api/zaphub/usuarios", async (req, res) => {
  const q = String(req.query?.q ?? "").trim();
  const limit = Math.max(1, Math.min(80, Number(req.query?.limit ?? 30) || 30));

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const binds = { limit };
    let where = `WHERE MOTIVOINATIVACAO IS NULL`;
    if (q) {
      binds.qLike = `%${q.toUpperCase()}%`;
      binds.qMatLike = `%${q}%`;
      where += ` AND (UPPER(NOME) LIKE :qLike OR TO_CHAR(MATRICULA) LIKE :qMatLike OR UPPER(AREAATUACAO) LIKE :qLike OR UPPER(FUNCAO) LIKE :qLike)`;
    }

    const sql = `
      SELECT *
      FROM (
        SELECT
          MATRICULA,
          NOME,
          AREAATUACAO,
          FUNCAO
        FROM PCEMPR
        ${where}
        ORDER BY MATRICULA
      )
      WHERE ROWNUM <= :limit
    `;

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const rows = (result.rows || []).map((row) => ({
      matricula: row.MATRICULA,
      nome: row.NOME,
      areaAtuacao: row.AREAATUACAO || null,
      funcao: row.FUNCAO || null,
    }));
    return res.json({ rows, count: rows.length });
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    console.error("Erro ao pesquisar usuários do ZapHub:", err);
    return res.status(500).json({ message: "Erro interno ao pesquisar usuários", detalhe });
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

app.put("/api/zaphub/instancias/responsavel/oracle", async (req, res) => {
  const instanceName = String(req.body?.instanceName || "").trim();
  const matricula = String(req.body?.matricula || "").trim();

  if (!instanceName) return res.status(400).json({ message: "instanceName é obrigatório" });
  if (!matricula) return res.status(400).json({ message: "matricula é obrigatória" });

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `
        SELECT
          MATRICULA,
          NOME,
          AREAATUACAO,
          FUNCAO
        FROM PCEMPR
        WHERE MOTIVOINATIVACAO IS NULL
          AND MATRICULA = :matricula
      `,
      { matricula },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const usuario = (result.rows || [])[0];
    if (!usuario) {
      return res.status(404).json({ message: "Usuário não encontrado ou inativo" });
    }

    const row = await vincularZapHubInstanceResponsavel({
      databasePool,
      instanceName,
      matricula: String(usuario.MATRICULA || "").trim(),
      nome: String(usuario.NOME || "").trim() || null,
      areaAtuacao: String(usuario.AREAATUACAO || "").trim() || null,
      funcao: String(usuario.FUNCAO || "").trim() || null,
    });

    return res.json({ ok: true, row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno ao vincular responsável";
    return res.status(500).json({ message });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {}
    }
  }
});

async function enviarCabecalhoGeral(targetId) {
  try {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: '2-digit', minute: '2-digit' });
    const lines = [];
    lines.push(`*Topx IA - ${timeStr}*`);
    lines.push(`*Topx IA - Mensagem Automatica*`);
    
    const finalMsg = lines.join("\n");
    const target = targetId.includes("@") ? targetId : `${targetId}@g.us`;

    const send = await fetchCompat(`${EV_API_BASE}/message/sendText/${EV_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY || "" },
      body: JSON.stringify({ number: target, text: finalMsg }),
    });
    
    const respText = await send.text();
    return { ok: send.ok, status: send.status, response: respText, message: finalMsg };
  } catch (err) {
    console.error("Erro ao enviar cabeçalho geral:", err);
    return { ok: false, error: err.message };
  }
}

async function enviarRelatorioStatusPedidos(targetId) {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql1 = `
      SELECT LOG2
      FROM PCPEDC
      WHERE LOG2 IS NULL
        AND CODFILIAL IN (1)
        AND CONDVENDA = 8
        AND POSICAO IN ('M', 'P', 'L')
        AND DATA BETWEEN TRUNC(SYSDATE, 'YYYY') AND TRUNC(SYSDATE)
        AND NUMPEDENTFUT IN (
          SELECT NUMPED
          FROM PCPEDC
          WHERE POSICAO = 'F'
        )
    `;
    const sql2 = `
      SELECT LOG2
      FROM PCPEDC
      WHERE LOG2 IS NOT NULL
        AND CODFILIAL IN (1)
        AND POSICAO IN ('M', 'P', 'L')
        AND CONDVENDA = 8
        AND DATA BETWEEN TRUNC(SYSDATE, 'YYYY') AND TRUNC(SYSDATE)
        AND NUMPED NOT IN (
          SELECT NUMPEDENTFUT
          FROM PCPEDC
          WHERE POSICAO = 'F'
            AND NUMPEDENTFUT IS NOT NULL
        )
      ORDER BY LOG2 ASC
    `;

    const result1 = await conn.execute(sql1, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const result2 = await conn.execute(sql2, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });

    const counts = {};

    const addRowsToCounts = (rows) => {
      rows.forEach((row) => {
        let code = 0;
        const raw = row.LOG2;
        if (typeof raw === "number") code = raw;
        else if (typeof raw === "string") {
          const s = raw.trim();
          if (s.includes("__")) {
            code = parseInt(s.split("__")[0], 10);
          } else {
            code = parseInt(s, 10);
          }
        }
        if (!Number.isFinite(code)) code = 0;
        counts[code] = (counts[code] || 0) + 1;
      });
    };

    addRowsToCounts(result1.rows || []);
    addRowsToCounts(result2.rows || []);

    const lines = [];
    // Cabeçalho da mensagem de pedidos
    lines.push(`*Status Pedidos:*`);

    const sortedKeys = Object.keys(counts)
      .map(Number)
      .sort((a, b) => a - b);

    let totalGeral = 0;

    for (const code of sortedKeys) {
      const label = STATUS_LABELS[code] || `Status ${code}`;
      const qtd = counts[code];
      totalGeral += qtd;
      lines.push(`• ${label}: ${qtd}`);
    }

    lines.push("");
    lines.push(`Total: ${totalGeral}`);

    const finalMsg = lines.join("\n");

    const target = targetId.includes("@") ? targetId : `${targetId}@g.us`;

    const send = await fetchCompat(`${EV_API_BASE}/message/sendText/${EV_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY || "" },
      body: JSON.stringify({ number: target, text: finalMsg }),
    });

    const respText = await send.text();
    return { ok: send.ok, status: send.status, response: respText, message: finalMsg };
  } catch (err) {
    console.error("Erro ao enviar relatorio status:", err);
    return { ok: false, error: err.message };
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {}
    }
  }
}

async function enviarRelatorioColetas(targetId) {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT p.NUMPED, p.LOG2 FROM PCPEDC p 
      WHERE EXISTS ( 
        SELECT 1 FROM PCPEDC x 
        WHERE x.LOG2 IN ('17', '19', '21') 
        AND x.POSICAO IN ('M', 'P', 'L') 
        AND x.NUMPED = p.NUMPED 
      )
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (!result.rows || result.rows.length === 0) {
      console.log("[RelatorioColetas] Nenhum pedido de coleta encontrado.");
      return { ok: true, message: "Nenhum dado para enviar." };
    }

    const lines = [];
    lines.push(`*Status Coletas:*`);

    const STATUS_MAP = {
      17: "Para Coleta",
      19: "Coleta Separada",
      21: "Separando Coleta"
    };

    const counts = {};
    result.rows.forEach((row) => {
      const statusDesc = STATUS_MAP[row.LOG2] || row.LOG2;
      counts[statusDesc] = (counts[statusDesc] || 0) + 1;
    });

    Object.entries(counts).forEach(([status, count]) => {
      lines.push(`• ${status}: ${count}`);
    });

    const finalMsg = lines.join("\n");

    const target = targetId.includes("@") ? targetId : `${targetId}@g.us`;

    const send = await fetchCompat(`${EV_API_BASE}/message/sendText/${EV_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY || "" },
      body: JSON.stringify({ number: target, text: finalMsg }),
    });

    const respText = await send.text();
    return { ok: send.ok, status: send.status, response: respText, message: finalMsg };
  } catch (err) {
    console.error("Erro ao enviar relatorio coletas:", err);
    return { ok: false, error: err.message };
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {}
    }
  }
}

async function enviarRelatorioFaturamento111(targetId) {
  try {
    const gestproPort = process.env.GESTPRO_PORT || "7004";
    const url = `http://localhost:${gestproPort}/api/gestpro/faturamento-111`;

    const resp = await fetchCompat(url);
    if (!resp.ok) {
      throw new Error(`Erro ao consumir GestPRO: ${resp.status}`);
    }
    const data = await resp.json();

    const formatMoney = (val) => {
      return (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    const lines = [];
    lines.push(`*Faturamento 111*`);

    // Diario
    const diario = (data.diario && data.diario[0]) || {};
    lines.push(`*Diário:*`);
    lines.push(`• Venda: ${formatMoney(diario.VLVENDA)}`);
    lines.push(`• Meta: ${formatMoney(diario.VLMETA)}`);
    lines.push(`• Ticket Médio: ${formatMoney(data.ticketMedio)}`);
    lines.push(`• Dev: ${formatMoney(diario.VLDEVOLUCAO)}`);
    lines.push(`• Notas Faturadas: ${data.qtdNotas || 0}`);
    
    lines.push(""); // Nova linha visual

    // Mensal
    const mensal = (data.mensal && data.mensal[0]) || {};
    lines.push(`*Mensal:*`);
    lines.push(`• Venda Líquida: ${formatMoney(mensal.VLVENDA)}`);
    lines.push(`• Meta: ${formatMoney(mensal.VLMETA)}`);
    lines.push(`• Dev: ${formatMoney(mensal.VLDEVOLUCAO)}`);

    const finalMsg = lines.join("\n");

    const target = targetId.includes("@") ? targetId : `${targetId}@g.us`;

    const send = await fetchCompat(`${EV_API_BASE}/message/sendText/${EV_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY || "" },
      body: JSON.stringify({ number: target, text: finalMsg }),
    });

    const respText = await send.text();
    return { ok: send.ok, status: send.status, response: respText, message: finalMsg };

  } catch (err) {
    console.error("Erro ao enviar relatorio faturamento 111:", err);
    return { ok: false, error: err.message };
  }
}

async function enviarRelatorioAuditoria(targetId, dataISO) {
  try {
    const gestlogPort = process.env.NEW_APP_GESTLOG_PORT || "7010";
    const dataRef =
      dataISO || new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const url = `http://localhost:${gestlogPort}/apis/gestpro/auditoria/resumo-dia?data=${encodeURIComponent(dataRef)}`;

    const resp = await fetchCompat(url);
    if (!resp.ok) {
      throw new Error(`Erro ao consumir resumo de auditoria: ${resp.status}`);
    }
    const data = await resp.json();
    const resumo = data.resumo || {};
    const pendencias = data.pendencias || {};

    const resumirNome = (nome) => {
      const limpo = String(nome || "Sem usuário").trim();
      if (!limpo) return "Sem usuário";
      return limpo.split(/\s+/)[0];
    };

    const lines = [];
    lines.push(`*Auditoria - ${data.dataFormatada || dataRef}*`);
    lines.push(`• ${resumo.qtAuditorias || 0} aud.`);
    lines.push(`• ${resumo.qtProdutos || 0} prod.`);
    lines.push(`• ${resumo.qtDivergencias || 0} div.`);

    lines.push("");
    lines.push(`*Status:*`);
    lines.push(`• ${resumo.qtAberta || 0} abertas`);
    lines.push(`• ${resumo.qtEmAndamento || 0} em andamento`);
    lines.push(`• ${resumo.qtFinalizada || 0} finalizadas`);
    lines.push(`• ${resumo.qtCancelada || 0} canceladas`);

    const porUsuario = Array.isArray(data.porUsuario) ? data.porUsuario : [];
    if (porUsuario.length > 0) {
      lines.push("");
      lines.push(`*Usuários:*`);
      porUsuario.forEach((row) => {
        lines.push(`• ${resumirNome(row.NOME_USUARIO)}: ${row.QT_PRODUTOS || 0} prod.`);
        lines.push(`  ${row.QT_DIVERGENCIAS || 0} div.`);
      });
    }

    const porSetor = (Array.isArray(data.porSetor) ? data.porSetor : []).filter(
      (row) => Number(row.QT_PRODUTOS || 0) > 0
    );
    if (porSetor.length > 0) {
      lines.push("");
      lines.push(`*Setores:*`);
      porSetor.forEach((row) => {
        lines.push(`• ${row.SETOR || "-"}`);
        lines.push(`  ${row.QT_PRODUTOS || 0} prod. / ${row.QT_DIVERGENCIAS || 0} div.`);
      });
    }

    const tiposDiv = [
      Number(pendencias.qtPrecoDivergente || 0) > 0 ? `preço: ${pendencias.qtPrecoDivergente}` : null,
      Number(pendencias.qtBarrasErrado || 0) > 0 ? `barras: ${pendencias.qtBarrasErrado}` : null,
      Number(pendencias.qtCodInternoErrado || 0) > 0 ? `cód: ${pendencias.qtCodInternoErrado}` : null,
      Number(pendencias.qtUnMedidaErrado || 0) > 0 ? `un: ${pendencias.qtUnMedidaErrado}` : null,
      Number(pendencias.qtSemEtiqueta || 0) > 0 ? `sem etiq: ${pendencias.qtSemEtiqueta}` : null,
    ].filter(Boolean);

    if (tiposDiv.length > 0) {
      lines.push("");
      lines.push(`*Pendências:*`);
      tiposDiv.forEach((item) => {
        lines.push(`• Div ${item}`);
      });
    }

    const finalMsg = lines.join("\n");
    const target = targetId.includes("@") ? targetId : `${targetId}@g.us`;

    const send = await fetchCompat(`${EV_API_BASE}/message/sendText/${EV_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY || "" },
      body: JSON.stringify({ number: target, text: finalMsg }),
    });

    const respText = await send.text();
    return { ok: send.ok, status: send.status, response: respText, message: finalMsg };
  } catch (err) {
    console.error("Erro ao enviar relatorio auditoria:", err);
    return { ok: false, error: err.message };
  }
}

async function enviarRelatorioCompletoSequencial(targetId) {
  console.log(`[RelatorioCompleto] Iniciando envio sequencial para ${targetId}`);
  
  // 1. Cabeçalho Geral
  const r1 = await enviarCabecalhoGeral(targetId);
  console.log(`[RelatorioCompleto] Cabecalho: ok=${r1.ok} status=${r1.status}`);

  // 2. Status Pedidos
  const r2 = await enviarRelatorioStatusPedidos(targetId);
  console.log(`[RelatorioCompleto] StatusPedidos: ok=${r2.ok} status=${r2.status}`);

  // 3. Faturamento 111
  const r3 = await enviarRelatorioFaturamento111(targetId);
  console.log(`[RelatorioCompleto] Faturamento111: ok=${r3.ok} status=${r3.status}`);

  // 4. Status Coletas
  const r4 = await enviarRelatorioColetas(targetId);
  console.log(`[RelatorioCompleto] Coletas: ok=${r4.ok} status=${r4.status}`);

  // 5. Auditoria de Produtos
  const r5 = await enviarRelatorioAuditoria(targetId);
  console.log(`[RelatorioCompleto] Auditoria: ok=${r5.ok} status=${r5.status}`);

  console.log(`[RelatorioCompleto] Envio sequencial concluído.`);
  return { cabecalho: r1, statusPedidos: r2, faturamento111: r3, coletas: r4, auditoria: r5 };
}

function msUntilNextRunGeral() {
  const now = new Date();
  const spTimeStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const nowSP = new Date(spTimeStr);

  const times = [
    [19, 30],
  ];

  for (let i = 0; i < times.length; i++) {
    const d = new Date(nowSP);
    d.setHours(times[i][0], times[i][1], 0, 0);
    if (d.getTime() > nowSP.getTime()) return d.getTime() - nowSP.getTime();
  }

  const next = new Date(nowSP);
  next.setDate(nowSP.getDate() + 1);
  next.setHours(times[0][0], times[0][1], 0, 0);
  return next.getTime() - nowSP.getTime();
}

function scheduleEnviarRelatorioGeral() {
  const delay = msUntilNextRunGeral();
  console.log(
    `[RelatorioGeral] Próximo envio automático agendado para daqui a ${Math.round(delay / 1000 / 60)} minutos.`
  );
  setTimeout(async () => {
    try {
      console.log("[RelatorioGeral] Iniciando envio automático...");
      await enviarRelatorioCompletoSequencial(EV_TARGET_STATUS_PEDIDOS_ID);
    } catch (err) {
      console.error("[RelatorioGeral] Erro no envio automático:", err);
    }
    scheduleEnviarRelatorioGeral();
  }, delay);
}

// Mantendo agendamento de coletas APENAS para os outros targets (removendo o target principal)
function msUntilNextRunColetas() {
  const now = new Date();
  const spTimeStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  const nowSP = new Date(spTimeStr);

  const times = [
    [19, 30],
  ];

  for (let i = 0; i < times.length; i++) {
    const d = new Date(nowSP);
    d.setHours(times[i][0], times[i][1], 0, 0);
    if (d.getTime() > nowSP.getTime()) return d.getTime() - nowSP.getTime();
  }

  const next = new Date(nowSP);
  next.setDate(nowSP.getDate() + 1);
  next.setHours(times[0][0], times[0][1], 0, 0);
  return next.getTime() - nowSP.getTime();
}

function scheduleEnviarRelatorioColetas() {
  const delay = msUntilNextRunColetas();
  console.log(
    `[RelatorioColetas] Proximo envio automatico agendado para daqui a ${Math.round(delay / 1000 / 60)} minutos.`
  );
  setTimeout(async () => {
    try {
      console.log("[RelatorioColetas] Iniciando envio automatico para outros targets...");
      // Remove o target principal para não duplicar, pois ele recebe via RelatorioGeral
      const targets = ["5585991070847", "5585992699937"]; 
      for (const t of targets) {
        await enviarRelatorioColetas(t);
      }
    } catch (err) {
      console.error("[RelatorioColetas] Erro no envio automatico:", err);
    }
    scheduleEnviarRelatorioColetas();
  }, delay);
}

scheduleEnviarRelatorioGeral();
scheduleEnviarRelatorioColetas();

/* Agendamentos antigos desativados em favor do RelatorioGeral
// scheduleEnviarFaturamento111();
// scheduleEnviarStatusPedidos();
*/

app.post("/api/evolution/disparo-status-pedidos", async (req, res) => {
  const target = req.body?.target || EV_TARGET_STATUS_PEDIDOS_ID;
  const r = await enviarRelatorioStatusPedidos(target);
  res.json(r);
});

app.post("/api/evolution/disparo-coletas", async (req, res) => {
  const target = req.body?.target || EV_TARGET_STATUS_PEDIDOS_ID;
  const r = await enviarRelatorioColetas(target);
  res.json(r);
});

app.post("/api/evolution/disparo-faturamento-111", async (req, res) => {
  const target = req.body?.target || EV_TARGET_STATUS_PEDIDOS_ID;
  const r = await enviarRelatorioFaturamento111(target);
  res.json(r);
});

app.post("/api/evolution/disparo-auditoria", async (req, res) => {
  const target = req.body?.target || EV_TARGET_STATUS_PEDIDOS_ID;
  const data = req.body?.data || null;
  const r = await enviarRelatorioAuditoria(target, data);
  res.json(r);
});

app.post("/api/evolution/disparo-geral", async (req, res) => {
  const target = req.body?.target || EV_TARGET_STATUS_PEDIDOS_ID;
  const r = await enviarRelatorioCompletoSequencial(target);
  const ok = Boolean(
    r?.cabecalho?.ok &&
      r?.statusPedidos?.ok &&
      r?.faturamento111?.ok &&
      r?.coletas?.ok &&
      r?.auditoria?.ok
  );
  res.status(ok ? 200 : 502).json({ ok, target, ...r });
});

app.post("/api/evolution/disparo-teste", async (req, res) => {
  try {
    const target = req.body?.target || EV_TARGET_STATUS_PEDIDOS_ID;
    const r = await enviarRelatorioCompletoSequencial(target);
    const ok = Boolean(
      r?.cabecalho?.ok &&
        r?.statusPedidos?.ok &&
        r?.faturamento111?.ok &&
        r?.coletas?.ok &&
        r?.auditoria?.ok
    );
    res.status(ok ? 200 : 502).json({ ok, target, ...r });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor Evolution rodando na porta ${PORT}`);
});
