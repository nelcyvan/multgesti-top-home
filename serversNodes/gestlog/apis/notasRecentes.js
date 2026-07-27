import express from "express";
import oracledb from "oracledb";

const router = express.Router();

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

function formatOraError(err) {
  if (!err) return { message: "Erro desconhecido" };
  const e = err instanceof Error ? err : null;
  const anyErr = err;
  const message = e?.message ?? (typeof anyErr?.message === "string" ? anyErr.message : String(anyErr));
  const out = { message };
  if (typeof anyErr?.errorNum === "number") out.errorNum = anyErr.errorNum;
  if (typeof anyErr?.offset === "number") out.offset = anyErr.offset;
  if (typeof anyErr?.code === "string") out.code = anyErr.code;
  return out;
}

async function executarProcedureNotasRecentes(conn, { dataInicio, dataFim, tipoEntrega }) {
  const plsql = `
BEGIN
  GESTLOG_NOTAS_RECENTES(
    p_data_inicio => :p_data_inicio,
    p_data_fim => :p_data_fim,
    p_tipo_entrega => :p_tipo_entrega,
    p_result => :p_result,
    p_vl_saldo_dinheiro => :p_vl_saldo_dinheiro,
    p_vl_saldo_dinheiro_avulso => :p_vl_saldo_dinheiro_avulso,
    p_vl_saldo_fundo_cx => :p_vl_saldo_fundo_cx,
    p_id_lote => :p_id_lote
  );
END;`;

  const binds = {
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
    p_tipo_entrega: tipoEntrega ?? null,
    p_result: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
    p_vl_saldo_dinheiro: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    p_vl_saldo_dinheiro_avulso: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    p_vl_saldo_fundo_cx: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    p_id_lote: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  };

  const result = await conn.execute(plsql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

  const resultSet = result.outBinds.p_result;
  try {
    const rows = await fetchAllRows(resultSet);
    return {
      rows,
      vlSaldoDinheiro: result.outBinds.p_vl_saldo_dinheiro ?? null,
      vlSaldoDinheiroAvulso: result.outBinds.p_vl_saldo_dinheiro_avulso ?? null,
      vlSaldoFundoCx: result.outBinds.p_vl_saldo_fundo_cx ?? null,
      idLote: result.outBinds.p_id_lote ?? null,
    };
  } finally {
    await resultSet.close();
  }
}

router.get("/api/gestlog/notas-recentes", async (req, res) => {
  const dataInicio = typeof req.query?.dataInicio === "string" ? req.query.dataInicio.trim() : "";
  const dataFim = typeof req.query?.dataFim === "string" ? req.query.dataFim.trim() : "";
  const tiposEntregaRaw = req.query?.tiposEntrega;
  const tiposEntregaInput = Array.isArray(tiposEntregaRaw)
    ? tiposEntregaRaw
    : typeof tiposEntregaRaw === "string"
      ? tiposEntregaRaw.split(",")
      : [];
  const tiposEntrega = tiposEntregaInput
    .map((v) => String(v ?? "").trim().toUpperCase())
    .filter(Boolean);
  const tiposEntregaPermitidos = new Set(["RP", "EN", "EF"]);
  const tiposEntregaInvalidos = tiposEntrega.filter((v) => !tiposEntregaPermitidos.has(v));
  if (tiposEntregaInvalidos.length) {
    return res.status(400).json({
      message: "tiposEntrega inválido. Valores permitidos: RP, EN, EF",
      detalhe: { invalidos: Array.from(new Set(tiposEntregaInvalidos)) },
    });
  }

  const tiposEntregaUnicos = Array.from(new Set(tiposEntrega));
  if (!dataInicio || !dataFim) {
    return res.status(400).json({ message: "dataInicio e dataFim são obrigatórios (YYYY-MM-DD)" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    return res.status(400).json({ message: "dataInicio/dataFim inválidos. Use YYYY-MM-DD" });
  }
  if (dataInicio > dataFim) {
    return res.status(400).json({ message: "dataInicio não pode ser maior que dataFim" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    let rows = [];
    let vlSaldoDinheiro = null;
    let vlSaldoDinheiroAvulso = null;
    let vlSaldoFundoCx = null;
    let idLote = null;

    if (tiposEntregaUnicos.length === 0) {
      const proc = await executarProcedureNotasRecentes(conn, { dataInicio, dataFim, tipoEntrega: null });
      rows = proc.rows;
      vlSaldoDinheiro = proc.vlSaldoDinheiro;
      vlSaldoDinheiroAvulso = proc.vlSaldoDinheiroAvulso;
      vlSaldoFundoCx = proc.vlSaldoFundoCx;
      idLote = proc.idLote;
    } else if (tiposEntregaUnicos.length === 1) {
      const proc = await executarProcedureNotasRecentes(conn, {
        dataInicio,
        dataFim,
        tipoEntrega: tiposEntregaUnicos[0],
      });
      rows = proc.rows;
      vlSaldoDinheiro = proc.vlSaldoDinheiro;
      vlSaldoDinheiroAvulso = proc.vlSaldoDinheiroAvulso;
      vlSaldoFundoCx = proc.vlSaldoFundoCx;
      idLote = proc.idLote;
    } else if (!tiposEntregaUnicos.includes("RP")) {
      const proc = await executarProcedureNotasRecentes(conn, { dataInicio, dataFim, tipoEntrega: null });
      rows = (proc.rows || []).filter((r) => tiposEntregaUnicos.includes(String(r.TIPOENTREGA ?? "").trim().toUpperCase()));
      vlSaldoDinheiro = proc.vlSaldoDinheiro;
      vlSaldoDinheiroAvulso = proc.vlSaldoDinheiroAvulso;
      vlSaldoFundoCx = proc.vlSaldoFundoCx;
      idLote = proc.idLote;
    } else {
      const mergedRows = [];
      for (const tipoEntrega of tiposEntregaUnicos) {
        const proc = await executarProcedureNotasRecentes(conn, { dataInicio, dataFim, tipoEntrega });
        if (vlSaldoDinheiro == null) vlSaldoDinheiro = proc.vlSaldoDinheiro;
        if (vlSaldoDinheiroAvulso == null) vlSaldoDinheiroAvulso = proc.vlSaldoDinheiroAvulso;
        if (vlSaldoFundoCx == null) vlSaldoFundoCx = proc.vlSaldoFundoCx;
        if (idLote == null) idLote = proc.idLote;
        mergedRows.push(...(proc.rows || []));
      }
      rows = mergedRows;
    }

    const VL_SALDO_DINHEIRO = vlSaldoDinheiro == null ? null : String(vlSaldoDinheiro);
    const VL_SALDO_DINHEIRO_AVULSO = vlSaldoDinheiroAvulso == null ? null : String(vlSaldoDinheiroAvulso);
    const VL_SALDO_FUNDO_CX = vlSaldoFundoCx == null ? null : String(vlSaldoFundoCx);
    const ID_LOTE = idLote ?? null;

    return res.json({
      rows: rows || [],
      count: (rows || []).length,
      VL_SALDO_DINHEIRO,
      VL_SALDO_DINHEIRO_AVULSO,
      VL_SALDO_FUNDO_CX,
      ID_LOTE,
    });
  } catch (err) {
    console.error("Erro ao buscar notas recentes GestLOG:", err);
    return res.status(500).json({ message: "Erro interno ao buscar notas recentes", detalhe: formatOraError(err) });
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
