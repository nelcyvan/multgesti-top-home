// Serviço para conciliar transação cancelada no GestFIN
// POST /api/gestfin/conciliar-cancelado

export interface ConciliarCanceladoPayload {
  recnum?: number; // opcional, gerado no servidor se ausente
  codConta: number; // padrão: 900084
  codFornec?: number; // opcional
  historico: string;
  duplic: string;
  valor: number; // padrão: 0
  dtVencBind: string; // DD/MM/YYYY
  dtLancBind: string; // DD/MM/YYYY
  dtCompetenciaBind: string; // DD/MM/YYYY
  dtEmissaoBind: string; // DD/MM/YYYY
  codFilial: number;
  indice: string; // 'A'
  tipoLanc: string; // 'C'|'P'
  tipoParceiro: string; // padrão: 'O'
  nomeFunc?: string;
  historico2?: string; // ex.: 'C1'
  moeda: string; // 'R'
  recNumPrinc?: number | null;
  nfServicoBind: string; // 'N'|'S'|'SN'|'0' ('SN' ou '0' viram N com numNota=0)
  numNotaBind?: number | null;
  codRotinaCad: string; // 'MULTGEST'
  codRotinaAlt: string; // 'MULTGEST'
  parcela: number; // 1
  vlrUtilizadoAdiantFornec?: number;
  lacreDigConecSocial?: string | null;
  tiposervico?: string | null; // padrão: '99'
  opcaoPagamentoIpva?: string | null;
  utilizouRateioConta: string; // 'S'|'N'
  prcRateioUtilizado?: number; // 0 ou 100
  reinFEventor4040?: string | null; // 'N'
  idImportacaoOFX?: number; // vínculo OFX
  codusurBind?: number; // usuário vínculo OFX
}

export interface ConciliarCanceladoResponse {
  ok?: boolean;
  recnum?: number;
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

export async function conciliarTransacaoCancelada(payload: ConciliarCanceladoPayload): Promise<ConciliarCanceladoResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/conciliar-cancelado`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao conciliar cancelado: ${resp.status} ${msg}`);
  }

  const data = (await resp.json()) as ConciliarCanceladoResponse;
  return data;
}