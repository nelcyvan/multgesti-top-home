// /home/multgesti/src/services/acesso/PermissaoGestFIN.tsx
export interface PermissaoResponse {
  permitido: boolean;
  message?: string;
}

export const verificarPermissaoGestFIN = async (codigoDoUsuario: string): Promise<PermissaoResponse> => {
  try {
    const envRaw = import.meta.env.VITE_API_URL || '';
    const env = envRaw.replace(/\/$/, '');
    const isDev = !!(import.meta as any).env?.DEV;
    let baseApi = '/api';

    // Em desenvolvimento, sempre usar o proxy local do Vite
    if (!isDev && env) {
      baseApi = env.endsWith('/api') ? env : `${env}/api`;
    }

    const response = await fetch(`${baseApi}/gestfin/permissao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoUsuario: codigoDoUsuario }),
    });
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');
    const data = isJson ? await response.json() : await response.text();
    if (!response.ok) {
      const message = isJson ? (data as any).message : String(data);
      throw new Error(message || 'Usuário sem permissão para GestFIN');
    }
    if (!isJson) {
      // Resposta inesperada não-JSON
      throw new Error('Resposta inválida do servidor ao validar permissão GestFIN');
    }
    return { permitido: Boolean((data as any).permitido ?? true), message: (data as any).message };
  } catch (error: unknown) {
    console.error('Erro ao validar permissão GestFIN:', error);
    const msg = error instanceof Error ? error.message : 'Falha na validação de permissão GestFIN';
    throw new Error(msg);
  }
};