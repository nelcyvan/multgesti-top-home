export default function registerInventarioAvulsoProdutosRegistros(router, { oracledb }) {
  router.get("/inventario/avulso/produtos/registros", async (req, res) => {
    const idInventarioRaw = req.query.idInventario ?? req.query.idinventario;
    const idInventarioNum = Number(idInventarioRaw);
    if (!Number.isFinite(idInventarioNum)) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: idInventario" });
    }

    const idProdutoRaw = req.query.idProduto ?? req.query.idproduto;
    const idProdutoNum = idProdutoRaw == null || idProdutoRaw === "" ? null : Number(idProdutoRaw);
    if (idProdutoRaw != null && idProdutoRaw !== "" && !Number.isFinite(idProdutoNum)) {
      return res.status(400).json({ message: "Parâmetro inválido: idProduto" });
    }

    const codProdRaw = req.query.codProd ?? req.query.codprod;
    const codProdNum = codProdRaw == null || codProdRaw === "" ? null : Number(codProdRaw);
    if (codProdRaw != null && codProdRaw !== "" && !Number.isFinite(codProdNum)) {
      return res.status(400).json({ message: "Parâmetro inválido: codProd" });
    }

    const codAuxiliarRaw = req.query.codAuxiliar ?? req.query.codauxiliar;
    const codAuxiliarStr = codAuxiliarRaw == null ? "" : String(codAuxiliarRaw).trim();
    const codAuxiliarNum = codAuxiliarStr ? Number(codAuxiliarStr) : null;
    if (codAuxiliarStr && !Number.isFinite(codAuxiliarNum)) {
      return res.status(400).json({ message: "Parâmetro inválido: codAuxiliar" });
    }

    const limitRaw = req.query.limit ?? req.query.limite;
    const limitNum = limitRaw == null || limitRaw === "" ? 500 : Number(limitRaw);
    if (!Number.isFinite(limitNum) || limitNum <= 0) {
      return res.status(400).json({ message: "Parâmetro inválido: limit" });
    }
    const limit = Math.min(2000, Math.floor(limitNum));

    const whereParts = ["ID_INVENTARIO = :idInventario"];
    const binds = { idInventario: idInventarioNum, limit };

    if (idProdutoNum != null) {
      whereParts.push("ID_PRODUTO = :idProduto");
      binds.idProduto = idProdutoNum;
    }
    if (codProdNum != null) {
      whereParts.push("CODPROD = :codProd");
      binds.codProd = codProdNum;
    }
    if (codAuxiliarNum != null) {
      whereParts.push("CODAUXILIAR = :codAuxiliar");
      binds.codAuxiliar = codAuxiliarNum;
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
        FROM (
              SELECT ID_INVENTARIO,
                     ID_PRODUTO,
                     CODPROD,
                     ROW_ID,
                     QT_CONTADA_REGISTRO,
                     CODAUXILIAR,
                     ROWID AS ROWID_REGISTRO
                FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS_REGISTROS
               WHERE ${whereParts.join("\n                 AND ")}
               ORDER BY ROWID DESC
             )
       WHERE ROWNUM <= :limit
    `;

      const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return res.json({ rows: result.rows || [], count: (result.rows || []).length });
    } catch (err) {
      return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
