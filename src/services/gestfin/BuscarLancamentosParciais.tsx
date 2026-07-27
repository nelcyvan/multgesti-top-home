export interface LancamentoParcialRow {
  RECNUM: number;
  FORNECEDOR?: string | null;
  VALOR_NUM?: number; // valor numérico bruto
  VALOR_FORMATADO: string; // já formatado pela API
  JUROS_NUM?: number; // juros numérico bruto
  JUROS?: string | null; // já formatado pela API
  DESCONTOFIN_NUM?: number; // desconto numérico bruto
  DESCONTOFIN?: string | null; // já formatado pela API
  NUMNOTA?: number | string | null;
  HISTORICO?: string | null;
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
 * Busca lançamentos parciais vinculados a um ID de importação OFX.
 * GET /api/gestfin/lancamentos-parciais/:idImportacaoOFX
 */
export async function buscarLancamentosParciais(
  idImportacaoOFX: number
): Promise<LancamentoParcialRow[]> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/lancamentos-parciais/${idImportacaoOFX}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao buscar lançamentos parciais: ${resp.status} ${msg}`);
  }

  const data = (await resp.json()) as LancamentoParcialRow[];
  return Array.isArray(data) ? data : [];
}