// home/multgesti/src/services/acesso/Login.tsx
export interface LoginResponse {
  message: string;
  nome?: string;
  usuario?: string;
  matricula?: string;
  codfilial?: string;
  codusur?: number | null;
}

//  Faz login do usuário na API Node
export const loginUsuario = async (usuario: string, senha: string): Promise<LoginResponse> => {
  try {
    const env = import.meta.env.VITE_API_URL || '';
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    let baseApi = '/api';
    if (env) {
      const trimmed = env.replace(/\/$/, '');
      // Evita Mixed Content: se a página estiver em HTTPS e env começar com HTTP, usa caminho relativo
      if (isHttps && /^http:\/\//i.test(trimmed)) {
        baseApi = '/api';
      } else {
        baseApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
      }
    }

    const response = await fetch(`${baseApi}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, senha }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(text || 'Resposta inválida do login');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erro no login');
    }

    return data as LoginResponse;
  } catch (error: unknown) {
    console.error('Erro ao conectar à API de login:', error);
    const msg = error instanceof Error ? error.message : 'Falha na conexão com o servidor';
    throw new Error(msg);
  }
};

