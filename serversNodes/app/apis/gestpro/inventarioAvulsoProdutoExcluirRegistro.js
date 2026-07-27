export default function registerInventarioAvulsoProdutoExcluirRegistro(router, { oracledb }) {
  router.delete("/inventario/avulso/produtos/registros", async (req, res) => {
    const rowIdRegistro = String(req.query.rowId ?? req.query.rowid ?? ((req.body || {}).rowId ?? (req.body || {}).rowid ?? "")).trim();
    if (!rowIdRegistro) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: rowId" });
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
          vIdInventario   NUMBER;
          vIdProduto      NUMBER;
          vCodProd        NUMBER;
          vCodAuxiliar    NUMBER;
          vQtRegistro     NUMBER;
          vCount          NUMBER;
          vSumQt          NUMBER;
          vStage          VARCHAR2(50);
      BEGIN
          vStage := 'LOCK_REGISTRO';
          SELECT ID_INVENTARIO,
                 ID_PRODUTO,
                 CODPROD,
                 CODAUXILIAR,
                 QT_CONTADA_REGISTRO
            INTO vIdInventario,
                 vIdProduto,
                 vCodProd,
                 vCodAuxiliar,
                 vQtRegistro
            FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS_REGISTROS
           WHERE ROW_ID = :rowIdRegistro
           FOR UPDATE;

          vStage := 'DELETE_REGISTRO';
          DELETE FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS_REGISTROS
           WHERE ROW_ID = :rowIdRegistro;

          vStage := 'AGG_RECALC';
          SELECT COUNT(*),
                 NVL(SUM(QT_CONTADA_REGISTRO), 0)
            INTO vCount,
                 vSumQt
            FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS_REGISTROS
           WHERE ID_INVENTARIO = vIdInventario
             AND ID_PRODUTO = vIdProduto;

          IF vCount <= 0 OR vSumQt <= 0 THEN
              vStage := 'DELETE_TOTALIZADOR';
              DELETE FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS
               WHERE ID_INVENTARIO = vIdInventario
                 AND ID_PRODUTO = vIdProduto;
          ELSE
              vStage := 'GET_LAST_KEYS';
              SELECT CODPROD,
                     CODAUXILIAR
                INTO vCodProd,
                     vCodAuxiliar
                FROM (
                      SELECT CODPROD,
                             CODAUXILIAR
                        FROM MULTGESTI_INVENTARIO_AVULSO_PRODUTOS_REGISTROS
                       WHERE ID_INVENTARIO = vIdInventario
                         AND ID_PRODUTO = vIdProduto
                       ORDER BY ROWID DESC
                     )
               WHERE ROWNUM = 1;

              vStage := 'UPDATE_TOTALIZADOR';
              UPDATE MULTGESTI_INVENTARIO_AVULSO_PRODUTOS
                 SET QT_CONTADA = vSumQt,
                     CODPROD = vCodProd,
                     CODAUXILIAR = vCodAuxiliar
               WHERE ID_INVENTARIO = vIdInventario
                 AND ID_PRODUTO = vIdProduto;
          END IF;

          :idInventario := vIdInventario;
          :idProduto := vIdProduto;
          :qtRegistro := vQtRegistro;
          :registrosCount := vCount;
          :qtTotal := vSumQt;
      EXCEPTION
          WHEN NO_DATA_FOUND THEN
              RAISE_APPLICATION_ERROR(-20001, 'INV_AVULSO_EXCLUI_REG:' || vStage || ':REGISTRO_NAO_ENCONTRADO');
          WHEN OTHERS THEN
              RAISE_APPLICATION_ERROR(-20001, 'INV_AVULSO_EXCLUI_REG:' || vStage || ':' || SQLERRM);
      END;
    `;

      const binds = {
        rowIdRegistro,
        idInventario: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        idProduto: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        qtRegistro: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        registrosCount: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        qtTotal: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      };

      const result = await conn.execute(plsql, binds, { autoCommit: true });
      const out = result.outBinds || {};
      return res.json({
        ok: true,
        idInventario: out.idInventario ?? null,
        idProduto: out.idProduto ?? null,
        qtRegistroExcluido: out.qtRegistro ?? null,
        qtTotalAtual: out.qtTotal ?? null,
        registrosRestantes: out.registrosCount ?? null,
      });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao excluir registro de contagem", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
