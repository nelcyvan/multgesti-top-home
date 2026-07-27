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
const PORT = Number(process.env.GESTFIN_PORT);
if (!PORT) {
  console.error("[GestFIN] Porta não configurada em GESTFIN_PORT");
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

// Healthcheck
app.get("/api/gestfin/ping", (req, res) => {
  res.json({ ok: true, service: "gestfin", ts: new Date().toISOString() });
});

// Busca contas por nome ou código
app.get("/api/gestfin/busca-contas", async (req, res) => {
  const nomeConta = String((req.query?.nomeConta ?? "").toString()).trim().toUpperCase();
  const codigoConta = String((req.query?.codigoConta ?? "").toString()).trim();

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT CODCONTA, CONTA 
         FROM PCCONTA 
        WHERE (UPPER(CONTA) LIKE '%' || :nomeConta || '%') 
           OR (TO_CHAR(CODCONTA) LIKE '%' || :codigoConta || '%') 
        ORDER BY CONTA ASC`,
      { nomeConta, codigoConta }
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error("Erro em /api/gestfin/busca-contas:", err);
    res.status(500).json({ error: "Falha ao buscar contas" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Adiantamento: executa bloco PL/SQL inserindo em TOPHC.PCLANC, atualizando OFX e marcando HISTORICO2
// POST /api/gestfin/adiantamento
app.post("/api/gestfin/adiantamento", async (req, res) => {
  const body = req.body || {};

  const required = [
    "recnum",
    "codConta",
    "historico",
    "duplic",
    "valor",
    "dtVencBind",
    "dtLancBind",
    "dtCompetenciaBind",
    "dtEmissaoBind",
    "codFilial",
    "indice",
    "tipoLanc",
    "tipoParceiro",
    "moeda",
    "nfServicoBind",
    "codRotinaCad",
    "codRotinaAlt",
    "parcela",
    "utilizouRateioConta",
    "prcRateioUtilizado",
    "idImportacaoOFX",
    "codusurBind",
  ];

  const missing = required.filter((k) => !(k in body));
  if (missing.length) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes", missing });
  }

  const rawNfServico = String(body.nfServicoBind ?? "N").trim().toUpperCase();
  const isSemNota = rawNfServico === "SN" || rawNfServico === "0";
  const nfServicoBind = rawNfServico === "S" ? "S" : "N";
  const numNotaBind = isSemNota ? 0 : Number(body.numNotaBind ?? 0);

  const idOfxNumCheck = Number(body.idImportacaoOFX);
  const codusurNumCheck = Number(body.codusurBind);
  if (!Number.isFinite(idOfxNumCheck) || idOfxNumCheck <= 0)
    return res.status(400).json({ error: "ID_IMPORTACAO_OFX inválido" });
  if (!Number.isFinite(codusurNumCheck) || codusurNumCheck <= 0)
    return res.status(400).json({ error: "CODUSUR_VINCULACAO inválido" });

  // Binds principais
  const baseBinds = {
    recnum: Number(body.recnum || 0),
    codConta: Number(body.codConta),
    codFornec: body.codFornec == null ? null : Number(body.codFornec),
    historico: String(body.historico ?? ""),
    duplic: String(body.duplic ?? ""),
    valor: Number(body.valor ?? 0),
    dtVencBind: String(body.dtVencBind),
    dtLancBind: String(body.dtLancBind),
    dtCompetenciaBind: String(body.dtCompetenciaBind),
    dtEmissaoBind: String(body.dtEmissaoBind),
    codFilial: Number(body.codFilial),
    indice: String(body.indice ?? "A"),
    tipoLanc: String(body.tipoLanc ?? ""),
    tipoParceiro: String(body.tipoParceiro ?? ""),
    nomeFunc: String(body.nomeFunc ?? ""),
    historico2: String(body.historico2 ?? ""),
    moeda: String(body.moeda ?? "R"),
    recNumPrinc: body.recNumPrinc == null ? null : Number(body.recNumPrinc),
    nfServicoBind,
    numNotaBind,
    codRotinaCad: String(body.codRotinaCad ?? "MULTGEST"),
    codRotinaAlt: String(body.codRotinaAlt ?? "MULTGEST"),
    parcela: Number(body.parcela ?? 1),
    vlrUtilizadoAdiantFornec: Number(body.vlrUtilizadoAdiantFornec ?? 0),
    lacreDigConecSocial: body.lacreDigConecSocial ?? null,
    tiposervico: body.tiposervico ?? null,
    opcaoPagamentoIpva: body.opcaoPagamentoIpva ?? null,
    utilizouRateioConta: String(body.utilizouRateioConta ?? "N"),
    prcRateioUtilizado: Number(body.prcRateioUtilizado ?? 0),
    reinFEventor4040: body.reinFEventor4040 ?? null,
  };

  // Binds específicos para o parcial
  const parcialBinds = {
    idOfx: idOfxNumCheck,
    recnum: baseBinds.recnum,
    codUsurVinculacao: codusurNumCheck,
    valor: baseBinds.valor,
    historico: baseBinds.historico,
    fornecedor: body.fornecedor ?? null,
    numNota: numNotaBind,
    juros: Number(body.juros ?? 0),
  };

  // Para update simples
  const updateBinds = { recnum: baseBinds.recnum };

  let conn;
  try {
    conn = await getConnection();

    const sqlInsertPclanc = `
      INSERT INTO TOPHC.PCLANC (
          RECNUM, ADIANTAMENTO, CODCONTA, CODFORNEC, HISTORICO, DUPLIC, VALOR,
          DTVENC, DTLANC, DTCOMPETENCIA, DTEMISSAO, CODFILIAL, INDICE, TIPOLANC,
          TIPOPARCEIRO, NOMEFUNC, HISTORICO2, MOEDA, RECNUMPRINC, NFSERVICO, NUMNOTA,
          CODROTINACAD, CODROTINAALT, PARCELA, VLRUTILIZADOADIANTFORNEC, LACREDIGCONECSOCIAL,
          TIPOSERVICO, OPCAOPAGAMENTOIPVA, UTILIZOURATEIOCONTA, PRCRATEIOUTILIZADO, REINFEVENTOR4040
        )
      VALUES (
          :recnum, 'S', :codConta, :codFornec, :historico, :duplic, :valor,
          TO_DATE(:dtVencBind,'DD/MM/YYYY'), TO_DATE(:dtLancBind,'DD/MM/YYYY'),
          TO_DATE(:dtCompetenciaBind,'DD/MM/YYYY'), TO_DATE(:dtEmissaoBind,'DD/MM/YYYY'),
          :codFilial, :indice, :tipoLanc, :tipoParceiro, :nomeFunc, :historico2,
          :moeda, :recNumPrinc, :nfServicoBind, :numNotaBind,
          :codRotinaCad, :codRotinaAlt, :parcela, :vlrUtilizadoAdiantFornec,
          :lacreDigConecSocial, :tiposervico, :opcaoPagamentoIpva,
          :utilizouRateioConta, :prcRateioUtilizado, :reinFEventor4040
      )`;

    const sqlInsertParcial = `
      INSERT INTO MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS (
        ID_IMPORTACAO_OFX, RECNUM, CODUSUR_VINCULACAO, VALOR,
        HISTORICO, FORNECEDOR, NUMNOTA, JUROS
      ) VALUES (
        :idOfx, :recnum, :codUsurVinculacao, :valor,
        :historico, :fornecedor, :numNota, :juros
      )`;

    const sqlUpdateHistorico = `
      UPDATE PCLANC
         SET HISTORICO2 = 'C1'
       WHERE RECNUM = :recnum`;

    // Execuções com logs mais detalhados
    console.log("🟢 Executando INSERT PCLANC:", baseBinds);
    await conn.execute(sqlInsertPclanc, baseBinds, { autoCommit: false });

    console.log("🟢 Executando INSERT PARCIAL:", parcialBinds);
    await conn.execute(sqlInsertParcial, parcialBinds, { autoCommit: false });

    console.log("🟢 Executando UPDATE:", updateBinds);
    await conn.execute(sqlUpdateHistorico, updateBinds, { autoCommit: false });

    await conn.commit();

    res.json({ ok: true, recnum: baseBinds.recnum });
  } catch (err) {
    console.error("❌ Erro em /api/gestfin/adiantamento:", err);
    if (conn) try { await conn.rollback(); } catch {}
    res.status(500).json({ error: "Falha ao salvar adiantamento", details: err.message });
  } finally {
    if (conn) try { await conn.close(); } catch {}
  }
});


// Conciliação de Transação Cancelada
// Insere em TOPHC.PCLANC com ADIANTAMENTO = NULL, atualiza OFX e marca HISTORICO2
// POST /api/gestfin/conciliar-cancelado
app.post("/api/gestfin/conciliar-cancelado", async (req, res) => {
  const body = req.body || {};

  // Parâmetros necessários (seguindo o padrão de adiantamento)
  const required = [
    // recnum é opcional: se não vier, geramos abaixo
    "codConta",
    "historico",
    "duplic",
    "valor",
    "dtVencBind",
    "dtLancBind",
    "dtCompetenciaBind",
    "dtEmissaoBind",
    "codFilial",
    "indice",
    "tipoLanc",
    "tipoParceiro",
    "moeda",
    "nfServicoBind",
    "codRotinaCad",
    "codRotinaAlt",
    "parcela",
    "utilizouRateioConta",
    "prcRateioUtilizado",
  ];

  const missing = required.filter((k) => !(k in body));
  if (missing.length) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes", missing });
  }

  // Normalização de NF de serviço: tratar 'SN' e '0' como Sem Nota
  const rawNfServico = String(body.nfServicoBind ?? "N").trim().toUpperCase();
  const isSemNota = rawNfServico === "SN" || rawNfServico === "0";
  const nfServicoBind = rawNfServico === "S" ? "S" : "N";
  const numNotaBind = isSemNota ? 0 : (body.numNotaBind == null ? 0 : Number(body.numNotaBind));

  let conn;
  try {
    conn = await getConnection();

    // Se recnum não vier, gerar próximo disponível
    let recnum = Number(body.recnum || 0);
    if (!Number.isFinite(recnum) || recnum <= 0) {
      const r = await conn.execute(`SELECT NVL(MAX(RECNUM), 0) + 1 AS NEXT_RECNUM FROM TOPHC.PCLANC`);
      const row = (r.rows || [])[0] || {};
      recnum = Number(row.NEXT_RECNUM ?? row.next_recnum ?? 1);
    }

    const binds = {
      recnum,
      codConta: Number(body.codConta),
      codFornec: body.codFornec == null ? null : Number(body.codFornec),
      historico: String(body.historico ?? ""),
      duplic: String(body.duplic ?? ""),
      valor: Number(body.valor ?? 0),
      dtVencBind: String(body.dtVencBind),
      dtLancBind: String(body.dtLancBind),
      dtCompetenciaBind: String(body.dtCompetenciaBind),
      dtEmissaoBind: String(body.dtEmissaoBind),
      codFilial: Number(body.codFilial),
      indice: String(body.indice ?? "A"),
      tipoLanc: String(body.tipoLanc ?? ""),
      tipoParceiro: String(body.tipoParceiro ?? ""),
      nomeFunc: String(body.nomeFunc ?? ""),
      historico2: String(body.historico2 ?? "C1"),
      moeda: String(body.moeda ?? "R"),
      recNumPrinc: body.recNumPrinc == null ? null : Number(body.recNumPrinc),
      nfServicoBind,
      numNotaBind,
      codRotinaCad: String(body.codRotinaCad ?? "MULTGEST"),
      codRotinaAlt: String(body.codRotinaAlt ?? "MULTGEST"),
      parcela: Number(body.parcela ?? 1),
      vlrUtilizadoAdiantFornec: Number(body.vlrUtilizadoAdiantFornec ?? 0),
      lacreDigConecSocial: body.lacreDigConecSocial == null ? null : String(body.lacreDigConecSocial),
      tiposervico: body.tiposervico == null ? null : String(body.tiposervico),
      opcaoPagamentoIpva: body.opcaoPagamentoIpva == null ? null : String(body.opcaoPagamentoIpva),
      utilizouRateioConta: String(body.utilizouRateioConta ?? "N"),
      prcRateioUtilizado: Number(body.prcRateioUtilizado ?? 0),
      reinFEventor4040: body.reinFEventor4040 == null ? null : String(body.reinFEventor4040),
      codusur: body.codusurBind == null ? null : Number(body.codusurBind),
      idOfx: body.idImportacaoOFX == null ? null : Number(body.idImportacaoOFX),
    };

    const plsql = `BEGIN
      INSERT INTO TOPHC.PCLANC (
          RECNUM, ADIANTAMENTO, CODCONTA, CODFORNEC, HISTORICO, DUPLIC, VALOR, DTVENC, DTLANC, DTCOMPETENCIA, DTEMISSAO, CODFILIAL, INDICE, TIPOLANC,
          TIPOPARCEIRO, NOMEFUNC, HISTORICO2, MOEDA, RECNUMPRINC, NFSERVICO, NUMNOTA, CODROTINACAD, CODROTINAALT,
          PARCELA, VLRUTILIZADOADIANTFORNEC, LACREDIGCONECSOCIAL, TIPOSERVICO, OPCAOPAGAMENTOIPVA,
          UTILIZOURATEIOCONTA, PRCRATEIOUTILIZADO, REINFEVENTOR4040
        ) VALUES (
          :recnum, NULL, :codConta, :codFornec, :historico, :duplic, :valor,
          TO_DATE(:dtVencBind, 'DD/MM/YYYY'), TO_DATE(:dtLancBind, 'DD/MM/YYYY'), TO_DATE(:dtCompetenciaBind, 'DD/MM/YYYY'), TO_DATE(:dtEmissaoBind, 'DD/MM/YYYY'),
          :codFilial, :indice, :tipoLanc, :tipoParceiro, :nomeFunc, :historico2, :moeda, :recNumPrinc, :nfServicoBind, :numNotaBind,
          :codRotinaCad, :codRotinaAlt, :parcela, :vlrUtilizadoAdiantFornec, :lacreDigConecSocial, :tiposervico, :opcaoPagamentoIpva,
          :utilizouRateioConta, :prcRateioUtilizado, :reinFEventor4040
        );

      UPDATE MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS
         SET DATA_VINCULACAO = SYSDATE,
             CODUSUR_VINCULACAO = :codusur,
             RECNUM = :recnum
       WHERE ID_IMPORTACAO_OFX = :idOfx;

      UPDATE PCLANC
         SET HISTORICO2 = :historico2
       WHERE RECNUM = :recnum;
    END;`;

    await conn.execute(plsql, binds, { autoCommit: false });
    await conn.commit();

    return res.json({ ok: true, recnum: binds.recnum });
  } catch (err) {
    console.error("Erro em /api/gestfin/conciliar-cancelado:", err);
    if (conn) { try { await conn.rollback(); } catch (e) { /* ignore */ } }
    res.status(500).json({
      error: "Falha ao conciliar transação cancelada",
      message: err?.message || String(err),
      code: err?.errorNum || undefined,
    });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Conciliação de Transação por Estorno
// Insere em TOPHC.PCLANC com ADIANTAMENTO = NULL, atualiza OFX e marca HISTORICO2
// Mantém o valor da transação (não zera), histórico vindo do frontend
// POST /api/gestfin/conciliar-estorno
app.post("/api/gestfin/conciliar-estorno", async (req, res) => {
  const body = req.body || {};

  // Parâmetros necessários (seguindo o padrão do cancelado/adiantamento)
  const required = [
    // recnum é opcional: se não vier, geramos abaixo
    "codConta",
    "historico",
    "duplic",
    "valor",
    "dtVencBind",
    "dtLancBind",
    "dtCompetenciaBind",
    "dtEmissaoBind",
    "codFilial",
    "indice",
    "tipoLanc",
    "tipoParceiro",
    "moeda",
    "nfServicoBind",
    "codRotinaCad",
    "codRotinaAlt",
    "parcela",
    "utilizouRateioConta",
    "prcRateioUtilizado",
  ];

  const missing = required.filter((k) => !(k in body));
  if (missing.length) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes", missing });
  }

  // Normalização de NF de serviço: tratar 'SN' e '0' como Sem Nota
  const rawNfServico = String(body.nfServicoBind ?? "N").trim().toUpperCase();
  const isSemNota = rawNfServico === "SN" || rawNfServico === "0";
  const nfServicoBind = rawNfServico === "S" ? "S" : "N";
  const numNotaBind = isSemNota ? 0 : (body.numNotaBind == null ? 0 : Number(body.numNotaBind));

  let conn;
  try {
    conn = await getConnection();

    // Se recnum não vier, gerar próximo disponível
    let recnum = Number(body.recnum || 0);
    if (!Number.isFinite(recnum) || recnum <= 0) {
      const r = await conn.execute(`SELECT NVL(MAX(RECNUM), 0) + 1 AS NEXT_RECNUM FROM TOPHC.PCLANC`);
      const row = (r.rows || [])[0] || {};
      recnum = Number(row.NEXT_RECNUM ?? row.next_recnum ?? 1);
    }

    const binds = {
      recnum,
      codConta: Number(body.codConta),
      codFornec: body.codFornec == null ? null : Number(body.codFornec),
      historico: String(body.historico ?? ""),
      duplic: String(body.duplic ?? ""),
      valor: Number(body.valor ?? 0),
      dtVencBind: String(body.dtVencBind),
      dtLancBind: String(body.dtLancBind),
      dtCompetenciaBind: String(body.dtCompetenciaBind),
      dtEmissaoBind: String(body.dtEmissaoBind),
      codFilial: Number(body.codFilial),
      indice: String(body.indice ?? "A"),
      tipoLanc: String(body.tipoLanc ?? ""),
      tipoParceiro: String(body.tipoParceiro ?? ""),
      nomeFunc: String(body.nomeFunc ?? ""),
      historico2: String(body.historico2 ?? "C1"),
      moeda: String(body.moeda ?? "R"),
      recNumPrinc: body.recNumPrinc == null ? null : Number(body.recNumPrinc),
      nfServicoBind,
      numNotaBind,
      codRotinaCad: String(body.codRotinaCad ?? "MULTGEST"),
      codRotinaAlt: String(body.codRotinaAlt ?? "MULTGEST"),
      parcela: Number(body.parcela ?? 1),
      vlrUtilizadoAdiantFornec: Number(body.vlrUtilizadoAdiantFornec ?? 0),
      lacreDigConecSocial: body.lacreDigConecSocial == null ? null : String(body.lacreDigConecSocial),
      tiposervico: body.tiposervico == null ? null : String(body.tiposervico),
      opcaoPagamentoIpva: body.opcaoPagamentoIpva == null ? null : String(body.opcaoPagamentoIpva),
      utilizouRateioConta: String(body.utilizouRateioConta ?? "N"),
      prcRateioUtilizado: Number(body.prcRateioUtilizado ?? 0),
      reinFEventor4040: body.reinFEventor4040 == null ? null : String(body.reinFEventor4040),
      codusur: body.codusurBind == null ? null : Number(body.codusurBind),
      idOfx: body.idImportacaoOFX == null ? null : Number(body.idImportacaoOFX),
    };

    const plsql = `BEGIN
      INSERT INTO TOPHC.PCLANC (
          RECNUM, ADIANTAMENTO, CODCONTA, CODFORNEC, HISTORICO, DUPLIC, VALOR, DTVENC, DTLANC, DTCOMPETENCIA, DTEMISSAO, CODFILIAL, INDICE, TIPOLANC,
          TIPOPARCEIRO, NOMEFUNC, HISTORICO2, MOEDA, RECNUMPRINC, NFSERVICO, NUMNOTA, CODROTINACAD, CODROTINAALT,
          PARCELA, VLRUTILIZADOADIANTFORNEC, LACREDIGCONECSOCIAL, TIPOSERVICO, OPCAOPAGAMENTOIPVA,
          UTILIZOURATEIOCONTA, PRCRATEIOUTILIZADO, REINFEVENTOR4040
        ) VALUES (
          :recnum, NULL, :codConta, :codFornec, :historico, :duplic, :valor,
          TO_DATE(:dtVencBind, 'DD/MM/YYYY'), TO_DATE(:dtLancBind, 'DD/MM/YYYY'), TO_DATE(:dtCompetenciaBind, 'DD/MM/YYYY'), TO_DATE(:dtEmissaoBind, 'DD/MM/YYYY'),
          :codFilial, :indice, :tipoLanc, :tipoParceiro, :nomeFunc, :historico2, :moeda, :recNumPrinc, :nfServicoBind, :numNotaBind,
          :codRotinaCad, :codRotinaAlt, :parcela, :vlrUtilizadoAdiantFornec, :lacreDigConecSocial, :tiposervico, :opcaoPagamentoIpva,
          :utilizouRateioConta, :prcRateioUtilizado, :reinFEventor4040
        );

      UPDATE MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS
         SET DATA_VINCULACAO = SYSDATE,
             CODUSUR_VINCULACAO = :codusur,
             RECNUM = :recnum
       WHERE ID_IMPORTACAO_OFX = :idOfx;

      UPDATE PCLANC
         SET HISTORICO2 = :historico2
       WHERE RECNUM = :recnum;
    END;`;

    await conn.execute(plsql, binds, { autoCommit: false });
    await conn.commit();

    return res.json({ ok: true, recnum: binds.recnum });
  } catch (err) {
    console.error("Erro em /api/gestfin/conciliar-estorno:", err);
    if (conn) { try { await conn.rollback(); } catch (e) { /* ignore */ } }
    res.status(500).json({
      error: "Falha ao conciliar transação por estorno",
      message: err?.message || String(err),
      code: err?.errorNum || undefined,
    });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Buscar último CODCONTA
app.get("/api/gestfin/ultimo-codconta", async (_req, res) => {
  let conn;
  try {
    conn = await getConnection();
    // Retorna o próximo código disponível (MAX + 1), tratando caso sem registros
    const sql = `SELECT NVL(MAX(CODCONTA), 0) + 1 AS PROXIMO_CODCONTA FROM PCCONTA`;
    const result = await conn.execute(sql, {});
    const row = (result.rows || [])[0] || {};
    const proximo = Number(row.PROXIMO_CODCONTA ?? row.proximo_codconta ?? 1);
    res.json({ ultimoCodConta: proximo });
  } catch (err) {
    console.error("Erro em /api/gestfin/ultimo-codconta:", err);
    res.status(500).json({ error: "Falha ao buscar próximo CODCONTA" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Listar grupos de contas
app.get("/api/gestfin/grupos-conta", async (_req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const sql = `SELECT CODGRUPO, GRUPO FROM PCGRUPO ORDER BY GRUPO`;
    const result = await conn.execute(sql, {});
    res.json(result.rows || []);
  } catch (err) {
    console.error("Erro em /api/gestfin/grupos-conta:", err);
    res.status(500).json({ error: "Falha ao listar grupos de contas" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Busca fornecedores por nome ou código
app.get("/api/gestfin/busca-fornecedores", async (req, res) => {
  const nomeFornecedor = String((req.query?.nomeFornecedor ?? "").toString()).trim().toUpperCase();
  const codigoFornecedor = String((req.query?.codigoFornecedor ?? "").toString()).trim();

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT CODFORNEC, FORNECEDOR 
         FROM PCFORNEC 
        WHERE (UPPER(FORNECEDOR) LIKE '%' || :nomeFornecedor || '%') 
           OR (TO_CHAR(CODFORNEC) LIKE '%' || :codigoFornecedor || '%') 
        ORDER BY FORNECEDOR ASC`,
      { nomeFornecedor, codigoFornecedor }
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error("Erro em /api/gestfin/busca-fornecedores:", err);
    res.status(500).json({ error: "Falha ao buscar fornecedores" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Conciliação Carteira Cliente
app.post("/api/gestfin/carteira-cliente", async (req, res) => {
  const { codigoCliente, dataInicio, dataFinal, codigoFilial } = req.body || {};

  if (codigoCliente == null || !dataInicio || !dataFinal || codigoFilial == null) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      required: ["codigoCliente", "dataInicio", "dataFinal", "codigoFilial"],
    });
  }

  let conn;
  try {
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT 
            TO_CHAR(a.DTEMISSAO, 'DD/MM/YYYY') AS DTEMISSAO, 
            TO_CHAR(a.DTPAG, 'DD/MM/YYYY') AS DTPAGTO, 
            a.CODCLI, 
            c.CLIENTE, 
            a.DUPLIC, 
            a.PREST, 
            a.VALOR, 
            a.CODUSUR, 
            b.NOME, 
            a.CODCOB, 
            d.COBRANCA, 
            a.CODFILIAL 
       FROM 
            PCPREST a 
       JOIN PCUSUARI b 
         ON b.CODUSUR = a.CODUSUR 
       JOIN PCCLIENT c 
         ON c.CODCLI = a.CODCLI 
       JOIN PCCOB d 
         ON d.CODCOB = a.CODCOB 
      WHERE 
            a.CODCLI = :codigoCliente 
        AND a.CODCOB <> 'DESD' 
        AND a.DTCANCEL IS NULL 
        AND a.DTPAG BETWEEN TO_DATE(:dataInicio, 'YYYY-MM-DD') 
        AND TO_DATE(:dataFinal, 'YYYY-MM-DD') 
        AND a.DTESTORNO IS NULL 
        AND a.CODFILIAL = :codigoFilial 
   ORDER BY 
            a.DTPAG, a.VALOR ASC`,
      {
        codigoCliente: Number(codigoCliente),
        dataInicio: String(dataInicio),
        dataFinal: String(dataFinal),
        codigoFilial: Number(codigoFilial),
      }
    );

    res.json(result.rows || []);
  } catch (err) {
    console.error("Erro em /api/gestfin/carteira-cliente:", err);
    res.status(500).json({ error: "Falha ao consultar carteira do cliente" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});

// Busca usuário por código
app.get("/api/gestfin/usuario/:codusur", async (req, res) => {
  const { codusur } = req.params || {};

  if (codusur == null) {
    return res.status(400).json({ error: "Parâmetro codusur é obrigatório" });
  }

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT CODUSUR, NOME FROM PCUSUARI WHERE CODUSUR = :codusur`,
      { codusur: Number(codusur) }
    );

    const rows = result.rows || [];
    if (!rows.length) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Retorna apenas o primeiro encontrado
    return res.json(rows[0]);
  } catch (err) {
    console.error("Erro em /api/gestfin/usuario/:codusur", err);
    res.status(500).json({ error: "Falha ao consultar usuário" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});

// Atualiza CODUSUR em PCPREST
app.post("/api/gestfin/vincular-usuario", async (req, res) => {
  const { CODUSUR_BIND, DUPLIC_BIND, PREST_BIND, CODFILIAL_BIND, CODCLI_BIND } = req.body || {};

  if (
    CODUSUR_BIND == null ||
    !DUPLIC_BIND ||
    PREST_BIND == null ||
    CODFILIAL_BIND == null ||
    CODCLI_BIND == null
  ) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      required: ["CODUSUR_BIND", "DUPLIC_BIND", "PREST_BIND", "CODFILIAL_BIND", "CODCLI_BIND"],
    });
  }

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `UPDATE PCPREST a
         SET a.CODUSUR = :CODUSUR_BIND
       WHERE a.DUPLIC = :DUPLIC_BIND
         AND a.PREST = :PREST_BIND
         AND a.CODFILIAL = :CODFILIAL_BIND
         AND a.CODCLI = :CODCLI_BIND`,
      {
        CODUSUR_BIND: Number(CODUSUR_BIND),
        DUPLIC_BIND: String(DUPLIC_BIND),
        PREST_BIND: Number(PREST_BIND),
        CODFILIAL_BIND: Number(CODFILIAL_BIND),
        CODCLI_BIND: Number(CODCLI_BIND),
      },
      { autoCommit: true }
    );

    return res.json({ rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("Erro em /api/gestfin/vincular-usuario", err);
    res.status(500).json({ error: "Falha ao atualizar usuário na prestação" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});

// Atualizar juros (TXPERM) em PCLANC por RECNUM
// POST /api/gestfin/atualizar-juros
app.post("/api/gestfin/atualizar-juros", async (req, res) => {
  const { recnum, juros } = req.body || {};

  // Validação básica de parâmetros
  if (recnum == null || juros == null) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      required: ["recnum", "juros"],
    });
  }

  const recnumNum = Number(recnum);
  const jurosNum = Number(juros);

  if (!Number.isFinite(recnumNum) || recnumNum <= 0) {
    return res.status(400).json({ error: "RECNUM inválido" });
  }
  if (!Number.isFinite(jurosNum)) {
    return res.status(400).json({ error: "Valor de juros inválido" });
  }
  // Normaliza para 2 casas decimais
  const jurosRounded = Math.round(jurosNum * 100) / 100;

  let conn;
  try {
    conn = await getConnection();
    const sql = `UPDATE PCLANC SET TXPERM = :juros WHERE RECNUM = :recnum`;
    const binds = { juros: jurosRounded, recnum: recnumNum };
    const result = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("Erro em /api/gestfin/atualizar-juros:", err);
    return res.status(500).json({ error: "Falha ao atualizar juros" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Atualizar desconto (DESCONTOFIN) em PCLANC por RECNUM
// POST /api/gestfin/atualizar-desconto
app.post("/api/gestfin/atualizar-desconto", async (req, res) => {
  const { recnum, desconto } = req.body || {};

  // Validação básica de parâmetros
  if (recnum == null || desconto == null) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      required: ["recnum", "desconto"],
    });
  }

  const recnumNum = Number(recnum);
  const descontoNum = Number(desconto);

  if (!Number.isFinite(recnumNum) || recnumNum <= 0) {
    return res.status(400).json({ error: "RECNUM inválido" });
  }
  if (!Number.isFinite(descontoNum) || descontoNum < 0) {
    return res.status(400).json({ error: "Valor de desconto inválido" });
  }
  // Normaliza para 2 casas decimais
  const descontoRounded = Math.round(descontoNum * 100) / 100;

  let conn;
  try {
    conn = await getConnection();
    const sql = `UPDATE PCLANC SET DESCONTOFIN = :desconto WHERE RECNUM = :recnum`;
    const binds = { desconto: descontoRounded, recnum: recnumNum };
    const result = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("Erro em /api/gestfin/atualizar-desconto:", err);
    return res.status(500).json({ error: "Falha ao atualizar desconto" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Confirmar conciliação: vincula OFX ao lançamento e marca histórico
// POST /api/gestfin/confirmar-conciliacao
app.post("/api/gestfin/confirmar-conciliacao", async (req, res) => {
  const { codusurBind, recnumBind, idOfxBind } = req.body || {};

  // Validação de presença
  if (codusurBind == null || recnumBind == null || idOfxBind == null) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      required: ["codusurBind", "recnumBind", "idOfxBind"],
    });
  }

  // Normalização/validação de tipos
  const codusur = Number(codusurBind);
  const recnum = Number(recnumBind);
  const idOfx = Number(idOfxBind);

  if (!Number.isFinite(codusur) || codusur <= 0) {
    return res.status(400).json({ error: "CODUSUR inválido" });
  }
  if (!Number.isFinite(recnum) || recnum <= 0) {
    return res.status(400).json({ error: "RECNUM inválido" });
  }
  if (!Number.isFinite(idOfx) || idOfx <= 0) {
    return res.status(400).json({ error: "ID_IMPORTACAO_OFX inválido" });
  }

  let conn;
  try {
    conn = await getConnection();

    // 1) Atualiza vinculação na tabela de OFX
    const sqlVincularOfx = `
      UPDATE MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS
         SET DATA_VINCULACAO = SYSDATE,
             CODUSUR_VINCULACAO = :codusur,
             RECNUM = :recnum
       WHERE ID_IMPORTACAO_OFX = :idOfx`;

    const bindsOfx = { codusur, recnum, idOfx };
    const r1 = await conn.execute(sqlVincularOfx, bindsOfx, { autoCommit: false });

    // 2) Atualiza PCLANC para marcar histórico
    const sqlMarcarHistorico = `
      UPDATE PCLANC
         SET HISTORICO2 = 'C1'
       WHERE RECNUM = :recnum`;

    const r2 = await conn.execute(sqlMarcarHistorico, { recnum }, { autoCommit: false });

    await conn.commit();
    return res.json({ ok: true, rowsAffectedOfx: r1.rowsAffected || 0, rowsAffectedPclanc: r2.rowsAffected || 0 });
  } catch (err) {
    console.error("Erro em /api/gestfin/confirmar-conciliacao:", err);
    if (conn) { try { await conn.rollback(); } catch (e) { /* ignore */ } }
    return res.status(500).json({ error: "Falha ao confirmar conciliação" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Lançamentos à Pagar (OFX Saída)
app.post("/api/gestfin/lancamentos-apagar", async (req, res) => {
  const { dataInicio, dataFim } = req.body || {};

  // Validação de presença e formato (DD/MM/YYYY)
  if (!dataInicio || !dataFim) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      required: ["dataInicio", "dataFim"],
    });
  }

  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!dateRegex.test(String(dataInicio)) || !dateRegex.test(String(dataFim))) {
    return res.status(400).json({
      error: "Formato de data inválido. Use DD/MM/YYYY",
      example: { dataInicio: "01/01/2024", dataFim: "31/01/2024" },
    });
  }

  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT 
     A.ID_IMPORTACAO_OFX, 
     A.DATA_TRANSACAO, 
     A.HISTORICO, 
     TO_CHAR(A.VALOR_TRANSACAO, 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS = '',.''') AS VALOR_TRANSACAO, 
     A.NOME_BANCO_FILIAL, 

     CASE 
         WHEN B.RECNUM IS NOT NULL THEN 
             CASE WHEN B.NFSERVICO = 'S' THEN 'Sim' ELSE 'Não' END 
         ELSE ( 
             SELECT LISTAGG( 
                 CASE WHEN B_PARCIAL.NFSERVICO = 'S' THEN 'Sim' ELSE 'Não' END, 
                 ' , ' 
             ) WITHIN GROUP (ORDER BY D_PARCIAIS.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             LEFT JOIN PCLANC B_PARCIAL ON B_PARCIAL.RECNUM = D_PARCIAIS.RECNUM 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS NFSERVICO_STATUS, 

     CASE 
         WHEN B.RECNUM IS NOT NULL THEN TO_CHAR(B.RECNUM) 
         ELSE ( 
             SELECT LISTAGG(D_PARCIAIS.RECNUM, ' , ') 
             WITHIN GROUP (ORDER BY D_PARCIAIS.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS RECNUM_PRINCIPAL_OU_PARCIAIS, 

     B.CODFORNEC, 
     TO_CHAR(B.DTPAGTO, 'DD/MM/YYYY') AS DTPAGTO, 

     CASE 
         WHEN B.RECNUM IS NOT NULL THEN 
             TO_CHAR(NVL(B.DESCONTOFIN, 0), 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS = '',.''') 
         ELSE ( 
             SELECT LISTAGG( 
                 TO_CHAR(NVL(B_PARCIAL.DESCONTOFIN, 0), 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS = '',.'''), 
                 ' , ' 
             ) WITHIN GROUP (ORDER BY D_PARCIAIS.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             LEFT JOIN PCLANC B_PARCIAL ON B_PARCIAL.RECNUM = D_PARCIAIS.RECNUM 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS DESCONTOFIN, 

     CASE 
         WHEN B.RECNUM IS NOT NULL THEN 
             CASE WHEN (B.NUMNOTA = 0 OR B.NUMNOTA IS NULL) THEN 'Sem Nota' ELSE TO_CHAR(B.NUMNOTA) END 
         ELSE ( 
             SELECT LISTAGG(NVL(TO_CHAR(D_PARCIAIS.NUMNOTA), 'Sem Nota'), ' , ') 
             WITHIN GROUP (ORDER BY D_PARCIAIS.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS NUMNOTA, 

     CASE 
         WHEN B.RECNUM IS NOT NULL THEN 
             TO_CHAR(B.VALOR, 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS = '',.''') 
         ELSE ( 
             SELECT LISTAGG( 
                 TO_CHAR(NVL(D_PARCIAIS.VALOR, 0), 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS = '',.'''), 
                 ' , ' 
             ) WITHIN GROUP (ORDER BY D_PARCIAIS.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS VALOR_LANCAMENTO_INTERNO, 

     CASE 
         WHEN B.RECNUM IS NOT NULL THEN 
             CASE WHEN B.CODFORNEC = 0 THEN 'Outro' ELSE NVL(C.FORNECEDOR, 'Fornecedor Desconhecido') END 
         ELSE ( 
             SELECT LISTAGG(DISTINCT 
                 CASE 
                     WHEN B_PARCIAL.CODFORNEC = 0 THEN 'Outro' 
                     ELSE NVL(C_PARCIAL.FORNECEDOR, 'Fornecedor Desconhecido') 
                 END, ' , ' 
             ) WITHIN GROUP (ORDER BY B_PARCIAL.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             LEFT JOIN PCLANC B_PARCIAL ON B_PARCIAL.RECNUM = D_PARCIAIS.RECNUM 
             LEFT JOIN PCFORNEC C_PARCIAL ON C_PARCIAL.CODFORNEC = B_PARCIAL.CODFORNEC 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS FORNECEDOR, 

     CASE 
         WHEN B.RECNUM IS NOT NULL THEN 
             CASE WHEN B.DTPAGTO IS NULL THEN 'Não pago' ELSE 'Pago' END 
         ELSE ( 
             SELECT LISTAGG( 
                 CASE WHEN B_PARCIAL.DTPAGTO IS NULL THEN 'Não pago' ELSE 'Pago' END, 
                 ' , ' 
             ) WITHIN GROUP (ORDER BY D_PARCIAIS.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             LEFT JOIN PCLANC B_PARCIAL ON B_PARCIAL.RECNUM = D_PARCIAIS.RECNUM 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS STATUS_PAGAMENTO, 

     CASE 
         WHEN B.RECNUM IS NOT NULL THEN 
             TO_CHAR(NVL(B.TXPERM, 0), 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS = '',.''') 
         ELSE ( 
             SELECT LISTAGG( 
                 TO_CHAR(NVL(B_PARCIAL.TXPERM, 0), 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS = '',.'''), 
                 ' , ' 
             ) WITHIN GROUP (ORDER BY D_PARCIAIS.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             LEFT JOIN PCLANC B_PARCIAL ON B_PARCIAL.RECNUM = D_PARCIAIS.RECNUM 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS JUROS, 

     CASE 
         WHEN B.RECNUM IS NOT NULL THEN B.HISTORICO 
         ELSE ( 
             SELECT LISTAGG(NVL(D_PARCIAIS.HISTORICO, 'Sem Histórico'), ' , ') 
             WITHIN GROUP (ORDER BY D_PARCIAIS.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS HISTORICO_DUPLICATA,
     CASE 
         WHEN B.RECNUM IS NOT NULL THEN D.CONTA 
         ELSE ( 
             SELECT LISTAGG( 
                 NVL(C_PARCIAL.CONTA, 'Sem Conta'), 
                 ' , ' 
             ) WITHIN GROUP (ORDER BY D_PARCIAIS.RECNUM) 
             FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS D_PARCIAIS 
             LEFT JOIN PCLANC B_PARCIAL ON B_PARCIAL.RECNUM = D_PARCIAIS.RECNUM 
             LEFT JOIN PCCONTA C_PARCIAL ON C_PARCIAL.CODCONTA = B_PARCIAL.CODCONTA 
             WHERE D_PARCIAIS.ID_IMPORTACAO_OFX = A.ID_IMPORTACAO_OFX 
         ) 
     END AS CONTA

 FROM MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS A 
 LEFT JOIN PCLANC B ON B.RECNUM = A.RECNUM 
 LEFT JOIN PCFORNEC C ON C.CODFORNEC = B.CODFORNEC 
 LEFT JOIN PCCONTA D ON D.CODCONTA = B.CODCONTA
 WHERE A.MOVIMENTACAO_OFX = 'OUT' 
   AND TRUNC(A.DATA_TRANSACAO) BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') 
                                   AND TO_DATE(:dataFim, 'DD/MM/YYYY') 
 ORDER BY A.ID_IMPORTACAO_OFX, A.DATA_TRANSACAO ASC`
      , { dataInicio: String(dataInicio), dataFim: String(dataFim) }
    );

    res.json(result.rows || []);
  } catch (err) {
    console.error("Erro em /api/gestfin/lancamentos-apagar:", err);
    res.status(500).json({ error: "Falha ao consultar lançamentos à pagar" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});

// Soma de adiantamentos em PCLANC por período de DTLANC
// POST /api/gestfin/lancamentos-apagar/adiantamentos-sum
app.post("/api/gestfin/lancamentos-apagar/adiantamentos-sum", async (req, res) => {
  const { dataInicio, dataFim } = req.body || {};

  // Validação de presença e formato (DD/MM/YYYY)
  if (!dataInicio || !dataFim) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      required: ["dataInicio", "dataFim"],
    });
  }

  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!dateRegex.test(String(dataInicio)) || !dateRegex.test(String(dataFim))) {
    return res.status(400).json({
      error: "Formato de data inválido. Use DD/MM/YYYY",
      example: { dataInicio: "01/01/2024", dataFim: "31/01/2024" },
    });
  }

  let conn;
  try {
    conn = await getConnection();
    const sql = `SELECT SUM(VALOR) AS TOTAL
                 FROM PCLANC
                 WHERE ADIANTAMENTO = 'S'
                   AND DTLANC BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY')
                                     AND TO_DATE(:dataFim, 'DD/MM/YYYY')`;
    const binds = { dataInicio: String(dataInicio), dataFim: String(dataFim) };
    const result = await conn.execute(sql, binds);
    const row = (result.rows || [])[0] || {};
    const total = Number(row.TOTAL || row.total || 0);
    return res.json({ total });
  } catch (err) {
    console.error("Erro em /api/gestfin/lancamentos-apagar/adiantamentos-sum:", err);
    return res.status(500).json({ error: "Falha ao calcular soma de adiantamentos" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) {} }
  }
});


// Buscar duplicatas (PCLANC) por filial e período (DTLANC)
app.post("/api/gestfin/buscar-duplicatas", async (req, res) => {
  const { codFilial, dataInicio, dataFim } = req.body || {};

  // Validação de presença e formato (DD/MM/YYYY)
  if (codFilial == null || !dataInicio || !dataFim) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      required: ["codFilial", "dataInicio", "dataFim"],
    });
  }

  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!dateRegex.test(String(dataInicio)) || !dateRegex.test(String(dataFim))) {
    return res.status(400).json({
      error: "Formato de data inválido. Use DD/MM/YYYY",
      example: { dataInicio: "01/01/2024", dataFim: "31/01/2024" },
    });
  }

  let conn;
  try {
    conn = await getConnection();
    const sql = `SELECT 
            A.RECNUM,
            A.NOMEFUNC,
            TO_CHAR(A.DTEMISSAO, 'DD/MM/YYYY') AS DTEMISSAO,
            TO_CHAR(A.DTLANC, 'DD/MM/YYYY') AS DTLANC,
            TO_CHAR(A.DTVENC, 'DD/MM/YYYY') AS DTVENC,
            A.CODCONTA,
            C.CONTA,
            A.CODFORNEC,
            B.FORNECEDOR,
            A.HISTORICO,
            A.NUMNOTA,
            TO_CHAR(A.VALOR, 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS='',.''') AS VALOR,
            TO_CHAR(A.DTPAGTO, 'DD/MM/YYYY') AS DTPAGTO,
            A.CODFUNCBAIXA,
            A.ASSINATURA,
            TO_CHAR(A.DTASSINATURA, 'DD/MM/YYYY') AS DTASSINATURA,
            TO_CHAR(NVL(A.TXPERM, 0), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS='',.''') AS JUROS,
            A.DUPLIC,
            TO_CHAR(NVL(A.DESCONTOFIN, 0), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS='',.''') AS DESCONTOFIN
        FROM 
            PCLANC A 
        LEFT JOIN 
            PCFORNEC B ON B.CODFORNEC = A.CODFORNEC 
        LEFT JOIN 
            PCCONTA C ON C.CODCONTA = A.CODCONTA 
        WHERE 
            A.CODFILIAL = :codFilial 
            AND A.DTLANC BETWEEN TO_DATE(:dataInicio, 'DD/MM/YYYY') AND TO_DATE(:dataFim, 'DD/MM/YYYY') 
            AND A.DTPAGTO IS NULL 
            AND (A.HISTORICO2 IS NULL OR A.HISTORICO2 <> 'C1') 
        ORDER BY A.DTVENC, A.VALOR ASC`;

    const binds = {
      codFilial: Number(codFilial),
      dataInicio: String(dataInicio),
      dataFim: String(dataFim),
    };

    const result = await conn.execute(sql, binds);
    res.json(result.rows || []);
  } catch (err) {
    console.error("Erro em /api/gestfin/buscar-duplicatas:", err);
    res.status(500).json({ error: "Falha ao buscar duplicatas" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});

// Reservar próximo RECNUM com lock e incremento imediato
app.get("/api/gestfin/novo-lancamento/proximo-recnum", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    // Seleciona com lock
    const selProxRecnum = `SELECT PROXNUMLANC FROM TOPHC.PCCONSUM FOR UPDATE`;
    const resProx = await conn.execute(selProxRecnum, {}, { autoCommit: false });
    const rowProx = (resProx.rows || [])[0] || {};
    const proxRecnum = Number(rowProx.PROXNUMLANC || rowProx.proxnumlanc || 0);

    // Incrementa imediatamente para reservar o número
    const updProx = `UPDATE TOPHC.PCCONSUM SET PROXNUMLANC = PROXNUMLANC + 1`;
    await conn.execute(updProx, {}, { autoCommit: false });
    await conn.commit();

    res.json({ recnum: proxRecnum });
  } catch (err) {
    console.error("Erro em /api/gestfin/novo-lancamento/proximo-recnum:", err);
    if (conn) {
      try { await conn.rollback(); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ error: "Falha ao reservar próximo RECNUM" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});

// Novo Lançamento: insere em TOPHC.PCLANC e replica em MULTGESTI_FINANCEIRO_LOGS_LANCAMENTO
app.post("/api/gestfin/novo-lancamento", async (req, res) => {
  const body = req.body || {};

  const required = [
    "codConta",
    "codFornec",
    "historico",
    "duplic",
    "valor",
    "dtVencBind",
    "dtLancBind",
    "dtCompetenciaBind",
    "dtEmissaoBind",
    "codFilial",
    "indice",
    "tipoLanc",
    "tipoParceiro",
    "nomeFunc",
    "historico2",
    "moeda",
    "nfServicoBind",
    "numNotaBind",
    "codRotinaCad",
    "codRotinaAlt",
    "parcela",
    "vlrUtilizadoAdiantFornec",
    "lacreDigConecSocial",
    "tiposervico",
    "opcaoPagamentoIpva",
    "utilizouRateioConta",
    "prcRateioUtilizado",
    "reinFEventor4040",
  ];

  const missing = required.filter((k) => !(k in body));
  if (missing.length) {
    return res.status(400).json({
      error: "Parâmetros obrigatórios ausentes",
      missing,
    });
  }

  // Normaliza tipos básicos
  // NFSERVICO precisa ser 1 char ('S' ou 'N'). Tratar 'SN' e '0' como Sem Nota (N + NUMNOTA=0).
  const rawNfServico = String(body.nfServicoBind ?? "N").trim().toUpperCase();
  const isSemNota = rawNfServico === "SN" || rawNfServico === "0";
  const nfServicoBind = rawNfServico === "S" ? "S" : "N"; // 'S' para NF-s, 'N' para NF-e e Sem Nota
  const numNotaBind = isSemNota ? 0 : (body.numNotaBind == null ? 0 : Number(body.numNotaBind));

  const binds = {
    recnum: Number(body.recnum || 0),
    codConta: Number(body.codConta),
    codFornec: Number(body.codFornec),
    historico: String(body.historico ?? ""),
    duplic: String(body.duplic ?? ""),
    valor: Number(body.valor ?? 0),
    dtVencBind: String(body.dtVencBind), // DD/MM/YYYY
    dtLancBind: String(body.dtLancBind), // DD/MM/YYYY
    dtCompetenciaBind: String(body.dtCompetenciaBind), // DD/MM/YYYY
    dtEmissaoBind: String(body.dtEmissaoBind), // DD/MM/YYYY
    codFilial: Number(body.codFilial),
    indice: String(body.indice ?? "A"),
    tipoLanc: String(body.tipoLanc ?? ""),
    tipoParceiro: String(body.tipoParceiro ?? ""),
    nomeFunc: String(body.nomeFunc ?? ""),
    historico2: String(body.historico2 ?? ""),
    moeda: String(body.moeda ?? "R"),
    recNumPrinc: body.recNumPrinc == null ? null : Number(body.recNumPrinc),
    nfServicoBind,
    numNotaBind,
    codRotinaCad: String(body.codRotinaCad ?? "MULTGEST"),
    codRotinaAlt: String(body.codRotinaAlt ?? "MULTGEST"),
    parcela: Number(body.parcela ?? 1),
    vlrUtilizadoAdiantFornec: Number(body.vlrUtilizadoAdiantFornec ?? 0),
    lacreDigConecSocial: body.lacreDigConecSocial == null ? null : String(body.lacreDigConecSocial),
    tiposervico: body.tiposervico == null ? null : String(body.tiposervico),
    opcaoPagamentoIpva: body.opcaoPagamentoIpva == null ? null : String(body.opcaoPagamentoIpva),
    utilizouRateioConta: String(body.utilizouRateioConta ?? "N"),
    prcRateioUtilizado: Number(body.prcRateioUtilizado ?? 0),
    reinFEventor4040: body.reinFEventor4040 == null ? null : String(body.reinFEventor4040),
  };

  let conn;
  try {
    conn = await getConnection();

    const insertPclanc = `INSERT INTO TOPHC.PCLANC ( 
        RECNUM, CODCONTA, CODFORNEC, HISTORICO, DUPLIC, VALOR, DTVENC, DTLANC, DTCOMPETENCIA, DTEMISSAO, CODFILIAL, INDICE, TIPOLANC, 
        TIPOPARCEIRO, NOMEFUNC, HISTORICO2, MOEDA, RECNUMPRINC, NFSERVICO, NUMNOTA, CODROTINACAD, CODROTINAALT,  
        PARCELA, VLRUTILIZADOADIANTFORNEC, LACREDIGCONECSOCIAL, TIPOSERVICO, OPCAOPAGAMENTOIPVA, 
        UTILIZOURATEIOCONTA, PRCRATEIOUTILIZADO, REINFEVENTOR4040 
      ) VALUES ( 
        :recnum, :codConta, :codFornec, :historico, :duplic, :valor, TO_DATE(:dtVencBind, 'DD/MM/YYYY'), TO_DATE(:dtLancBind, 'DD/MM/YYYY'), TO_DATE(:dtCompetenciaBind, 'DD/MM/YYYY'), TO_DATE(:dtEmissaoBind, 'DD/MM/YYYY'), :codFilial, :indice, :tipoLanc, 
        :tipoParceiro, :nomeFunc, :historico2, :moeda, :recNumPrinc, :nfServicoBind, :numNotaBind, :codRotinaCad, :codRotinaAlt, 
        :parcela, :vlrUtilizadoAdiantFornec, :lacreDigConecSocial, :tiposervico, :opcaoPagamentoIpva, 
        :utilizouRateioConta, :prcRateioUtilizado, :reinFEventor4040 
      )`;

    const insertLog = `INSERT INTO MULTGESTI_FINANCEIRO_LOGS_LANCAMENTO ( 
        RECNUM, CODCONTA, CODFORNEC, HISTORICO, DUPLIC, VALOR, DTVENC, DTLANC, DTCOMPETENCIA, DTEMISSAO, CODFILIAL, INDICE, TIPOLANC, 
        TIPOPARCEIRO, NOMEFUNC, HISTORICO2, MOEDA, RECNUMPRINC, NFSERVICO, NUMNOTA, CODROTINACAD, CODROTINAALT, 
        PARCELA, VLRUTILIZADOADIANTFORNEC, LACREDIGCONECSOCIAL, TIPOSERVICO, OPCAOPAGAMENTOIPVA, 
        UTILIZOURATEIOCONTA, PRCRATEIOUTILIZADO, REINFEVENTOR4040 
      ) VALUES ( 
        :recnum, :codConta, :codFornec, :historico, :duplic, :valor, TO_DATE(:dtVencBind, 'DD/MM/YYYY'), TO_DATE(:dtLancBind, 'DD/MM/YYYY'), TO_DATE(:dtCompetenciaBind, 'DD/MM/YYYY'), TO_DATE(:dtEmissaoBind, 'DD/MM/YYYY'), :codFilial, :indice, :tipoLanc, 
        :tipoParceiro, :nomeFunc, :historico2, :moeda, :recNumPrinc, :nfServicoBind, :numNotaBind, :codRotinaCad, :codRotinaAlt, 
        :parcela, :vlrUtilizadoAdiantFornec, :lacreDigConecSocial, :tiposervico, :opcaoPagamentoIpva, 
        :utilizouRateioConta, :prcRateioUtilizado, :reinFEventor4040 
      )`;

    // Executa em transação
    await conn.execute(insertPclanc, binds, { autoCommit: false });
    await conn.execute(insertLog, binds, { autoCommit: false });

    await conn.commit();

    return res.json({ ok: true, recnum: binds.recnum });
  } catch (err) {
    console.error("Erro em /api/gestfin/novo-lancamento:", err);
    if (conn) {
      try { await conn.rollback(); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ error: "Falha ao inserir novo lançamento" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});

// Atualizar lançamento existente em TOPHC.PCLANC por RECNUM
// POST /api/gestfin/atualizar-lancamento
app.post("/api/gestfin/atualizar-lancamento", async (req, res) => {
  const body = req.body || {};

  const required = [
    "recnum",
    "codConta",
    "historico",
    "duplic",
    "valor",
    "dtVencBind",
    "dtLancBind",
    "dtCompetenciaBind",
    "dtEmissaoBind",
    "codFilial",
    "indice",
    "tipoLanc",
    "tipoParceiro",
    "moeda",
    "codRotinaAlt",
    "parcela",
    "utilizouRateioConta",
    "prcRateioUtilizado",
  ];

  const missing = required.filter((k) => !(k in body));
  if (missing.length) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes", missing });
  }

  const rawNfServico = String(body.nfServicoBind ?? "N").trim().toUpperCase();
  const isSemNota = rawNfServico === "SN" || rawNfServico === "0";
  const nfServicoBind = rawNfServico === "S" ? "S" : "N";
  const numNotaBind = isSemNota ? 0 : Number(body.numNotaBind ?? 0);

  const baseBinds = {
    recnum: Number(body.recnum || 0),
    codConta: Number(body.codConta),
    codFornec: body.codFornec == null ? null : Number(body.codFornec),
    historico: String(body.historico ?? ""),
    duplic: String(body.duplic ?? ""),
    valor: Number(body.valor ?? 0),
    dtVencBind: String(body.dtVencBind),
    dtLancBind: String(body.dtLancBind),
    dtCompetenciaBind: String(body.dtCompetenciaBind),
    dtEmissaoBind: String(body.dtEmissaoBind),
    codFilial: Number(body.codFilial),
    indice: String(body.indice ?? "A"),
    tipoLanc: String(body.tipoLanc ?? ""),
    tipoParceiro: String(body.tipoParceiro ?? ""),
    nomeFunc: String(body.nomeFunc ?? ""),
    historico2: String(body.historico2 ?? ""),
    moeda: String(body.moeda ?? "R"),
    recNumPrinc: body.recNumPrinc == null ? null : Number(body.recNumPrinc),
    nfServicoBind,
    numNotaBind,
    codRotinaAlt: String(body.codRotinaAlt ?? "MULTGEST"),
    parcela: Number(body.parcela ?? 1),
    vlrUtilizadoAdiantFornec: Number(body.vlrUtilizadoAdiantFornec ?? 0),
    lacreDigConecSocial: body.lacreDigConecSocial ?? null,
    tiposervico: body.tiposervico ?? null,
    opcaoPagamentoIpva: body.opcaoPagamentoIpva ?? null,
    utilizouRateioConta: String(body.utilizouRateioConta ?? "N"),
    prcRateioUtilizado: Number(body.prcRateioUtilizado ?? 0),
    reinFEventor4040: body.reinFEventor4040 ?? null,
  };

  const sqlUpdatePclanc = `
    UPDATE TOPHC.PCLANC
       SET CODCONTA = :codConta,
           CODFORNEC = :codFornec,
           HISTORICO = :historico,
           DUPLIC = :duplic,
           VALOR = :valor,
           DTVENC = TO_DATE(:dtVencBind,'DD/MM/YYYY'),
           DTLANC = TO_DATE(:dtLancBind,'DD/MM/YYYY'),
           DTCOMPETENCIA = TO_DATE(:dtCompetenciaBind,'DD/MM/YYYY'),
           DTEMISSAO = TO_DATE(:dtEmissaoBind,'DD/MM/YYYY'),
           CODFILIAL = :codFilial,
           INDICE = :indice,
           TIPOLANC = :tipoLanc,
           TIPOPARCEIRO = :tipoParceiro,
           NOMEFUNC = :nomeFunc,
           HISTORICO2 = :historico2,
           MOEDA = :moeda,
           RECNUMPRINC = :recNumPrinc,
           NFSERVICO = :nfServicoBind,
           NUMNOTA = :numNotaBind,
           CODROTINAALT = :codRotinaAlt,
           PARCELA = :parcela,
           VLRUTILIZADOADIANTFORNEC = :vlrUtilizadoAdiantFornec,
           LACREDIGCONECSOCIAL = :lacreDigConecSocial,
           TIPOSERVICO = :tiposervico,
           OPCAOPAGAMENTOIPVA = :opcaoPagamentoIpva,
           UTILIZOURATEIOCONTA = :utilizouRateioConta,
           PRCRATEIOUTILIZADO = :prcRateioUtilizado,
           REINFEVENTOR4040 = :reinFEventor4040
     WHERE RECNUM = :recnum`;

  let conn;
  try {
    conn = await getConnection();

    console.log("🟡 Atualizando PCLANC:", baseBinds);
    const result = await conn.execute(sqlUpdatePclanc, baseBinds, { autoCommit: false });
    await conn.commit();
    res.json({ ok: true, rowsAffected: Number(result?.rowsAffected ?? 0) });
  } catch (err) {
    console.error("❌ Erro em /api/gestfin/atualizar-lancamento:", err);
    if (conn) try { await conn.rollback(); } catch {}
    res.status(500).json({ error: "Falha ao atualizar lançamento", details: err.message });
  } finally {
    if (conn) try { await conn.close(); } catch {}
  }
});

// Salvar Nova Conta
app.post("/api/gestfin/salvar-nova-conta", async (req, res) => {
  const body = req.body || {};

  // Validações básicas
  const codConta = Number(body.CODCONTA);
  const conta = String(body.CONTA ?? "").trim();
  const grupoConta = Number(body.GRUPOCONTA);
  const tipo = String(body.TIPO ?? "").trim().toUpperCase();
  const investimento = String(body.INVESTIMENTO ?? "N").trim().toUpperCase();
  const usarRateioCentroCusto = String(body.USARATEIOCENTROCUSTO ?? "N").trim().toUpperCase();
  const restringirNoBalancete = String(body.RESTRINGIRNOBALANCETE ?? "N").trim().toUpperCase();
  const utilizaCentroCustoRestrito = String(body.UTILIZACENTROCUSTORESTRITO ?? "N").trim().toUpperCase();
  const fixaVariavel = String(body.FIXAVARIAVEL ?? "F").trim().toUpperCase();

  if (!Number.isFinite(codConta) || codConta <= 0) {
    return res.status(400).json({ success: false, message: "CODCONTA inválido" });
  }
  if (!conta) {
    return res.status(400).json({ success: false, message: "CONTA é obrigatória" });
  }
  if (!Number.isFinite(grupoConta) || grupoConta <= 0) {
    return res.status(400).json({ success: false, message: "GRUPOCONTA inválido" });
  }
  if (!tipo || !/[APRD]/.test(tipo)) {
    return res.status(400).json({ success: false, message: "TIPO deve ser A, P, R ou D" });
  }

  let conn;
  try {
    conn = await getConnection();

    // Verifica se já existe conta com mesmo código
    const check = await conn.execute(
      `SELECT COUNT(1) AS QTD FROM PCCONTA WHERE CODCONTA = :cod`,
      { cod: codConta },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const qtd = Number(((check.rows || [])[0] || {}).QTD ?? 0);
    if (qtd > 0) {
      return res.status(409).json({ success: false, message: "Já existe uma conta com este código" });
    }

    const sql = `INSERT INTO PCCONTA (
        CODCONTA, CONTA, GRUPOCONTA, TIPO, INVESTIMENTO,
        USARATEIOCENTROCUSTO, RESTRINGIRNOBALANCETE,
        UTILIZACENTROCUSTORESTRITO, FIXAVARIAVEL
      ) VALUES (
        :CODCONTA, :CONTA, :GRUPOCONTA, :TIPO, :INVESTIMENTO,
        :USARATEIOCENTROCUSTO, :RESTRINGIRNOBALANCETE,
        :UTILIZACENTROCUSTORESTRITO, :FIXAVARIAVEL
      )`;

    const binds = {
      CODCONTA: codConta,
      CONTA: conta,
      GRUPOCONTA: grupoConta,
      TIPO: tipo,
      INVESTIMENTO: investimento,
      USARATEIOCENTROCUSTO: usarRateioCentroCusto,
      RESTRINGIRNOBALANCETE: restringirNoBalancete,
      UTILIZACENTROCUSTORESTRITO: utilizaCentroCustoRestrito,
      FIXAVARIAVEL: fixaVariavel,
    };

    await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ success: true, codConta: codConta, message: "Conta criada com sucesso" });
  } catch (err) {
    console.error("Erro em /api/gestfin/salvar-nova-conta:", err);
    return res.status(500).json({ success: false, message: "Falha ao salvar nova conta" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Desdobrar Duplicata: reserva RECNUM em TOPHC.PCCONSUM_NOVA132 e insere backup em TOPHC.PCLANC_BACKUP
app.post("/api/gestfin/desdobrar-duplicata", async (req, res) => {
  const body = req.body || {};

  const required = [
    "recNumAtual", // RECNUM da duplicata original em PCLANC
    "duplic",      // identificador da parcela (ex.: 1,2,3...)
    "valor",       // valor da parcela
    "dtVenc",      // YYYY-MM-DD
    "nomeFunc",    // usuário que está desdobrando
    "dtDesd",      // YYYY-MM-DD (data do desdobramento)
  ];

  const missing = required.filter((k) => !(k in body));
  if (missing.length) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes", missing });
  }

  const binds = {
    recNumAtual: Number(body.recNumAtual),
    duplic: String(body.duplic ?? ""),
    valor: Number(body.valor ?? 0),
    dtVenc: String(body.dtVenc ?? ""), // YYYY-MM-DD
    nomeFunc: String(body.nomeFunc ?? ""),
    dtDesd: String(body.dtDesd ?? ""), // YYYY-MM-DD
    // opcionais para UPDATE final
    codFunc: body.codFunc != null ? Number(body.codFunc) : null,
    finalizar: body.finalizar === true || body.finalizar === "true" || body.finalizar === 1,
  };

  let conn;
  try {
    conn = await getConnection();

    // 1) Reserva próximo RECNUM na tabela TOPHC.PCCONSUM_NOVA132 com lock
    const selProx = `SELECT PROXNUMLANC FROM TOPHC.PCCONSUM FOR UPDATE`;
    const resSel = await conn.execute(selProx, {}, { autoCommit: false });
    const rowSel = (resSel.rows || [])[0] || {};
    const proxRecnum = Number(rowSel.PROXNUMLANC || rowSel.proxnumlanc || 0);

    // 2) Incrementa para reservar
    const updProx = `UPDATE TOPHC.PCCONSUM SET PROXNUMLANC = PROXNUMLANC + 1`;
    await conn.execute(updProx, {}, { autoCommit: false });

    // 3) Insere backup em TOPHC.PCLANC_BACKUP a partir do registro atual em PCLANC
    const insertBackup = `INSERT INTO TOPHC.PCLANC (
        RECNUM, DUPLIC, VALOR, DTVENC, NOMEFUNC, DTDESD,
        CODCONTA, CODFORNEC, HISTORICO, DTLANC, DTCOMPETENCIA, DTEMISSAO,
        CODFILIAL, INDICE, TIPOLANC, TIPOPARCEIRO, HISTORICO2, MOEDA,
        RECNUMPRINC, NFSERVICO, NUMNOTA, CODROTINACAD, CODROTINAALT,
        PARCELA, VLRUTILIZADOADIANTFORNEC, LACREDIGCONECSOCIAL, TIPOSERVICO, OPCAOPAGAMENTOIPVA,
        UTILIZOURATEIOCONTA, PRCRATEIOUTILIZADO, REINFEVENTOR4040
      )
      SELECT
        :recnum, :duplic, :valor, TO_DATE(:dtVenc, 'YYYY-MM-DD'), :nomeFunc, TO_DATE(:dtDesd, 'YYYY-MM-DD'),
        CODCONTA, CODFORNEC, HISTORICO, DTLANC, DTCOMPETENCIA, DTEMISSAO,
        CODFILIAL, INDICE, TIPOLANC, TIPOPARCEIRO, HISTORICO2, MOEDA,
        RECNUMPRINC, NFSERVICO, NUMNOTA, CODROTINACAD, CODROTINAALT,
        PARCELA, VLRUTILIZADOADIANTFORNEC, LACREDIGCONECSOCIAL, TIPOSERVICO, OPCAOPAGAMENTOIPVA,
        UTILIZOURATEIOCONTA, PRCRATEIOUTILIZADO, REINFEVENTOR4040
      FROM TOPHC.PCLANC
      WHERE RECNUM = :recNumAtual`;

    const backupBinds = {
      recnum: proxRecnum,
      duplic: binds.duplic,
      valor: binds.valor,
      dtVenc: binds.dtVenc,
      nomeFunc: binds.nomeFunc,
      dtDesd: binds.dtDesd,
      recNumAtual: binds.recNumAtual,
    };
    try {
      await conn.execute(insertBackup, backupBinds, { autoCommit: false });
    } catch (e) {
      console.error("Falha ao executar insertBackup em desdobrar-duplicata:", { backupBinds, error: e });
      throw e;
    }

    // 4) Ao finalizar, atualiza o registro original em TOPHC.PCLANC
    if (binds.finalizar) {
      const codFuncNumber = Number(binds.codFunc);
      const includeCodFunc = Number.isFinite(codFuncNumber);

      let updatePclanc = `UPDATE TOPHC.PCLANC SET 
        VPAGO = VALOR,
        DTPAGTO = TO_DATE(:dtDesd, 'YYYY-MM-DD'),
        DTULTALTER = TO_DATE(:dtDesd, 'YYYY-MM-DD'),
        DTDESD = TO_DATE(:dtDesd, 'YYYY-MM-DD'),
        LOCALIZACAO = 'TITULO DESDOBRADO.'`;

      if (includeCodFunc) {
        updatePclanc += `,
        CODFUNCBAIXA = :codFunc,
        CODFUNCULTALTER = :codFunc`;
      }

      updatePclanc += `
      WHERE RECNUM = :recNumAtual`;

      const updateBinds = {
        dtDesd: binds.dtDesd,
        recNumAtual: binds.recNumAtual,
      };
      if (includeCodFunc) {
        updateBinds.codFunc = { val: codFuncNumber, type: oracledb.NUMBER };
      }

      try {
        await conn.execute(updatePclanc, updateBinds, { autoCommit: false });
      } catch (e) {
        console.error("Falha ao executar updatePclanc em desdobrar-duplicata:", { updateBinds, error: e });
        throw e;
      }
    }

    await conn.commit();

    res.json({ ok: true, recnumReserva: proxRecnum, finalizado: Boolean(binds.finalizar) });
  } catch (err) {
    console.error("Erro em /api/gestfin/desdobrar-duplicata:", err);
    if (conn) {
      try { await conn.rollback(); } catch (e) { /* ignore */ }
    }
    res.status(500).json({ error: "Falha ao desdobrar duplicata" });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { /* ignore */ }
    }
  }
});

// Lançamentos parciais vinculados a uma importação OFX
// GET /api/gestfin/lancamentos-parciais/:idImportacaoOFX
app.get("/api/gestfin/lancamentos-parciais/:idImportacaoOFX", async (req, res) => {
  const { idImportacaoOFX } = req.params || {};

  const id = Number(idImportacaoOFX);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "ID_IMPORTACAO_OFX inválido" });
  }

  let conn;
  try {
    conn = await getConnection();
    const sql = `
      SELECT 
        A.RECNUM, 
        C.FORNECEDOR, 
        NVL(B.VALOR, 0) AS VALOR_NUM,
        TO_CHAR(NVL(B.VALOR, 0), 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS=",."') AS VALOR_FORMATADO, 
        NVL(B.TXPERM, 0) AS JUROS_NUM,
        TO_CHAR(NVL(B.TXPERM, 0), 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS=",."') AS JUROS, 
        NVL(B.DESCONTOFIN, 0) AS DESCONTOFIN_NUM,
        TO_CHAR(NVL(B.DESCONTOFIN, 0), 'FM999G999G990D00', 'NLS_NUMERIC_CHARACTERS=",."') AS DESCONTOFIN, 
        B.NUMNOTA, 
        B.HISTORICO 
      FROM 
        MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS A 
      LEFT JOIN 
        PCLANC B 
        ON B.RECNUM = A.RECNUM 
      LEFT JOIN 
        PCFORNEC C 
        ON C.CODFORNEC = B.CODFORNEC 
      WHERE 
        A.ID_IMPORTACAO_OFX = :idImportacaoOFX`;

    const result = await conn.execute(sql, { idImportacaoOFX: id });
    return res.json(result.rows || []);
  } catch (err) {
    console.error("Erro em /api/gestfin/lancamentos-parciais:", err);
    return res.status(500).json({ error: "Falha ao buscar lançamentos parciais" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Inserir lançamento parcial vinculado a uma importação OFX
// POST /api/gestfin/inserir-lancamento-parcial
app.post("/api/gestfin/inserir-lancamento-parcial", async (req, res) => {
  const {
    idOfx,
    recnum,
    codUsurVinculacao,
    valor,
    historico,
    fornecedor,
    numNota,
    juros,
  } = req.body || {};

  const idOfxNum = Number(idOfx);
  const recnumNum = Number(recnum);
  const codusurNum = Number(codUsurVinculacao);
  const valorNum = Number(valor);
  const jurosNum = Number(juros);

  if (!Number.isFinite(idOfxNum) || idOfxNum <= 0) {
    return res.status(400).json({ error: "ID_IMPORTACAO_OFX inválido" });
  }
  if (!Number.isFinite(recnumNum) || recnumNum <= 0) {
    return res.status(400).json({ error: "RECNUM inválido" });
  }
  if (!Number.isFinite(codusurNum) || codusurNum <= 0) {
    return res.status(400).json({ error: "CODUSUR_VINCULACAO inválido" });
  }
  if (!Number.isFinite(valorNum) || valorNum < 0) {
    return res.status(400).json({ error: "VALOR inválido" });
  }
  if (!Number.isFinite(jurosNum) || jurosNum < 0) {
    return res.status(400).json({ error: "JUROS inválido" });
  }

  let conn;
  try {
    conn = await getConnection();
    // Executa INSERT e UPDATE em um único bloco PL/SQL com COMMIT
    const sql = `
      BEGIN
        INSERT INTO MULTGESTI_FINANCEIRO_OFX_LANCAMENTOS_PARCIAIS (
          ID_IMPORTACAO_OFX,
          RECNUM,
          CODUSUR_VINCULACAO,
          VALOR,
          HISTORICO,
          FORNECEDOR,
          NUMNOTA,
          JUROS
        ) VALUES (
          :idOfx,
          :recnum,
          :codUsurVinculacao,
          :valor,
          :historico,
          :fornecedor,
          :numNota,
          :juros
        );

        :rowsIns := SQL%ROWCOUNT;

        UPDATE PCLANC 
           SET HISTORICO2 = 'C1' 
         WHERE RECNUM = :recnum;

        :rowsUpd := SQL%ROWCOUNT;

        COMMIT;
      END;`;

    const binds = {
      idOfx: { val: idOfxNum, type: oracledb.NUMBER },
      recnum: { val: recnumNum, type: oracledb.NUMBER },
      codUsurVinculacao: { val: codusurNum, type: oracledb.NUMBER },
      valor: { val: valorNum, type: oracledb.NUMBER },
      historico: { val: (historico ?? null), type: oracledb.STRING },
      fornecedor: { val: (fornecedor ?? null), type: oracledb.STRING },
      numNota: { val: (numNota == null ? null : Number(numNota)), type: oracledb.NUMBER },
      juros: { val: jurosNum, type: oracledb.NUMBER },
      rowsIns: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      rowsUpd: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };

    const result = await conn.execute(sql, binds, { autoCommit: false });
    const rowsInserted = Number(result?.outBinds?.rowsIns ?? 0);
    const rowsUpdated = Number(result?.outBinds?.rowsUpd ?? 0);
    const rowsAffected = rowsInserted + rowsUpdated;
    return res.json({ ok: true, rowsAffected });
  } catch (err) {
    console.error("Erro em /api/gestfin/inserir-lancamento-parcial:", err);
    return res.status(500).json({ error: "Falha ao inserir lançamento parcial" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

// Excluir duplicata em PCLANC por RECNUM e DUPLIC
// POST /api/gestfin/excluir-duplicata
app.post("/api/gestfin/excluir-duplicata", async (req, res) => {
  const { recnum, duplic } = req.body || {};

  const recnumNum = Number(recnum);
  const duplicStr = String(duplic ?? "").trim();

  if (!Number.isFinite(recnumNum) || recnumNum <= 0) {
    return res.status(400).json({ error: "RECNUM inválido" });
  }
  if (!duplicStr) {
    return res.status(400).json({ error: "DUPLIC obrigatório" });
  }

  let conn;
  try {
    conn = await getConnection();
    const sql = `DELETE FROM PCLANC WHERE RECNUM = :recnum AND DUPLIC = :duplic`;
    const binds = { recnum: recnumNum, duplic: duplicStr };
    const result = await conn.execute(sql, binds, { autoCommit: false });
    await conn.commit();
    const rowsAffected = Number(result.rowsAffected || 0);
    return res.json({ ok: rowsAffected > 0, rowsAffected });
  } catch (err) {
    console.error("Erro em /api/gestfin/excluir-duplicata:", err);
    return res.status(500).json({ error: "Falha ao excluir duplicata" });
  } finally {
    if (conn) { try { await conn.close(); } catch (e) { /* ignore */ } }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`GestFIN server listening on port ${PORT}`);
});