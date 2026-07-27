function getValueCI(obj, nameUpper) {
  if (!obj || typeof obj !== "object") return undefined;
  const key = Object.keys(obj).find((k) => String(k).toUpperCase().trim() === nameUpper);
  return key ? obj[key] : undefined;
}

function normalizeRecord(raw) {
  const codprod = Number(getValueCI(raw, "CODPROD"));
  const descricao = String(getValueCI(raw, "DESCRICAO") ?? "").trim();
  const codauxiliarRaw = getValueCI(raw, "CODAUXILIAR");
  const codigoUsuarioAddRaw = getValueCI(raw, "CODIGO_USUARIO_ADD");

  if (!Number.isFinite(codprod)) {
    return { error: "CODPROD é obrigatório e deve ser numérico" };
  }
  if (!descricao) {
    return { error: "DESCRICAO é obrigatório" };
  }

  const codauxiliar = codauxiliarRaw === undefined || codauxiliarRaw === null ? null : String(codauxiliarRaw).trim();
  const codigo_usuario_add =
    codigoUsuarioAddRaw === undefined || codigoUsuarioAddRaw === null || codigoUsuarioAddRaw === ""
      ? null
      : Number(codigoUsuarioAddRaw);

  if (codigo_usuario_add !== null && !Number.isFinite(codigo_usuario_add)) {
    return { error: "CODIGO_USUARIO_ADD deve ser numérico quando informado" };
  }

  return {
    binds: {
      codprod,
      descricao,
      codauxiliar,
      codigo_usuario_add,
    },
  };
}

async function findExistingByCodprod(conn, { oracledb }, codprod) {
  const result = await conn.execute(
    `SELECT 
       ID, CODPROD, DESCRICAO, CODAUXILIAR, 
       TO_CHAR(DATA_ADD, 'DD/MM/YYYY HH24:MI:SS') AS DATA_ADD,
       CODIGO_USUARIO_ADD
     FROM GESTLOG_PRODUTOS_SEM_GTIN
     WHERE CODPROD = :codprod
     FETCH FIRST 1 ROWS ONLY`,
    { codprod },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  const rows = result.rows || [];
  return rows.length > 0 ? rows[0] : null;
}

export default function registerInserirProdutoSemGtin(router, { oracledb }) {
  router.post("/produtos-sem-gtin/inserir", async (req, res) => {
    const body = req.body || {};
    const registro = Array.isArray(body.registros) ? null : (body.registro || body);
    const registros = Array.isArray(body.registros) ? body.registros : null;

    if ((!registro || typeof registro !== "object") && !Array.isArray(registros)) {
      return res.status(400).json({
        message: "Informe os dados do registro: use 'registro' (objeto) ou 'registros' (array de objetos).",
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
        MERGE INTO GESTLOG_PRODUTOS_SEM_GTIN t
        USING (
          SELECT
            :codprod AS CODPROD,
            :descricao AS DESCRICAO,
            :codauxiliar AS CODAUXILIAR,
            :codigo_usuario_add AS CODIGO_USUARIO_ADD
          FROM DUAL
        ) s
        ON (t.CODPROD = s.CODPROD)
        WHEN NOT MATCHED THEN
          INSERT (
            CODPROD,
            DESCRICAO,
            CODAUXILIAR,
            CODIGO_USUARIO_ADD
          )
          VALUES (
            s.CODPROD,
            s.DESCRICAO,
            s.CODAUXILIAR,
            s.CODIGO_USUARIO_ADD
          )
      `;

      if (Array.isArray(registros) && registros.length > 0) {
        const insertedCodprods = [];
        const alreadyExists = [];
        let insertedCount = 0;

        for (const r of registros) {
          const normalized = normalizeRecord(r || {});
          if (normalized.error) {
            return res.status(400).json({ message: normalized.error });
          }
          const exists = await findExistingByCodprod(conn, { oracledb }, normalized.binds.codprod);
          if (exists) {
            alreadyExists.push({ codprod: normalized.binds.codprod, registro: exists });
            continue;
          }
          const ins = await conn.execute(sql, normalized.binds, { autoCommit: false });
          if ((ins.rowsAffected || 0) > 0) {
            insertedCount += ins.rowsAffected || 0;
            insertedCodprods.push(normalized.binds.codprod);
          } else {
            const existsAfter = await findExistingByCodprod(conn, { oracledb }, normalized.binds.codprod);
            if (existsAfter) {
              alreadyExists.push({ codprod: normalized.binds.codprod, registro: existsAfter });
            }
          }
        }
        await conn.commit();
        return res.json({
          ok: true,
          insertedCount,
          skippedCount: alreadyExists.length,
          insertedCodprods,
          alreadyExists,
          message: "Processado com sucesso",
        });
      }

      const normalized = normalizeRecord(registro || {});
      if (normalized.error) {
        return res.status(400).json({ message: normalized.error });
      }
      const existsSingle = await findExistingByCodprod(conn, { oracledb }, normalized.binds.codprod);
      if (existsSingle) {
        return res.json({
          ok: true,
          exists: true,
          message: "Já existe uma inserção para este CODPROD",
          registro: existsSingle,
        });
      }
      const result = await conn.execute(sql, normalized.binds, { autoCommit: true });
      const inserted = Number(result.rowsAffected || 0) > 0;
      return res.json({
        ok: true,
        inserted,
        rowsAffected: result.rowsAffected || 0,
        message: inserted ? "Registro inserido em GESTLOG_PRODUTOS_SEM_GTIN" : "Registro já existia em GESTLOG_PRODUTOS_SEM_GTIN",
      });
    } catch (err) {
      return res.status(500).json({ message: "Erro ao inserir produto sem GTIN", detalhe: err.message });
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch {}
      }
    }
  });
}
