export default function registerAssumirSeparacaoPedido(router, { oracledb }) {
  router.post("/assumir-separacao", async (req, res) => {
    const { numped, status, usuario, codigoNovoSeparador } = req.body || {};

    const numpedNum = Number(numped);
    const statusNum = Number(status);
    const usuarioStr = String(usuario || "").trim();
    const codigoNovoSeparadorNum = Number(codigoNovoSeparador);

    if (
      !Number.isFinite(numpedNum) ||
      !Number.isFinite(statusNum) ||
      !usuarioStr ||
      !Number.isFinite(codigoNovoSeparadorNum)
    ) {
      return res.status(400).json({
        message:
          "Parâmetros inválidos: informe 'numped', 'status' e 'codigoNovoSeparador' numéricos e 'usuario'",
      });
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
             SET CODFUNCSEP = :codigoNovoSeparador
           WHERE NUMPED = :numped;

          UPDATE PCPEDC
             SET LOG1 = CASE
                          WHEN LOG1 IS NULL OR LOG1 = ''
                               THEN (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                          ELSE LOG1 || ',' || (TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario)
                        END,
                 ULTIMASITUACAOCFAT = SUBSTR((TO_CHAR(:status) || '__' || TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') || '_' || :usuario), 1, 100),
                 LOG2 = TO_CHAR(:status)
           WHERE NUMPED = :numped;
        END;`;

      const binds = {
        numped: numpedNum,
        status: statusNum,
        usuario: usuarioStr,
        codigoNovoSeparador: codigoNovoSeparadorNum,
      };
      const result = await conn.execute(sql, binds, { autoCommit: true });
      return res.json({ ok: true, rowsAffected: result.rowsAffected || 0 });
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
