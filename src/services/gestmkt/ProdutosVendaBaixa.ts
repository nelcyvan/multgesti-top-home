export interface ProdutoVendaBaixaRow {
  CODFILIAL?: number;
  CODPROD?: number;
  DESCRICAO?: string;
  CODAUXILIAR?: string;
  MARCA?: string;
  DISPONIVEL?: number;
  BLOQUEADO?: number;
  AVARIA?: number;
  ESTOQUE_GERAL?: number;
  NOVA_DTULTSAIDA?: string; // DD/MM/YYYY
  CUSTOULTENT?: number;
  PVENDA?: number;
  VENDA_TOTAL?: number;
  QTD_PROMOCOES?: number; // quantidade de promoções no mês
  TIPO_CAMPANHA?: string; // último tipo de campanha no mês (PE,PQ,PP,PA)
  [key: string]: unknown;
}

export interface ProdutosVendaBaixaResponse {
  rows: ProdutoVendaBaixaRow[];
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

export const buscarProdutosVendaBaixa = async (
  params: {
    dataInicio: string; // YYYY-MM-DD
    dataFim: string;    // YYYY-MM-DD
    codFilial: string;  // "1"|"2"|"3"|"4"
    estoqueMinimo?: string; // optional number string
    vendasMax: string;      // required number string
    categoria: string;      // "1"|"2"|"3"
    mesData: string;        // YYYY-MM-DD
  }
): Promise<ProdutosVendaBaixaResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/produtos-venda-baixa`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataInicio: String(params.dataInicio ?? ''),
      dataFim: String(params.dataFim ?? ''),
      codFilial: String(params.codFilial ?? ''),
      estoqueMinimo: String(params.estoqueMinimo ?? ''),
      vendasMax: String(params.vendasMax ?? ''),
      categoria: String(params.categoria ?? ''),
      mesData: String(params.mesData ?? ''),
    }),
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao buscar produtos com venda baixa');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT');
  }
  return data as ProdutosVendaBaixaResponse;
};