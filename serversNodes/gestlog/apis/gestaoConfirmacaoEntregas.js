import express from "express";
import oracledb from "oracledb";

const router = express.Router();

const normalizeNumber = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseValor = (v) => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const raw = String(v).trim();
  if (!raw) return null;
  const s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const extractOracleAppErrorMessage = (err) => {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const m = msg.match(/ORA-(\d{5}):\s*([^]*?)(?:\n|$)/);
  if (!m) return null;
  const code = Number(m[1]);
  const message = String(m[2] ?? "").trim();
  if (!Number.isFinite(code) || code < 20000 || code > 20999) return null;
  return message || msg;
};

router.post("/api/gestlog/marcar-sitdoc", async (req, res) => {
  const body = req.body || {};

  const nNota = normalizeNumber(body.numNota ?? body.p_num_nota);
  const nPed = normalizeNumber(body.numPedidoTv8 ?? body.p_num_pedido_tv8);
  const nIdLote = normalizeNumber(body.ID_LOTE ?? body.idLote ?? body.p_id_lote);
  const tipoAnteriorEntregaOuRetiraRaw = body.p_tipo_anterior_entrega_ou_retira ?? body.tipoAnteriorEntregaOuRetira;
  const novoTipoEntregaOuRetiraRaw = body.p_novo_tipo_entrega_ou_retira ?? body.novoTipoEntregaOuRetira;
  const tipoAnteriorEntregaOuRetira =
    tipoAnteriorEntregaOuRetiraRaw == null ? null : String(tipoAnteriorEntregaOuRetiraRaw).trim().toUpperCase();
  const novoTipoEntregaOuRetira =
    novoTipoEntregaOuRetiraRaw == null ? null : String(novoTipoEntregaOuRetiraRaw).trim().toUpperCase();
  const semDinheiroRaw = body.semDinheiro ?? body.p_sem_dinheiro;
  const semDin =
    semDinheiroRaw === true ||
    semDinheiroRaw === 1 ||
    semDinheiroRaw === "1" ||
    String(semDinheiroRaw ?? "").toLowerCase() === "true";
  const nCodUsurUltAtual = normalizeNumber(body.codusurUltAtual ?? body.p_codusur_ult_atual);

  if (!nNota) {
    return res.status(400).json({ message: "numNota é obrigatório e deve ser numérico" });
  }
  if (!nPed) {
    return res.status(400).json({ message: "numPedidoTv8 é obrigatório e deve ser numérico" });
  }
  if (!nIdLote || nIdLote <= 0) {
    return res.status(400).json({ message: "ID_LOTE é obrigatório e deve ser numérico (maior que zero)" });
  }

  const vldespacho = semDin ? 0 : parseValor(body.valorDespacho ?? body.p_valor_despacho);
  if (!semDin && (vldespacho == null || vldespacho <= 0)) {
    return res.status(400).json({ message: "valorDespacho é obrigatório (maior que zero) ou marque semDinheiro" });
  }
  if (vldespacho > 0 && (!nCodUsurUltAtual || nCodUsurUltAtual <= 0)) {
    return res.status(400).json({ message: "codusurUltAtual é obrigatório e deve ser numérico (usuário logado)" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    await conn.execute(
      `BEGIN
         GESTLOG_GESTAO_CONFIRMACAO_ENTREGAS(
           :p_num_nota,
           :p_num_pedido_tv8,
           :p_valor_despacho,
           :p_sem_dinheiro,
           :p_codusur_ult_atual,
           :p_id_lote,
           :p_tipo_anterior_entrega_ou_retira,
           :p_novo_tipo_entrega_ou_retira
         );
       END;`,
      {
        p_num_nota: nNota,
        p_num_pedido_tv8: nPed,
        p_valor_despacho: vldespacho ?? 0,
        p_sem_dinheiro: semDin ? 1 : 0,
        p_codusur_ult_atual: vldespacho > 0 ? nCodUsurUltAtual : 0,
        p_id_lote: nIdLote,
        p_tipo_anterior_entrega_ou_retira: tipoAnteriorEntregaOuRetira,
        p_novo_tipo_entrega_ou_retira: novoTipoEntregaOuRetira,
      },
      { autoCommit: true, outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const chkNf = await conn.execute(
      `SELECT COUNT(1) AS C
         FROM PCNFSAID
        WHERE NUMNOTA = :numNota
          AND NUMPED = :numPed
          AND SITDOC = 'S'`,
      { numNota: nNota, numPed: nPed },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const rowsAffected = Number(chkNf?.rows?.[0]?.C ?? 0) > 0 ? 1 : 0;

    let rowsAffectedSaldo = 0;
    let rowsAffectedLote = 0;
    if (vldespacho > 0) {
      const chkSaldo = await conn.execute(
        `SELECT COUNT(1) AS C
           FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO
          WHERE CODFILIAL = 3`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      rowsAffectedSaldo = Number(chkSaldo?.rows?.[0]?.C ?? 0) > 0 ? 1 : 0;

      const chkLote = await conn.execute(
        `SELECT COUNT(1) AS C
           FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES
          WHERE ID_LOTE = :idLote
            AND CODFILIAL = '3'
            AND NUMNOTA = :numNota
            AND CODUSUR = :codusur`,
        {
          idLote: nIdLote,
          numNota: nNota,
          codusur: nCodUsurUltAtual,
        },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      rowsAffectedLote = Number(chkLote?.rows?.[0]?.C ?? 0) > 0 ? 1 : 0;
    }

    return res.json({ success: true, rowsAffected, rowsAffectedSaldo, rowsAffectedLote });
  } catch (err) {
    const appMsg = extractOracleAppErrorMessage(err);
    if (appMsg) {
      return res.status(400).json({ message: appMsg });
    }
    console.error("Erro ao executar GESTLOG_GESTAO_CONFIRMACAO_ENTREGAS:", err);
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

router.post("/api/gestlog/editar-entrega", async (req, res) => {
  const body = req.body || {};

  const nNota = normalizeNumber(body.numNota ?? body.p_num_nota);
  const nPed = normalizeNumber(body.numPedidoTv8 ?? body.p_num_pedido_tv8);
  const nIdLote = normalizeNumber(body.ID_LOTE ?? body.idLote ?? body.p_id_lote);
  const nCodUsurUltAtual = normalizeNumber(body.codusurUltAtual ?? body.p_codusur_ult_atual);
  const novoTipoEntregaOuRetiraRaw = body.p_novo_tipo_entrega_ou_retira ?? body.novoTipoEntregaOuRetira;
  const novoTipoEntregaOuRetira =
    novoTipoEntregaOuRetiraRaw == null ? null : String(novoTipoEntregaOuRetiraRaw).trim().toUpperCase();

  if (!nNota) {
    return res.status(400).json({ message: "numNota é obrigatório e deve ser numérico" });
  }
  if (!nPed) {
    return res.status(400).json({ message: "numPedidoTv8 é obrigatório e deve ser numérico" });
  }
  if (!nCodUsurUltAtual || nCodUsurUltAtual <= 0) {
    return res.status(400).json({ message: "codusurUltAtual é obrigatório e deve ser numérico (usuário logado)" });
  }
  if (!novoTipoEntregaOuRetira || !["EN", "RP"].includes(novoTipoEntregaOuRetira)) {
    return res.status(400).json({ message: "novoTipoEntregaOuRetira inválido (use EN ou RP)" });
  }

  const novoVlDespacho = parseValor(body.valorDespacho ?? body.p_valor_despacho);
  if (novoVlDespacho == null || novoVlDespacho < 0) {
    return res.status(400).json({ message: "valorDespacho é obrigatório e deve ser numérico (maior ou igual a zero)" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const nfRes = await conn.execute(
      `SELECT NUMNOTA, NUMPED, SITDOC, NVL(VLDESPACHO, 0) AS VLDESPACHO
         FROM PCNFSAID
        WHERE NUMNOTA = :numNota
          AND NUMPED = :numPed
        FOR UPDATE`,
      { numNota: nNota, numPed: nPed },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const nfRow = nfRes?.rows?.[0] || null;
    if (!nfRow) {
      return res.status(404).json({ message: "NF-e não encontrada para edição" });
    }
    if (String(nfRow.SITDOC ?? "").trim().toUpperCase() !== "S") {
      return res.status(400).json({ message: "A NF-e precisa estar confirmada (SITDOC = 'S') para editar" });
    }

    const vlAnterior = normalizeNumber(nfRow.VLDESPACHO) ?? 0;
    const delta = Number(novoVlDespacho) - Number(vlAnterior);

    if (delta !== 0 && (!nIdLote || nIdLote <= 0)) {
      return res.status(400).json({ message: "ID_LOTE é obrigatório (maior que zero) para alterar o valor em dinheiro" });
    }

    await conn.execute(
      `UPDATE PCNFSAID
          SET VLDESPACHO = :novoVl
        WHERE NUMNOTA = :numNota
          AND NUMPED = :numPed`,
      { novoVl: Number(novoVlDespacho), numNota: nNota, numPed: nPed },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (delta !== 0) {
      const saldoRes = await conn.execute(
        `UPDATE MULTGESTI_FINANCEIRO_SALDO_DINHEIRO s
            SET s.VL_SALDO_DINHEIRO = NVL(s.VL_SALDO_DINHEIRO, 0) + :delta,
                s.DATA_HORA_ULT_ATUAL = SYSDATE,
                s.CODUSUR_ULT_ATUAL = :codusur,
                s.ID_LOTE = :idLote
          WHERE s.CODFILIAL = 3
            AND s.ID_LOTE = :idLote
            AND s.DATA_HORA_SANGRIA IS NULL
            AND s.CODUSUR_SANGRIA IS NULL`,
        { delta, codusur: nCodUsurUltAtual, idLote: nIdLote },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!saldoRes?.rowsAffected) {
        throw new Error("Saldo não encontrado para atualização (lote/filial)");
      }
    }

    if (delta !== 0 && nIdLote && nIdLote > 0) {
      const loteExistsRes = await conn.execute(
        `SELECT COUNT(1) AS C
           FROM MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES l
          WHERE l.ID_LOTE = :idLote
            AND l.CODFILIAL = '3'
            AND l.NUMNOTA = :numNota
            AND l.NUMPED_TV8 = :numPed`,
        { idLote: nIdLote, numNota: nNota, numPed: nPed },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const loteExists = Number(loteExistsRes?.rows?.[0]?.C ?? 0) > 0;

      if (loteExists) {
        await conn.execute(
          `UPDATE MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES l
              SET l.VL_DINHEIRO = :novoVl,
                  l.DATA_HORA = SYSDATE,
                  l.CODUSUR = :codusur
            WHERE l.ID_LOTE = :idLote
              AND l.CODFILIAL = '3'
              AND l.NUMNOTA = :numNota
              AND l.NUMPED_TV8 = :numPed`,
          {
            novoVl: Number(novoVlDespacho),
            codusur: nCodUsurUltAtual,
            idLote: nIdLote,
            numNota: nNota,
            numPed: nPed,
          },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
      } else if (Number(novoVlDespacho) > 0) {
        const pedRes = await conn.execute(
          `SELECT NUMPEDENTFUT AS NUMPED_TV7, CODCLI
             FROM PCPEDC
            WHERE NUMPED = :numPed`,
          { numPed: nPed },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        const pedRow = pedRes?.rows?.[0] || null;
        if (!pedRow) {
          return res.status(400).json({ message: "Pedido não encontrado para inserir registro do lote" });
        }

        await conn.execute(
          `INSERT INTO MULTGESTI_FINANCEIRO_SALDO_DINHEIRO_LOTES (
              ID_LOTE,
              CODFILIAL,
              NUMPED_TV7,
              NUMPED_TV8,
              NUMNOTA,
              CODCLI,
              VL_DINHEIRO,
              DATA_HORA,
              CODUSUR
          ) VALUES (
              :idLote,
              '3',
              :numpedTv7,
              :numpedTv8,
              :numNota,
              :codcli,
              :vlDinheiro,
              SYSDATE,
              :codusur
          )`,
          {
            idLote: nIdLote,
            numpedTv7: normalizeNumber(pedRow.NUMPED_TV7) ?? 0,
            numpedTv8: nPed,
            numNota: nNota,
            codcli: normalizeNumber(pedRow.CODCLI) ?? 0,
            vlDinheiro: Number(novoVlDespacho),
            codusur: nCodUsurUltAtual,
          },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
      }
    }

    const tipoRes = await conn.execute(
      `UPDATE PCPEDI
          SET TIPOENTREGA = :tipo
        WHERE NUMPED = :numPed`,
      { tipo: novoTipoEntregaOuRetira, numPed: nPed },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!tipoRes?.rowsAffected) {
      return res.status(400).json({ message: "Não foi possível atualizar o tipo de entrega do pedido" });
    }

    await conn.commit();
    return res.json({
      success: true,
      numNota: nNota,
      numPedidoTv8: nPed,
      idLote: nIdLote ?? null,
      valorAnterior: vlAnterior,
      valorNovo: Number(novoVlDespacho),
      delta,
      tipoNovo: novoTipoEntregaOuRetira,
    });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    const appMsg = extractOracleAppErrorMessage(err);
    if (appMsg) {
      return res.status(400).json({ message: appMsg });
    }
    console.error("Erro ao editar entrega:", err);
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
