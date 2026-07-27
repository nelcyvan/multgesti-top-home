export interface EmAbertoRow {
  CODUSUR?: number;
  RCA?: string;
  VALOR?: number;
  [key: string]: unknown;
}

export interface EmAbertoResponse {
  rows: EmAbertoRow[];
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

export const buscarEmAbertoMesAtual = async (): Promise<EmAbertoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestpro/em-aberto-mes-atual`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API GestPRO (em-aberto-mes-atual)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar Em Aberto (Mês Atual)');
  }
  return data as EmAbertoResponse;
};