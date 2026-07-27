import oracledb from "oracledb";

export default async function inserirPedidoRota(conn, { idRota, numped, codUsurAdd }) {
  const binds = {
    p_id_rota: idRota,
    p_numped: numped,
    p_codusur_add: codUsurAdd,
    p_status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
    p_id_item: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  };
  const proc = await conn.execute(
    `BEGIN
      GESTLOG_INSERIR_PEDIDO_ROTA(
        :p_id_rota,
        :p_numped,
        :p_codusur_add,
        :p_status,
        :p_message,
        :p_id_item
      );
    END;`,
    binds
  );
  const status = Number(proc?.outBinds?.p_status);
  const message = String(proc?.outBinds?.p_message ?? "").trim() || "Erro interno no servidor";
  const idItem = Number(proc?.outBinds?.p_id_item);
  return { status, message, idItem: Number.isFinite(idItem) ? idItem : null };
}
