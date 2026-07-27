export interface AtualizarStatusPayload {
  numped: number;
  status: number;
  usuario?: string;
  motivoCorte?: string;
  codFuncEmissaoMapa?: number;
  novaLocalizacao?: string;
  novoUsuario?: string;
}

export interface AtualizarStatusResponse {
  success: boolean;
  rowsAffected: number;
  data: { STATUS_PEDIDO?: number | string; ULTIMASITUACAOCFAT?: string } | null;
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

export const atualizarStatusPedido = async (
  payload: AtualizarStatusPayload
): Promise<AtualizarStatusResponse> => {
  if (!Number.isFinite(payload.numped)) {
    throw new Error('numped inválido');
  }
  if (!Number.isFinite(payload.status)) {
    throw new Error('status inválido');
  }
  const baseApi = resolveBaseApi();
  const response = await fetch(`${baseApi}/gestlog/atualizar-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      numped: Number(payload.numped),
      status: Number(payload.status),
      usuario: payload.usuario ?? 'APP',
      motivoCorte: payload.motivoCorte
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  let data: unknown = null;
  try {
    data = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch (_err) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Resposta inválida do servidor GestLOG');
  }
  if (!response.ok) {
    const message = (() => {
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        const m = obj.message;
        return typeof m === 'string' ? m : 'Falha ao marcar visualização';
      }
      return String(data || 'Falha ao marcar visualização');
    })();
    throw new Error(message);
  }
  if (typeof data === 'string') {
    throw new Error(`Resposta não-JSON da API GestLOG: ${data.slice(0, 200)}`);
  }
  return data as AtualizarStatusResponse;
};

export const atualizarStatusEspecial = async (
  payload: AtualizarStatusPayload
): Promise<AtualizarStatusResponse> => {
  if (!Number.isFinite(payload.numped)) {
    throw new Error('numped inválido');
  }
  if (!Number.isFinite(payload.status)) {
    throw new Error('status inválido');
  }
  const baseApi = resolveBaseApi();
  const response = await fetch(`${baseApi}/gestlog/atualizar-status-especial`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      numped: Number(payload.numped),
      status: Number(payload.status),
      usuario: payload.usuario ?? 'APP',
      codFuncEmissaoMapa: payload.codFuncEmissaoMapa,
      novaLocalizacao: payload.novaLocalizacao,
      novoUsuario: payload.novoUsuario
    }),
  });
  const contentType = response.headers.get('content-type') || '';
  let data: unknown = null;
  try {
    data = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch (_err) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Resposta inválida do servidor GestLOG');
  }
  if (!response.ok) {
    const message = (() => {
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        const m = obj.message;
        return typeof m === 'string' ? m : 'Falha ao marcar status especial';
      }
      return String(data || 'Falha ao marcar status especial');
    })();
    throw new Error(message);
  }
  if (typeof data === 'string') {
    throw new Error(`Resposta não-JSON da API GestLOG: ${data.slice(0, 200)}`);
  }
  return data as AtualizarStatusResponse;
};

export const voltarTriagem = async (
  payload: { numped: number; usuario?: string }
): Promise<AtualizarStatusResponse> => {
  if (!Number.isFinite(payload.numped)) {
    throw new Error('numped inválido');
  }
  const baseApi = resolveBaseApi();
  const response = await fetch(`${baseApi}/gestlog/voltar-triagem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numped: Number(payload.numped), usuario: payload.usuario ?? 'APP' }),
  });
  const contentType = response.headers.get('content-type') || '';
  let data: unknown = null;
  try {
    data = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch (_err) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Resposta inválida do servidor GestLOG');
  }
  if (!response.ok) {
    const message = (() => {
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        const m = obj.message;
        return typeof m === 'string' ? m : 'Falha ao voltar triagem';
      }
      return String(data || 'Falha ao voltar triagem');
    })();
    throw new Error(message);
  }
  if (typeof data === 'string') {
    throw new Error(`Resposta não-JSON da API GestLOG: ${data.slice(0, 200)}`);
  }
  return data as AtualizarStatusResponse;
};
