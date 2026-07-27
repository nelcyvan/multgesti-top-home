// Serviço para desdobrar duplicata: reserva RECNUM e insere backup

export interface DesdobrarParcelaPayload {
  recNumAtual: number; // RECNUM atual em TOPHC.PCLANC
  duplic: string;      // índice/identificador da parcela
  valor: number;       // valor da parcela
  dtVenc: string;      // YYYY-MM-DD
  nomeFunc: string;    // usuário
  dtDesd: string;      // YYYY-MM-DD
  codFunc?: number;    // CODUSUR do usuário (para CODFUNCULTALTER)
  finalizar?: boolean; // true apenas na última parcela para executar UPDATE
}

export interface DesdobrarParcelaResponse {
  ok?: boolean;
  recnumReserva?: number;
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

export async function desdobrarParcela(
  payload: DesdobrarParcelaPayload
): Promise<DesdobrarParcelaResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/desdobrar-duplicata`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao desdobrar duplicata: ${resp.status} ${msg}`);
  }

  const data = (await resp.json()) as DesdobrarParcelaResponse;
  return data;
}