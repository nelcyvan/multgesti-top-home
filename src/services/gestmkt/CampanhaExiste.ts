export interface CampanhaExisteResponse {
  ok: boolean;
  exists: boolean;
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

export async function campanhaExiste(codProd: number): Promise<CampanhaExisteResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/campanha-existe`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codProd }),
  });
  const ct = resp.headers.get('content-type') || '';
  const isJson = ct.toLowerCase().includes('application/json');
  const data = isJson ? await resp.json() : await resp.text();
  if (!resp.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao verificar campanha existente');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (campanha-existe)');
  }
  return data as CampanhaExisteResponse;
}