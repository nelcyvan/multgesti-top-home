// /home/multgesti/src/services/acesso/PermissaoOFXConcilia.tsx
export interface PermissaoResponse {
  permitido: boolean;
  message?: string;
}

export const verificarPermissaoOFXConcilia = async (codigoDoUsuario: string): Promise<PermissaoResponse> => {
  try {
    const env = import.meta.env.VITE_API_URL || '';
    let baseApi = '/api';
    if (env) {
      const trimmed = env.replace(/\/$/, '');
      baseApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    }

    const response = await fetch(`${baseApi}/ofxconcilia/permissao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoUsuario: codigoDoUsuario }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(text || 'Resposta inválida da API OFX-Concilia (permissão). Verifique se o servidor de conexões (porta 7001) está ativo e se o proxy do Vite está configurado.');
    }

    const data = await response.json();
    if (response.status === 404) {
      throw new Error(data.message || 'Endpoint de permissão OFX-Concilia não encontrado (404).');
    }
    if (!response.ok) {
      throw new Error(data.message || 'Usuário sem permissão para OFX-Concilia');
    }

    return { permitido: Boolean(data.permitido ?? true), message: data.message };
  } catch (error: unknown) {
    console.error('Erro ao validar permissão OFX-Concilia:', error);
    const msg = error instanceof Error ? error.message : 'Falha na validação de permissão OFX-Concilia';
    throw new Error(msg);
  }
};