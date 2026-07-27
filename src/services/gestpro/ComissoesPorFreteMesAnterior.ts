import type { FretePorLiquidezResumoRow } from "./ComissoesPorFreteMesAtual";

export interface ComissoesPorFreteMesAnteriorResponse {
  rows: FretePorLiquidezResumoRow[];
  count: number;
}

const resolveBaseApi = (): string => {
  const env = import.meta.env.VITE_API_URL || '';
  let baseApi = '/api';
  if (env) {
    const trimmed = env.replace(/\/$/, '');
    baseApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return baseApi;
};

export const buscarComissoesPorFreteMesAnterior = async (): Promise<ComissoesPorFreteMesAnteriorResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestpro/comissoes-por-frete-mes-anterior-total`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API GestPRO (comissoes-por-frete-mes-anterior-total)');
  }
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof data === "object" && data != null && "message" in data
        ? String((data as { message?: unknown }).message || "Falha ao buscar Comissões por Frete (Mês Anterior)")
        : "Falha ao buscar Comissões por Frete (Mês Anterior)";
    throw new Error(message);
  }

  const obj = typeof data === "object" && data != null ? (data as Record<string, unknown>) : {};
  const rowsRaw = obj.rows;
  const countRaw = obj.count;
  const rows = Array.isArray(rowsRaw) ? (rowsRaw as FretePorLiquidezResumoRow[]) : [];
  const countNum = Number(countRaw ?? rows.length);

  return { rows, count: Number.isFinite(countNum) ? countNum : rows.length };
};
