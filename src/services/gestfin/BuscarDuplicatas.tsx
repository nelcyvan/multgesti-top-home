export interface BuscarDuplicatasParams {
  codFilial: number;
  dataInicio: string; // DD/MM/YYYY
  dataFim: string; // DD/MM/YYYY
}

export interface DuplicataRow {
  RECNUM: number;
  NOMEFUNC?: string | null;
  DTEMISSAO: string; // DD/MM/YYYY
  DTLANC: string; // DD/MM/YYYY
  DTVENC: string; // DD/MM/YYYY
  CODCONTA: number;
  CONTA?: string | null;
  CODFORNEC: number;
  FORNECEDOR?: string | null;
  HISTORICO?: string | null;
  NUMNOTA?: number | null;
  VALOR: string; // formatado pela API
  DTPAGTO?: string | null; // DD/MM/YYYY ou null
  CODFUNCBAIXA?: number | null;
  ASSINATURA?: string | null;
  DTASSINATURA?: string | null; // DD/MM/YYYY ou null
  JUROS: string; // formatado pela API
  DUPLIC?: string | null;
  DESCONTOFIN: string; // formatado pela API
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

export const buscarDuplicatas = async (
  params: BuscarDuplicatasParams
): Promise<DuplicataRow[]> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/buscar-duplicatas`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson
      ? (payload as any)?.error || (payload as any)?.message
      : String(payload || "Falha ao buscar duplicatas");
    throw new Error(message);
  }

  const rows = Array.isArray(payload) ? (payload as DuplicataRow[]) : [];
  return rows;
};