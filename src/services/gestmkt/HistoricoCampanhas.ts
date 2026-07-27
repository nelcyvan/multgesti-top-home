export interface HistoricoCampanhaRow {
  CODFILIAL: number;
  CODPROD: number;
  MES_DATA_PROMOCAO: string; // ISO or raw
  DT_ADD: string;
  CODUSUR_ADD: number;
  TIPO_CAMPANHA: string;
  PRECOFICTICIO: number | null;
  ID: number;
  DT_INICIO_CAMPANHA: string | null;
  DT_FIM_CAMPANHA: string | null;
  PRECOFIXO: number | null;
  DT_SALVO: string | null;
  CODUSUR_SALVOU: number | null;
  CODIGO_PROMOCAO: number | null;
  STATUS_ENCARTE: string | null;
}

export interface HistoricoCampanhaResponse {
  rows: HistoricoCampanhaRow[];
  count: number;
}

const resolveBaseApi = (): string => {
  const env = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL;
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';

  if (env && typeof env === 'string') {
    const trimmed = env.replace(/\/+$/, '');
    const isEnvHttp = /^http:\/\//i.test(trimmed);
    if (isHttps && isEnvHttp) return '/api';
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  return '/api';
};

export const buscarHistoricoCampanhas = async (
  codProd: number
): Promise<HistoricoCampanhaResponse> => {
  const baseApi = resolveBaseApi();
  // Endpoint: /api/gestpro/historico-campanhas/:codProd
  const url = `${baseApi}/gestpro/historico-campanhas/${codProd}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao buscar histórico de campanhas');
    throw new Error(message);
  }

  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API (Histórico)');
  }

  return data as HistoricoCampanhaResponse;
};
