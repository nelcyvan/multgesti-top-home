export interface ComissaoPorLiquidezMesAnteriorRow {
  QTTITULOS: number;
  CODUSUR: number;
  RCA: string;
  TIPOVEND: string;
  VALOR: number;
}

export interface ComissaoPorLiquidezMesAnteriorResponse {
  rows: ComissaoPorLiquidezMesAnteriorRow[];
  count: number;
}

const resolveBaseApi = (): string => {
  const env = import.meta.env.VITE_API_URL || '';
  let baseApi = '/api';
  if (env) {
    const trimmed = env.replace(/\/$/, '');
    baseApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return baseApi;
};

export const buscarComissaoPorLiquidezMesAnterior = async (): Promise<ComissaoPorLiquidezMesAnteriorResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestpro/comissao-por-liquidez-mes-anterior`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API GestPRO (comissao-por-liquidez-mes-anterior)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar comissões por liquidez (mês anterior)');
  }
  return data as ComissaoPorLiquidezMesAnteriorResponse;
};