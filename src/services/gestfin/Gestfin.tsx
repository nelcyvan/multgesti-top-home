export interface CarteiraClienteRequest {
  codigoCliente: number;
  dataInicio: string; // formato: YYYY-MM-DD
  dataFinal: string;  // formato: YYYY-MM-DD
  codigoFilial: number;
}

export interface CarteiraClienteRow {
  DTEMISSAO: string; // DD/MM/YYYY
  DTPAGTO: string;   // DD/MM/YYYY
  CODCLI: number;
  CLIENTE: string;
  DUPLIC: string;
  PREST: number;
  VALOR: number;
  CODUSUR: number;
  NOME: string;
  CODCOB: string;
  COBRANCA: string;
  CODFILIAL: number;
}

export interface UsuarioRow {
  CODUSUR: number;
  NOME: string;
}

function resolveBaseApi(): string {
  const envApiGestfin = (import.meta as any)?.env?.VITE_GESTFIN_API_URL as string | undefined;
  const envApi = envApiGestfin || ((import.meta as any)?.env?.VITE_API_URL as string | undefined);
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  if (envApi && typeof envApi === "string") {
    const isEnvHttp = /^http:\/\//i.test(envApi);
    // Evita Mixed Content: se site está em HTTPS e API em HTTP explícito, usa caminho relativo
    if (isHttps && isEnvHttp) return "/api";

    // Normaliza barra final e evita duplicar /api
    const trimmed = envApi.replace(/\/+$/, "");
    const hasApiSuffix = /\/(api)$/i.test(trimmed);
    return hasApiSuffix ? trimmed : `${trimmed}/api`;
  }

  // Sem VITE_API_URL definido, usa caminho relativo
  return "/api";
}

/**
 * Busca a conciliação da carteira do cliente.
 * POST /api/gestfin/carteira-cliente
 */
export async function buscarCarteiraCliente(
  payload: CarteiraClienteRequest
): Promise<CarteiraClienteRow[]> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/carteira-cliente`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao buscar carteira: ${resp.status} ${msg}`);
  }

  const data = (await resp.json()) as CarteiraClienteRow[];
  return Array.isArray(data) ? data : [];
}

/**
 * Busca usuário por código.
 * GET /api/gestfin/usuario/:codusur
 */
export async function buscarUsuarioPorCodigo(codusur: number): Promise<UsuarioRow | null> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/usuario/${codusur}`;

  const resp = await fetch(url);
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao buscar usuário: ${resp.status} ${msg}`);
  }

  const data = (await resp.json()) as UsuarioRow;
  return data ?? null;
}

/**
 * Atualiza o usuário (CODUSUR) de uma prestação/título.
 * POST /api/gestfin/vincular-usuario
 */
export interface VincularUsuarioPayload {
  CODUSUR_BIND: number;
  DUPLIC_BIND: string;
  PREST_BIND: number;
  CODFILIAL_BIND: number;
  CODCLI_BIND: number;
}

export async function vincularUsuarioPrestacao(payload: VincularUsuarioPayload): Promise<number> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/vincular-usuario`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao vincular usuário: ${resp.status} ${msg}`);
  }

  const data = await resp.json();
  return Number(data?.rowsAffected ?? 0);
}

// Confirmar conciliação: atualiza OFX e PCLANC
export interface ConfirmarConciliacaoPayload {
  codusurBind: number;
  recnumBind: number;
  idOfxBind: number;
}

export async function confirmarConciliacao(payload: ConfirmarConciliacaoPayload): Promise<{ ok: boolean; rowsAffectedOfx: number; rowsAffectedPclanc: number; }>{
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/confirmar-conciliacao`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = resp.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await resp.json() : { error: await safeText(resp) };

  if (!resp.ok) {
    throw new Error(`Erro ao confirmar conciliação: ${resp.status} ${(data as any)?.error || ''}`);
  }

  return {
    ok: Boolean((data as any)?.ok),
    rowsAffectedOfx: Number((data as any)?.rowsAffectedOfx ?? 0),
    rowsAffectedPclanc: Number((data as any)?.rowsAffectedPclanc ?? 0),
  };
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}