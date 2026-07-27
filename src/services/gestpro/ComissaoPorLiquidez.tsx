export interface ComissaoPorLiquidezRow {
  QTTITULOS: number;
  CODUSUR: number;
  RCA: string;
  TIPOVEND: string;
  VALOR: number;
}

export interface ComissaoPorLiquidezResponse {
  rows: ComissaoPorLiquidezRow[];
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

export const buscarComissaoPorLiquidez = async (): Promise<ComissaoPorLiquidezResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestpro/comissao-por-liquidez`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API GestPRO (comissao-por-liquidez)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar comissões por liquidez');
  }
  return data as ComissaoPorLiquidezResponse;
};