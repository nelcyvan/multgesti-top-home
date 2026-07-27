export interface CalcularMargemPrecoFixoPayload {
  precoFixo: number;
  pcomint1?: number; // percentual de comissão interna
  custoBase?: number;
  custoReal?: number;
  custoUltEntLiq?: number;
  custoUltEnt?: number;
}

export interface CalcularMargemPrecoFixoResponse {
  ok: boolean;
  precoFixo: number;
  pcomint1: number;
  custoBase: number;
  comissaoValor: number;
  cmvCalculado: number;
  margemPercent: number;
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

export const calcularMargemPrecoFixo = async (
  payload: CalcularMargemPrecoFixoPayload
): Promise<CalcularMargemPrecoFixoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/calcular-margem-preco-fixo`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao calcular margem para preço fixo');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (calcular margem)');
  }
  return data as CalcularMargemPrecoFixoResponse;
};