import type { ProdutoVendaBaixaRow } from "./ProdutosVendaBaixa";

interface BuscarProdutoParams {
  q: string;
  codFilial: string; // "1"|"2"|"3"|"4"
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

export const buscarProdutoPorQuery = async (
  params: BuscarProdutoParams
): Promise<ProdutoVendaBaixaRow | null> => {
  const baseApi = resolveBaseApi();
  const qp = new URLSearchParams({
    q: String(params.q || ''),
    codFilial: String(params.codFilial || ''),
  });
  const url = `${baseApi}/gestmkt/buscar-produto?${qp.toString()}`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha na busca de produto');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (buscar produto)');
  }
  const resData = data as { row?: ProdutoVendaBaixaRow; rows?: ProdutoVendaBaixaRow[] };
  const row = resData.row ?? (resData.rows || [])[0];
  if (!row) return null;
  return row;
};