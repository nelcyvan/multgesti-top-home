import { buscarPrecoPromocional } from "./auditoriaPromoPreco.js";

async function recalcularTotaisAuditoria(conn, codAuditoria) {
  await conn.execute(
    `UPDATE GESTPRO_AUDITORIA a
        SET QTITENS = (
              SELECT COUNT(*)
                FROM GESTPRO_AUDITORIA_PRODUTOS p
               WHERE p.CODAUDITORIA = a.CODAUDITORIA
            ),
            QTDIVERGENCIAS = (
              SELECT COUNT(*)
                FROM GESTPRO_AUDITORIA_PRODUTOS p
               WHERE p.CODAUDITORIA = a.CODAUDITORIA
                 AND p.DIVERGENTE = 'S'
            )
      WHERE a.CODAUDITORIA = :codAuditoria`,
    { codAuditoria },
    { autoCommit: false }
  );
}

function normalizarFlagSN(valor, padrao = "N") {
  if (valor === undefined || valor === null || valor === "") return padrao;
  const v = String(valor).trim().toUpperCase();
  return v === "S" ? "S" : "N";
}

function calcularDivergente(precoEtiqueta, precoSistema, flags = {}) {
  const codBarrasErrado = normalizarFlagSN(flags.codBarrasErrado);
  const codInternoErrado = normalizarFlagSN(flags.codInternoErrado);
  const unMedidaErrado = normalizarFlagSN(flags.unMedidaErrado);
  const semEtiqueta = normalizarFlagSN(flags.semEtiqueta);
  if (
    codBarrasErrado === "S" ||
    codInternoErrado === "S" ||
    unMedidaErrado === "S" ||
    semEtiqueta === "S"
  ) {
    return "S";
  }
  if (precoEtiqueta == null || precoSistema == null) return "N";
  if (!Number.isFinite(precoEtiqueta) || !Number.isFinite(precoSistema)) return "N";
  return precoEtiqueta !== precoSistema ? "S" : "N";
}

async function auditoriaPermiteAlteracao(conn, oracledb, codAuditoria) {
  const r = await conn.execute(
    `SELECT STATUS FROM GESTPRO_AUDITORIA WHERE CODAUDITORIA = :codAuditoria`,
    { codAuditoria },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  const row = (r.rows || [])[0];
  if (!row) return { ok: false, status: 404, message: "Auditoria não encontrada" };
  const status = String(row.STATUS || "").toUpperCase();
  if (status === "FINALIZADA" || status === "CANCELADA") {
    return {
      ok: false,
      status: 409,
      message: `Auditoria com status ${status} não permite alteração de produtos`,
    };
  }
  return { ok: true, statusAuditoria: status };
}

export default function registerAuditoriaProduto(router, { oracledb }) {
  router.post("/auditoria/produto", async (req, res) => {
    const body = req.body || {};
    const codAuditoria = Number(body.codAuditoria);
    const codProd = Number(body.codProd);
    const codAuxiliar = String(body.codAuxiliar || "").trim() || null;
    const precoEtiqueta =
      body.precoEtiqueta !== undefined && body.precoEtiqueta !== null && body.precoEtiqueta !== ""
        ? Number(body.precoEtiqueta)
        : null;
    const precoSistema =
      body.precoSistema !== undefined && body.precoSistema !== null && body.precoSistema !== ""
        ? Number(body.precoSistema)
        : null;
    const codUsuarioConf =
      body.codUsuarioConf !== undefined && body.codUsuarioConf !== null && body.codUsuarioConf !== ""
        ? Number(body.codUsuarioConf)
        : null;
    const observacao = String(body.observacao || "").trim() || null;
    const qtEtiqueta =
      body.qtEtiqueta !== undefined && body.qtEtiqueta !== null && body.qtEtiqueta !== ""
        ? Number(body.qtEtiqueta)
        : null;
    const codBarrasErrado = normalizarFlagSN(body.codBarrasErrado);
    const codInternoErrado = normalizarFlagSN(body.codInternoErrado);
    const unMedidaErrado = normalizarFlagSN(body.unMedidaErrado);
    const semEtiqueta = normalizarFlagSN(body.semEtiqueta);

    if (!Number.isFinite(codAuditoria) || !Number.isFinite(codProd)) {
      return res.status(400).json({
        message: "Parâmetros obrigatórios ausentes: codAuditoria, codProd",
      });
    }
    if (precoEtiqueta != null && !Number.isFinite(precoEtiqueta)) {
      return res.status(400).json({ message: "precoEtiqueta inválido" });
    }
    if (precoSistema != null && !Number.isFinite(precoSistema)) {
      return res.status(400).json({ message: "precoSistema inválido" });
    }
    if (codUsuarioConf != null && !Number.isFinite(codUsuarioConf)) {
      return res.status(400).json({ message: "codUsuarioConf inválido" });
    }
    if (qtEtiqueta != null && (!Number.isFinite(qtEtiqueta) || qtEtiqueta < 0 || qtEtiqueta > 99)) {
      return res.status(400).json({ message: "qtEtiqueta inválido (use 0 a 99)" });
    }

    const divergente = calcularDivergente(precoEtiqueta, precoSistema, {
      codBarrasErrado,
      codInternoErrado,
      unMedidaErrado,
      semEtiqueta,
    });

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const check = await auditoriaPermiteAlteracao(conn, oracledb, codAuditoria);
      if (!check.ok) {
        return res.status(check.status).json({ message: check.message });
      }

      const rExiste = await conn.execute(
        `SELECT CODAUDITORIAPROD
           FROM GESTPRO_AUDITORIA_PRODUTOS
          WHERE CODAUDITORIA = :codAuditoria
            AND CODPROD = :codProd`,
        { codAuditoria, codProd },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const existente = (rExiste.rows || [])[0];
      if (existente) {
        return res.status(409).json({
          ok: false,
          exists: true,
          message: "Produto já cadastrado nesta auditoria",
          codAuditoriaProd: Number(existente.CODAUDITORIAPROD),
        });
      }

      const sql = `
        INSERT INTO GESTPRO_AUDITORIA_PRODUTOS (
          CODAUDITORIA,
          CODPROD,
          CODAUXILIAR,
          PRECO_ETIQUETA,
          PRECO_SISTEMA,
          DIVERGENTE,
          CODUSUARIOCONF,
          DTCONFERENCIA,
          OBSERVACAO,
          QT_ETIQUETA,
          COD_BARRAS_ERRADO,
          COD_INTERNO_ERRADO,
          UN_MEDIDA_ERRADO,
          SEM_ETIQUETA
        ) VALUES (
          :codAuditoria,
          :codProd,
          :codAuxiliar,
          :precoEtiqueta,
          :precoSistema,
          :divergente,
          :codUsuarioConf,
          CASE WHEN :codUsuarioConf IS NOT NULL THEN SYSDATE END,
          :observacao,
          :qtEtiqueta,
          :codBarrasErrado,
          :codInternoErrado,
          :unMedidaErrado,
          :semEtiqueta
        )
        RETURNING CODAUDITORIAPROD INTO :codAuditoriaProd
      `;

      const result = await conn.execute(
        sql,
        {
          codAuditoria,
          codProd,
          codAuxiliar,
          precoEtiqueta,
          precoSistema,
          divergente,
          codUsuarioConf,
          observacao,
          qtEtiqueta,
          codBarrasErrado,
          codInternoErrado,
          unMedidaErrado,
          semEtiqueta,
          codAuditoriaProd: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: false }
      );

      await recalcularTotaisAuditoria(conn, codAuditoria);
      await conn.commit();

      const promo = await buscarPrecoPromocional(conn, oracledb, codProd);

      return res.json({
        ok: true,
        codAuditoriaProd: Number(result.outBinds?.codAuditoriaProd ?? 0),
        divergente,
        precoPromocional: promo.precoPromocional,
        codPrecoProm: promo.codPrecoProm,
        statusCampanha: promo.statusCampanha,
      });
    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (rollbackErr) {}
      }
      return res.status(500).json({ message: "Erro ao adicionar produto na auditoria", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
