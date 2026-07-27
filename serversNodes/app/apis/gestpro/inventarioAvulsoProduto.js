export default function registerInventarioAvulsoProduto(router, { oracledb }) {
  router.post("/inventario/avulso/produto", async (req, res) => {
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

              vStage := 'INSERT_REGISTRO_UPDATE';
              INSERT INTO MULTGESTI_INVENTARIO_AVULSO_PRODUTOS_REGISTROS (
                  ID_INVENTARIO,
                  ID_PRODUTO,
                  CODPROD,
                  ROW_ID,
                  QT_CONTADA_REGISTRO,
                  CODAUXILIAR
              ) VALUES (
                  :idInventario,
                  vIdProdutoExist,
                  :codProd,
                  RAWTOHEX(SYS_GUID()),
                  :novaQuantidadeContada,
                  :codAuxiliar
              );
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

              vStage := 'INSERT_REGISTRO_INSERT';
              INSERT INTO MULTGESTI_INVENTARIO_AVULSO_PRODUTOS_REGISTROS (
                  ID_INVENTARIO,
                  ID_PRODUTO,
                  CODPROD,
                  ROW_ID,
                  QT_CONTADA_REGISTRO,
                  CODAUXILIAR
              ) VALUES (
                  :idInventario,
                  :idProduto,
                  :codProd,
                  RAWTOHEX(SYS_GUID()),
                  :novaQuantidadeContada,
                  :codAuxiliar
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

      try {
        console.log("[apis/gestpro] inventario/avulso/produto binds", {
          idInventario: idInventarioNum,
          codProd: codProdNum,
          descricao,
          codAuxiliar,
          novaQuantidadeContada: qtdNum,
        });
      } catch {}

      const result = await conn.execute(plsql, binds, { autoCommit: true });
      const outIdProduto = result.outBinds && (result.outBinds.idProduto ?? null);
      return res.json({ ok: true, idProduto: outIdProduto });
    } catch (err) {
      try {
        const e = err || {};
        const info = {
          message: String(e.message || ""),
          code: String(e.code || ""),
          errorNum: Number(e.errorNum || 0),
          offset: Number(e.offset || 0),
        };
        console.error("[apis/gestpro] Erro inventario/avulso/produto", info);
      } catch {}
      return res.status(500).json({ message: "Erro ao inserir/atualizar produto no inventário", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
