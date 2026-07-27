export default function registerComissoesPorFreteMesAnteriorTotal(router, { oracledb }) {
  router.get("/comissoes-por-frete-mes-anterior-total", async (req, res) => {
    console.log("[GestPRO] Acessando /api/gestpro/comissoes-por-frete-mes-anterior-total");
    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        WITH params AS (
          SELECT
            :p_data1 AS data1,
            :p_data2 AS data2,
            :p_codfilial_csv AS codfilial_csv
          FROM dual
        ),
        base AS (
          SELECT
            PCPREST.DTEMISSAO,
            PCNFSAID.DTSAIDA,
            PCPREST.DTBAIXA,
            PCPREST.DTPAG,
            PCNFSAID.NUMNOTA,
            PCNFSAID.CODCLI,
            PCCLIENT.CLIENTE,
            PCPEDC.CODCLI AS CODCLI_PEDIDO,
            PCCLIENTPED.CLIENTE AS CLIENTE_PEDIDO,
            PCNFSAID.NUMPED,
            PCNFSAID.CODFILIAL,
            NVL(PCPEDC.VLFRETE, 0) AS FRETE,
            NVL(PCPEDC.VLOUTRASDESP, 0) AS OUTRAS_DESPESAS,
            ROUND(
              (
                NVL(PCNFSAID.VLTOTGER, 0) - (
                  NVL(PCNFSAID.ICMSRETIDO, 0)
                  + NVL(PCNFSAID.VLOUTRASDESP, 0)
                  + NVL(PCNFSAID.VLIPI, 0)
                )
                + (
                  DECODE(
                    FERRAMENTAS.F_BUSCARPARAMETRO_ALFA('AGREGARFRETECOMISS', '99', 'N'),
                    'N', 0,
                    NVL(PCNFSAID.VLFRETE, 0)
                  )
                )
              ),
              2
            ) AS VLTOTGER,
            PCNFSAID.NUMTRANSVENDA,
            PCPREST.CODUSUR,
            PCUSUARI.NOME,
            PCPREST.DUPLIC
          FROM PCPREST, PCNFSAID, PCUSUARI, PCSUPERV, PCCLIENT, PCCLIENT PCCLIENTPED, PCCOB, PCPEDC, params P
          WHERE PCPREST.NUMTRANSVENDA = PCNFSAID.NUMTRANSVENDA
            AND PCPREST.CODUSUR = PCUSUARI.CODUSUR(+)
            AND PCPEDC.NUMPED(+) = PCNFSAID.NUMPED
            AND PCCLIENTPED.CODCLI(+) = PCPEDC.CODCLI
            AND PCPREST.DTPAG IS NOT NULL
            AND PCPREST.CODCOB = PCCOB.CODCOB
            AND PCCOB.PAGCOMISSAO = 'S'
            AND PCPREST.CODCOB NOT IN ('DESD', 'ESTR', 'DEVP', 'DEVT', 'BNF')
            AND PCUSUARI.CODSUPERVISOR = PCSUPERV.CODSUPERVISOR
            AND PCNFSAID.CODFISCAL IN (511, 611, 512, 612, 711, 712, 599, 699)
            AND PCNFSAID.CONDVENDA <> 4
            AND PCPREST.CODCLI = PCCLIENT.CODCLI
            AND PCNFSAID.DTCANCEL IS NULL
            AND (
              (NVL(PCPREST.PERMITEESTORNO, 'S') = 'S')
              OR (
                (
                  (NVL(PCPREST.PERMITEESTORNO, 'S') = 'N')
                  AND (PCPREST.DTESTORNO IS NOT NULL)
                  AND (NVL(PCPREST.VALORESTORNO, 0) < NVL(PCPREST.VPAGO, 0))
                )
                OR PCPREST.CODCOB = 'SUPP'
              )
            )
            AND NVL(PCUSUARI.BLOQCOMIS, 'X') <> 'S'
            AND PCPREST.DTPAGCOMISSAO IS NULL
            AND PCPREST.CODFILIAL IN (
              SELECT TRIM(REGEXP_SUBSTR(P.CODFILIAL_CSV, '[^,]+', 1, LEVEL))
              FROM dual
              CONNECT BY REGEXP_SUBSTR(P.CODFILIAL_CSV, '[^,]+', 1, LEVEL) IS NOT NULL
            )
            AND PCPREST.DTPAG >= P.DATA1
            AND PCPREST.DTPAG < (P.DATA2 + 1)
        ),
        ranked AS (
          SELECT
            base.*,
            ROW_NUMBER() OVER (
              PARTITION BY
                NUMNOTA,
                CODCLI,
                NUMPED,
                CODFILIAL,
                NUMTRANSVENDA,
                CODUSUR,
                NOME,
                DUPLIC
              ORDER BY
                DTPAG DESC NULLS LAST,
                DTBAIXA DESC NULLS LAST,
                DTSAIDA DESC NULLS LAST,
                DTEMISSAO DESC NULLS LAST
            ) AS RN
          FROM base
        )
        SELECT
          DTEMISSAO,
          DTSAIDA,
          DTBAIXA,
          DTPAG,
          NUMNOTA,
          CODCLI_PEDIDO,
          CLIENTE_PEDIDO,
          NUMPED,
          CODFILIAL,
          FRETE,
          OUTRAS_DESPESAS,
          VLTOTGER,
          NUMTRANSVENDA,
          CODUSUR,
          NOME,
          DUPLIC
        FROM ranked
        WHERE RN = 1
          AND (NVL(FRETE, 0) > 0 OR NVL(OUTRAS_DESPESAS, 0) > 0)
        ORDER BY DTSAIDA, NUMNOTA, CODCLI, NUMPED
      `;

      const now = new Date();
      const data1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const data2 = new Date(now.getFullYear(), now.getMonth(), 0);
      const data1Query = req.query?.data1;
      const data2Query = req.query?.data2;
      const codfilialQuery = req.query?.codfilial;

      const data1Param =
        typeof data1Query === "string" && data1Query.trim() ? new Date(`${data1Query}T00:00:00`) : data1;
      const data2Param =
        typeof data2Query === "string" && data2Query.trim() ? new Date(`${data2Query}T00:00:00`) : data2;
      const codfilialParam =
        typeof codfilialQuery === "string" && codfilialQuery.trim() ? codfilialQuery.trim() : "1";

      if (Number.isNaN(data1Param.getTime()) || Number.isNaN(data2Param.getTime())) {
        return res.status(400).json({
          message: "Parâmetros de data inválidos. Use o formato YYYY-MM-DD em data1 e data2.",
        });
      }

      const binds = {
        p_data1: data1Param,
        p_data2: data2Param,
        p_codfilial_csv: codfilialParam,
      };

      const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const rowsAll = result?.rows || [];

      return res.json({ rows: rowsAll, count: rowsAll.length });
    } catch (err) {
      console.error("Erro ao buscar Comissões por Frete (Mês Anterior - Total):", err);
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

  console.log("[GestPRO] Registrada rota GET /api/gestpro/comissoes-por-frete-mes-anterior-total");
}
