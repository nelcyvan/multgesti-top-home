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

export interface UltimoCodContaResponse {
  ultimoCodConta: number;
}

export async function buscarUltimoCodConta(): Promise<number> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/ultimo-codconta`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao buscar último CODCONTA: ${resp.status} ${msg}`);
  }
  const data = (await resp.json()) as UltimoCodContaResponse;
  return Number(data?.ultimoCodConta ?? 0);
}