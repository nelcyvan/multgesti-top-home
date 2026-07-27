function digitsOnly(s) {
  return String(s || "").replace(/\D+/g, "");
}

function normalizeCodprod(value) {
  const n = Number(digitsOnly(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function uniqueNumbers(values) {
  const set = new Set();
  for (const v of values) {
    const n = normalizeCodprod(v);
    if (n !== null) set.add(n);
  }
  return Array.from(set);
}

export default function registerExcluirProdutoSemGtin(router, { oracledb }) {
  router.delete("/produtos-sem-gtin/excluir", async (req, res) => {
    const body = req.body || {};
    const q = req.query || {};

    const codprodSingle = body.codprod ?? q.codprod ?? body.CODPROD ?? q.CODPROD;
    const codprodsRaw = body.codprods ?? body.codProds ?? q.codprods ?? q.codProds;
    const codprods = Array.isArray(codprodsRaw) ? uniqueNumbers(codprodsRaw) : null;

    if (!codprods && codprodSingle === undefined) {
      return res.status(400).json({ message: "Informe 'codprod' ou 'codprods' para excluir" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      if (Array.isArray(codprods) && codprods.length > 0) {
        if (codprods.length > 1000) {
          return res.status(400).json({ message: "Máximo de 1000 itens por requisição" });
        }

        const sqlDel = `DELETE FROM GESTLOG_PRODUTOS_SEM_GTIN WHERE CODPROD = :codprod`;
        const bindsArray = codprods.map((c) => ({ codprod: c }));
        const result = await conn.executeMany(sqlDel, bindsArray, { autoCommit: true });

        return res.json({
          ok: true,
          deletedCount: Number(result.rowsAffected || 0),
          deletedCodprods: codprods,
          message: "Exclusão processada",
        });
      }

      const codprod = normalizeCodprod(codprodSingle);
      if (!codprod) {
        return res.status(400).json({ message: "Parâmetro 'codprod' inválido" });
      }

      const delRes = await conn.execute(
        `DELETE FROM GESTLOG_PRODUTOS_SEM_GTIN WHERE CODPROD = :codprod`,
        { codprod },
        { autoCommit: true }
      );
      const deleted = Number(delRes.rowsAffected || 0) > 0;

      return res.json({
        ok: true,
        deleted,
        rowsAffected: delRes.rowsAffected || 0,
        message: deleted ? "Exclusão realizada" : "Nenhum registro encontrado para exclusão",
      });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao excluir produto sem GTIN", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch {}
      }
    }
  });
}
