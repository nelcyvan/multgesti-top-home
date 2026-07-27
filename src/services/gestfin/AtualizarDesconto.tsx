// Serviço para atualizar desconto (DESCONTOFIN) de um lançamento por RECNUM

export interface AtualizarDescontoPayload {
  recnum: number;
  desconto: number; // valor em reais, ex.: 10.5
}

export interface AtualizarDescontoResponse {
  ok?: boolean;
  rowsAffected?: number;
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

// POST /api/gestfin/atualizar-desconto
// Esperado no backend: UPDATE PCLANC SET DESCONTOFIN = :desconto WHERE RECNUM = :recnum
export async function atualizarDesconto(
  payload: AtualizarDescontoPayload
): Promise<AtualizarDescontoResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/atualizar-desconto`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = resp.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");
  const data = isJson ? await resp.json() : { error: await safeText(resp) };

  if (!resp.ok) {
    const message = (data as any)?.error || `Erro ao atualizar desconto: ${resp.status}`;
    throw new Error(message);
  }

  return {
    ok: Boolean((data as any)?.ok ?? true),
    rowsAffected: Number((data as any)?.rowsAffected ?? 1),
  };
}