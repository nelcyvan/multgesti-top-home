export interface ProdutoSemVendaRow {
  CODFILIAL?: number;
  CODPROD?: number;
  DESCRICAO?: string;
  CODAUXILIAR?: string;
  MARCA?: string;
  DISPONIVEL?: number;
  BLOQUEADO?: number;
  AVARIA?: number;
  ESTOQUE_GERAL?: number;
  DTULTSAIDA?: string; // DD/MM/YYYY
  CUSTOULTENT?: number;
  PRECO_VENDA?: number;
  QTD_PROMOCOES?: number; // quantidade de promoções no mês
  TIPO_CAMPANHA?: string; // último tipo de campanha no mês
  [key: string]: unknown;
}

export interface ProdutosSemVendaResponse {
  rows: ProdutoSemVendaRow[];
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

export const buscarProdutosSemVenda = async (
  params: {
    codFilial: string;
    tipoProduto?: string;    // "1" Geral, "2" Mix, "3" Pisos/Revestimentos
    estoqueMinimo?: string;  // optional number string
    mesData: string;         // required DD/MM/YYYY
  }
): Promise<ProdutosSemVendaResponse> => {
  const baseApi = resolveBaseApi();
  const qp = new URLSearchParams({
    codFilial: String(params.codFilial || ''),
    tipoProduto: String(params.tipoProduto || ''),
    estoqueMinimo: String(params.estoqueMinimo || ''),
    mesData: String(params.mesData || ''),
  });
  const url = `${baseApi}/gestmkt/produtos-sem-venda?${qp.toString()}`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao buscar produtos sem venda');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (sem venda)');
  }
  return data as ProdutosSemVendaResponse;
};