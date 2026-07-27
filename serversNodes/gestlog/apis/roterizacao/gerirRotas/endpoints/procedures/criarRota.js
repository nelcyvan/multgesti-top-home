import oracledb from "oracledb";

export default async function criarRota(conn, params) {
  const {
    descricaoRota,
    bairro1,
    bairro2,
    bairro3,
    bairro4,
    bairro5,
    codMotorista,
    codVeiculo,
    dataRota,
    codUsurCriacao,
    turnoSeparacao,
  } = params;

  const binds = {
    p_descricao_rota: descricaoRota,
    p_bairro1: bairro1,
    p_bairro2: bairro2,
    p_bairro3: bairro3,
    p_bairro4: bairro4,
    p_bairro5: bairro5,
    p_cod_motorista: codMotorista,
    p_cod_veiculo: codVeiculo,
    p_data_rota: dataRota,
    p_codusur_criacao: codUsurCriacao,
    p_turno_separacao: turnoSeparacao,
    p_status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
    p_id_rota: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  };

  const exec = await conn.execute(
    `BEGIN
      GESTLOG_CRIAR_ROTA(
        :p_descricao_rota,
        :p_bairro1,
        :p_bairro2,
        :p_bairro3,
        :p_bairro4,
        :p_bairro5,
        :p_cod_motorista,
        :p_cod_veiculo,
        :p_data_rota,
        :p_codusur_criacao,
        :p_turno_separacao,
        :p_status,
        :p_message,
        :p_id_rota
      );
    END;`,
    binds
  );

  const status = Number(exec?.outBinds?.p_status);
  const message = String(exec?.outBinds?.p_message ?? "").trim() || "Erro interno no servidor";
  const idRota = Number(exec?.outBinds?.p_id_rota);

  return { status, message, idRota: Number.isFinite(idRota) ? idRota : null };
}
