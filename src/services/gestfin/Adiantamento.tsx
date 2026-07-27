// Serviço para criar adiantamento no GestFIN
// POST /api/gestfin/adiantamento

export interface AdiantamentoPayload {
  recnum: number;
  codConta: number;
  codFornec?: number;
  fornecedor?: string; // nome do fornecedor (texto)
  historico: string;
  duplic: string;
  valor: number;
  dtVencBind: string; // DD/MM/YYYY ou compatível
  dtLancBind: string; // DD/MM/YYYY
  dtCompetenciaBind: string; // DD/MM/YYYY
  dtEmissaoBind: string; // DD/MM/YYYY
  codFilial: number;
  indice: string; // 'A'
  tipoLanc: string; // 'C'|'P'
  tipoParceiro: string; // 'F'|'C'|'R'|'M'|'O'
  nomeFunc?: string;
  historico2?: string;
  moeda: string; // 'R'
  recNumPrinc?: number | null;
  nfServicoBind: string; // 'N'|'S'|'SN'
  numNotaBind?: number | null;
  codRotinaCad: string; // 'MULTGEST'
  codRotinaAlt: string; // 'MULTGEST'
  parcela: number; // 1
  vlrUtilizadoAdiantFornec?: number;
  lacreDigConecSocial?: string | null; // null ou string
  tiposervico?: string | null; // '20','30','22','99'
  opcaoPagamentoIpva?: string | null; // null ou string
  utilizouRateioConta: string; // 'S' | 'N'
  prcRateioUtilizado?: number; // 100
  reinFEventor4040?: string | null; // 'N'
  idImportacaoOFX?: number; // vínculo ao OFX quando aplicável
  codusurBind?: number; // usuário que está vinculando OFX
  juros?: number; // opcional, default 0 no backend
}

export interface AdiantamentoResponse {
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
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

export async function criarAdiantamento(payload: AdiantamentoPayload): Promise<AdiantamentoResponse> {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/adiantamento`;

  // Completa automaticamente o codusurBind a partir do usuário logado (localStorage)
  let enrichedPayload: AdiantamentoPayload = { ...payload };
  try {
    if (!enrichedPayload.codusurBind || Number(enrichedPayload.codusurBind) <= 0) {
      const raw = typeof window !== "undefined" ? localStorage.getItem("usuarioLogado") : null;
      if (raw) {
        const usuario = JSON.parse(raw || "{}");
        const matriculaStr = usuario?.matricula;
        const matriculaNum = Number(matriculaStr);
        if (Number.isFinite(matriculaNum) && matriculaNum > 0) {
          enrichedPayload = { ...enrichedPayload, codusurBind: matriculaNum };
        }
      }
    }
  } catch {
    // silencioso: se não conseguir ler, segue sem codusurBind e backend validará
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enrichedPayload),
  });

  if (!resp.ok) {
    const msg = await safeText(resp);
    throw new Error(`Erro ao criar adiantamento: ${resp.status} ${msg}`);
  }

  const data = (await resp.json()) as AdiantamentoResponse;
  return data;
}