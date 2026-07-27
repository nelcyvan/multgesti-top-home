// Serviço para criar novo lançamento no GestFIN
// POST /api/gestfin/novo-lancamento

export interface NovoLancamentoPayload {
  recnum: number;
  codConta: number;
  codFornec: number;
  historico: string;
  duplic: string;
  valor: number;
  dtVencBind: string; // YYYY-MM-DD
  dtLancBind: string; // YYYY-MM-DD
  dtCompetenciaBind: string; // YYYY-MM-DD
  dtEmissaoBind: string; // YYYY-MM-DD - Data de emissão
  codFilial: number;
  indice: string; // 'A' por padrão
  tipoLanc: string;
  tipoParceiro: string;
  nomeFunc?: string;
  historico2?: string;
  moeda: string; // ex.: 'R'
  recNumPrinc?: number | null;
  nfServicoBind: string; // '', 'N'=NF-e, 'S'=NF-s
  numNotaBind?: number | null;
  codRotinaCad: string; // 'MULTGEST'
  codRotinaAlt: string; // 'MULTGEST'
  parcela: number; // 1
  vlrUtilizadoAdiantFornec?: number;
  lacreDigConecSocial?: string | null; // null ou string
  tiposervico?: string | null; // '20','30','22','99'
  opcaoPagamentoIpva?: string | null; // null ou string
  utilizouRateioConta: string; // 'S' | 'N'
  prcRateioUtilizado?: number; // 100
  reinFEventor4040?: string | null; // 'N'
}

export interface NovoLancamentoResponse {
  ok?: boolean;
  recnum?: number;
  error?: string;
}

function resolveBaseApi(): string {
  const envApiGestfin = (import.meta as any)?.env?.VITE_GESTFIN_API_URL as string | undefined;
  const envApi = envApiGestfin || ((import.meta as any)?.env?.VITE_API_URL as string | undefined);
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  if (envApi && typeof envApi === "string") {
    const isEnvHttp = /^http:\/\//i.test(envApi);
    if (isHttps && isEnvHttp) return "/api";
    const trimmed = envApi.replace(/\/+$/, "");
    const hasApiSuffix = /\/(api)$/i.test(trimmed);
    return hasApiSuffix ? trimmed : `${trimmed}/api`;
  }

  return "/api";
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

export async function criarNovoLancamento(
  payload: NovoLancamentoPayload
): Promise<NovoLancamentoResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/novo-lancamento`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao criar novo lançamento: ${resp.status} ${msg}`);
  }

  const data = (await resp.json()) as NovoLancamentoResponse;
  return data;
}

export async function buscarProximoRecnum(): Promise<number> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/novo-lancamento/proximo-recnum`;

  const resp = await fetch(url);
  if (!resp.ok) {
    const msg = await safeText(resp as Response);
    throw new Error(`Erro ao obter próximo RECNUM: ${resp.status} ${msg}`);
  }
  const data = (await resp.json()) as { recnum?: number };
  return Number(data?.recnum ?? 0);
}

export interface ContaItem { CODCONTA: number; CONTA: string }
export interface FornecedorItem { CODFORNEC: number; FORNECEDOR: string }

export async function buscarContas(params: { nomeConta?: string; codigoConta?: string }): Promise<ContaItem[]> {
  const baseApi = resolveBaseApi();
  const q = new URLSearchParams();
  if (params?.nomeConta) q.set("nomeConta", params.nomeConta);
  if (params?.codigoConta) q.set("codigoConta", params.codigoConta);
  const url = `${baseApi}/gestfin/busca-contas?${q.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao buscar contas: ${resp.status} ${msg}`);
  }
  const data = (await resp.json()) as ContaItem[];
  return Array.isArray(data) ? data : [];
}

export async function buscarFornecedores(params: { nomeFornecedor?: string; codigoFornecedor?: string }): Promise<FornecedorItem[]> {
  const baseApi = resolveBaseApi();
  const q = new URLSearchParams();
  if (params?.nomeFornecedor) q.set("nomeFornecedor", params.nomeFornecedor);
  if (params?.codigoFornecedor) q.set("codigoFornecedor", params.codigoFornecedor);
  const url = `${baseApi}/gestfin/busca-fornecedores?${q.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao buscar fornecedores: ${resp.status} ${msg}`);
  }
  const data = (await resp.json()) as FornecedorItem[];
  return Array.isArray(data) ? data : [];
}