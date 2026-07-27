export interface LancamentosAreceberRequest {
  dataInicio: string; // YYYY-MM-DD (frontend)
  dataFinal: string;  // YYYY-MM-DD (frontend)
}

export interface LancamentosAreceberRow {
  ID_IMPORTACAO_OFX: number;
  DATA_TRANSACAO: string; // ISO string do Oracle
  DATA_TRANSACAO_BR?: string | null;
  HISTORICO: string;
  VALOR_TRANSACAO: string; // já formatado pelo backend (pt-BR)
  NOME_BANCO_FILIAL: string;
  DUPLIC?: string | null;
  PREST?: number | string | null;
  CLIENTE?: string | null;
  DTEMISSAO?: string | null; // DD/MM/YYYY
  DTPAG?: string | null;     // DD/MM/YYYY
  VPAGO?: string | null;     // pt-BR
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
 * Busca lançamentos a receber dentro do intervalo de datas.
 * POST /api/gestfin/lancamentos-areceber
 */
export async function buscarLancamentosAreceber(
  payload: LancamentosAreceberRequest
): Promise<LancamentosAreceberRow[]> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/lancamentos-areceber`;

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
    throw new Error(`Erro ao buscar lançamentos à receber: ${resp.status} ${msg}`);
  }

  const data = (await resp.json()) as LancamentosAreceberRow[];
  return Array.isArray(data) ? data : [];
}