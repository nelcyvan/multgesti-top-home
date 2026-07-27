
export interface PedidoCarteira {
  DTEMISSAO: string;
  CODCLI: number;
  CLIENTE: string;
  NUMPED: number;
  VALOR: number;
  CODCOB: string;
  CODUSUR: number;
  NOME: string; // Nome do vendedor
}

export interface CarteiraSummary {
  totalPedidos: number;
  totalValor: number;
  porVendedor: Record<string, number>; // Nome do vendedor -> Valor Total
  porCobranca: Record<string, number>; // CODCOB -> Valor Total
}

export const COBRANCA_DESCRICAO: Record<string, string> = {
  'CTDI': 'Carteira Dinheiro',
  'CTP': 'Carteira PIX',
  'CART': 'Carteira',
  'CTC': 'Carteira C. Crédito',
  'CTD': 'Carteira C. Débito',
  'C': 'Duplicar em Carteira',
};

export const fetchCarteira = async (params: {
  dataInicio: string;
  dataFim: string;
}): Promise<PedidoCarteira[]> => {
  const response = await fetch("/api/ofxconcilia/carteira/buscar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Erro ao buscar dados da carteira");
  }

  const data = await response.json();
  return data.rows;
};

export const calculateCarteiraSummary = (pedidos: PedidoCarteira[]): CarteiraSummary => {
  const summary: CarteiraSummary = {
    totalPedidos: pedidos.length,
    totalValor: 0,
    porVendedor: {},
    porCobranca: {},
  };

  pedidos.forEach((pedido) => {
    summary.totalValor += pedido.VALOR;

    const vendedor = pedido.NOME || "NÃO INFORMADO";
    if (!summary.porVendedor[vendedor]) {
      summary.porVendedor[vendedor] = 0;
    }
    summary.porVendedor[vendedor] += pedido.VALOR;

    const cobranca = pedido.CODCOB || "NÃO INFORMADO";
    if (!summary.porCobranca[cobranca]) {
      summary.porCobranca[cobranca] = 0;
    }
    summary.porCobranca[cobranca] += pedido.VALOR;
  });

  return summary;
};
