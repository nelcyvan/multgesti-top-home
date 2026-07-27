export interface ExcluirDuplicataPayload {
  recnum: number;
  duplic: string;
}

export interface ExcluirDuplicataResponse {
  ok: boolean;
  rowsAffected: number;
  error?: string;
}

function resolveBaseApi(): string {
  const envApiGestfin = (import.meta as any)?.env?.VITE_GESTFIN_API_URL as string | undefined;
  const envApi = envApiGestfin || ((import.meta as any)?.env?.VITE_API_URL as string | undefined);
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  if (envApi && typeof envApi === "string") {
    const isEnvHttp = /^http:\/\//i.test(envApi);
    if (isHttps && isEnvHttp) return "/api"; // evita mixed-content

    const trimmed = envApi.replace(/\/+$/, "");
    const hasApiSuffix = /\/api$/i.test(trimmed);
    return hasApiSuffix ? trimmed : `${trimmed}/api`;
  }

  return "/api";
}

export async function excluirDuplicata(payload: ExcluirDuplicataPayload): Promise<ExcluirDuplicataResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/excluir-duplicata`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Erro ao excluir duplicata: ${resp.status} ${text}`);
  }

  return (await resp.json()) as ExcluirDuplicataResponse;
}