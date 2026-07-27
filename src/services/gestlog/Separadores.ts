export interface Separador {
  MATRICULA: number;
  NOME: string;
}

export interface ListarSeparadoresResponse {
  rows: Separador[];
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

export const listarSeparadores = async (): Promise<ListarSeparadoresResponse> => {
  const baseApi = resolveBaseApi();
  const response = await fetch(`${baseApi}/gestlog/separadores`);
  const contentType = response.headers.get('content-type') || '';
  let data: unknown = null;
  try {
    data = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Resposta inválida ao listar separadores');
  }
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in (data as object)
        ? String((data as { message?: unknown }).message ?? '')
        : String(data || 'Falha ao listar separadores');
    throw new Error(message);
  }
  if (typeof data === 'string') {
    throw new Error(`Resposta não-JSON da API GestLOG: ${data.slice(0, 200)}`);
  }
  return data as ListarSeparadoresResponse;
};

export const definirSeparador = async (
  payload: { numped: number; codigoSeparador: number }
): Promise<{ success: boolean; rowsAffected: number }> => {
  if (!Number.isFinite(payload.numped)) {
    throw new Error('numped inválido');
  }
  if (!Number.isFinite(payload.codigoSeparador)) {
    throw new Error('codigoSeparador inválido');
  }
  const baseApi = resolveBaseApi();
  const response = await fetch(`${baseApi}/gestlog/definir-separador`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numped: Number(payload.numped), codigoSeparador: Number(payload.codigoSeparador) }),
  });
  const contentType = response.headers.get('content-type') || '';
  let data: unknown = null;
  try {
    data = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Resposta inválida ao definir separador');
  }
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in (data as object)
        ? String((data as { message?: unknown }).message ?? '')
        : String(data || 'Falha ao definir separador');
    throw new Error(message);
  }
  if (typeof data === 'string') {
    throw new Error(`Resposta não-JSON da API GestLOG: ${data.slice(0, 200)}`);
  }
  return data as { success: boolean; rowsAffected: number };
};