export interface ProdutoPromocaoRow {
  ID?: number;
  CODFILIAL?: number;
  CODPROD?: number;
  MES_DATA_PROMOCAO?: string; // MM-YYYY
  DT_ADD?: string; // DD/MM/YYYY
  CODUSUR_ADD?: number;
  TIPOCAMPANHA?: string; // 'PQ','PE','PP','AC'
  PRECOFICTICIO?: number;
  DESCRICAO?: string;
  CODAUXILIAR?: string;
  MARCA?: string;
  PRECOFIXO?: number;
  CODPRECOPROM?: number;
  STATUS_ENCARTE?: string; // S ou NULL
  // Campos antigos (compatibilidade)
  DTINICIOVIGENCIA?: string; // DD/MM/YYYY
  DTFIMVIGENCIA?: string;    // DD/MM/YYYY
  // Campos atuais vindos do endpoint
  DT_INICIO_CAMPANHA?: string; // DD/MM/YYYY HH:mm:ss ou DD/MM/YYYY
  DT_FIM_CAMPANHA?: string;    // DD/MM/YYYY HH:mm:ss ou DD/MM/YYYY
  // Novos campos para exibição de Venda, Custo e Margem
  CUSTOULTENT?: number;
  CUSTOULTENTLIQ?: number;
  CUSTOREAL?: number;
  PVENDA?: number;
  PCOMINT1?: number; // percentual de comissão interna
  COMISSAO_VALOR?: number; // venda * (pcomint1/100)
  CUSTO_BASE?: number; // custo preferencial (real ou ultentliq)
  CMV_CALCULADO?: number; // custo + comissão
  MARGEM_PRECIFICACAO?: number; // % truncada
  [key: string]: unknown;
}

export interface ProdutosPromocaoResponse {
  rows: ProdutoPromocaoRow[];
  count: number;
}

export interface ProdutosPromocaoAgregadoResponse {
  PQ: ProdutosPromocaoResponse;
  PE: ProdutosPromocaoResponse;
  PP: ProdutosPromocaoResponse;
  PA: ProdutosPromocaoResponse; // Produtos Ação (servidor retorna 'PA')
}

const resolveBaseApi = (): string => {
  const env = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL;
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';

  if (env && typeof env === 'string') {
    const trimmed = env.replace(/\/+$/, '');
    const isEnvHttp = /^http:\/\//i.test(trimmed);
    // Evita Mixed Content: se site está em HTTPS e API em HTTP explícito, usa caminho relativo
    if (isHttps && isEnvHttp) return '/api';
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  // Sem VITE_API_URL definido, usa caminho relativo com proxy do dev
  return '/api';
};

export const buscarProdutosPromocaoAgregado = async (mes: string): Promise<ProdutosPromocaoAgregadoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/produtos-promocao?mes=${encodeURIComponent(mes)}`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao buscar produtos (agregado)');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (agregado)');
  }
  return data as ProdutosPromocaoAgregadoResponse;
};

export const confirmarEncarte = async (id: number, status?: string): Promise<{ ok: boolean; rowsAffected: number }> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/produtos-promocao/confirmar-encarte`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao confirmar encarte');
  }
  return data;
};

export const excluirProdutoPromocao = async (id: number, codPrecoProm?: number): Promise<{ ok: boolean; rowsAffected: number }> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/produtos-promocao/excluir`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, codPrecoPromocional: codPrecoProm }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao excluir produto promoção');
  }
  return data;
};