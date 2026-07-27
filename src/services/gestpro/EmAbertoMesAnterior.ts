export interface EmAbertoMesAnteriorRow {
  CODUSUR?: number;
  RCA?: string;
  VALOR?: number;
  [key: string]: unknown;
}

export interface EmAbertoMesAnteriorResponse {
  rows: EmAbertoMesAnteriorRow[];
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

export const buscarEmAbertoMesAnterior = async (): Promise<EmAbertoMesAnteriorResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestpro/em-aberto-mes-anterior`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API GestPRO (em-aberto-mes-anterior)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar Em Aberto (Mês Anterior)');
  }
  return data as EmAbertoMesAnteriorResponse;
};