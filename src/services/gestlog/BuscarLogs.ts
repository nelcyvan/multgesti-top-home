export interface BuscarLogsResponse {
  ULTIMASITUACAOCFAT?: string;
  LOG1?: string;
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

export async function buscarLogs(numped: number): Promise<BuscarLogsResponse> {
  if (!Number.isFinite(numped)) {
    throw new Error('numped inválido');
  }
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestlog/logs/${numped}`;
  const resp = await fetch(url);
  if (resp.status === 404) {
    const url2 = `${baseApi}/gestlog/logs?numped=${numped}`;
    const resp2 = await fetch(url2);
    if (!resp2.ok) {
      const txt = await resp2.text().catch(() => '');
      throw new Error(txt || `Falha ao buscar logs em ${url2}`);
    }
    const ct2 = resp2.headers.get('content-type') || '';
    if (!ct2.includes('application/json')) {
      const text = await resp2.text().catch(() => '');
      throw new Error(text || 'Resposta não-JSON ao buscar logs');
    }
    return (await resp2.json()) as BuscarLogsResponse;
  }
  const ct = resp.headers.get('content-type') || '';
  let data: unknown = null;
  try {
    data = ct.includes('application/json') ? await resp.json() : await resp.text();
  } catch (_err) {
    const text = await resp.text().catch(() => '');
    throw new Error(text || 'Resposta inválida ao buscar logs');
  }
  if (!resp.ok) {
    const message = (() => {
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        const m = obj.message;
        return typeof m === 'string' ? m : 'Falha ao buscar logs';
      }
      return String(data || 'Falha ao buscar logs');
    })();
    throw new Error(message);
  }
  if (typeof data === 'string') {
    throw new Error(`Resposta não-JSON da API GestLOG: ${data.slice(0, 200)}`);
  }
  return data as BuscarLogsResponse;
}