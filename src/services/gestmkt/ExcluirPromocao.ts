export interface ExcluirPromocaoResponse {
  ok: boolean;
  rowsAffected?: number;
  message?: string;
}

const resolveBaseApi = (): string => {
  const env = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL;
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';

  if (env && typeof env === 'string') {
    const trimmed = env.replace(/\/+$/, '');
    const isEnvHttp = /^http:\/\//i.test(trimmed);
    if (isHttps && isEnvHttp) return '/api';
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }

  return '/api';
};

export interface HistoricoCampanha {
  CODFILIAL: string | number;
  CODPROD: number;
  MES_DATA_PROMOCAO?: string;
  DT_ADD?: string;
  CODUSUR_ADD?: number;
  TIPO_CAMPANHA: string;
  PRECOFICTICIO?: number;
  ID_ORIGEM: number;
  DT_INICIO_CAMPANHA?: string;
  DT_FIM_CAMPANHA?: string;
  PRECOFIXO?: number;
  CODUSUR_SALVOU?: number;
  CODIGO_PROMOCAO?: number;
  STATUS_ENCARTE?: string;
}

export const excluirPromocao = async (
  id: number,
  codPrecoPromocional?: number | null,
  historico?: HistoricoCampanha
): Promise<ExcluirPromocaoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/produtos-promocao/excluir`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      id, 
      codPrecoPromocional: codPrecoPromocional ?? undefined,
      historico 
    }),
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao excluir promoção');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (excluir)');
  }
  return data as ExcluirPromocaoResponse;
};

export const excluirPromocaoPorCodigo = async (
  codPrecoPromocional: number,
  payload?: { codFilial?: string | number; codProd?: number }
): Promise<ExcluirPromocaoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/produtos-promocao/excluir`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codPrecoPromocional,
      codFilial: payload?.codFilial,
      codProd: payload?.codProd,
    }),
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao excluir promoção');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (excluir)');
  }
  return data as ExcluirPromocaoResponse;
};

export const excluirPcprecoProm = async (codPrecoPromocional: number): Promise<ExcluirPromocaoResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestmkt/pcprecoprom/excluir`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codPrecoPromocional }),
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');
  const data = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = isJson ? (data as { message?: string })?.message : String(data || 'Falha ao excluir PCPRECOPROM');
    throw new Error(message);
  }
  if (!isJson) {
    throw new Error(typeof data === 'string' ? data : 'Resposta inválida da API GestMKT (pcprecoprom/excluir)');
  }
  return data as ExcluirPromocaoResponse;
};
