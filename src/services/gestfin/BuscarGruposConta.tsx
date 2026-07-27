export interface GrupoContaItem {
  CODGRUPO: number;
  GRUPO: string;
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

export async function buscarGruposConta(): Promise<GrupoContaItem[]> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/grupos-conta`;
  const resp = await fetch(url);
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const txt = await resp.text();
    throw new Error(txt || 'Resposta inválida ao listar grupos de contas');
  }
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error || 'Falha ao buscar grupos de contas');
  }
  return Array.isArray(data) ? data as GrupoContaItem[] : [];
}