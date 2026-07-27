export interface ComprovantePayload {
  NUMPED: number;
  CODCLI: number;
  CODUSUR: number;
  NOME: string;
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

export const enviarComprovante = async (payload: ComprovantePayload, file: File): Promise<{ ok: boolean; message?: string; path?: string; filename?: string; size?: number; }> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestpro/enviar-comprovante`;
  const form = new FormData();
  form.append('NUMPED', String(payload.NUMPED));
  form.append('CODCLI', String(payload.CODCLI));
  form.append('CODUSUR', String(payload.CODUSUR));
  form.append('NOME', payload.NOME);
  form.append('file', file);

  const response = await fetch(url, {
    method: 'POST',
    body: form,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text || 'Resposta inválida da API GestPRO (enviar-comprovante)');
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Falha ao enviar comprovante');
  }
  return data;
};