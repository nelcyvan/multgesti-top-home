export interface DiasDoMesResponse {
  rows: { DT_OFX_DIARIO: string }[];
  count: number;
}

export interface TotalTransacoesResponse {
  TOTAL_TRANSACAO_OFX: number;
}

export interface TotalSaldoResponse {
  TOTAL_SALDO: number;
}

export interface ProvisaoMesAtualResponse {
  PROVISAO_MES_ATUAL: number;
}

export interface ProvisaoProximoMesResponse {
  PROVISAO_PROXIMO_MES: number;
}

export interface TotalResultadoSaidaResponse {
  TOTAL_RESULTADO: number;
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

export const buscarDiasDoMes = async (): Promise<DiasDoMesResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/dias-do-mes`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (dias-do-mes)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar dias importados OFX');
  }
  return data as DiasDoMesResponse;
};

export const buscarTotalTransacoes = async (): Promise<TotalTransacoesResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/total-transacoes`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (total-transacoes)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar total de transações OFX');
  }
  return data as TotalTransacoesResponse;
};

export const buscarTotalSaldo = async (): Promise<TotalSaldoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/total-saldo`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (total-saldo)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar total saldo OFX');
  }
  return data as TotalSaldoResponse;
};

export const buscarProvisaoMesAtual = async (): Promise<ProvisaoMesAtualResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/provisao-mes-atual`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (provisao-mes-atual)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar provisão do mês atual');
  }
  return data as ProvisaoMesAtualResponse;
};

export const buscarProvisaoProximoMes = async (): Promise<ProvisaoProximoMesResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/provisao-proximo-mes`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (provisao-proximo-mes)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar provisão do próximo mês');
  }
  return data as ProvisaoProximoMesResponse;
};

export const buscarTotalResultadoSaida = async (): Promise<TotalResultadoSaidaResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/total-resultado-saida`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (total-resultado-saida)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar Total Resultado Saída');
  }
  return data as TotalResultadoSaidaResponse;
};

export interface DetalhamentoConciliadoSaidaRow {
  CODFORNEC: number;
  FORNECEDOR: string;
  TOTAL_POR_FORNECEDOR: number;
}

export interface DetalhamentoConciliadoSaidaResponse {
  rows: DetalhamentoConciliadoSaidaRow[];
  count: number;
}

export const buscarDetalhamentoConciliadoSaida = async (): Promise<DetalhamentoConciliadoSaidaResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/detalhamento-conciliado-saida`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (detalhamento-conciliado-saida)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar detalhamento conciliado saída');
  }
  return data as DetalhamentoConciliadoSaidaResponse;
};

export interface DetalhamentoProvisaoRow {
  HISTORICO: string;
  VALOR: number;
  DTVENC: string | Date;
}

export interface DetalhamentoProvisaoResponse {
  rows: DetalhamentoProvisaoRow[];
  count: number;
}

export const buscarDetalhamentoProvisaoMesAtual = async (): Promise<DetalhamentoProvisaoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/detalhamento-provisao-mes-atual`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (detalhamento-provisao-mes-atual)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar detalhamento provisão mês atual');
  }
  return data as DetalhamentoProvisaoResponse;
};

export const buscarDetalhamentoProximoMes = async (): Promise<DetalhamentoProvisaoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/detalhamento-provisao-proximo-mes`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (detalhamento-provisao-proximo-mes)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar detalhamento provisão próximo mês');
  }
  return data as DetalhamentoProvisaoResponse;
};

export interface ProvisaoRetroativaResponse {
  PROVISAO_RETROATIVA_EM_ABERTO: number;
}

export interface DetalhamentoProvisaoRetroativoRow {
  HISTORICO: string;
  VALOR: number;
  DTVENC: string | Date;
}

export interface DetalhamentoProvisaoRetroativoResponse {
  rows: DetalhamentoProvisaoRetroativoRow[];
  count: number;
}

export const buscarProvisaoRetroativaEmAberto = async (): Promise<ProvisaoRetroativaResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/provisao-retroativa-em-aberto`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (provisao-retroativa-em-aberto)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar provisão retroativa em aberto');
  }
  return data as ProvisaoRetroativaResponse;
};

export const buscarDetalhamentoProvisaoRetroativo = async (): Promise<DetalhamentoProvisaoRetroativoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/ofxconcilia/detalhamento-provisao-retroativo`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API OFX-Concilia (detalhamento-provisao-retroativo)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao buscar detalhamento provisão retroativo');
  }
  return data as DetalhamentoProvisaoRetroativoResponse;
};