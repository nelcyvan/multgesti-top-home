export interface LancamentosApagarRequest {
  dataInicio: string; // YYYY-MM-DD (frontend)
  dataFinal: string;  // YYYY-MM-DD (frontend)
}

export interface LancamentosApagarRow {
  ID_IMPORTACAO_OFX: number;
  DATA_TRANSACAO: string; // ISO string do Oracle (ex.: 2025-10-01T00:00:00.000Z)
  HISTORICO: string;
  VALOR_TRANSACAO: string; // já formatado pelo backend (pt-BR)
  NOME_BANCO_FILIAL: string;
  NFSERVICO_STATUS: string;
  RECNUM_PRINCIPAL_OU_PARCIAIS: string; // pode ser LISTAGG
  CODFORNEC: number;
  DTPAGTO: string; // DD/MM/YYYY
  DESCONTOFIN: string; // já formatado pelo backend (pt-BR)
  NUMNOTA: string; // pode ser 'Sem Nota' ou LISTAGG
  VALOR_LANCAMENTO_INTERNO: string; // já formatado pelo backend (pt-BR)
  FORNECEDOR: string;
  CONTA?: string; // nome da conta (PCCONTA.CONTA)
  STATUS_PAGAMENTO: string;
  JUROS: string; // já formatado pelo backend (pt-BR)
  HISTORICO_DUPLICATA: string;
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

/**
 * Busca lançamentos a pagar dentro do intervalo de datas.
 * POST /api/gestfin/lancamentos-apagar
 */
export async function buscarLancamentosApagar(
  payload: LancamentosApagarRequest
): Promise<LancamentosApagarRow[]> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/lancamentos-apagar`;

  // Backend espera 'DD/MM/YYYY'
  const toBR = (iso: string) => {
    const [yyyy, mm, dd] = iso.split("-");
    if (!yyyy || !mm || !dd) return iso;
    return `${dd}/${mm}/${yyyy}`;
  };

  const body = {
    dataInicio: toBR(payload.dataInicio),
    dataFim: toBR(payload.dataFinal),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao buscar lançamentos a pagar: ${resp.status} ${msg}`);
  }

  const data = (await resp.json()) as LancamentosApagarRow[];
  return Array.isArray(data) ? data : [];
}

/**
 * Consulta soma de adiantamentos (PCLANC.ADIANTAMENTO = 'S') por período de DTLANC.
 * POST /api/gestfin/lancamentos-apagar/adiantamentos-sum
 */
export async function buscarSomaAdiantamentos(
  payload: LancamentosApagarRequest
): Promise<number> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/lancamentos-apagar/adiantamentos-sum`;

  const toBR = (iso: string) => {
    const [yyyy, mm, dd] = iso.split("-");
    if (!yyyy || !mm || !dd) return iso;
    return `${dd}/${mm}/${yyyy}`;
  };

  const body = {
    dataInicio: toBR(payload.dataInicio),
    dataFim: toBR(payload.dataFinal),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao consultar soma de adiantamentos: ${resp.status} ${msg}`);
  }

  const json = await resp.json();
  const total = Number(json?.total ?? 0);
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
}