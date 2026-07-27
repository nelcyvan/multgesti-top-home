function validarDataISO(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split("-").map(Number);
  const dt = new Date(ano, mes - 1, dia);
  return dt.getFullYear() === ano && dt.getMonth() === mes - 1 && dt.getDate() === dia;
}

const FILTRO_DATA_AUDITORIA = `
  TRUNC(a.DTCADASTRO) = TO_DATE(:data, 'YYYY-MM-DD')
  OR TRUNC(a.DTINICIO) = TO_DATE(:data, 'YYYY-MM-DD')
  OR TRUNC(a.DTFINALIZACAO) = TO_DATE(:data, 'YYYY-MM-DD')
`;

const PRODUTO_DIVERGENTE_EXPR = `
  NVL(p.DIVERGENTE, 'N') = 'S'
  OR NVL(p.COD_BARRAS_ERRADO, 'N') = 'S'
  OR NVL(p.COD_INTERNO_ERRADO, 'N') = 'S'
  OR NVL(p.UN_MEDIDA_ERRADO, 'N') = 'S'
  OR NVL(p.SEM_ETIQUETA, 'N') = 'S'
`;

export default function registerAuditoriaResumoDia(router, { oracledb }) {
  router.get("/auditoria/resumo-dia", async (req, res) => {
    const data = String(req.query.data || "").trim();

    if (!data) {
      return res.status(400).json({ message: "Parâmetro obrigatório ausente: data (YYYY-MM-DD)" });
    }
    if (!validarDataISO(data)) {
      return res.status(400).json({ message: "Parâmetro inválido: data (use YYYY-MM-DD)" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const rResumo = await conn.execute(
        `SELECT COUNT(*) AS QT_AUDITORIAS,
                SUM(CASE WHEN a.STATUS = 'ABERTA' THEN 1 ELSE 0 END) AS QT_ABERTA,
                SUM(CASE WHEN a.STATUS = 'EM_ANDAMENTO' THEN 1 ELSE 0 END) AS QT_EM_ANDAMENTO,
                SUM(CASE WHEN a.STATUS = 'FINALIZADA' THEN 1 ELSE 0 END) AS QT_FINALIZADA,
                SUM(CASE WHEN a.STATUS = 'CANCELADA' THEN 1 ELSE 0 END) AS QT_CANCELADA
           FROM GESTPRO_AUDITORIA a
          WHERE ${FILTRO_DATA_AUDITORIA}`,
        { data },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const rProdutos = await conn.execute(
        `SELECT COUNT(*) AS QT_PRODUTOS,
                SUM(CASE WHEN ${PRODUTO_DIVERGENTE_EXPR} THEN 1 ELSE 0 END) AS QT_DIVERGENCIAS,
                SUM(CASE WHEN NOT (${PRODUTO_DIVERGENTE_EXPR}) THEN 1 ELSE 0 END) AS QT_PRODUTOS_OK,
                SUM(CASE WHEN NVL(p.DIVERGENTE, 'N') = 'S' THEN 1 ELSE 0 END) AS QT_PRECO_DIVERGENTE,
                SUM(CASE WHEN NVL(p.COD_BARRAS_ERRADO, 'N') = 'S' THEN 1 ELSE 0 END) AS QT_BARRAS_ERRADO,
                SUM(CASE WHEN NVL(p.COD_INTERNO_ERRADO, 'N') = 'S' THEN 1 ELSE 0 END) AS QT_COD_INTERNO_ERRADO,
                SUM(CASE WHEN NVL(p.UN_MEDIDA_ERRADO, 'N') = 'S' THEN 1 ELSE 0 END) AS QT_UN_MEDIDA_ERRADO,
                SUM(CASE WHEN NVL(p.SEM_ETIQUETA, 'N') = 'S' THEN 1 ELSE 0 END) AS QT_SEM_ETIQUETA,
                NVL(SUM(p.QT_ETIQUETA), 0) AS QT_ETIQUETAS
           FROM GESTPRO_AUDITORIA_PRODUTOS p
           JOIN GESTPRO_AUDITORIA a
             ON a.CODAUDITORIA = p.CODAUDITORIA
          WHERE ${FILTRO_DATA_AUDITORIA}`,
        { data },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const rSetores = await conn.execute(
        `SELECT NVL(a.SETOR, '-') AS SETOR,
                COUNT(DISTINCT a.CODAUDITORIA) AS QT_AUDITORIAS,
                COUNT(p.CODAUDITORIAPROD) AS QT_PRODUTOS,
                SUM(CASE WHEN ${PRODUTO_DIVERGENTE_EXPR} THEN 1 ELSE 0 END) AS QT_DIVERGENCIAS
           FROM GESTPRO_AUDITORIA a
           LEFT JOIN GESTPRO_AUDITORIA_PRODUTOS p
             ON p.CODAUDITORIA = a.CODAUDITORIA
          WHERE ${FILTRO_DATA_AUDITORIA}
          GROUP BY NVL(a.SETOR, '-')
          ORDER BY QT_PRODUTOS DESC, SETOR ASC`,
        { data },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const rAuditorias = await conn.execute(
        `SELECT a.CODAUDITORIA,
                a.DESCRICAO,
                a.SETOR,
                a.STATUS,
                a.CODUSUARIOCRIACAO,
                ec.MATRICULA AS MATRICULA_USUARIO_CRIACAO,
                ec.NOME AS NOME_USUARIO_CRIACAO,
                a.CODUSUARIOINI,
                ei.MATRICULA AS MATRICULA_USUARIO_INI,
                ei.NOME AS NOME_USUARIO_INI,
                a.CODUSUARIOFIM,
                ef.MATRICULA AS MATRICULA_USUARIO_FIM,
                ef.NOME AS NOME_USUARIO_FIM,
                TO_CHAR(a.DTCADASTRO, 'DD/MM/YYYY HH24:MI:SS') AS DTCADASTRO,
                TO_CHAR(a.DTINICIO, 'DD/MM/YYYY HH24:MI:SS') AS DTINICIO,
                TO_CHAR(a.DTFINALIZACAO, 'DD/MM/YYYY HH24:MI:SS') AS DTFINALIZACAO,
                NVL((
                  SELECT COUNT(*)
                    FROM GESTPRO_AUDITORIA_PRODUTOS p
                   WHERE p.CODAUDITORIA = a.CODAUDITORIA
                ), 0) AS QTITENS,
                NVL((
                  SELECT COUNT(*)
                    FROM GESTPRO_AUDITORIA_PRODUTOS p
                   WHERE p.CODAUDITORIA = a.CODAUDITORIA
                     AND (${PRODUTO_DIVERGENTE_EXPR})
                ), 0) AS QTDIVERGENCIAS
           FROM GESTPRO_AUDITORIA a
           LEFT JOIN PCEMPR ec
             ON ec.MATRICULA = a.CODUSUARIOCRIACAO
           LEFT JOIN PCEMPR ei
             ON ei.MATRICULA = a.CODUSUARIOINI
           LEFT JOIN PCEMPR ef
             ON ef.MATRICULA = a.CODUSUARIOFIM
          WHERE ${FILTRO_DATA_AUDITORIA}
          ORDER BY a.CODAUDITORIA DESC`,
        { data },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const rUsuarios = await conn.execute(
        `SELECT NVL(e.NOME, 'Sem usuário') AS NOME_USUARIO,
                p.CODUSUARIOCONF AS COD_USUARIO,
                COUNT(DISTINCT a.CODAUDITORIA) AS QT_AUDITORIAS,
                COUNT(p.CODAUDITORIAPROD) AS QT_PRODUTOS,
                SUM(CASE WHEN ${PRODUTO_DIVERGENTE_EXPR} THEN 1 ELSE 0 END) AS QT_DIVERGENCIAS,
                SUM(CASE WHEN NOT (${PRODUTO_DIVERGENTE_EXPR}) THEN 1 ELSE 0 END) AS QT_PRODUTOS_OK
           FROM GESTPRO_AUDITORIA_PRODUTOS p
           JOIN GESTPRO_AUDITORIA a
             ON a.CODAUDITORIA = p.CODAUDITORIA
           LEFT JOIN PCEMPR e
             ON e.MATRICULA = p.CODUSUARIOCONF
          WHERE ${FILTRO_DATA_AUDITORIA}
          GROUP BY p.CODUSUARIOCONF, NVL(e.NOME, 'Sem usuário')
          ORDER BY QT_PRODUTOS DESC, NOME_USUARIO ASC`,
        { data },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const rPendencias = await conn.execute(
        `SELECT a.CODAUDITORIA,
                a.DESCRICAO,
                a.SETOR,
                a.STATUS,
                NVL(ef.NOME, NVL(ei.NOME, ec.NOME)) AS NOME_USUARIO,
                NVL((
                  SELECT COUNT(*)
                    FROM GESTPRO_AUDITORIA_PRODUTOS p
                   WHERE p.CODAUDITORIA = a.CODAUDITORIA
                     AND (${PRODUTO_DIVERGENTE_EXPR})
                ), 0) AS QTDIVERGENCIAS
           FROM GESTPRO_AUDITORIA a
           LEFT JOIN PCEMPR ec
             ON ec.MATRICULA = a.CODUSUARIOCRIACAO
           LEFT JOIN PCEMPR ei
             ON ei.MATRICULA = a.CODUSUARIOINI
           LEFT JOIN PCEMPR ef
             ON ef.MATRICULA = a.CODUSUARIOFIM
          WHERE ${FILTRO_DATA_AUDITORIA}
            AND (
              a.STATUS IN ('ABERTA', 'EM_ANDAMENTO')
              OR EXISTS (
                SELECT 1
                  FROM GESTPRO_AUDITORIA_PRODUTOS p
                 WHERE p.CODAUDITORIA = a.CODAUDITORIA
                   AND (${PRODUTO_DIVERGENTE_EXPR})
              )
            )
          ORDER BY a.STATUS ASC, a.CODAUDITORIA DESC`,
        { data },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const resumoAuditorias = (rResumo.rows || [])[0] || {};
      const resumoProdutos = (rProdutos.rows || [])[0] || {};
      const [ano, mes, dia] = data.split("-");

      return res.json({
        data,
        dataFormatada: `${dia}/${mes}/${ano}`,
        resumo: {
          qtAuditorias: Number(resumoAuditorias.QT_AUDITORIAS ?? 0),
          qtAberta: Number(resumoAuditorias.QT_ABERTA ?? 0),
          qtEmAndamento: Number(resumoAuditorias.QT_EM_ANDAMENTO ?? 0),
          qtFinalizada: Number(resumoAuditorias.QT_FINALIZADA ?? 0),
          qtCancelada: Number(resumoAuditorias.QT_CANCELADA ?? 0),
          qtProdutos: Number(resumoProdutos.QT_PRODUTOS ?? 0),
          qtDivergencias: Number(resumoProdutos.QT_DIVERGENCIAS ?? 0),
          qtProdutosOk: Number(resumoProdutos.QT_PRODUTOS_OK ?? 0),
          qtPrecoDivergente: Number(resumoProdutos.QT_PRECO_DIVERGENTE ?? 0),
          qtBarrasErrado: Number(resumoProdutos.QT_BARRAS_ERRADO ?? 0),
          qtCodInternoErrado: Number(resumoProdutos.QT_COD_INTERNO_ERRADO ?? 0),
          qtUnMedidaErrado: Number(resumoProdutos.QT_UN_MEDIDA_ERRADO ?? 0),
          qtSemEtiqueta: Number(resumoProdutos.QT_SEM_ETIQUETA ?? 0),
          qtEtiquetas: Number(resumoProdutos.QT_ETIQUETAS ?? 0),
        },
        porSetor: rSetores.rows || [],
        porUsuario: rUsuarios.rows || [],
        pendencias: {
          qtAuditoriasAbertas: Number(resumoAuditorias.QT_ABERTA ?? 0),
          qtAuditoriasEmAndamento: Number(resumoAuditorias.QT_EM_ANDAMENTO ?? 0),
          qtDivergencias: Number(resumoProdutos.QT_DIVERGENCIAS ?? 0),
          qtPrecoDivergente: Number(resumoProdutos.QT_PRECO_DIVERGENTE ?? 0),
          qtBarrasErrado: Number(resumoProdutos.QT_BARRAS_ERRADO ?? 0),
          qtCodInternoErrado: Number(resumoProdutos.QT_COD_INTERNO_ERRADO ?? 0),
          qtUnMedidaErrado: Number(resumoProdutos.QT_UN_MEDIDA_ERRADO ?? 0),
          qtSemEtiqueta: Number(resumoProdutos.QT_SEM_ETIQUETA ?? 0),
          itens: rPendencias.rows || [],
        },
        auditorias: rAuditorias.rows || [],
      });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao gerar resumo do dia", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
