export type FretePorLiquidezResumoRow = {
  DTEMISSAO?: unknown;
  DTSAIDA?: unknown;
  DTBAIXA?: unknown;
  DTPAG?: unknown;
  NUMNOTA?: number;
  CODCLI_PEDIDO?: number;
  CLIENTE_PEDIDO?: string;
  NUMPED?: number;
  CODFILIAL?: string;
  FRETE?: number;
  OUTRAS_DESPESAS?: number;
  VLTOTGER?: number;
  NUMTRANSVENDA?: number;
  CODUSUR?: number;
  NOME?: string;
  DUPLIC?: string;
};

export interface ComissoesPorFreteMesAtualResponse {
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

export const buscarComissoesPorFreteMesAtual = async (): Promise<ComissoesPorFreteMesAtualResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestpro/comissoes-por-frete-mes-atual`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API GestPRO (comissoes-por-frete-mes-atual)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar Comissões por Frete (Mês Atual)');
  }
  const rowsRaw = (data as any)?.rows;
  const countRaw = (data as any)?.count;
  const rows = Array.isArray(rowsRaw) ? (rowsRaw as FretePorLiquidezResumoRow[]) : [];
  const count = Number(countRaw ?? rows.length);
  return { rows, count: Number.isFinite(count) ? count : rows.length };
};
