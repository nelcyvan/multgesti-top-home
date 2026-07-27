export interface ConciliarAreceberPayload {
  idOfx: number;
  valor: number | string; // será positivado no backend
  data: string; // DD/MM/YYYY
}

export interface ConciliarAreceberResponse {
  ok: boolean;
  duplic?: string | null;
  prest?: string | number | null;
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
  try { return await resp.text(); } catch { return ""; }
}

export async function conciliarAreceber(payload: ConciliarAreceberPayload): Promise<ConciliarAreceberResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/areceber/conciliar`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    return { ok: false, error: `Erro ${resp.status}: ${msg}` };
  }

  const ct = resp.headers.get("content-type") || "";
  const isJson = ct.toLowerCase().includes("application/json");
  const data = isJson ? await resp.json() : { ok: true };
  return data as ConciliarAreceberResponse;
}