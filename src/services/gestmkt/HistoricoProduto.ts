export interface HistoricoProdutoRow {
  CODFILIAL: string;
  CODPROD: number;
  DESCRICAO: string;
  CODAUXILIAR: string;
  MARCA: string;
  QTD_MOVIMENTACOES: number;
  QUANTIDADE_TOTAL: number;
  PRECO_MEDIO: number;
  VALOR_TOTAL: number;
  PRIMEIRA_SAIDA: string; // DD/MM/YYYY
  ULTIMA_SAIDA: string;   // DD/MM/YYYY
  ESTOQUE_ATUAL: number;
  DISPONIVEL: number;
  ESTOQUE_GERAL: number;
}

export interface BuscarHistoricoProdutoInput {
  codigoDoProduto: number;
  filialDoPrduto: string;
  dataInicio: string; // DD/MM/YYYY
  dataFinal: string;  // DD/MM/YYYY
}

export async function buscarHistoricoProduto(payload: BuscarHistoricoProdutoInput): Promise<HistoricoProdutoRow[]> {
  const url = "/api/gestpro/historico-produto";
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Falha ao buscar histórico: ${resp.status} ${txt}`);
  }
  const data = await resp.json();
  return data?.rows ?? [];
}