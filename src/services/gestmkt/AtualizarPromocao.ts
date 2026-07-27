export interface AtualizarPromocaoPayload {
  id: number;
  precoFicticio?: number | null;
  precoFixo?: number | null;
  dataInicioCampanha?: string | null; // DD/MM/YYYY
  dataFimCampanha?: string | null;    // DD/MM/YYYY
  dataSalvou?: string | null;         // DD/MM/YYYY
  codigoUsuarioSalvou?: number | null;
}

export interface AtualizarPromocaoResponse {
  ok: boolean;
  rowsAffected?: number;
  message?: string;
}

const resolveBaseApi = (): string => {
  const env = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';

  if (env && typeof env === 'string') {
    const trimmed = env.replace(/\/+$/, '');
    const isEnvHttp = /^http:\/\//i.test(trimmed);
    if (isHttps && isEnvHttp) return '/api';
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  return '/api';
};

export const atualizarPromocao = async (
  payload: AtualizarPromocaoPayload
): Promise<AtualizarPromocaoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/produtos-promocao/atualizar`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as any)?.message : String(data || 'Falha ao atualizar promoção');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (atualizar)');
  }
  return data as AtualizarPromocaoResponse;
};