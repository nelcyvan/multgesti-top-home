export interface AtualizarCadastroPayload {
  codigoDoProduto: number; // NUMBER(6)
  novaEmbalagem: string;   // VARCHAR2(12)
  novoMultiplo: number;    // NUMBER(18,6)
}

export interface AtualizarCadastroResponse {
  success: boolean;
  rowsAffected: {
    produt: number;
    prodfilial: number;
  };
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

export const atualizarCadastro = async (
  payload: AtualizarCadastroPayload
): Promise<AtualizarCadastroResponse> => {
  // validações rápidas no cliente (servidor também valida)
  if (!Number.isFinite(payload.codigoDoProduto)) {
    throw new Error('codigoDoProduto inválido');
  }
  if (typeof payload.novaEmbalagem !== 'string' || !payload.novaEmbalagem.trim()) {
    throw new Error('novaEmbalagem é obrigatória');
  }
  if (payload.novaEmbalagem.length > 12) {
    throw new Error('novaEmbalagem deve ter no máximo 12 caracteres');
  }
  if (!Number.isFinite(payload.novoMultiplo)) {
    throw new Error('novoMultiplo inválido');
  }

  const baseApi = resolveBaseApi();
  const response = await fetch(`${baseApi}/gestlog/atualizar-cadastro`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigoDoProduto: payload.codigoDoProduto,
      novaEmbalagem: payload.novaEmbalagem.trim(),
      novoMultiplo: payload.novoMultiplo,
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  let data: unknown = null;
  try {
    data = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch (err) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Resposta inválida do servidor GestLOG');
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data !== null ? (data as any).message : String(data || 'Falha ao atualizar cadastro');
    throw new Error(message);
  }
  if (typeof data === 'string') {
    throw new Error(`Resposta não-JSON da API GestLOG: ${data.slice(0, 200)}`);
  }
  return data as AtualizarCadastroResponse;
};