export default function registerConfirmarSeparacaoItemPedido(router, { oracledb }) {
  router.post("/confirmar-item-separacao", async (req, res) => {
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
      const result = await conn.execute(
        sql,
        { codigo: codigoNum, numped: numpedNum, codigoProduto: codigoProdutoNum },
        { autoCommit: true }
      );

      return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
    } catch (err) {
      console.error("Erro ao confirmar separação:", err);
      return res.status(500).json({ message: "Erro interno no servidor", detalhe: err.message });
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
}
