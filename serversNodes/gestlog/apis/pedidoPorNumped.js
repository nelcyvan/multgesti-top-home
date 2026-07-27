import express from "express";
import oracledb from "oracledb";

const router = express.Router();

router.get("/api/gestlog/pedido-por-numped", async (req, res) => {
  console.log("[GestLOG] Acessando /api/gestlog/pedido-por-numped");
  const numpedNum = Number(req.query.numped);
  if (!Number.isFinite(numpedNum) || numpedNum <= 0) {
    return res.status(400).json({ message: "Parâmetro obrigatório inválido: numped" });
  }

  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING,
    });

    const sql = `
SELECT DISTINCT 
    TO_CHAR(A.DATA, 'DD/MM/YYYY') AS DATA, 
    A.CODCOB, 
    A.CODFILIAL, 
    B.CODFILIALRETIRA, 
    A.CONDVENDA, 
    A.POSICAO, 
    A.NUMVIASMAPASEP, 
    B.TIPOENTREGA, 
    E.CODCLI, 
    E.CLIENTE, 
    A.NUMPED AS NUMERO_DO_PEDIDO_TV8, 
    A.NUMPEDENTFUT AS NUMERO_DO_PEDIDO_TV7, 
    B.CODPROD, 
    C.DESCRICAO, 
    C.CODAUXILIAR AS CODIGO_DE_BARRAS, 
    B.QT AS QUANTIDADE_ITEM_PEDIDO, 
    D.QTEST AS ESTOQUE_ATUAL_LOJA, 
    J.COBRANCA, 
    A.OBSENTREGA1, 
    A.OBSENTREGA2, 
    A.OBSENTREGA3, 
    A.OBS, 
    A.OBS1, 
    A.OBS2, 
    F.NOME AS VENDEDOR, 
    E.ENDERENT AS ENDERENT, 
    E.NUMEROENT AS NUMEROENT, 
    E.BAIRROENT AS BAIRROENT, 
    E.MUNICENT AS MUNICENT, 
    E.CODPRACA,  
    E.TELENT, 
    G.NUMNOTA AS NUMNOTA, 
    G.DTSAIDA, 
    G.CODEMITENTE, 
    A.VLFRETE, 
    G.VLOUTRASDESP, 
    H.NOME_GUERRA AS NOME_EMITENTE, 
    K.NOME AS EMITENTE_MAPA, 
    C.MULTIPLO,
    C.EMBALAGEM,
    CASE
        WHEN C.MULTIPLO < 1 THEN 'Multiplo errado'
        WHEN ABS((B.QT / C.MULTIPLO) - ROUND(B.QT / C.MULTIPLO)) < 0.0001 
        THEN TO_CHAR(ROUND(B.QT / C.MULTIPLO)) || ' ' || C.EMBALAGEMMASTER
    ELSE 'Multiplo errado'
    END AS QT_TOTAL,
    A.LOG1 AS STATUS_PEDIDO,
    A.LOG3,
    A.ULTIMASITUACAOCFAT AS ULTIMASITUACAOCFAT,
    A.CODUSUR AS MATRICULA_RCA,
    S.STATUS_PRIORIDADE AS STATUS_ESPECIAL_PRIORIDADE,
    A.DTINICIALSEP
FROM PCPEDC A 
JOIN PCPEDI B ON B.NUMPED = A.NUMPED 
JOIN PCPEDC I ON I.NUMPED = A.NUMPEDENTFUT 
JOIN PCPRODUT C ON C.CODPROD = B.CODPROD 
JOIN PCEST D ON D.CODPROD = B.CODPROD AND D.CODFILIAL = A.CODFILIAL 
JOIN PCCLIENT E ON E.CODCLI = B.CODCLI 
JOIN PCUSUARI F ON F.CODUSUR = A.CODUSUR 
LEFT JOIN PCEMPR K ON K.MATRICULA = A.CODFUNCEMISSAOMAPA 
LEFT JOIN PCNFSAID G ON G.NUMPED = A.NUMPED 
LEFT JOIN PCEMPR H ON H.MATRICULA = G.CODEMITENTE 
JOIN PCCOB J ON J.CODCOB = A.CODCOB 
LEFT JOIN MULTGESTI_STATUS_ESPECIAL_PEDIDOS S ON S.NUMPED = A.NUMPED 

WHERE A.NUMPED = :numped

ORDER BY B.TIPOENTREGA, A.NUMPED, A.NUMVIASMAPASEP
    `;

    const result = await conn.execute(sql, { numped: numpedNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return res.json({ rows: result.rows || [], count: (result.rows || []).length });
  } catch (err) {
    console.error("[GestLOG] Erro ao buscar pedido por NUMPED:", err);
    return res.status(500).json({ message: "Erro interno no servidor GestLOG", detalhe: err.message });
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
