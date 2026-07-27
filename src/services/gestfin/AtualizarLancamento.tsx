export interface AtualizarLancamentoPayload {
  recnum: number;
  codConta: number;
  codFornec?: number | null;
  historico: string;
  duplic: string;
  valor: number;
  dtVencBind: string; // DD/MM/YYYY
  dtLancBind: string; // DD/MM/YYYY
  dtCompetenciaBind: string; // DD/MM/YYYY
  dtEmissaoBind: string; // DD/MM/YYYY
  codFilial: number;
  indice?: string;
  tipoLanc?: string;
  tipoParceiro?: string;
  nomeFunc?: string;
  historico2?: string;
  moeda?: string; // 'R'
  recNumPrinc?: number | null;
  nfServicoBind?: 'S' | 'N' | 'SN' | '0';
  numNotaBind?: number;
  codRotinaAlt?: string; // 'MULTGEST'
  parcela?: number;
  vlrUtilizadoAdiantFornec?: number;
  lacreDigConecSocial?: string | null;
  tiposervico?: string | null;
  opcaoPagamentoIpva?: string | null;
  utilizouRateioConta?: 'S' | 'N';
  prcRateioUtilizado?: number;
  reinFEventor4040?: string | null;
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

export async function atualizarLancamento(payload: AtualizarLancamentoPayload): Promise<{ ok: boolean; rowsAffected: number }> {
  const baseApi = resolveBaseApi();
  // Normaliza Tipo Serviço conforme regra do modal:
  // - Se Tipo Parceiro = 'F' (Fornecedor) -> '20 - Pgto Fornecedor'
  // - Caso contrário -> '99 - Pgto Outros'
  // Além disso, valida mensagem amigável quando ausente.
  const tipoParceiro = String(payload.tipoParceiro || "").trim().toUpperCase();
  const codFornecNum = payload.codFornec != null ? Number(payload.codFornec) : 0;
  // Ajuste sempre conforme Tipo Parceiro (e fallback por codFornec):
  const isFornecedor = tipoParceiro === "F" || codFornecNum > 0;
  const tiposervicoNormalized = isFornecedor ? "20" : "99";

  if (!tiposervicoNormalized) {
    throw new Error("Campos obrigatórios faltando: Tipo Serviço");
  }

  const finalPayload: AtualizarLancamentoPayload = {
    ...payload,
    tipoParceiro,
    tiposervico: tiposervicoNormalized,
  };

  const url = `${baseApi}/gestfin/atualizar-lancamento`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(finalPayload),
  });
  const contentType = resp.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");
  const data = isJson ? await resp.json() : await resp.text();
  if (!resp.ok) {
    const message = isJson ? (data as any)?.error || (data as any)?.message : String(data || "Falha ao atualizar lançamento");
    throw new Error(message);
  }
  return data as { ok: boolean; rowsAffected: number };
}