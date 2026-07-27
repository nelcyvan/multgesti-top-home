export interface SubirCampanhaProdutoItem {
  codProd: number;
}

export interface SubirCampanhaPayload {
  id: number;
  produtos: SubirCampanhaProdutoItem[]; // lote
  codFilial: string; // "1"|"2"|"3"|"4"
  precoFixo: number; // number
  dtInicio: string;  // YYYY-MM-DD
  dtFim: string;     // YYYY-MM-DD
  codFuncUltAlter: number; // usuário
}

export interface SubirCampanhaResponse {
  ok: boolean;
  message?: string;
  resultados?: Array<{ codProd: number; codPrecoProm?: number; sucesso?: boolean }>;
  erros?: Array<{ codProd: number; erro: string }>;
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

export const subirCampanha = async (
  payload: SubirCampanhaPayload
): Promise<SubirCampanhaResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/subir-campanha`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const ct = resp.headers.get('content-type') || '';
  const isJson = ct.toLowerCase().includes('application/json');
  const data = isJson ? await resp.json() : await resp.text();
  if (!resp.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao subir campanha (lote)');
    const err = new Error(message) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (subir campanha lote)');
  }
  return data as SubirCampanhaResponse;
};