export default function registerCanpanhaVendasMesAnterior(app, oracledb) {
  app.get("/api/gestpro/campanha-vendas-mes-anterior", async (req, res) => {
    const offsetRaw = (req.query || {}).offset;
    const offset = offsetRaw == null || String(offsetRaw).trim() === "" ? 1 : Number(offsetRaw);
    const offsetValido = Number.isFinite(offset) && (offset === 0 || offset === 1 || offset === 2);
    console.log(`[GestPRO] Acessando /api/gestpro/campanha-vendas-mes-anterior offset=${offsetRaw == null ? "1" : String(offsetRaw)}`);

    if (!offsetValido) {
      return res.status(400).json({ message: "Parâmetro 'offset' inválido. Valores aceitos: 0 (mês atual), 1 (mês anterior), 2 (mês antes do anterior)" });
    }

    const offsetStart = -offset;
    const offsetEnd = -(offset - 1);
    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        WITH datas_ref AS (
            SELECT
                TRUNC(ADD_MONTHS(SYSDATE, :offsetStart), 'MM') AS data_inicio,
                TRUNC(ADD_MONTHS(SYSDATE, :offsetEnd), 'MM') AS data_fim
            FROM DUAL
        ),
        pedidos_filtrados AS (
            SELECT DISTINCT PCNFSAID.NUMPED
            FROM PCPREST
            INNER JOIN PCNFSAID ON PCPREST.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
            LEFT JOIN PCUSUARI ON PCPREST.CODUSUR = PCUSUARI.CODUSUR
            CROSS JOIN datas_ref datas
            WHERE PCPREST.DTPAG IS NOT NULL
              AND PCPREST.DTPAG >= datas.data_inicio
              AND PCPREST.DTPAG < datas.data_fim
              AND PCPREST.CODFILIAL IN ('1')
              AND PCPREST.DTPAGCOMISSAO IS NULL
              AND PCUSUARI.TIPOVEND = 'I'
              AND NVL(PCUSUARI.BLOQCOMIS, 'X') <> 'S'
              AND PCNFSAID.CODFISCAL IN (511, 611, 512, 612, 711, 712, 599, 699)
              AND PCNFSAID.CONDVENDA <> 4
              AND PCNFSAID.DTCANCEL IS NULL
              AND EXISTS (
                  SELECT 1 FROM PCCOB
                  WHERE PCCOB.CODCOB = PCPREST.CODCOB
                    AND PCCOB.PAGCOMISSAO = 'S'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM PCCOB
                  WHERE PCCOB.CODCOB = PCPREST.CODCOB
                    AND PCCOB.CODCOB IN ('DESD', 'ESTR', 'DEVP', 'DEVT', 'BNF')
              )
              AND (
                  (NVL(PCPREST.PERMITEESTORNO, 'S') = 'S')
                  OR (
                      (NVL(PCPREST.PERMITEESTORNO, 'S') = 'N')
                      AND (PCPREST.DTESTORNO IS NOT NULL)
                      AND (NVL(PCPREST.VALORESTORNO, 0) < NVL(PCPREST.VPAGO, 0))
                  )
                  OR PCPREST.CODCOB = 'SUPP'
              )
        )
        SELECT
            pedItens.DATA,
            pedItens.NUMPED,
            pedItens.CODCLI,
            cli.CLIENTE AS nomeCliente,
            pedItens.CODPROD,
            prodPed.DESCRICAO,
            prodPed.CODAUXILIAR,
            pedItens.QT,
            (pedItens.PVENDA * pedItens.QT) AS valorTotal,
            pedItens.CODUSUR,
            vendedor.NOME AS nomeVendedor
        FROM PCPEDI pedItens
        INNER JOIN PCPRODUT prodPed ON prodPed.CODPROD = pedItens.CODPROD
        INNER JOIN PCCLIENT cli ON cli.CODCLI = pedItens.CODCLI
        LEFT JOIN PCEMPR vendedor ON vendedor.MATRICULA = pedItens.CODUSUR
        INNER JOIN pedidos_filtrados filtro ON filtro.NUMPED = pedItens.NUMPED
        WHERE prodPed.CODFORNEC = 1207
      `;

      const result = await conn.execute(
        sql,
        { offsetStart, offsetEnd },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return res.json({ rows: result.rows || [], count: (result.rows || []).length });
    } catch (err) {
      console.error("Erro ao buscar Campanha Vendas (Mês Anterior):", err);
      return res.status(500).json({ message: "Erro interno no servidor GestPRO", detalhe: err.message });
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

  console.log("[GestPRO] Registrada rota GET /api/gestpro/campanha-vendas-mes-anterior");
}
