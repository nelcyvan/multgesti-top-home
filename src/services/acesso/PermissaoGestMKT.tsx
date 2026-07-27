// /home/multgesti/src/services/acesso/PermissaoGestMKT.tsx
export interface PermissaoResponse {
  permitido: boolean;
  message?: string;
}

export const verificarPermissaoGestMKT = async (
  codigoDoUsuario: string
): Promise<PermissaoResponse> => {
  try {
    const envRaw = import.meta.env.VITE_API_URL || '';
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const trimmed = envRaw.replace(/\/$/, '');

    // Base principal: sempre termina com /api (com proteção contra Mixed Content)
    let baseApi = '/api';
    if (trimmed) {
      if (isHttps && /^http:\/\//i.test(trimmed)) {
        baseApi = '/api';
      } else {
        baseApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
      }
    }

    const primaryUrl = `${baseApi}/gestmkt/permissao`;
    const baseRoot = trimmed && trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const fallbackUrl = baseRoot ? `${baseRoot}/gestmkt/permissao` : '/gestmkt/permissao';

    const codigoUsuarioPayload = Number.isFinite(Number(codigoDoUsuario))
      ? Number(codigoDoUsuario)
      : codigoDoUsuario;

    const postAndParse = async (url: string) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigoUsuario: codigoUsuarioPayload }),
      });
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.toLowerCase().includes('application/json');
      const data = isJson ? await response.json() : await response.text();
      return { ok: response.ok, status: response.status, data, isJson, url };
    };

    // Tenta URL primária via proxy
    let result = await postAndParse(primaryUrl);
    // Se 404 ou resposta não JSON, tenta fallback sem /api
    if (!result.ok && (result.status === 404 || !result.isJson)) {
      result = await postAndParse(fallbackUrl);
    }

    if (!result.ok) {
      let message: string | undefined;
      if (result.status === 404) {
        message = `Endpoint de permissão GestMKT não encontrado (404) em ${result.url}. Verifique VITE_API_URL, proxy do Vite e servidor de conexões (porta 7001).`;
      } else if (!result.isJson) {
        message = `Resposta não-JSON ao validar permissão GestMKT em ${result.url}. Possível página HTML de proxy/WAF.`;
      }
      // Tenta extrair mensagem do payload JSON se houver
      if (!message && typeof result.data === 'object' && result.data !== null) {
        const m = (result.data as Record<string, unknown>).message;
        if (typeof m === 'string') message = m;
      }
      throw new Error(message || 'Usuário sem permissão para GestMKT');
    }

    const data = result.data as any;
    const permitido = typeof data?.permitido === 'boolean' ? data.permitido : true;
    const message = typeof data?.message === 'string' ? data.message : undefined;
    return { permitido, message };
  } catch (error: unknown) {
    console.error('Erro ao validar permissão GestMKT:', error);
    const msg = error instanceof Error ? error.message : 'Falha na validação de permissão GestMKT';
    throw new Error(msg);
  }
};