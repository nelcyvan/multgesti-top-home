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
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const d = new Date(t);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
};

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

router.post("/api/gestlog/sangria-lotes/finalizados", async (req, res) => {
  const body = req.body || {};
  const dataInicio = normalizeDate(body.dataInicio ?? body.data_inicio ?? body.inicio);
  const dataFim = normalizeDate(body.dataFim ?? body.data_fim ?? body.fim);

  if (!dataInicio || !dataFim) {
    return res.status(400).json({ message: "dataInicio e dataFim são obrigatórios (ISO 8601 ou timestamp)" });
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
      const resumo = await conn.execute(
        `
          SELECT
            ID_LOTE,
            COUNT(*) AS DUPLICATAS_TOTAL,
            SUM(CASE WHEN CODUSUR_CONCILIACAO IS NULL THEN 1 ELSE 0 END) AS DUPLICATAS_PENDENTES
          FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES
          WHERE TRUNC(DATA_HORA) BETWEEN TRUNC(:dataInicio) AND TRUNC(:dataFim)
          GROUP BY ID_LOTE
        `,
        { dataInicio, dataFim },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const mapResumo = new Map();
      for (const r of resumo?.rows || []) {
        const id = Number(r?.ID_LOTE);
        if (!Number.isFinite(id)) continue;
        mapResumo.set(id, {
          DUPLICATAS_TOTAL: Number(r?.DUPLICATAS_TOTAL ?? 0) || 0,
          DUPLICATAS_PENDENTES: Number(r?.DUPLICATAS_PENDENTES ?? 0) || 0,
        });
      }

      const merged = (rows || []).map((r) => {
        const id = Number(r?.ID_LOTE);
        const agg = mapResumo.get(id) || { DUPLICATAS_TOTAL: 0, DUPLICATAS_PENDENTES: 0 };
        const total = Number(agg.DUPLICATAS_TOTAL ?? 0) || 0;
        const pendentes = Number(agg.DUPLICATAS_PENDENTES ?? 0) || 0;
        const conciliadas = Math.max(0, total - pendentes);
        return {
          ...r,
          DUPLICATAS_TOTAL: total,
          DUPLICATAS_PENDENTES: pendentes,
          DUPLICATAS_CONCILIADAS: conciliadas,
          DUPLICATAS_PENDENTE_TOTAL: `${pendentes}/${total}`,
          DUPLICATAS_CONCILIADAS_TOTAL: `${conciliadas}/${total}`,
        };
      });

      return res.json({ rows: merged, count: merged.length });
    } finally {
      await resultSet.close();
    }
  } catch (err) {
    console.error("Erro ao buscar lotes finalizados (sangria):", err);
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



router.post("/api/gestlog/sangria-lotes/conciliar-lote", async (req, res) => {
  const body = req.body || {};
  const idLote = normalizeNumber(body.idLote ?? body.ID_LOTE ?? body.p_id_lote);
  const codusurConciliacao = normalizeNumber(
    body.codusurConciliacao ?? body.codusur_conciliacao ?? body.codusur ?? body.CODUSUR ?? body.p_codusur_ult_atual
  );

  if (!idLote) {
    return res.status(400).json({ message: "idLote é obrigatório e deve ser numérico" });
  }
  if (!codusurConciliacao) {
    return res.status(400).json({ message: "codusurConciliacao é obrigatório e deve ser numérico" });
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
        p_id_lote: idLote,
        p_data_hora_sangria: null,
        p_codusur_sangria: 0,
        p_data_hora_ult_atual: null,
        p_codusur_ult_atual: codusurConciliacao,
        consultar_lote: "conciliar_lote",
        p_result: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const resultSet = result.outBinds.p_result;
    try {
      const rows = await fetchAllRows(resultSet);
      return res.json({ success: true, idLote, rows, count: rows.length });
    } finally {
      await resultSet.close();
    }
  } catch (err) {
    console.error("Erro ao conciliar lote (sangria):", err);
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

router.post("/api/gestlog/sangria-lotes/conciliar-item", async (req, res) => {
  const body = req.body || {};
  const idLote = normalizeNumber(body.idLote ?? body.ID_LOTE ?? body.id_lote);
  const numnota = normalizeNumber(body.numnota ?? body.NUMNOTA ?? body.numNota ?? body.num_nota);
  const numpedTv8 = normalizeNumber(body.numped_tv8 ?? body.numpedTv8 ?? body.NUMPED_TV8 ?? body.tv8);
  const codusurConciliacao = normalizeNumber(
    body.codusurConciliacao ?? body.codusur_conciliacao ?? body.codusur ?? body.CODUSUR ?? body.CODUSUR_CONCILIACAO
  );
  if (!idLote) {
    return res.status(400).json({ message: "idLote é obrigatório e deve ser numérico" });
  }
  if (!numnota) {
    return res.status(400).json({ message: "numnota é obrigatório e deve ser numérico" });
  }
  if (!numpedTv8) {
    return res.status(400).json({ message: "numped_tv8 é obrigatório e deve ser numérico" });
  }
  if (!codusurConciliacao) {
    return res.status(400).json({ message: "codusurConciliacao é obrigatório e deve ser numérico" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const upd = await conn.execute(
      `
        UPDATE MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES
           SET CONCILIADO = 'S',
               CODUSUR_CONCILIACAO = :codusurConciliacao,
               DATA_HORA_CONCILIACAO = SYSDATE
         WHERE ID_LOTE = :idLote
           AND NUMNOTA = :numnota
           AND NUMPED_TV8 = :numpedTv8
           AND NVL(CONCILIADO, 'N') <> 'S'
      `,
      { idLote, numnota, numpedTv8, codusurConciliacao },
      { autoCommit: true }
    );

    return res.json({ success: true, rowsAffected: upd?.rowsAffected ?? 0 });
  } catch (err) {
    console.error("Erro ao conciliar item (sangria):", err);
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




router.post("/api/gestlog/avulso/buscar-pedido-tv8", async (req, res) => {
  const body = req.body || {};
  const numpedTv8 = normalizeNumber(body.numped_tv8 ?? body.numpedTv8 ?? body.NUMPED_TV8 ?? body.tv8);
  if (!numpedTv8) {
    return res.status(400).json({ message: "numped_tv8 é obrigatório e deve ser numérico" });
  }

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
          aa.NUMPEDENTFUT AS PEDIDO_TV7,
          aa.NUMPED AS PEDIDO_TV8,
          TO_CHAR(aa.DATA, 'YYYY-MM-DD') AS DATA,
          aa.CODCLI,
          bb.CLIENTE,
          aa.VLTOTAL
        FROM PCPEDC aa
        JOIN PCCLIENT bb
          ON bb.CODCLI = aa.CODCLI
        WHERE aa.NUMPED = :numped_tv8
      `,
      { numped_tv8: numpedTv8 },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const row = result?.rows?.[0] ?? null;
    if (!row) return res.status(404).json({ message: "Pedido TV8 não encontrado" });
    return res.json({ success: true, row });
  } catch (err) {
    console.error("Erro ao buscar pedido TV8 (avulso):", err);
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

router.post("/api/gestlog/gestao-sangria-lotes", async (req, res) => {
  const body = req.body || {};

  const consultarLoteRaw =
    body.consultar_lote ??
    body.consultarLote ??
    body.consultar ??
    body.acao ??
    body.action ??
    body.operacao ??
    body.operation;
  const acaoTxt = normalizeString(consultarLoteRaw);
  const consultarLote = consultarLoteRaw === true || consultarLoteRaw === 1 || consultarLoteRaw === "1" || acaoTxt === "consultar_lote";
  const atualizarSaldoAvulso = acaoTxt === "atualizar_saldo_avulso";
  const listarAvulsos = acaoTxt === "listar_avulsos";
  const acao = consultarLote
    ? "consultar_lote"
    : atualizarSaldoAvulso
      ? "atualizar_saldo_avulso"
      : listarAvulsos
        ? "listar_avulsos"
        : null;

  const idLote = normalizeNumber(body.idLote ?? body.ID_LOTE ?? body.p_id_lote);
  const codfilialRaw = body.codfilial ?? body.codFilial ?? body.CODFILIAL ?? body.p_codfilial;
  const codfilial =
    codfilialRaw == null ? null : String(codfilialRaw).trim() ? String(codfilialRaw).trim() : null;
  const codusurSangria = normalizeNumber(
    body.codusurSangria ?? body.codUsurSangria ?? body.CODUSUR_SANGRIA ?? body.p_codusur_sangria
  );
  const codigoFilialAvulso = normalizeNumber(body.codigoFilial ?? body.codigo_filial ?? body.codfilial ?? body.codFilial ?? body.CODFILIAL);
  const codigoFilialAvulsoTxt = normalizeString(body.codigoFilial ?? body.codigo_filial ?? body.codfilial ?? body.codFilial ?? body.CODFILIAL);
  const novoValorParaSerAtualizado = normalizeNumber(
    body.novoValorParaSerAtualizado ??
      body.novo_valor_para_ser_atualizado ??
      body.valorAvulso ??
      body.valor_avulso ??
      body.valor ??
      body.vl_saldo_dinheiro_avulso
  );
  const codcliAvulso = normalizeNumber(body.codcli ?? body.CODCLI ?? body.codigoCliente ?? body.codigo_cliente);
  const codusurAvulso = normalizeNumber(
    body.codusur ?? body.codusurUltAtual ?? body.codUsurUltAtual ?? body.CODUSUR_ULT_ATUAL ?? body.CODUSUR
  );
  const numpedTv7Avulso = normalizeNumber(body.numpedTv7 ?? body.NUMPED_TV7 ?? body.tv7);
  const numpedTv8Avulso = normalizeNumber(body.numpedTv8 ?? body.NUMPED_TV8 ?? body.tv8);
  const vlSaldoFundoCx = normalizeNumber(
    body.vlSaldoFundoCx ??
      body.vl_saldo_fundo_cx ??
      body.vlSaldoFundoCaixa ??
      body.vl_saldo_fundo_caixa ??
      body.fundoCaixa ??
      body.fundo_caixa ??
      body.valorFundoCaixa ??
      body.valor_fundo_caixa
  );

  const dataHoraSangria =
    normalizeDate(body.dataHoraSangria ?? body.DATA_HORA_SANGRIA ?? body.p_data_hora_sangria) ??
    new Date();
  const dataHoraUltAtual =
    normalizeDate(body.dataHoraUltAtual ?? body.DATA_HORA_ULT_ATUAL ?? body.p_data_hora_ult_atual) ??
    new Date();

  const codusurUltAtual = normalizeNumber(
    body.codusurUltAtual ??
      body.codUsurUltAtual ??
      body.CODUSUR_ULT_ATUAL ??
      body.p_codusur_ult_atual ??
      codusurSangria
  );

  if (!idLote) {
    return res.status(400).json({ message: "idLote é obrigatório e deve ser numérico" });
  }
  if (atualizarSaldoAvulso) {
    if (!novoValorParaSerAtualizado || novoValorParaSerAtualizado <= 0) {
      return res.status(400).json({ message: "novoValorParaSerAtualizado é obrigatório e deve ser maior que zero" });
    }
    if (!codusurAvulso) {
      return res.status(400).json({ message: "codusur é obrigatório e deve ser numérico" });
    }
  }
  if (!consultarLote && !atualizarSaldoAvulso && !listarAvulsos && !codusurSangria) {
    return res.status(400).json({ message: "codusurSangria é obrigatório e deve ser numérico" });
  }
  if (!consultarLote && !atualizarSaldoAvulso && !listarAvulsos && !codusurUltAtual) {
    return res.status(400).json({ message: "codusurUltAtual é obrigatório e deve ser numérico" });
  }
  if (!consultarLote && !atualizarSaldoAvulso && !listarAvulsos && !Number.isFinite(dataHoraSangria.getTime())) {
    return res.status(400).json({ message: "dataHoraSangria inválida (ISO 8601 ou timestamp)" });
  }
  if (!consultarLote && !atualizarSaldoAvulso && !listarAvulsos && !Number.isFinite(dataHoraUltAtual.getTime())) {
    return res.status(400).json({ message: "dataHoraUltAtual inválida (ISO 8601 ou timestamp)" });
  }
  if (vlSaldoFundoCx != null && vlSaldoFundoCx < 0) {
    return res.status(400).json({ message: "vlSaldoFundoCx deve ser maior ou igual a zero" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    if (consultarLote) {
      const somenteConciliados =
        body.somenteConciliados === true ||
        body.somenteConciliados === 1 ||
        body.somenteConciliados === "1" ||
        normalizeString(body.somenteConciliados) === "true";

      const sql = `
        SELECT
          ROWIDTOCHAR(l.ROWID) AS ROW_ID,
          l.ID_LOTE,
          l.CODFILIAL,
          l.NUMPED_TV7,
          l.NUMNOTA,
          l.CODCLI,
          cli.CLIENTE,
          l.VL_DINHEIRO,
          l.DATA_HORA,
          l.CODUSUR,
          usur.NOME,
          l.CONCILIADO,
          l.CODUSUR_CONCILIACAO,
          l.DATA_HORA_CONCILIACAO,
          (
            SELECT LISTAGG(x.DUPLIC, ', ') WITHIN GROUP (ORDER BY x.DUPLIC)
              FROM (
                    SELECT DISTINCT p.DUPLIC
                      FROM PCPREST p
                     WHERE p.NUMPED = l.NUMPED_TV7
                       AND p.DUPLIC IS NOT NULL
              ) x
          ) AS DUPLICATA,
          l.TIPO_ENTREGA_RETIRA_ANTERIOR,
          l.NUMPED_TV8
        FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES l
        LEFT JOIN PCCLIENT cli
          ON cli.CODCLI = l.CODCLI
        LEFT JOIN PCUSUARI usur
          ON usur.CODUSUR = l.CODUSUR
        WHERE l.ID_LOTE = :idLote
        ${somenteConciliados ? " AND NVL(l.CONCILIADO, 'N') = 'S'" : ""}
        ORDER BY l.DATA_HORA ASC, l.NUMNOTA ASC
      `;

      const result = await conn.execute(sql, { idLote }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const rows = result?.rows || [];
      return res.json({ success: true, idLote, rows, count: rows.length });
    }

    if (atualizarSaldoAvulso) {
      const pCodfilial = codfilial ?? codigoFilialAvulsoTxt ?? (codigoFilialAvulso ? String(codigoFilialAvulso) : null);
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
             ,:p_codcli
             ,:p_vl_dinheiro_avulso
             ,:p_codfilial
             ,:p_codusur
             ,:p_numped_tv7
             ,:p_numped_tv8
           );
         END;`,
        {
          p_id_lote: idLote,
          p_data_hora_sangria: new Date(),
          p_codusur_sangria: codigoFilialAvulso,
          p_data_hora_ult_atual: new Date(),
          p_codusur_ult_atual: novoValorParaSerAtualizado,
          consultar_lote: "atualizar_saldo_avulso",
          p_result: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
          p_codcli: codcliAvulso ?? 0,
          p_vl_dinheiro_avulso: novoValorParaSerAtualizado,
          p_codfilial: pCodfilial,
          p_codusur: codusurAvulso,
          p_numped_tv7: numpedTv7Avulso ?? 0,
          p_numped_tv8: numpedTv8Avulso ?? 0,
        },
        { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const resultSet = result.outBinds.p_result;
      try {
        const rows = await fetchAllRows(resultSet);
        const vlSaldoDinheiroAvulso = rows?.[0]?.VL_SALDO_DINHEIRO_AVULSO ?? null;
        return res.json({
          success: true,
          idLote,
          CODFILIAL: rows?.[0]?.CODFILIAL ?? codigoFilialAvulso ?? pCodfilial,
          novoValorParaSerAtualizado,
          VL_SALDO_DINHEIRO_AVULSO: vlSaldoDinheiroAvulso == null ? null : String(vlSaldoDinheiroAvulso),
        });
      } finally {
        await resultSet.close();
      }
    }

    if (listarAvulsos) {
      const pCodfilial = codfilial ?? (codigoFilialAvulso ? String(codigoFilialAvulso) : null);
      const result = await conn.execute(
        `BEGIN
           GESTLOG_GESTAO_SANGRIA_LOTES(
             p_id_lote => :p_id_lote,
             p_data_hora_sangria => NULL,
             p_codusur_sangria => 0,
             p_data_hora_ult_atual => NULL,
             p_codusur_ult_atual => 0,
             consultar_lote => :consultar_lote,
             p_result => :p_result,
             p_codfilial => :p_codfilial
           );
         END;`,
        {
          p_id_lote: idLote,
          consultar_lote: "listar_avulsos",
          p_result: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
          p_codfilial: pCodfilial,
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const resultSet = result.outBinds.p_result;
      try {
        const rows = await fetchAllRows(resultSet);
        return res.json({ success: true, idLote, rows, count: rows.length });
      } finally {
        await resultSet.close();
      }
    }

    await conn.execute(
      `BEGIN
         GESTLOG_GESTAO_SANGRIA_LOTES(
           p_id_lote => :p_id_lote,
           p_data_hora_sangria => :p_data_hora_sangria,
           p_codusur_sangria => :p_codusur_sangria,
           p_data_hora_ult_atual => :p_data_hora_ult_atual,
           p_codusur_ult_atual => :p_codusur_ult_atual,
           consultar_lote => :consultar_lote,
           p_result => :p_result,
           p_codfilial => :p_codfilial,
           p_vl_saldo_fundo_cx => :p_vl_saldo_fundo_cx
         );
       END;`,
      {
        p_id_lote: idLote,
        p_data_hora_sangria: consultarLote ? new Date() : dataHoraSangria,
        p_codusur_sangria: consultarLote ? 0 : codusurSangria,
        p_data_hora_ult_atual: consultarLote ? new Date() : dataHoraUltAtual,
        p_codusur_ult_atual: consultarLote ? 0 : codusurUltAtual,
        consultar_lote: acao,
        p_result: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
        p_codfilial: codfilial,
        p_vl_saldo_fundo_cx: vlSaldoFundoCx,
      },
      { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let nextSql = `
      SELECT ID_LOTE
        FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO
       WHERE DATA_HORA_SANGRIA IS NULL
    `;
    const nextBinds = {};
    if (codfilial) {
      nextSql += " AND CODFILIAL = :codfilial";
      nextBinds.codfilial = codfilial;
    }
    nextSql += `
       ORDER BY ID_LOTE DESC
       FETCH FIRST 1 ROWS ONLY
    `;

    const nextLoteResult = await conn.execute(nextSql, nextBinds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    const novoIdLote = nextLoteResult?.rows?.[0]?.ID_LOTE ?? null;

    return res.json({
      success: true,
      idLoteAnterior: idLote,
      novoIdLote,
    });
  } catch (err) {
    console.error("Erro ao executar GESTLOG_GESTAO_SANGRIA_LOTES:", err);
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
