export interface Pedido {
  DATA: string;
  CODCOB: number;
  CODFILIAL: number;
  CODFILIALRETIRA: number;
  CONDVENDA: number;
  POSICAO: string;
  NUMVIASMAPASEP: number;
  TIPOENTREGA: string;
  CODCLI: number;
  CLIENTE: string;
  NUMERO_DO_PEDIDO_TV8: number;
  NUMERO_DO_PEDIDO_TV7: number;
  CODPROD: number;
  DESCRICAO: string;
  CODIGO_DE_BARRAS: string;
  QUANTIDADE_ITEM_PEDIDO: number;
  ESTOQUE_ATUAL_LOJA: number;
  COBRANCA: string;
  OBSENTREGA1: string;
  OBSENTREGA2: string;
  OBSENTREGA3: string;
  OBS: string;
  OBS1: string;
  OBS2: string;
  VENDEDOR: string;
  ENDERENT: string;
  NUMEROENT: string;
  BAIRROENT: string;
  MUNICENT: string;
  CODPRACA: number;
  TELENT: string;
  NUMNOTA: number;
  DTSAIDA: string;
  CODEMITENTE: number;
  VLFRETE: number;
  VLOUTRASDESP: number;
  NOME_EMITENTE: string;
  EMITENTE_MAPA: string;
  MULTIPLO: number;
  EMBALAGEM: string;
  QT_TOTAL: string;
  STATUS_PEDIDO: string;
  LOG3: string;
  ULTIMASITUACAOCFAT: string;
  MATRICULA_RCA: number;
  STATUS_ESPECIAL_PRIORIDADE: string;
  DTINICIALSEP: string;
}

export interface BuscarPedidosParams {
  dataInicio: string;
  dataFim: string;
  filiais: string[];
  tiposEntrega: string[];
  filiaisRetira: string[];
  posicoesPedido: string[];
}

export const fetchPedidos = async (params: BuscarPedidosParams): Promise<Pedido[]> => {
  const response = await fetch("/api/ofxconcilia/gestlog/buscar-pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Erro na requisição: ${response.statusText}`);
  }

  const data = await response.json();
  return data.rows || [];
};

export interface DashboardSummary {
  totalPedidos: number;
  porTipoEntrega: Record<string, number>;
  porStatus: Record<string, number>;
  porGrupoStatus: Record<string, number>;
  porPosicao: Record<string, number>;
  totalFrete: number;
}

export const STATUS_LABELS: Record<number, string> = {
  0: 'Aguardando Visualização',
  1: 'Visualizado',
  2: 'Separando',
  3: 'Separado',
  4: 'Aguardando rota',
  5: 'Incluído em rota',
  6: 'Saindo em rota',
  7: 'Entregue',
  8: 'Retornou',
  9: 'Entrega em dia Específico',
  10: 'Aguardando Fornecedor',
  11: 'Entrega Fracionada',
  12: 'Entrega em horário Específico',
  13: 'Corte',
  14: 'Pegar Localização',
  15: 'Faturar',
  16: 'Separação Cancelada',
  17: 'Coleta',
  18: 'Localização Inserida',
  19: 'Coleta Separada',
  20: 'Enviar p/ Messejana',
  21: 'Coleta Separando',
  22: 'Corte Realizado',
  23: 'Pedidos Prioridade',
  24: 'Entrega Futura',
  25: 'Retira Posterior',
};

export const TIPO_ENTREGA_LABELS: Record<string, string> = {
  'EF': 'Entrega Futura',
  'EN': 'Entrega',
  'RP': 'Retira Posterior',
};

export const POSICAO_LABELS: Record<string, string> = {
  'P': 'Pendente',
  'L': 'Liberado',
  'M': 'Montado',
};

export const FILIAL_RETIRA_LABELS: Record<string, string> = {
  '1': 'Messejana',
  '3': 'CD',
};

export const FILIAL_ORIGEM_LABELS: Record<string, string> = {
  '1': 'Messejana',
};

// Ordem cronológica sugerida para exibição
export const STATUS_ORDER: string[] = [
  'Aguardando Visualização',
  'Visualizado',
  'Aguardando Fornecedor',
  'Pedidos Prioridade',
  'Separando',
  'Separado',
  'Separação Cancelada',
  'Coleta',
  'Coleta Separando',
  'Coleta Separada',
  'Faturar',
  'Aguardando rota',
  'Incluído em rota',
  'Pegar Localização',
  'Localização Inserida',
  'Saindo em rota',
  'Entregue',
  'Retornou',
  'Corte',
  'Corte Realizado',
  'Entrega em dia Específico',
  'Entrega em horário Específico',
  'Entrega Fracionada',
  'Entrega Futura',
  'Retira Posterior',
  'Enviar p/ Messejana',
];

const GROUP_MAPPING: Record<number, string> = {
  0: 'Aguardando Visualização',
  1: 'Visualizado',
  2: 'Separando',
  3: 'Separado',
  4: 'Aguardando rota',
  5: 'Incluído em rota',
  6: 'Saindo em rota',
  7: 'Entregue',
  8: 'Retornou',
  9: 'Entrega em dia Específico',
  10: 'Aguardando Fornecedor',
  11: 'Entrega Fracionada',
  12: 'Entrega em horário Específico',
  13: 'Corte',
  14: 'Pegar Localização',
  15: 'Faturar',
  16: 'Separação Cancelada',
  17: 'Coleta',
  18: 'Localização Inserida',
  19: 'Coleta Separada',
  20: 'Enviar p/ Messejana',
  21: 'Coleta Separando',
  22: 'Corte Realizado',
  23: 'Pedidos Prioridade',
  24: 'Entrega Futura',
  25: 'Retira Posterior',
};

export const calculateSummary = (pedidos: Pedido[]): DashboardSummary => {
  // Remover duplicatas baseadas no NUMERO_DO_PEDIDO_TV8
  const uniquePedidosMap = new Map<number, Pedido>();
  pedidos.forEach(p => {
    if (!uniquePedidosMap.has(p.NUMERO_DO_PEDIDO_TV8)) {
      uniquePedidosMap.set(p.NUMERO_DO_PEDIDO_TV8, p);
    }
  });
  const uniquePedidos = Array.from(uniquePedidosMap.values());

  const summary: DashboardSummary = {
    totalPedidos: uniquePedidos.length,
    porTipoEntrega: {},
    porStatus: {},
    porGrupoStatus: {},
    porPosicao: {},
    totalFrete: 0,
  };

  uniquePedidos.forEach((p) => {
    // Tipo Entrega
    const tipo = p.TIPOENTREGA || "Outros";
    summary.porTipoEntrega[tipo] = (summary.porTipoEntrega[tipo] || 0) + 1;

    // Status (ULTIMASITUACAOCFAT)
    // Se ULTIMASITUACAOCFAT for nulo ou vazio, consideramos como status 0 (Aguardando Visualização)
    const statusStr = p.ULTIMASITUACAOCFAT;
    const status = (statusStr !== null && statusStr !== undefined && statusStr !== '') 
      ? parseInt(statusStr, 10) 
      : 0;
      
    const statusKey = status.toString();
    
    summary.porStatus[statusKey] = (summary.porStatus[statusKey] || 0) + 1;

    // Grupo de Status
    const group = GROUP_MAPPING[status] || 'Outros';
    summary.porGrupoStatus[group] = (summary.porGrupoStatus[group] || 0) + 1;

    // Posição
    const pos = p.POSICAO || "N/A";
    summary.porPosicao[pos] = (summary.porPosicao[pos] || 0) + 1;

    // Frete
    if (p.VLFRETE) {
      summary.totalFrete += Number(p.VLFRETE);
    }
  });

  return summary;
};
