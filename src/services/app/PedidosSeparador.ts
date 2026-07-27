export interface PedidoSeparadorRow {
  NUMPED: number;
  DATA: string;
  CODCLI: number;
  CLIENTE: string;
  CODPROD: number;
  DESCRICAO: string;
  CODAUXILIAR: string;
  MARCA?: string;
  QT: number;
  MULTIPLO?: number;
  PVENDA?: number;
  CODFUNCSEP?: number;
  QT_TOTAL: string;
}

export interface PedidosSeparadorResponse {
  rows: PedidoSeparadorRow[];
  count: number;
}

const resolveBaseApi = (): string => {
  const env = import.meta?.env?.VITE_API_URL || '';
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  const trimmed = env.replace(/\/$/, '');
  if (!trimmed) return '/api';
  if (isHttps && /^http:\/\//i.test(trimmed)) return '/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

export async function buscarPedidosPorSeparador(codigo: string | number): Promise<PedidosSeparadorResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestpro/pedidos-separador?codigo=${encodeURIComponent(String(codigo))}`;
  const resp = await fetch(url);
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const txt = await resp.text();
    throw new Error(txt || 'Resposta inválida da API GestPRO (pedidos-separador)');
  }
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.message || 'Falha ao buscar pedidos por separador');
  }
  return data as PedidosSeparadorResponse;
}