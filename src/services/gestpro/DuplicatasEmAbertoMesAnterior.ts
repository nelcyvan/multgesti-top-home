export interface DuplicataAbertaAnteriorRow {
  DTEMISSAO: string; // já formatado pelo backend: DD/MM/YYYY
  CODCLI: number;
  CLIENTE: string;
  NUMPED: number;
  VALOR: number;
  CODCOB: string;
  CODUSUR: number;
  NOME: string; // nome do RCA
}

export interface DuplicatasEmAbertoAnteriorResponse {
  rows: DuplicataAbertaAnteriorRow[];
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

export const buscarDuplicatasEmAbertoMesAnterior = async (): Promise<DuplicatasEmAbertoAnteriorResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestpro/duplicatas-em-aberto-mes-anterior`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API GestPRO (duplicatas-em-aberto-mes-anterior)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar Duplicatas em Aberto (Mês Anterior)');
  }
  return data as DuplicatasEmAbertoAnteriorResponse;
};