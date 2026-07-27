export interface RegistrarPromocaoPayload {
  codFilial: string;      // "1"|"2"|"3"|"4"
  codProd: number;        // produto
  tipoCampanha: string;   // "PE"|"PQ"|"PP"|"PA"
  mesDataPromocao: string; // YYYY-MM ou DD/MM/YYYY
  codUsurAdd: number;     // matricula
}

export interface RegistrarPromocaoResponse {
  ok: boolean;
  exists?: boolean;
  inserted?: boolean;
  rowsAffected?: number;
  message?: string;
  id?: number;
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

export const registrarPromocao = async (payload: RegistrarPromocaoPayload): Promise<RegistrarPromocaoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/produtos-promocao/registrar`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao registrar promoção');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (registrar)');
  }
  return data as RegistrarPromocaoResponse;
};

export interface RegistrarPromocaoComDetalhesPayload extends RegistrarPromocaoPayload {
  precoFicticio?: number | null;
  precoFixo?: number | null;
  dataInicioCampanha?: string | null; // DD/MM/YYYY
  dataFimCampanha?: string | null;    // DD/MM/YYYY
}

export const registrarPromocaoComDetalhes = async (payload: RegistrarPromocaoComDetalhesPayload): Promise<RegistrarPromocaoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/produtos-promocao/registrar-com-detalhes`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao registrar promoção com detalhes');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (registrar-com-detalhes)');
  }
  return data as RegistrarPromocaoResponse;
};