import oracledb from "oracledb";

export default async function excluirRota(conn, params) {
  const { idRota } = params;

  const binds = {
    p_id_rota: idRota,
    p_status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
  };

  const exec = await conn.execute(
    `BEGIN
      GESTLOG_EXCLUIR_ROTA(
        :p_id_rota,
        :p_status,
        :p_message
      );
    END;`,
    binds
  );

  const status = Number(exec?.outBinds?.p_status);
  const message = String(exec?.outBinds?.p_message ?? "").trim() || "Erro interno no servidor";

  return { status, message };
}
