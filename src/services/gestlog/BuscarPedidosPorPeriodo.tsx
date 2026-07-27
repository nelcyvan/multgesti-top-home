export interface BuscarPedidosParams {
  filiais: string[];
  tiposEntrega: string[];
  filiaisRetira?: string[];
  dataInicio: string; // formato 'YYYY-MM-DD'
  dataFim: string;    // formato 'YYYY-MM-DD'
  posicoesPedido: string[]; // ex: ['X', 'B', 'L']
}

export interface PedidoGestLOG {
  DATA: string;
  CODCOB: string;
  CODFILIAL: string;
  CODFILIALRETIRA?: string;
  CONDVENDA: number;
  POSICAO: string;
  NUMVIASMAPASEP: number;
  TIPOENTREGA: string;
  CODCLI: number;
  CLIENTE: string;
  NUMERO_DO_PEDIDO_TV8: number;
  NUMERO_DO_PEDIDO_TV7?: number;
  CODPROD: number;
  DESCRICAO: string;
  CODIGO_DE_BARRAS?: string;
  QUANTIDADE_ITEM_PEDIDO: number;
  MULTIPLO?: number;
  EMBALAGEM?: string;
  ESTOQUE_ATUAL_LOJA: number;
  COBRANCA: string;
  OBSENTREGA1?: string;
  OBSENTREGA2?: string;
  OBSENTREGA3?: string;
  OBS?: string;
  OBS1?: string;
  OBS2?: string;
  VENDEDOR: string;
  ENDERENT?: string;
  NUMEROENT?: string;
  BAIRROENT?: string;
  MUNICENT?: string;
  ENDERECO_PRINCIPAL?: string;
  NUMERO_PRINCIPAL?: string;
  BAIRRO_PRINCIPAL?: string;
  MUNICIPIO_PRINCIPAL?: string;
  CODPRACA?: string;
  TELENT?: string;
  NUMNOTA?: number;
  DTSAIDA?: string;
  CODEMITENTE?: number;
  VLFRETE?: number;
  VLTOTAL?: number;
  VLOUTRASDESP?: number;
  NOME_EMITENTE?: string;
  EMITENTE_MAPA?: string;
  STATUS_DESCRICAO: string;
  PRIMEIRA_VISUAL?: string;
  DT_PRIMEIRA_VISUALIZACAO?: string;
  ULTIMA_VISUAL?: string;
  DT_ULTIMA_VISUALIZACAO?: string;
  // novo campo do backend: quantidade total com embalagem master
  QT_TOTAL?: string;
  STATUS_PEDIDO?: number | string; // LOG1
  LOG3?: string; // LOG3 - Endereço de entrega formatado
  ULTIMASITUACAOCFAT?: string; // último status compactado
  MATRICULA_RCA?: number; // código do RCA (usuário)
  STATUS_ESPECIAL_PRIORIDADE?: string; // S.STATUS_PRIORIDADE AS STATUS_ESPECIAL_PRIORIDADE
  STATUS_ESPECIAL_SEPARADO?: string;
  STATUS_ESPECIAL_COLETA?: string;
  STATUS_ESPECIAL_ROTA?: string;
  STATUS_ESPECIAL_LOCALIZACAO?: string;
  STATUS_ESPECIAL_FATURA?: string;
  STATUS_ESPECIAL_CORTE?: string;
  STATUS_ESPECIAL_ENV_MESSEJANA?: string;
  DTINICIALSEP?: string;
}

export interface BuscarPedidosResponse {
  rows: PedidoGestLOG[];
  count: number;
}

export const buscarPedidosPorPeriodo = async (params: BuscarPedidosParams): Promise<BuscarPedidosResponse> => {
  // Normaliza a base para evitar /api/api quando VITE_API_URL já contém /api
  const env = import.meta.env.VITE_API_URL || '';
  let baseApi = '/api';
  if (env) {
    const trimmed = env.replace(/\/$/, ''); // remove barra final
    baseApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  const primaryUrl = `${baseApi}/gestlog/buscar-pedidos`;
  let response: Response | null = null;
  try {
    response = await fetch(primaryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    response = null;
  }
  if (!response) {
    const fallbackUrl = `/api/gestlog/buscar-pedidos`;
    response = await fetch(fallbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }
  const contentType = response.headers.get('content-type') || '';
  let data: unknown = null;
  try {
    data = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch {
    // evita "Unexpected end of JSON input" em respostas vazias/HTML
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Resposta inválida do servidor GestLOG');
  }
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in (data as object)
        ? String((data as { message?: unknown }).message ?? '')
        : '';
    throw new Error(message || 'Falha ao buscar pedidos');
  }
  // data esperado é objeto com rows/count
  if (typeof data === 'string') {
    throw new Error(`Resposta não-JSON da API GestLOG: ${data.slice(0, 200)}`);
  }
  return data as BuscarPedidosResponse;
};