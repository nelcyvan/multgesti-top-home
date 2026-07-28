import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import oracledb from "oracledb";
import gerirRotasRouter from "./apis/roterizacao/gerirRotas/index.js";
import gestlogListarRotasPorDataRouter from "./apis/gestlogListarRotasPorData.js";
import editarRotaExistenteRouter from "./apis/editarRotaExistente.js";
import gerirPedidosEmRotaRouter from "./apis/roterizacao/gerirPedidosEmRota/index.js";
import deletarPedidoDeRotaRouter from "./apis/deletarPedidoDeRota.js";
import novoVeiculoRouter from "./apis/novoVeiculo.js";
import gestaoSangriaLotesRouter from "./apis/gestaoSangriaLotes.js";
import gestaoConfirmacaoEntregasRouter from "./apis/gestaoConfirmacaoEntregas.js";
import gerirMotoristasRouter from "./apis/roterizacao/gerirMotoristas/index.js";
import notasRecentesRouter from "./apis/notasRecentes.js";
import pedidosEntreguesPorDataRouter from "./apis/pedidosEntreguesPorData.js";
import pedidoPorNumpedRouter from "./apis/pedidoPorNumped.js";
import pedidosFotosPorPedidoRouter from "./apis/pedidosFotosPorPedido.js";
import pedidosFotosArquivoRouter from "./apis/pedidosFotosArquivo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://72.60.247.126:8888";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "Topx";

function obterDescricaoStatus(status) {
  const mapa = {
    14: "Pegar Localizacao",
    18: "Localizacao Inserida",
    23: "Pedidos Prioridade",
    24: "Entrega Futura",
    25: "Retira Posterior",
  };
  return mapa[status] || String(status);
}

const app = express();
const PORT = Number(process.env.GESTLOG_PORT);
if (!PORT) {
  console.error("[GestLOG] Porta não configurada em GESTLOG_PORT");
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(gerirRotasRouter);
app.use(gestlogListarRotasPorDataRouter);
app.use(editarRotaExistenteRouter);
app.use(gerirPedidosEmRotaRouter);
app.use(deletarPedidoDeRotaRouter);
app.use(novoVeiculoRouter);
app.use(gestaoSangriaLotesRouter);
app.use(gestaoConfirmacaoEntregasRouter);
app.use(gerirMotoristasRouter);
app.use(notasRecentesRouter);
app.use(pedidosEntreguesPorDataRouter);
app.use(pedidoPorNumpedRouter);
app.use(pedidosFotosPorPedidoRouter);
app.use(pedidosFotosArquivoRouter);

function gerarPlaceholders(arr, prefix) {
  return arr.map((_, idx) => `:${prefix}${idx}`).join(", ");
}

app.post("/api/gestlog/buscar-pedidos", async (req, res) => {
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

// Endpoint: marcar visualização do pedido (status = 1)
app.post("/api/gestlog/atualizar-status", async (req, res) => {
  const { numped, status, usuario, motivoCorte } = req.body || {};
  if (typeof numped !== "number" || !Number.isFinite(numped)) {
    return res.status(400).json({ message: "numped é obrigatório e deve ser numérico" });
  }
  const statusNum = Number(status);
  if (!Number.isFinite(statusNum)) {
    return res.status(400).json({ message: "status é obrigatório e deve ser numérico" });
  }
  const usuarioNome = typeof usuario === "string" && usuario.trim() ? usuario.trim() : "APP";

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const resultUpdate = await conn.execute(
      `UPDATE PCPEDC
         SET LOG1 = CASE 
                      WHEN LOG1 IS NULL OR LOG1 = '' THEN (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                      ELSE LOG1 || ',' || (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                    END,
             ULTIMASITUACAOCFAT = SUBSTR((TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario), 1, 100),
             LOG2 = TO_CHAR(:status)
       WHERE NUMPED = :numped`,
      { status: statusNum, usuario: usuarioNome, numped: Number(numped) },
      { autoCommit: true }
    );

    // Mapa de status especiais
    const MAP_STATUS_ESPECIAL = {
      3: 'STATUS_SEPARADO',
      5: 'STATUS_ROTA',
      13: 'STATUS_CORTE',
      14: 'STATUS_LOCALIZACAO',
      15: 'STATUS_FATURA',
      17: 'STATUS_COLETA',
      20: 'STATUS_ENV_MESSEJANA',
      23: 'STATUS_PRIORIDADE'
    };

    const colEspecial = MAP_STATUS_ESPECIAL[statusNum];
    if (colEspecial) {
      await conn.execute(
        `MERGE INTO MULTGESTI_STATUS_ESPECIAL_PEDIDOS aa
         USING (
             SELECT
                 :numped AS NUMPED,
                 'S'     AS VALOR_ESPECIAL
             FROM dual
         ) bb
         ON (aa.NUMPED = bb.NUMPED)
         WHEN MATCHED THEN
             UPDATE SET
                 aa.${colEspecial} = bb.VALOR_ESPECIAL
         WHEN NOT MATCHED THEN
             INSERT (NUMPED, ${colEspecial})
             VALUES (bb.NUMPED, bb.VALOR_ESPECIAL)`,
        { numped: Number(numped) },
        { autoCommit: true }
      );
    }

    if (statusNum === 13 && motivoCorte && typeof motivoCorte === 'string' && motivoCorte.trim()) {
      await conn.execute(
        `MERGE INTO MULTGESTI_LOGS_PEDIDOS_CORTE aa
         USING (
             SELECT
                 :numped       AS NUMPED,
                 :motivoCorte AS MOTIVO_CORTE
             FROM dual
         ) bb
         ON (aa.NUMPED = bb.NUMPED)
         WHEN MATCHED THEN
             UPDATE SET
                 aa.MOTIVO_CORTE = bb.MOTIVO_CORTE
         WHEN NOT MATCHED THEN
             INSERT (NUMPED, MOTIVO_CORTE)
             VALUES (bb.NUMPED, bb.MOTIVO_CORTE)`,
        { numped: Number(numped), motivoCorte: motivoCorte.trim() },
        { autoCommit: true }
      );
    }

    const resultSelect = await conn.execute(
      `SELECT LOG1 AS STATUS_PEDIDO,
              ULTIMASITUACAOCFAT
         FROM PCPEDC
        WHERE NUMPED = :numped`,
      { numped: Number(numped) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      success: true,
      rowsAffected: resultUpdate?.rowsAffected ?? 0,
      data: (resultSelect.rows && resultSelect.rows[0]) || null,
    });
  } catch (err) {
    console.error("Erro ao atualizar status GestLOG:", err);
    res.status(500).json({ message: "Erro ao atualizar status", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.get("/api/gestlog/separadores", async (_req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });
    const result = await conn.execute(
      `SELECT MATRICULA, NOME FROM PCEMPR WHERE CODSETOR = 24 ORDER BY NOME`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar separadores GestLOG:", err);
    return res.status(500).json({ message: "Erro interno ao buscar separadores", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.post("/api/gestlog/definir-separador", async (req, res) => {
  const { numped, codigoSeparador } = req.body || {};
  if (typeof numped !== "number" || !Number.isFinite(numped)) {
    return res.status(400).json({ message: "numped é obrigatório e deve ser numérico" });
  }
  const codSepNum = Number(codigoSeparador);
  if (!Number.isFinite(codSepNum)) {
    return res.status(400).json({ message: "codigoSeparador é obrigatório e deve ser numérico" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const resultUpdate = await conn.execute(
      `UPDATE PCPEDC SET CODFUNCSEP = :codsep, DTINICIALSEP = SYSDATE WHERE NUMPED = :numped`,
      { codsep: codSepNum, numped: Number(numped) },
      { autoCommit: true }
    );

    return res.json({ success: true, rowsAffected: resultUpdate?.rowsAffected ?? 0 });
  } catch (err) {
    console.error("Erro ao definir separador GestLOG:", err);
    return res.status(500).json({ message: "Erro ao definir separador", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.post("/api/gestlog/atualizar-status-especial", async (req, res) => {
  const { numped, status, usuario, codFuncEmissaoMapa, novaLocalizacao, novoUsuario } = req.body || {};
  if (typeof numped !== "number" || !Number.isFinite(numped)) {
    return res.status(400).json({ message: "numped é obrigatório e deve ser numérico" });
  }
  const statusNum = Number(status);
  if (!Number.isFinite(statusNum) || statusNum < 0 || statusNum > 25) {
    return res.status(400).json({ message: "status é obrigatório, numérico e entre 0 e 25" });
  }
  const usuarioNome = typeof usuario === "string" && usuario.trim() ? usuario.trim() : "APP";

  const codFuncEmissaoMapaNum = Number(codFuncEmissaoMapa);
  const temEmissao = Number.isFinite(codFuncEmissaoMapaNum);

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    let sql = `
      UPDATE PCPEDC
         SET LOG1 = CASE 
                      WHEN LOG1 IS NULL OR LOG1 = '' THEN (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                      ELSE LOG1 || ',' || (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                    END,
             ULTIMASITUACAOCFAT = SUBSTR((TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario), 1, 100),
             LOG2 = TO_CHAR(:status)`;

    const binds = {
      status: statusNum,
      usuario: usuarioNome,
      numped: Number(numped),
    };

    if (temEmissao) {
      sql += `,
             CODFUNCEMISSAOMAPA = :codFuncEmissaoMapa,
             DTEMISSAOMAPA = SYSDATE,
             HORAEMISSAOMAPA = TO_NUMBER(TO_CHAR(SYSDATE, 'HH24')),
             MINUTOEMISSAOMAPA = TO_NUMBER(TO_CHAR(SYSDATE, 'MI')),
             NUMVIASMAPASEP = NVL(NUMVIASMAPASEP, 0) + 1`;
      binds.codFuncEmissaoMapa = codFuncEmissaoMapaNum;
    }

    sql += `
       WHERE NUMPED = :numped`;

    const resultUpdate = await conn.execute(sql, binds, { autoCommit: true });

    // Atualiza status especial (Prioridade, Corte, Separado, etc.)
    const MAP_STATUS_ESPECIAL = {
      3: 'STATUS_SEPARADO',
      5: 'STATUS_ROTA',
      13: 'STATUS_CORTE',
      18: 'STATUS_LOCALIZACAO',
      15: 'STATUS_FATURA',
      17: 'STATUS_COLETA',
      20: 'STATUS_ENV_MESSEJANA',
      23: 'STATUS_PRIORIDADE'
    };

    const colEspecial = MAP_STATUS_ESPECIAL[statusNum];
    if (colEspecial) {
      await conn.execute(
        `MERGE INTO MULTGESTI_STATUS_ESPECIAL_PEDIDOS aa
         USING (
             SELECT
                 :numped AS NUMPED,
                 'S'     AS VALOR_ESPECIAL
             FROM dual
         ) bb
         ON (aa.NUMPED = bb.NUMPED)
         WHEN MATCHED THEN
             UPDATE SET
                 aa.${colEspecial} = bb.VALOR_ESPECIAL
         WHEN NOT MATCHED THEN
             INSERT (NUMPED, ${colEspecial})
             VALUES (bb.NUMPED, bb.VALOR_ESPECIAL)`,
        { numped: Number(numped) },
        { autoCommit: true }
      );
    }

    // Lógica para MULTGESTI_LOGS_PEDIDOS_LOCALIZACAO (Status 14 ou 2)
    if ((statusNum === 14 || statusNum === 2) && novaLocalizacao) {
      // novoUsuario agora deve ser STRING (nome do usuário)
      // Se não vier, usamos usuarioNome como fallback
      let valNovoUsuario = (typeof novoUsuario === 'string' && novoUsuario.trim().length > 0) 
                           ? novoUsuario.trim() 
                           : usuarioNome;
      
      // Garante limite de 40 caracteres conforme banco
      if (valNovoUsuario.length > 40) {
        valNovoUsuario = valNovoUsuario.substring(0, 40);
      }
      
      await conn.execute(
        `MERGE INTO MULTGESTI_LOGS_PEDIDOS_LOCALIZACAO aa
         USING (
             SELECT :numped           AS NUMPED,
                    :novaLocalizacao  AS NOVA_LOCALIZACAO,
                    :novoUsuario      AS NOVO_USUARIO
             FROM dual
         ) src
         ON (aa.NUMPED = src.NUMPED)
         
         -- 🔄 SE JÁ EXISTE → UPDATE
         WHEN MATCHED THEN
             UPDATE SET
                 aa.LOCALIZACAO_ANTERIORES = 
                     NVL(aa.LOCALIZACAO_ANTERIORES, '') || 
                     CASE 
                         WHEN aa.LOCALIZACAO_ATUAL IS NOT NULL 
                         THEN ' | ' || aa.LOCALIZACAO_ATUAL 
                         ELSE '' 
                     END,
         
                 aa.LOCALIZACAO_ATUAL = src.NOVA_LOCALIZACAO,

                 aa.LOG_USUARIOS_ANTERIORES = 
                     NVL(aa.LOG_USUARIOS_ANTERIORES, '') || 
                     CASE 
                         WHEN aa.LOG_ULT_USUARIO_LOCALIZACAO IS NOT NULL 
                         THEN ' | ' || aa.LOG_ULT_USUARIO_LOCALIZACAO 
                         ELSE '' 
                     END,
         
                 aa.LOG_ULT_USUARIO_LOCALIZACAO = src.NOVO_USUARIO
         
         -- 🔄 SE NÃO EXISTE → INSERT
         WHEN NOT MATCHED THEN
             INSERT (
                 NUMPED,
                 LOCALIZACAO_ATUAL,
                 LOCALIZACAO_ANTERIORES,
                 LOG_ULT_USUARIO_LOCALIZACAO,
                 LOG_USUARIOS_ANTERIORES
             )
             VALUES (
                 src.NUMPED,
                 src.NOVA_LOCALIZACAO,
                 NULL,
                 src.NOVO_USUARIO,
                 NULL
             )`,
        {
          numped: Number(numped),
          novaLocalizacao: (statusNum === 14) ? '' : (novaLocalizacao ? novaLocalizacao.toString().substring(0, 100) : ''),
          novoUsuario: valNovoUsuario
        },
        { autoCommit: true }
      );
    }

    const resultSelect = await conn.execute(
      `SELECT LOG1 AS STATUS_PEDIDO,
              ULTIMASITUACAOCFAT
         FROM PCPEDC
        WHERE NUMPED = :numped`,
      { numped: Number(numped) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const numerosEnvio = [];
    try {
      const resultEnvio = await conn.execute(
        `SELECT CODUSUR, STATUS_ENVIO
           FROM MULTGESTI_ENVIO_MENSAGENS_CHATHUB
          WHERE CODUSUR IN (60, 64, 84, 135)
            AND STATUS_ENVIO = 'S'`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (resultEnvio.rows && resultEnvio.rows.length > 0) {
        for (const row of resultEnvio.rows) {
          const cod = Number(row.CODUSUR);
          if (Number.isFinite(cod)) {
            if (cod === 64) {
              numerosEnvio.push("5585991070847");
            } else if (cod === 60) {
              numerosEnvio.push("5585992699937");
            } else if (cod === 84 && statusNum === 18) {
              numerosEnvio.push("5585991127518");
            } else if (cod === 135 && statusNum === 18) {
              numerosEnvio.push("5585991726639");
            }
          }
        }
      }
    } catch (errEnvio) {
      console.error("Erro ao validar envio Evolution GestLOG:", errEnvio);
    }

    const dadosPedido = (resultSelect.rows && resultSelect.rows[0]) || null;

    if (numerosEnvio.length > 0 && (statusNum === 14 || statusNum === 18) && EVOLUTION_API_URL && EVOLUTION_API_KEY) {
      const partesMensagem = [
        "GestLOG - Atualizacao de status especial",
        `Pedido: ${numped}`,
        `Status: ${obterDescricaoStatus(statusNum)}`,
        `Usuario: ${usuarioNome}`,
      ];

      if (dadosPedido && dadosPedido.ULTIMASITUACAOCFAT) {
        const valorBruto = String(dadosPedido.ULTIMASITUACAOCFAT);
        let ultimaSituacaoFormatada = "";
        const partesStatus = valorBruto.split("__");
        if (partesStatus.length >= 2) {
          const codigoStr = partesStatus[0];
          const resto = partesStatus[1];
          const partesData = resto.split("_");
          if (partesData.length >= 1) {
            const dataHora = partesData[0];
            const dataSomente = dataHora.split(" ")[0] || dataHora;
            const codigoNum = Number(codigoStr);
            const descStatus = obterDescricaoStatus(Number.isFinite(codigoNum) ? codigoNum : codigoStr);
            ultimaSituacaoFormatada = `Ultima situacao: ${descStatus},${dataSomente}`;
          }
        }
        if (!ultimaSituacaoFormatada) {
          ultimaSituacaoFormatada = `Ultima situacao: ${valorBruto}`;
        }
        partesMensagem.push(ultimaSituacaoFormatada);
      }

      const texto = partesMensagem.join("\n");

      for (const numero of numerosEnvio) {
        try {
          const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
          const url = `${baseUrl}/message/sendText/${EVOLUTION_INSTANCE}`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: numero,
              text: texto,
            }),
          });

          if (!response.ok) {
            let bodyText = "";
            try {
              bodyText = await response.text();
            } catch (_) {}
            console.error(
              "Falha ao enviar mensagem Evolution GestLOG:",
              response.status,
              bodyText
            );
          }
        } catch (errEnvioHttp) {
          console.error("Erro ao chamar Evolution API GestLOG:", errEnvioHttp);
        }
      }
    }

    res.json({
      success: true,
      rowsAffected: resultUpdate?.rowsAffected ?? 0,
      data: (resultSelect.rows && resultSelect.rows[0]) || null,
    });
  } catch (err) {
    console.error("Erro ao atualizar status especial GestLOG:", err);
    res.status(500).json({ message: "Erro ao atualizar status especial", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

// Endpoint: obter logs de um pedido (OBSENTREGA4, LOG1)
app.get("/api/gestlog/logs/:numped", async (req, res) => {
  const numpedRaw = req.params?.numped;
  const numped = Number(numpedRaw);
  if (!Number.isFinite(numped)) {
    return res.status(400).json({ message: "numped inválido" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });
    const result = await conn.execute(
      `SELECT ULTIMASITUACAOCFAT, LOG1 FROM PCPEDC WHERE NUMPED = :numped`,
      { numped },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Pedido não encontrado" });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao obter logs GestLOG:", err);
    return res.status(500).json({ message: "Erro interno ao obter logs", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.get("/api/gestlog/logs", async (req, res) => {
  const numpedRaw = req.query?.numped;
  const numped = Number(numpedRaw);
  if (!Number.isFinite(numped)) {
    return res.status(400).json({ message: "numped inválido" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });
    const result = await conn.execute(
      `SELECT ULTIMASITUACAOCFAT, LOG1 FROM PCPEDC WHERE NUMPED = :numped`,
      { numped },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Pedido não encontrado" });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao obter logs GestLOG:", err);
    return res.status(500).json({ message: "Erro interno ao obter logs", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

// Endpoint para atualizar cadastro de produto (Embalagem Master e Múltiplo)
app.post("/api/gestlog/atualizar-cadastro", async (req, res) => {
  const { codigoDoProduto, novaEmbalagem, novoMultiplo } = req.body || {};

  // validação básica dos parâmetros
  if (
    typeof codigoDoProduto !== "number" ||
    !Number.isFinite(codigoDoProduto)
  ) {
    return res.status(400).json({ message: "codigoDoProduto é obrigatório e deve ser numérico" });
  }
  if (typeof novaEmbalagem !== "string" || !novaEmbalagem.trim()) {
    return res.status(400).json({ message: "novaEmbalagem é obrigatória" });
  }
  if (
    typeof novoMultiplo !== "number" ||
    !Number.isFinite(novoMultiplo)
  ) {
    return res.status(400).json({ message: "novoMultiplo é obrigatório e deve ser numérico" });
  }
  if (novaEmbalagem.length > 12) {
    return res.status(400).json({ message: "novaEmbalagem deve ter no máximo 12 caracteres" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // Usa binds posicionais para evitar ORA-01036 por nomes
    const bindProdut = [novaEmbalagem.trim(), Number(novoMultiplo), Number(codigoDoProduto)];

    // Atualiza PCPRODUT
    const resultProdut = await conn.execute(
      `UPDATE PCPRODUT A 
       SET A.EMBALAGEMMASTER = :1, 
           A.MULTIPLO = :2 
       WHERE A.CODPROD = :3`,
      bindProdut,
      { autoCommit: false }
    );

    // Atualiza PCPRODFILIAL
    const bindProdfilial = [Number(novoMultiplo), Number(codigoDoProduto)];
    const resultProdfilial = await conn.execute(
      `UPDATE PCPRODFILIAL B 
       SET B.MULTIPLO = :1 
       WHERE B.CODPROD = :2`,
      bindProdfilial,
      { autoCommit: false }
    );

    await conn.commit();

    res.json({
      success: true,
      rowsAffected: {
        produt: resultProdut?.rowsAffected ?? 0,
        prodfilial: resultProdfilial?.rowsAffected ?? 0,
      },
    });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error("Erro ao atualizar cadastro GestLOG:", err);
    res.status(500).json({ message: "Erro ao atualizar cadastro", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});



app.post("/api/gestlog/inventario/adicionar-pendente", async (req, res) => {
  const { 
    codProd, 
    descricao, 
    codAuxiliar, 
    codUsurContagem, 
    nomeUsuarioContagem 
  } = req.body || {};

  if (!codProd) {
      return res.status(400).json({ message: "Dados obrigatórios faltando (codProd)" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // 0. Validação se já existe registro pendente
    const resultCheck = await conn.execute(
      `SELECT 1 AS EXISTS_FLAG 
         FROM MULTGESTI_INVENTARIO_PRODUTOS_PENDENTES 
        WHERE CODPROD = :codProd 
          AND DATA_HORA_PRIMEIRA_TRATATIVA IS NULL`,
      { codProd: Number(codProd) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (resultCheck.rows && resultCheck.rows.length > 0) {
      return res.status(409).json({ message: "O produto já está aguardando inventário." });
    }

    // 1. Obter próximo ID
    const resultId = await conn.execute(
      `SELECT NVL(MAX(ID_PRODUTO), 0) + 1 AS PROXIMO_ID FROM MULTGESTI_INVENTARIO_PRODUTOS_PENDENTES`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const proximoId = resultId.rows[0].PROXIMO_ID;

    // 2. Insert
    const sqlInsert = `
      INSERT INTO MULTGESTI_INVENTARIO_PRODUTOS_PENDENTES (
        ID_PRODUTO, 
        CODPROD, 
        DESCRICAO, 
        CODAUXILIAR, 
        CODUSUR_ENVIO_CONTAGEM, 
        NOME_USUARIO_ENVIO_CONTAGEM
      ) VALUES (
        :idProduto,
        :codProd,
        :descricao,
        :codAuxiliar,
        :codUsur,
        :nomeUsur
      )
    `;

    const resultInsert = await conn.execute(
      sqlInsert,
      {
        idProduto: proximoId,
        codProd: Number(codProd),
        descricao: (descricao || '').substring(0, 40),
        codAuxiliar: codAuxiliar ? Number(codAuxiliar) : null,
        codUsur: codUsurContagem ? Number(codUsurContagem) : null,
        nomeUsur: (nomeUsuarioContagem || '').substring(0, 100)
      },
      { autoCommit: true }
    );

    res.json({ success: true, idProduto: proximoId, rowsAffected: resultInsert.rowsAffected });

  } catch (err) {
    console.error("Erro ao inserir inventário pendente:", err);
    res.status(500).json({ message: "Erro ao inserir inventário pendente", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.post("/api/gestlog/inventario/verificar-pendentes", async (req, res) => {
  const { codProds } = req.body || {};

  if (!Array.isArray(codProds) || codProds.length === 0) {
    return res.json({ pendentes: [] });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const cods = codProds.map(c => Number(c)).filter(n => Number.isFinite(n));
    if (cods.length === 0) return res.json({ pendentes: [] });

    // Gera placeholders :id0, :id1, ...
    const placeholders = cods.map((_, i) => `:id${i}`).join(", ");
    
    const sql = `
      SELECT DISTINCT CODPROD 
        FROM MULTGESTI_INVENTARIO_PRODUTOS_PENDENTES 
       WHERE CODPROD IN (${placeholders}) 
         AND DATA_HORA_PRIMEIRA_TRATATIVA IS NULL
    `;

    const binds = {};
    cods.forEach((c, i) => binds[`id${i}`] = c);

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const pendentes = (result.rows || []).map(r => r.CODPROD);

    res.json({ pendentes });

  } catch (err) {
    console.error("Erro ao verificar inventário pendente:", err);
    res.status(500).json({ message: "Erro ao verificar inventário", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.post("/api/gestlog/atualizar-obs-entrega", async (req, res) => {
  const { numped, obsEntrega3, usuario } = req.body || {};
  if (typeof numped !== "number" || !Number.isFinite(numped)) {
    return res.status(400).json({ message: "numped é obrigatório e deve ser numérico" });
  }

  let finalObs = obsEntrega3;
  try {
    let dados = obsEntrega3;
    if (typeof dados === 'string' && dados.trim().startsWith('{')) {
      dados = JSON.parse(dados);
    }

    if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
      if (dados.address) {
        const parts = [dados.address];
        if (dados.number) parts.push(`N° ${dados.number}`);
        if (dados.complement) parts.push(dados.complement);
        finalObs = parts.join(', ');
      }
    }
  } catch (error) {
    console.warn("Falha ao tentar formatar obsEntrega3, salvando valor original.", error);
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `UPDATE PCPEDC SET LOG3= :enderecoEntregaPorLocalizacao WHERE NUMPED = :numpedTV8`,
      { enderecoEntregaPorLocalizacao: finalObs || '', numpedTV8: numped },
      { autoCommit: true }
    );

    // Lógica para MULTGESTI_LOGS_PEDIDOS_LOCALIZACAO
    if (finalObs) {
      const usuarioNome = typeof usuario === "string" && usuario.trim() ? usuario.trim() : "APP";
      let valNovoUsuario = usuarioNome;
      
      // Garante limite de 40 caracteres conforme banco
      if (valNovoUsuario.length > 40) {
        valNovoUsuario = valNovoUsuario.substring(0, 40);
      }
      
      await conn.execute(
        `MERGE INTO MULTGESTI_LOGS_PEDIDOS_LOCALIZACAO aa
         USING (
             SELECT :numped           AS NUMPED,
                    :novaLocalizacao  AS NOVA_LOCALIZACAO,
                    :novoUsuario      AS NOVO_USUARIO
             FROM dual
         ) src
         ON (aa.NUMPED = src.NUMPED)
         
         -- 🔄 SE JÁ EXISTE → UPDATE
         WHEN MATCHED THEN
             UPDATE SET
                 aa.LOCALIZACAO_ANTERIORES = 
                     NVL(aa.LOCALIZACAO_ANTERIORES, '') || 
                     CASE 
                         WHEN aa.LOCALIZACAO_ATUAL IS NOT NULL 
                         THEN ' | ' || aa.LOCALIZACAO_ATUAL 
                         ELSE '' 
                     END,
         
                 aa.LOCALIZACAO_ATUAL = src.NOVA_LOCALIZACAO,
         
                 aa.LOG_USUARIOS_ANTERIORES = 
                     NVL(aa.LOG_USUARIOS_ANTERIORES, '') || 
                     CASE 
                         WHEN aa.LOG_ULT_USUARIO_LOCALIZACAO IS NOT NULL 
                         THEN ' | ' || aa.LOG_ULT_USUARIO_LOCALIZACAO 
                         ELSE '' 
                     END,
         
                 aa.LOG_ULT_USUARIO_LOCALIZACAO = src.NOVO_USUARIO
         
         -- ➕ SE NÃO EXISTE → INSERT
         WHEN NOT MATCHED THEN
             INSERT (
                 NUMPED,
                 LOCALIZACAO_ATUAL,
                 LOCALIZACAO_ANTERIORES,
                 LOG_ULT_USUARIO_LOCALIZACAO,
                 LOG_USUARIOS_ANTERIORES
             )
             VALUES (
                 src.NUMPED,
                 NULL,
                 NULL,
                 NULL,
                 NULL
             )`,
        {
          numped: Number(numped),
          novaLocalizacao: finalObs.toString().substring(0, 100), // Proteção de tamanho
          novoUsuario: valNovoUsuario
        },
        { autoCommit: true }
      );
    }

    return res.json({ success: true, rowsAffected: result?.rowsAffected ?? 0 });
  } catch (err) {
    console.error("Erro ao atualizar LOG3 GestLOG:", err);
    return res.status(500).json({ message: "Erro ao atualizar LOG3", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.post("/api/gestlog/endereco-cliente", async (req, res) => {
  const { codcliente } = req.body || {};
  if (!codcliente) {
    return res.status(400).json({ message: "codcliente é obrigatório" });
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
         E.ENDERENT AS ENDERENT, 
         E.NUMEROENT AS NUMEROENT, 
         E.BAIRROENT AS BAIRROENT, 
         E.MUNICENT AS MUNICENT, 
         E.CEPENT 
     FROM 
         PCCLIENT E 
    WHERE 
         E.CODCLI = :codcliente
    `;

    const result = await conn.execute(
      sql,
      { codcliente: Number(codcliente) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("Erro ao buscar endereço cliente GestLOG:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.listen(PORT, () => {
  console.log(`Servidor GestLOG rodando na porta ${PORT}`);
});
