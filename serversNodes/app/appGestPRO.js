import express from "express";
import oracledb from "oracledb";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: "/home/multgesti/.env" });
oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB });

const app = express();
const PORT = Number(process.env.APP_GESTPRO_PORT);
if (!PORT) {
  console.error("[appGestPRO] Porta não configurada em APP_GESTPRO_PORT");
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get("/api/gestpro/pedidos-separador", async (req, res) => {
  const codigo = req.query.codigo;
  if (!codigo) {
    return res.status(400).json({ message: "Parâmetro obrigatório ausente: codigo" });
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
         aa.NUMPED, 
         aa.CODFILIALRETIRA,
         aa.DATA, 
         aa.CODCLI, 
         bb.CLIENTE, 
         aa.CODPROD, 
         cc.DESCRICAO, 
         cc.CODAUXILIAR, 
         dd.MARCA, 
         aa.QT, 
         cc.MULTIPLO, 
         aa.PVENDA, 
         ee.CODFUNCSEP, 
         aa.CODFUNCSEP AS "SEPARADOR_ITEM", 
         ee.ULTIMASITUACAOCFAT AS "ULTIMASITUACAOCFAT", 
         ff.NOME, 
         CASE 
           WHEN aa.CODFUNCSEP IS NULL THEN 'PENDENTE' 
           ELSE 'SEPARADO' 
         END AS STATUS_SEPARACAO, 
         CASE 
           WHEN cc.MULTIPLO < 1 THEN 'Multiplo errado' 
           WHEN ABS((aa.QT / cc.MULTIPLO) - ROUND(aa.QT / cc.MULTIPLO)) < 0.0001 
             THEN TO_CHAR(ROUND(aa.QT / cc.MULTIPLO)) || ' ' || cc.EMBALAGEMMASTER 
           ELSE 'Multiplo errado' 
         END AS QT_TOTAL
       FROM 
         PCPEDI aa 
       JOIN PCCLIENT bb 
         ON bb.CODCLI = aa.CODCLI 
       JOIN PCPRODUT cc 
         ON cc.CODPROD = aa.CODPROD 
       LEFT JOIN PCMARCA dd 
         ON dd.CODMARCA = cc.CODMARCA 
       JOIN PCPEDC ee 
         ON ee.NUMPED = aa.NUMPED 
       JOIN PCUSUARI ff 
         ON ff.CODUSUR = ee.CODUSUR 
        AND ee.CODFUNCSEP = :codigo 
        AND ee.POSICAO IN ('L', 'M', 'P') 
       ORDER BY 
         aa.NUMPED, 
         CASE WHEN aa.CODFUNCSEP IS NULL THEN 1 ELSE 2 END, 
         aa.CODPROD
    `;

    const binds = { codigo: Number(codigo) };

    const result = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    return res.json({
      rows: result.rows || [],
      count: (result.rows || []).length,
    });

  } catch (err) {
    console.error("Erro ao buscar pedidos por separador:", err);
    return res.status(500).json({
      message: "Erro interno no servidor",
      detalhe: err.message,
    });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});



app.post("/api/gestpro/confirmar-separacao", async (req, res) => {
  const { numped, codigo, codigoProduto } = req.body || {};

  const numpedNum = Number(numped);
  const codigoNum = Number(codigo);
  const codigoProdutoNum = Number(codigoProduto);

  if (!Number.isFinite(numpedNum) || !Number.isFinite(codigoNum) || !Number.isFinite(codigoProdutoNum)) {
    return res.status(400).json({ message: "Parâmetros inválidos: informe 'numped', 'codigo' e 'codigoProduto' numéricos" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `UPDATE PCPEDI SET CODFUNCSEP = :codigo WHERE NUMPED = :numped AND CODPROD = :codigoProduto`;
    const result = await conn.execute(sql, { codigo: codigoNum, numped: numpedNum, codigoProduto: codigoProdutoNum }, { autoCommit: true });

    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    console.error("Erro ao confirmar separação:", err);
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) { console.error("Erro ao fechar conexão:", err); }
    }
  }
});

app.post("/api/gestpro/cancelar-separacao", async (req, res) => {
  const { numped, status, usuario } = req.body || {};

  const numpedNum = Number(numped);
  const statusNum = Number(status);
  const usuarioStr = String(usuario || '').trim();

  if (!Number.isFinite(numpedNum) || !Number.isFinite(statusNum) || !usuarioStr) {
    return res.status(400).json({ message: "Parâmetros inválidos: informe 'numped' e 'status' numéricos e 'usuario'" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      BEGIN
        UPDATE PCPEDI
           SET CODFUNCSEP = ''
         WHERE NUMPED = :numped;

        UPDATE PCPEDC
           SET CODFUNCSEP = ''
         WHERE NUMPED = :numped;

        UPDATE PCPEDC
           SET LOG1 = CASE
                        WHEN LOG1 IS NULL OR LOG1 = ''
                             THEN (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                        ELSE LOG1 || ',' || (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                      END,
               ULTIMASITUACAOCFAT = SUBSTR(
                        (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario),
                        1,
                        100
               )
         WHERE NUMPED = :numped;
      END;`;

    const binds = { numped: numpedNum, status: statusNum, usuario: usuarioStr };
    const result = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.post("/api/gestpro/inventario/avulso", async (req, res) => {
  const body = req.body || {};
  const nomeInventario = String(body.nomeInventario || "").trim();
  const localContagem = String(body.localContagem || "").trim();
  const codusur = Number(body.codusur);
  const nomeUsuario = String(body.nomeUsuario || "").trim();
  const filial = String(body.filial || "").trim();
  const responsavel = String(body.responsavel || "").trim();
  

  if (!nomeInventario || !localContagem || !Number.isFinite(codusur) || !nomeUsuario || !filial || !responsavel) {
    return res.status(400).json({ message: "Parâmetros obrigatórios ausentes: nomeInventario, localContagem, codusur, nomeUsuario, filial, responsavel" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const rId = await conn.execute(
      `SELECT NVL(MAX(ID_INVENTARIO), 0) + 1 AS NEXT_ID FROM MULTGESTI_INVENTARIO_AVULSO`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const nextId = Number(((rId.rows || [])[0] || {}).NEXT_ID || 0);
    if (!Number.isFinite(nextId) || nextId <= 0) {
      return res.status(500).json({ message: "Falha ao obter próximo ID do inventário" });
    }

    await conn.execute(
      `INSERT INTO MULTGESTI_INVENTARIO_AVULSO (
        ID_INVENTARIO,
        NOME_INVENTARIO,
        LOCAL_CONTAGEM,
        CODUSUR,
        NOME_USUARIO,
        FILIAL,
        DATA,
        RESPONSAVEL
      ) VALUES (
        :id,
        :nomeInventario,
        :localContagem,
        :codusur,
        :nomeUsuario,
        :filial,
        SYSTIMESTAMP,
        :responsavel
      )`,
      { id: nextId, nomeInventario, localContagem, codusur, nomeUsuario, filial, responsavel },
      { autoCommit: true }
    );
    return res.json({ ok: true, idInventario: nextId });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao criar inventário", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.post("/api/gestpro/inventario/avulso/produto", async (req, res) => {
  const body = req.body || {};
  const idInventarioNum = Number(body.idInventario);
  const codProdNum = Number(body.codProd);
  const descricao = String(body.descricao || "").trim();
  const codAuxiliar = String(body.codAuxiliar || "").trim();
  const qtdNum = Number(body.novaQuantidadeContada);
  

  if (!Number.isFinite(idInventarioNum) || !Number.isFinite(codProdNum) || !descricao || !codAuxiliar || !Number.isFinite(qtdNum)) {
    return res.status(400).json({ message: "Parâmetros obrigatórios ausentes: idInventario, codProd, descricao, codAuxiliar, novaQuantidadeContada" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const plsql = `
      DECLARE 
          vExisteInventario NUMBER; 
          vUltimoIdProduto  NUMBER; 
          vIdProdutoExist   NUMBER; 
          vRowIdProduto     ROWID; 
          vStage            VARCHAR2(50);
          vLock             NUMBER;
      BEGIN 
          vStage := 'COUNT_INVENTARIO';
          SELECT COUNT(*) 
            INTO vExisteInventario 
            FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS 
           WHERE ID_INVENTARIO = :idInventario; 

          IF vExisteInventario > 0 THEN 
              vStage := 'LOCK_PARENT_INVENTARIO';
              BEGIN
                  SELECT 1
                    INTO vLock
                    FROM MULTGESTI_INVENTARIO_AVULSO
                   WHERE ID_INVENTARIO = :idInventario
                   FOR UPDATE;
              EXCEPTION
                  WHEN NO_DATA_FOUND THEN
                      vLock := 1;
              END;

              vStage := 'GET_MAX_ID';
              SELECT NVL(MAX(ID_PRODUTO), 0)
                INTO vUltimoIdProduto
                FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS
               WHERE ID_INVENTARIO = :idInventario;

              :idProduto := vUltimoIdProduto + 1; 
          ELSE 
              :idProduto := 1; 
          END IF; 

          vStage := 'EXIST_SELECT_FOR_UPDATE';
          BEGIN 
              SELECT ROWID, ID_PRODUTO 
                INTO vRowIdProduto, vIdProdutoExist 
                FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS 
               WHERE CODAUXILIAR = :codAuxiliar 
                 AND ID_INVENTARIO = :idInventario 
               FOR UPDATE; 

          EXCEPTION 
              WHEN NO_DATA_FOUND THEN 
                  vIdProdutoExist := NULL; 
          END; 

          IF vIdProdutoExist IS NOT NULL THEN 
              vStage := 'UPDATE_EXISTING';
              UPDATE MULTGESTI_INVENTARIO_AVULSO_PRODUTOS 
                 SET QT_CONTADA = QT_CONTADA + :novaQuantidadeContada, 
                     DATA_HORA_ULTIMA_CONTAGEM = SYSTIMESTAMP 
               WHERE ROWID = vRowIdProduto; 
          ELSE 
              vStage := 'INSERT_NEW';
              INSERT INTO MULTGESTI_INVENTARIO_AVULSO_PRODUTOS ( 
                  ID_INVENTARIO, 
                  ID_PRODUTO, 
                  CODPROD, 
                  DESCRICAO, 
                  CODAUXILIAR, 
                  QT_CONTADA, 
                  DATA_HORA_PRIMEIRA_CONTAGEM, 
                  DATA_HORA_ULTIMA_CONTAGEM 
              ) VALUES ( 
                  :idInventario, 
                  :idProduto, 
                  :codProd, 
                  :descricao, 
                  :codAuxiliar, 
                  :novaQuantidadeContada, 
                  SYSTIMESTAMP, 
                  SYSTIMESTAMP 
              ); 
          END IF; 
      EXCEPTION
          WHEN OTHERS THEN
              RAISE_APPLICATION_ERROR(-20001, 'INV_AVULSO_PRODUTO:' || vStage || ':' || SQLERRM);
      END; 
    `;

    const binds = {
      idInventario: idInventarioNum,
      idProduto: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      codProd: codProdNum,
      descricao,
      codAuxiliar,
      novaQuantidadeContada: qtdNum,
    };

    try { console.log('[appGestPRO] inventario/avulso/produto binds', { idInventario: idInventarioNum, codProd: codProdNum, descricao, codAuxiliar, novaQuantidadeContada: qtdNum }); } catch {}
    const result = await conn.execute(plsql, binds, { autoCommit: true });
    const outIdProduto = result.outBinds && (result.outBinds.idProduto ?? null);
    return res.json({ ok: true, idProduto: outIdProduto });
  } catch (err) {
    try {
      const e = err || {};
      const info = { message: String(e.message || ''), code: String(e.code || ''), errorNum: Number(e.errorNum || 0), offset: Number(e.offset || 0) };
      console.error('[appGestPRO] Erro inventario/avulso/produto', info);
    } catch {}
    return res.status(500).json({ message: "Erro ao inserir/atualizar produto no inventário", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.get("/api/gestpro/produto-estoque", async (req, res) => {
  const codAuxiliar = String((req.query.codAuxiliar ?? req.query.codauxiliar ?? "")).trim();
  if (!codAuxiliar) {
    return res.status(400).json({ message: "Parâmetro obrigatório ausente: codAuxiliar" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT aa.CODPROD,
             aa.DESCRICAO,
             aa.CODAUXILIAR,
             bb.MARCA,
             cc.FORNECEDOR,
             TO_CHAR(NVL(dd.PTABELA, 0), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS PTABELA,
             TO_CHAR((NVL(ee.QTEST,0) - NVL(ee.QTRESERV,0) - NVL(ee.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_DISPON_F1,
             TO_CHAR((NVL(ee.QTBLOQUEADA,0) - NVL(ee.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_BLOQ_F1,
             TO_CHAR((NVL(ff.QTEST,0) - NVL(ff.QTRESERV,0) - NVL(ff.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_DISPON_F3,
             TO_CHAR((NVL(ff.QTBLOQUEADA,0) - NVL(ff.QTINDENIZ,0)), 'FM999G999G999G990D00', 'NLS_NUMERIC_CHARACTERS=,.') AS EST_BLOQ_F3
        FROM PCPRODUT aa
        LEFT JOIN PCMARCA bb
               ON bb.CODMARCA = aa.CODMARCA
        LEFT JOIN PCFORNEC cc
               ON cc.CODFORNEC = aa.CODFORNEC
        LEFT JOIN PCTABPR dd
               ON dd.CODPROD = aa.CODPROD
              AND dd.NUMREGIAO = 1
        LEFT JOIN PCEST ee
               ON ee.CODFILIAL = 1
              AND ee.CODPROD = aa.CODPROD
        LEFT JOIN PCEST ff
               ON ff.CODFILIAL = 3
              AND ff.CODPROD = aa.CODPROD
       WHERE aa.CODAUXILIAR = :codAuxiliar
    `;
    try { console.log('[appGestPRO] SQL produto-estoque:', sql); } catch {}

    const result = await conn.execute(sql, { codAuxiliar }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.get("/api/gestpro/cliente-por-cpf", async (req, res) => {
  const cpf = String((req.query.cpf ?? req.query.cgcent ?? "")).trim();
  if (!cpf) {
    return res.status(400).json({ message: "Parâmetro obrigatório ausente: cpf" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT CGCENT, CODCLI, CLIENTE, ENDERENT, NUMEROENT, BAIRROENT, MUNICENT, CEPENT
        FROM PCCLIENT
       WHERE CGCENT = :cpf
    `;

    const result = await conn.execute(sql, { cpf }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.get("/api/gestpro/inventario/avulso/usuario", async (req, res) => {
  const codigoRaw = req.query.codigoDoUsuario ?? req.query.codusur ?? req.query.codigoUsuario ?? req.query['códigoDoUsuario'];
  const codigoDoUsuarioNum = Number(codigoRaw);
  if (!Number.isFinite(codigoDoUsuarioNum)) {
    return res.status(400).json({ message: "Parâmetro obrigatório ausente: codigoDoUsuario" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT *
        FROM MULTGESTI_INVENTARIO_AVULSO
       WHERE CODUSUR = :codigoDoUsuario
       AND DATA_ENCERRAMENTO IS NULL
       ORDER BY ID_INVENTARIO ASC
    `;

    const result = await conn.execute(sql, { codigoDoUsuario: codigoDoUsuarioNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.get("/api/gestpro/carrinho-clientes", async (req, res) => {
  const termo = String((req.query.termo ?? "")).trim().toUpperCase();
  const codusuarioNum = Number(req.query.codusur ?? req.query.codusuario ?? req.query.codUsuario ?? 0);
  if (!Number.isFinite(codusuarioNum) || codusuarioNum <= 0) {
    return res.status(400).json({ message: "Parâmetro obrigatório ausente: codusur (>0)" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // Consulta base
    let sql = `
      SELECT CODCLI, CLIENTE, CGCENT
        FROM MULTGESTI_CONSULTAS_CARRINHO_CLIENTES
       WHERE CODUSUR = :codusuario
    `;
    let binds = { codusuario: codusuarioNum };

    // Filtro opcional por nome/CPF contendo termo
    if (termo) {
      sql += ` AND (UPPER(CLIENTE) LIKE :termo OR UPPER(CGCENT) LIKE :termo)`;
      binds.termo = `%${termo}%`;
    }

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.post("/api/gestpro/carrinho-clientes/inserir", async (req, res) => {
  const body = req.body || {};
  const cgcent = String(body.cgcent ?? body.CGCENT ?? "").trim();
  const codcliNum = Number(body.codcli ?? body.CODCLI ?? 0);
  const cliente = String(body.cliente ?? body.CLIENTE ?? "").trim();
  const enderent = String(body.enderent ?? body.ENDERENT ?? "").trim();
  const numeroent = String(body.numeroent ?? body.NUMEROENT ?? "").trim();
  const bairroent = String(body.bairroent ?? body.BAIRROENT ?? "").trim();
  const muncient = String(body.muncient ?? body.MUNICENT ?? "").trim();
  const cepent = String(body.cepent ?? body.CEPENT ?? "").trim();
  const codusurNum = Number(body.codusur ?? body.CODUSUR ?? 0);

  if (!cgcent || !Number.isFinite(codcliNum) || codcliNum <= 0 || !cliente || !Number.isFinite(codusurNum) || codusurNum <= 0) {
    return res.status(400).json({ message: "Parâmetros obrigatórios ausentes: cgcent, codcli (>0), cliente, codusur (>0)" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      MERGE INTO MULTGESTI_CONSULTAS_CARRINHO_CLIENTES t
      USING (
        SELECT
          :cgcent   AS CGCENT,
          :codcli   AS CODCLI,
          :cliente  AS CLIENTE,
          :enderent AS ENDERENT,
          :numeroent AS NUMEROENT,
          :bairroent AS BAIRROENT,
          :muncient  AS MUNICENT,
          :cepent    AS CEPENT,
          :codusur   AS CODUSUR
        FROM DUAL
      ) src
      ON (t.CODCLI = src.CODCLI)
      WHEN NOT MATCHED THEN INSERT (
        CGCENT, CODCLI, CLIENTE, ENDERENT, NUMEROENT, BAIRROENT, MUNICENT, CEPENT, CODUSUR
      ) VALUES (
        src.CGCENT, src.CODCLI, src.CLIENTE, src.ENDERENT, src.NUMEROENT, src.BAIRROENT, src.MUNICENT, src.CEPENT, src.CODUSUR
      )`;

    const binds = {
      cgcent,
      codcli: codcliNum,
      cliente,
      enderent,
      numeroent,
      bairroent,
      muncient,
      cepent,
      codusur: codusurNum,
    };

    const result = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.post("/api/gestpro/inventario/avulso/encerrar", async (req, res) => {
  const body = req.body || {};
  const idInventarioNum = Number(body.idInventario);

  if (!Number.isFinite(idInventarioNum)) {
    return res.status(400).json({ message: "Parâmetro obrigatório ausente: idInventario" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `UPDATE MULTGESTI_INVENTARIO_AVULSO SET DATA_ENCERRAMENTO = SYSDATE WHERE ID_INVENTARIO = :idInventario`;
    const binds = { idInventario: idInventarioNum };
    const result = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao encerrar inventário", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.get("/api/gestpro/inventario/avulso/produtos", async (req, res) => {
  const idRaw = req.query.idInventario ?? req.query.idinventario;
  const idInventarioNum = Number(idRaw);
  if (!Number.isFinite(idInventarioNum)) {
    return res.status(400).json({ message: "Parâmetro obrigatório ausente: idInventario" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT *
        FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS
       WHERE ID_INVENTARIO = :idInventario
       ORDER BY ID_PRODUTO ASC`;

    const result = await conn.execute(sql, { idInventario: idInventarioNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.post("/api/gestpro/carrinho-clientes/produtos/inserir", async (req, res) => {
  const body = req.body || {};
  const codcliNum = Number(body.codcli ?? body.CODCLI ?? 0);
  const codprodNum = Number(body.codprod ?? body.CODPROD ?? 0);
  const descricao = String(body.descricao ?? body.DESCRICAO ?? "").trim();
  const codauxiliar = String(body.codauxiliar ?? body.CODAUXILIAR ?? "").trim();

  if (!Number.isFinite(codcliNum) || codcliNum <= 0 || !Number.isFinite(codprodNum) || codprodNum <= 0) {
    return res.status(400).json({ message: "Parâmetros obrigatórios ausentes: codcli (>0), codprod (>0)" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    // Se já existir o par (CODCLI, CODPROD) não insere novamente
    const sql = `
      MERGE INTO MULTGESTI_CONSULTAS_CARRINHO_CLIENTES_PRODUTOS t
      USING (
        SELECT :codcli AS CODCLI,
               :codprod AS CODPROD,
               :descricao AS DESCRICAO,
               :codauxiliar AS CODAUXILIAR
          FROM DUAL
      ) src
      ON (t.CODCLI = src.CODCLI AND t.CODPROD = src.CODPROD)
      WHEN NOT MATCHED THEN INSERT (
        CODCLI, CODPROD, DESCRICAO, CODAUXILIAR
      ) VALUES (
        src.CODCLI, src.CODPROD, src.DESCRICAO, src.CODAUXILIAR
      )`;

    const binds = { codcli: codcliNum, codprod: codprodNum, descricao, codauxiliar };
    const result = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.get("/api/gestpro/carrinho-clientes/completo", async (req, res) => {
  const codusuarioNum = Number(req.query.codusur ?? req.query.codusuario ?? req.query.codUsuario ?? 0);
  if (!Number.isFinite(codusuarioNum) || codusuarioNum <= 0) {
    return res.status(400).json({ message: "Parâmetro obrigatório ausente: codusur (>0)" });
  }
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT aa.*, bb.*
        FROM MULTGESTI_CONSULTAS_CARRINHO_CLIENTES aa
        JOIN MULTGESTI_CONSULTAS_CARRINHO_CLIENTES_PRODUTOS bb
          ON bb.CODCLI = aa.CODCLI
       WHERE aa.CODUSUR = :codusuario
    `;
    const result = await conn.execute(sql, { codusuario: codusuarioNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.get("/api/gestpro/produtos-promocao-por-depto", async (req, res) => {
  const param = String((req.query.param ?? "")).trim();
  if (!param || (param !== '=' && param !== '<>')) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: param deve ser '=' ou '<>'" });
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
          aa.CODPROD,
          aa.DESCRICAO,
          bb.CODAUXILIAR,
          aa.PRECOFIXO,
          aa.PVENDA1
        FROM MULTGESTI_PRODUTO_EM_PROMOCAO aa
        JOIN PCPRODUT bb ON bb.CODPROD = aa.CODPROD
       WHERE 
         CASE 
           WHEN :param = '='  AND bb.CODEPTO = 10000 THEN 1 
           WHEN :param = '<>' AND bb.CODEPTO <> 10000 THEN 1 
           ELSE 0 
         END = 1`;

    const result = await conn.execute(sql, { param }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.post("/api/login", async (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const result = await conn.execute(
      `SELECT decrypt(senhabd, usuariobd) AS senha,
              nome,
              nome_guerra,
              matricula,
              codfilial
       FROM pcempr
       WHERE nome_guerra = :usuario`,
      [usuario.toUpperCase()],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const userDB = result.rows[0];

    if (userDB.SENHA !== senha.toUpperCase()) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    let codusur = null;
    try {
      const codRes = await conn.execute(
        `SELECT CODUSUR FROM PCUSUARI WHERE NOME_GUERRA = :usuario`,
        [userDB.NOME_GUERRA],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (codRes.rows && codRes.rows.length > 0) {
        codusur = codRes.rows[0].CODUSUR;
      }
    } catch (e) {
      console.error("Falha ao buscar CODUSUR:", e);
    }

    res.json({
      message: "Login realizado com sucesso",
      nome: userDB.NOME,
      usuario: userDB.NOME_GUERRA,
      matricula: userDB.MATRICULA,
      codfilial: userDB.CODFILIAL,
      codusur: codusur,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
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

app.get("/api/gestpro/inventario/produtos-pendentes", async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      SELECT 
            aa.ID_PRODUTO, 
            aa.CODPROD, 
            aa.DESCRICAO, 
            aa.CODAUXILIAR,
            aa.QT_CONTADA 
        FROM 
            MULTGESTI_INVENTARIO_PRODUTOS_PENDENTES aa 
       WHERE 
            aa.DATA_HORA_ULTIMA_CONTAGEM IS NULL
       ORDER BY aa.ID_PRODUTO 
    `;

    const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.post("/api/gestpro/inventario/produtos-pendentes/atualizar-data", async (req, res) => {
  const body = req.body || {};
  const idProduto = Number(body.idProduto);
  const codProduto = Number(body.codProduto);

  if (!Number.isFinite(idProduto) || !Number.isFinite(codProduto)) {
    return res.status(400).json({ message: "Parâmetros obrigatórios inválidos ou ausentes: idProduto, codProduto" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      UPDATE MULTGESTI_INVENTARIO_PRODUTOS_PENDENTES 
      SET DATA_HORA_ULTIMA_CONTAGEM = SYSTIMESTAMP 
      WHERE ID_PRODUTO = :idProduto AND CODPROD = :codProduto
    `;

    const binds = {
      idProduto,
      codProduto
    };

    const result = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });

  } catch (err) {
    console.error("Erro ao atualizar data hora ultima contagem:", err);
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.post("/api/gestpro/inventario/produtos-pendentes", async (req, res) => {
  const body = req.body || {};
  const idProduto = Number(body.idProduto);
  const codProduto = Number(body.codProduto);
  const QtContadaEnviada = Number(body.QtContadaEnviada);
  const codUsuarioEnvio = String(body.codUsuarioEnvio || "");
  const nomeUsuarioEnvio = String(body.nomeUsuarioEnvio || "");

  if (!Number.isFinite(idProduto) || !Number.isFinite(codProduto) || !Number.isFinite(QtContadaEnviada)) {
    return res.status(400).json({ message: "Parâmetros obrigatórios inválidos ou ausentes" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
      MERGE INTO MULTGESTI_INVENTARIO_PRODUTOS_PENDENTES aa 
      USING ( 
          SELECT 
              :idProduto   AS ID_PRODUTO, 
              :codProduto  AS CODPROD, 
              :novaQtContadaEnviada AS QT_ENVIADA, 
              SYSTIMESTAMP     AS DATA_ATUAL, 
              :codUsuarioEnvio || ' - ' || :nomeUsuarioEnvio || ' - ' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI:SS') || ' - Qt: ' || :novaQtContadaEnviada AS LOG_ENVIO 
          FROM dual 
      ) src 
      ON ( 
             aa.ID_PRODUTO = src.ID_PRODUTO 
         AND aa.CODPROD    = src.CODPROD 
      ) 
      WHEN MATCHED THEN 
          UPDATE SET 
              aa.QT_CONTADA = NVL(aa.QT_CONTADA, 0) + src.QT_ENVIADA, 

              aa.DATA_HORA_PRIMEIRA_CONTAGEM = 
                  CASE 
                      WHEN aa.QT_CONTADA IS NULL 
                      THEN src.DATA_ATUAL 
                      ELSE aa.DATA_HORA_PRIMEIRA_CONTAGEM 
                  END, 

              aa.LOGS_ENVIO_CONTAGENS = CASE WHEN aa.LOGS_ENVIO_CONTAGENS IS NULL THEN src.LOG_ENVIO ELSE aa.LOGS_ENVIO_CONTAGENS || ' | ' || src.LOG_ENVIO END
    `;

    const binds = {
      idProduto,
      codProduto,
      novaQtContadaEnviada: QtContadaEnviada,
      codUsuarioEnvio,
      nomeUsuarioEnvio
    };

    const result = await conn.execute(sql, binds, { autoCommit: true });
    return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });

  } catch (err) {
    console.error("Erro ao atualizar produtos pendentes:", err);
    return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.get("/api/gestpro/usuarios", async (req, res) => {
  const termo = String(req.query.termo || "").trim().toUpperCase();
  
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    let sql = `SELECT CODUSUR, NOME FROM PCUSUARI WHERE DTEXCLUSAO IS NULL`;
    const binds = {};

    if (termo) {
      sql += ` AND (UPPER(NOME) LIKE :termo OR TO_CHAR(CODUSUR) = :termoCode)`;
      binds.termo = `%${termo}%`;
      binds.termoCode = termo;
    }
    
    sql += ` ORDER BY NOME`;

    const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [] });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao buscar usuários", detalhe: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (err) {}
    }
  }
});

app.listen(PORT, () => {
  console.log(`Servidor appGestPRO rodando na porta ${PORT}`);
});
