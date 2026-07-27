// /home/multgesti/src/services/acesso/PermissaoGestPRO.tsx
export interface PermissaoResponse {
  permitido: boolean;
  message?: string;
}

export const verificarPermissaoGestPRO = async (codigoDoUsuario: string): Promise<PermissaoResponse> => {
  try {
    const env = import.meta.env.VITE_API_URL || '';
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    let baseApi = '/api';
    if (env) {
      const trimmed = env.replace(/\/$/, '');
      if (isHttps && /^http:\/\//i.test(trimmed)) {
        baseApi = '/api';
      } else {
        baseApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
      }
    }

    const response = await fetch(`${baseApi}/gestpro/permissao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoUsuario: codigoDoUsuario }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Usuário sem permissão para GestPRO');
    return { permitido: Boolean(data.permitido ?? true), message: data.message };
  } catch (error: unknown) {
    console.error('Erro ao validar permissão GestPRO:', error);
    const msg = error instanceof Error ? error.message : 'Falha na validação de permissão GestPRO';
    throw new Error(msg);
  }
};