// /home/multgesti/src/services/acesso/PermissaoZapHub.tsx
export interface PermissaoResponse {
  permitido: boolean;
  message?: string;
}

export const verificarPermissaoZapHub = async (codigoDoUsuario: string): Promise<PermissaoResponse> => {
  try {
    const env = import.meta.env.VITE_API_URL || '';
    let baseApi = '/api';
    if (env) {
      const trimmed = env.replace(/\/$/, '');
      baseApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    }

    const response = await fetch(`${baseApi}/zaphub/permissao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoUsuario: codigoDoUsuario }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Usuário sem permissão para ZapHub');
    return { permitido: Boolean(data.permitido ?? true), message: data.message };
  } catch (error: unknown) {
    console.error('Erro ao validar permissão ZapHub:', error);
    const msg = error instanceof Error ? error.message : 'Falha na validação de permissão ZapHub';
    throw new Error(msg);
  }
};