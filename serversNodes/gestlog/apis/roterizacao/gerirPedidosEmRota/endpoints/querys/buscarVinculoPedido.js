import oracledb from "oracledb";

export default async function buscarVinculoPedido(conn, numped) {
  const result = await conn.execute(
    `
      SELECT
        r.ID_ROTA AS ID_ROTA,
        r.DESCRICAO_ROTA AS DESCRICAO_ROTA,
        r.DATA_ROTA AS DATA_ROTA,
        r.TURNO_SEPARACAO AS TURNO_SEPARACAO,
        r.COD_MOTORISTA AS COD_MOTORISTA,
        mot.NOME AS MOTORISTA_NOME,
        r.COD_VEICULO AS COD_VEICULO,
        vei.DESCRICAO_VEICULO AS VEICULO_DESCRICAO,
        vei.PLACA_VEICULO AS VEICULO_PLACA,
        rp.DATA_ADD AS DATA_ADD
      FROM GESTLOG_ROTAS_PEDIDOS rp
      JOIN GESTLOG_ROTAS r
        ON r.ID_ROTA = rp.ID_ROTA
      LEFT JOIN GESTLOG_MOTORISTAS mot
        ON mot.ID = r.COD_MOTORISTA
      LEFT JOIN GESTLOG_VEICULOS vei
        ON vei.ID = r.COD_VEICULO
      WHERE rp.NUMPED = :numped
      ORDER BY r.DATA_ROTA DESC, rp.DATA_ADD DESC
      FETCH FIRST 1 ROWS ONLY
    `,
    { numped },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  const row = result?.rows?.[0] || null;
  if (!row) return null;
  return {
    idRota: Number(row.ID_ROTA),
    descricaoRota: row.DESCRICAO_ROTA ?? null,
    dataRota: row.DATA_ROTA ?? null,
    turnoSeparacao: row.TURNO_SEPARACAO ?? null,
    codMotorista: row.COD_MOTORISTA ?? null,
    motoristaNome: row.MOTORISTA_NOME ?? null,
    codVeiculo: row.COD_VEICULO ?? null,
    veiculoDescricao: row.VEICULO_DESCRICAO ?? null,
    veiculoPlaca: row.VEICULO_PLACA ?? null,
    dataAdd: row.DATA_ADD ?? null,
  };
}
