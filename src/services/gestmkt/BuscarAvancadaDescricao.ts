import type { ProdutoVendaBaixaRow } from "./ProdutosVendaBaixa";

interface BuscarAvancadaDescricaoParams {
  q: string; // termos separados por espaço
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

export interface BuscarAvancadaDescricaoResponse {
  rows: ProdutoVendaBaixaRow[];
  count: number;
}

export async function buscarAvancadaPorDescricao(
  params: BuscarAvancadaDescricaoParams
): Promise<BuscarAvancadaDescricaoResponse> {
  const baseApi = resolveBaseApi();
  const qp = new URLSearchParams({
    q: String(params.q || ''),
    codFilial: String(params.codFilial || ''),
  });
  const url = `${baseApi}/gestmkt/busca-avancada-descricao?${qp.toString()}`;
  const resp = await fetch(url);
  const ct = resp.headers.get('content-type') || '';
  const isJson = ct.toLowerCase().includes('application/json');
  const data = isJson ? await resp.json() : await resp.text();
  if (!resp.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha na busca avançada por descrição');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (busca-avancada-descricao)');
  }
  return data as BuscarAvancadaDescricaoResponse;
}