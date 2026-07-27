export default function registerConfirmarSeparacaoPedido(router, { oracledb }) {
  router.post("/confirmar-separacao", async (req, res) => {
    const { numped, codigo, status, usuario } = req.body || {};

    const numpedNum = Number(numped);
    const codigoNum = Number(codigo);

    const statusNum = Number(status ?? 3);
    const usuarioStr = String(usuario ?? "APP").trim();

    if (!Number.isFinite(numpedNum) || !Number.isFinite(codigoNum)) {
      return res.status(400).json({ message: "Parâmetros inválidos: informe 'numped' e 'codigo' numéricos" });
    }
    if (!Number.isFinite(statusNum) || !usuarioStr) {
      return res.status(400).json({ message: "Parâmetros inválidos: informe 'status' numérico e 'usuario'" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const sql = `
        BEGIN
          UPDATE PCPEDC
             SET CODFUNCSEP = :codigo
           WHERE NUMPED = :numped;

          UPDATE PCPEDC
             SET LOG1 = CASE 
                          WHEN LOG1 IS NULL OR LOG1 = '' THEN (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                          ELSE LOG1 || ',' || (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                        END,
                 ULTIMASITUACAOCFAT = SUBSTR((TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario), 1, 100),
                 LOG2 = TO_CHAR(:status)
           WHERE NUMPED = :numped;
        END;`;

      const binds = {
        codigo: codigoNum,
        numped: numpedNum,
        status: statusNum,
        usuario: usuarioStr,
      };
      const result = await conn.execute(sql, binds, { autoCommit: true });

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
