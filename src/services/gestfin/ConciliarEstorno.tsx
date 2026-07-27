// Serviço para conciliar transação de Estorno no GestFIN
// POST /api/gestfin/conciliar-estorno

export interface ConciliarEstornoPayload {
  recnum?: number;
  codConta: number;
  codFornec?: number;
  historico: string;
  duplic: string;
  valor: number; // será enviado como valor absoluto (positivo)
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
  nfServicoBind: string; // 'N'|'S'|'SN'|'0'
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

export interface ConciliarEstornoResponse {
  ok?: boolean;
  recnum?: number;
  error?: string;
}

function resolveBaseApi(): string {
  const envApiGestfin = (import.meta as any)?.env?.VITE_GESTFIN_API_URL as string | undefined;
  const envApi = envApiGestfin || ((import.meta as any)?.env?.VITE_API_URL as string | undefined);
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  if (envApi && typeof envApi === "string") {
    const isEnvHttp = /^http:\/\/\//i.test(envApi);
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

export async function conciliarTransacaoEstorno(payload: ConciliarEstornoPayload): Promise<ConciliarEstornoResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/conciliar-estorno`;

  // Garantir que o valor seja gravado como positivo
  const valorRaw = Number(payload.valor);
  const valorAbs = Number.isFinite(valorRaw) ? Math.abs(valorRaw) : 0;
  const sanitizedPayload = { ...payload, valor: valorAbs };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sanitizedPayload),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao conciliar estorno: ${resp.status} ${msg}`);
  }

  const ct = resp.headers.get('content-type') || '';
  const isJson = ct.toLowerCase().includes('application/json');
  const data = isJson ? await resp.json() : { ok: true };
  return data as ConciliarEstornoResponse;
}