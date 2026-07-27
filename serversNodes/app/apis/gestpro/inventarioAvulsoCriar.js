export default function registerInventarioAvulsoCriar(router, { oracledb }) {
  router.post("/inventario/avulso", async (req, res) => {
    const body = req.body || {};
    const nomeInventario = String(body.nomeInventario || "").trim();
    const localContagem = String(body.localContagem || "").trim();
    const codusur = Number(body.codusur);
    const nomeUsuario = String(body.nomeUsuario || "").trim();
    const filial = String(body.filial || "").trim();
    const responsavel = String(body.responsavel || "").trim();

    if (!nomeInventario || !localContagem || !Number.isFinite(codusur) || !nomeUsuario || !filial || !responsavel) {
      return res.status(400).json({ message: "Parâmetros obrigatórios ausentes: nomeInventario, localContagem, codusur, nomeUsuario, filial, responsavel" });
    }

    let conn;
    try {
      conn = await oracledb.getConnection({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECT_STRING,
      });

      const rId = await conn.execute(
        `SELECT NVL(MAX(ID_INVENTARIO), 0) + 1 AS NEXT_ID FROM MULTGESTI_INVENTARIO_AVULSO`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const nextId = Number(((rId.rows || [])[0] || {}).NEXT_ID || 0);
      if (!Number.isFinite(nextId) || nextId <= 0) {
        return res.status(500).json({ message: "Falha ao obter próximo ID do inventário" });
      }

      await conn.execute(
        `INSERT INTO MULTGESTI_INVENTARIO_AVULSO (
        ID_INVENTARIO,
        NOME_INVENTARIO,
        LOCAL_CONTAGEM,
        CODUSUR,
        NOME_USUARIO,
        FILIAL,
        DATA,
        RESPONSAVEL
      ) VALUES (
        :id,
        :nomeInventario,
        :localContagem,
        :codusur,
        :nomeUsuario,
        :filial,
        SYSTIMESTAMP,
        :responsavel
      )`,
        { id: nextId, nomeInventario, localContagem, codusur, nomeUsuario, filial, responsavel },
        { autoCommit: true }
      );
      return res.json({ ok: true, idInventario: nextId });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao criar inventário", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (err) {}
      }
    }
  });
}
