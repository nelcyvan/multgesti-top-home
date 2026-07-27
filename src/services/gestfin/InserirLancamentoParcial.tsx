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
  try { return await resp.text(); } catch { return ""; }
}

export interface InserirLancamentoParcialPayload {
  idOfx: number;
  recnum: number;
  codUsurVinculacao: number;
  valor: number;
  historico?: string | null;
  fornecedor?: string | null;
  numNota?: number | string | null;
  juros: number;
}

export async function inserirLancamentoParcial(payload: InserirLancamentoParcialPayload): Promise<number> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/inserir-lancamento-parcial`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao inserir parcial: ${resp.status} ${msg}`);
  }

  const data = await resp.json();
  return Number(data?.rowsAffected ?? 0);
}