import { buscarPrecoPromocional } from "./auditoriaPromoPreco.js";

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

export default function registerAuditoriaProdutoAtualizar(router, { oracledb }) {
  router.put("/auditoria/produto", async (req, res) => {
    const body = req.body || {};
    const codAuditoriaProd = Number(body.codAuditoriaProd);
    const codAuxiliar =
      body.codAuxiliar !== undefined ? String(body.codAuxiliar || "").trim() || null : undefined;
    const precoEtiqueta =
      body.precoEtiqueta !== undefined && body.precoEtiqueta !== null && body.precoEtiqueta !== ""
        ? Number(body.precoEtiqueta)
        : body.precoEtiqueta === null || body.precoEtiqueta === ""
          ? null
          : undefined;
    const precoSistema =
      body.precoSistema !== undefined && body.precoSistema !== null && body.precoSistema !== ""
        ? Number(body.precoSistema)
        : body.precoSistema === null || body.precoSistema === ""
          ? null
          : undefined;
    const codUsuarioConf =
      body.codUsuarioConf !== undefined && body.codUsuarioConf !== null && body.codUsuarioConf !== ""
        ? Number(body.codUsuarioConf)
        : body.codUsuarioConf === null || body.codUsuarioConf === ""
          ? null
          : undefined;
    const observacao =
      body.observacao !== undefined ? String(body.observacao || "").trim() || null : undefined;
    const divergenteManual =
      body.divergente !== undefined ? String(body.divergente || "").trim().toUpperCase() : undefined;
    const qtEtiqueta =
      body.qtEtiqueta !== undefined && body.qtEtiqueta !== null && body.qtEtiqueta !== ""
        ? Number(body.qtEtiqueta)
        : body.qtEtiqueta === null || body.qtEtiqueta === ""
          ? null
          : undefined;
    const codBarrasErrado =
      body.codBarrasErrado !== undefined ? normalizarFlagSN(body.codBarrasErrado) : undefined;
    const codInternoErrado =
      body.codInternoErrado !== undefined ? normalizarFlagSN(body.codInternoErrado) : undefined;
    const unMedidaErrado =
      body.unMedidaErrado !== undefined ? normalizarFlagSN(body.unMedidaErrado) : undefined;
    const semEtiqueta =
      body.semEtiqueta !== undefined ? normalizarFlagSN(body.semEtiqueta) : undefined;

    if (!Number.isFinite(codAuditoriaProd)) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: codAuditoriaProd" });
    }
    if (precoEtiqueta !== undefined && precoEtiqueta != null && !Number.isFinite(precoEtiqueta)) {
      return res.status(400).json({ message: "precoEtiqueta inválido" });
    }
    if (precoSistema !== undefined && precoSistema != null && !Number.isFinite(precoSistema)) {
      return res.status(400).json({ message: "precoSistema inválido" });
    }
    if (codUsuarioConf !== undefined && codUsuarioConf != null && !Number.isFinite(codUsuarioConf)) {
      return res.status(400).json({ message: "codUsuarioConf inválido" });
    }
    if (divergenteManual !== undefined && divergenteManual && !["S", "N"].includes(divergenteManual)) {
      return res.status(400).json({ message: "divergente inválido (use S ou N)" });
    }
    if (qtEtiqueta !== undefined && qtEtiqueta != null && (!Number.isFinite(qtEtiqueta) || qtEtiqueta < 0 || qtEtiqueta > 99)) {
      return res.status(400).json({ message: "qtEtiqueta inválido (use 0 a 99)" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const rAtual = await conn.execute(
        `SELECT CODAUDITORIA,
                CODPROD,
                PRECO_ETIQUETA,
                PRECO_SISTEMA,
                QT_ETIQUETA,
                COD_BARRAS_ERRADO,
                COD_INTERNO_ERRADO,
                UN_MEDIDA_ERRADO,
                SEM_ETIQUETA
           FROM GESTPRO_AUDITORIA_PRODUTOS
          WHERE CODAUDITORIAPROD = :codAuditoriaProd`,
        { codAuditoriaProd },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const atual = (rAtual.rows || [])[0];
      if (!atual) {
        return res.status(404).json({ message: "Produto da auditoria não encontrado" });
      }

      const codAuditoria = Number(atual.CODAUDITORIA);
      const rStatus = await conn.execute(
        `SELECT STATUS FROM GESTPRO_AUDITORIA WHERE CODAUDITORIA = :codAuditoria`,
        { codAuditoria },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const status = String(((rStatus.rows || [])[0] || {}).STATUS || "").toUpperCase();
      if (status === "FINALIZADA" || status === "CANCELADA") {
        return res.status(409).json({
          message: `Auditoria com status ${status} não permite alteração de produtos`,
        });
      }

      const novoPrecoEtiqueta =
        precoEtiqueta !== undefined ? precoEtiqueta : Number(atual.PRECO_ETIQUETA ?? null);
      const novoPrecoSistema =
        precoSistema !== undefined ? precoSistema : Number(atual.PRECO_SISTEMA ?? null);
      const novoCodBarrasErrado =
        codBarrasErrado !== undefined ? codBarrasErrado : normalizarFlagSN(atual.COD_BARRAS_ERRADO);
      const novoCodInternoErrado =
        codInternoErrado !== undefined ? codInternoErrado : normalizarFlagSN(atual.COD_INTERNO_ERRADO);
      const novoUnMedidaErrado =
        unMedidaErrado !== undefined ? unMedidaErrado : normalizarFlagSN(atual.UN_MEDIDA_ERRADO);
      const novoSemEtiqueta =
        semEtiqueta !== undefined ? semEtiqueta : normalizarFlagSN(atual.SEM_ETIQUETA);
      const divergente =
        divergenteManual !== undefined && divergenteManual
          ? divergenteManual
          : calcularDivergente(novoPrecoEtiqueta, novoPrecoSistema, {
              codBarrasErrado: novoCodBarrasErrado,
              codInternoErrado: novoCodInternoErrado,
              unMedidaErrado: novoUnMedidaErrado,
              semEtiqueta: novoSemEtiqueta,
            });

      const setParts = ["DIVERGENTE = :divergente"];
      const binds = { codAuditoriaProd, divergente };

      if (codAuxiliar !== undefined) {
        setParts.push("CODAUXILIAR = :codAuxiliar");
        binds.codAuxiliar = codAuxiliar;
      }
      if (precoEtiqueta !== undefined) {
        setParts.push("PRECO_ETIQUETA = :precoEtiqueta");
        binds.precoEtiqueta = precoEtiqueta;
      }
      if (precoSistema !== undefined) {
        setParts.push("PRECO_SISTEMA = :precoSistema");
        binds.precoSistema = precoSistema;
      }
      if (observacao !== undefined) {
        setParts.push("OBSERVACAO = :observacao");
        binds.observacao = observacao;
      }
      if (qtEtiqueta !== undefined) {
        setParts.push("QT_ETIQUETA = :qtEtiqueta");
        binds.qtEtiqueta = qtEtiqueta;
      }
      if (codBarrasErrado !== undefined) {
        setParts.push("COD_BARRAS_ERRADO = :codBarrasErrado");
        binds.codBarrasErrado = codBarrasErrado;
      }
      if (codInternoErrado !== undefined) {
        setParts.push("COD_INTERNO_ERRADO = :codInternoErrado");
        binds.codInternoErrado = codInternoErrado;
      }
      if (unMedidaErrado !== undefined) {
        setParts.push("UN_MEDIDA_ERRADO = :unMedidaErrado");
        binds.unMedidaErrado = unMedidaErrado;
      }
      if (semEtiqueta !== undefined) {
        setParts.push("SEM_ETIQUETA = :semEtiqueta");
        binds.semEtiqueta = semEtiqueta;
      }
      if (codUsuarioConf !== undefined) {
        setParts.push("CODUSUARIOCONF = :codUsuarioConf");
        setParts.push("DTCONFERENCIA = CASE WHEN :codUsuarioConf IS NOT NULL THEN SYSDATE ELSE NULL END");
        binds.codUsuarioConf = codUsuarioConf;
      }

      const result = await conn.execute(
        `UPDATE GESTPRO_AUDITORIA_PRODUTOS
            SET ${setParts.join(",\n                ")}
          WHERE CODAUDITORIAPROD = :codAuditoriaProd`,
        binds,
        { autoCommit: false }
      );

      if (!result.rowsAffected) {
        await conn.rollback();
        return res.status(404).json({ message: "Produto da auditoria não encontrado" });
      }

      await recalcularTotaisAuditoria(conn, codAuditoria);
      await conn.commit();

      const codProd = Number(atual.CODPROD);
      const promo = await buscarPrecoPromocional(conn, oracledb, codProd);

      return res.json({
        ok: true,
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
      return res.status(500).json({ message: "Erro ao atualizar produto da auditoria", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
