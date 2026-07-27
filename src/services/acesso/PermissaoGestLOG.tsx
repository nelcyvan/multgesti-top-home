// /home/multgesti/src/services/acesso/PermissaoGestLOG.tsx
export interface PermissaoGestLOGResponse {
  permitido: boolean;
  message?: string;
}

// Valida permissão do usuário para acessar a página GestLOG
export const verificarPermissaoGestLOG = async (
  codigoDoUsuario: string
): Promise<PermissaoGestLOGResponse> => {
  try {
    const envRaw = import.meta.env.VITE_API_URL || '';
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const trimmed = envRaw.replace(/\/$/, '');

    // Base principal: sempre termina com /api
    let baseApi = '/api';
    if (trimmed) {
      if (isHttps && /^http:\/\//i.test(trimmed)) {
        baseApi = '/api';
      } else {
        baseApi = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
      }
    }

    // URL primária e URL de fallback (sem /api)
    const primaryUrl = `${baseApi}/gestlog/permissao`;
    const baseRoot = trimmed && trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
    const fallbackUrl = baseRoot ? `${baseRoot}/gestlog/permissao` : '/gestlog/permissao';

    // Normaliza codigoUsuario para número quando possível
    const codigoUsuarioPayload = Number.isFinite(Number(codigoDoUsuario))
      ? Number(codigoDoUsuario)
      : codigoDoUsuario;

    // Função auxiliar para fazer POST e validar JSON
    const postAndParse = async (url: string) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigoUsuario: codigoUsuarioPayload }),
      });

      const contentType = response.headers.get('content-type') || '';
      console.log(`[GestLOG] POST ${url} -> status ${response.status} | content-type: ${contentType}`);
      if (!contentType.includes('application/json')) {
        await response.text(); // consumir body para evitar leaks
        return { ok: response.ok, status: response.status, data: null as unknown, url };
      }

      const data = await response.json();
      return { ok: response.ok, status: response.status, data, url };
    };

    // Tenta URL primária
    let result = await postAndParse(primaryUrl);

    // Se 404 ou não-JSON, tenta fallback sem /api
    if (!result.ok && (result.status === 404 || result.data === null)) {
      result = await postAndParse(fallbackUrl);
    }

    if (!result.ok) {
      let msg: string | undefined;
      if (result.status === 404) {
        msg = `Endpoint de permissão GestLOG não encontrado (404) em ${result.url}. Verifique VITE_API_URL e publicação da API.`;
      } else if (result.status === 405) {
        msg = `Método POST não permitido (405) em ${result.url}. Parece rota de frontend, não API.`;
      } else if (result.data === null) {
        msg = `Resposta não-JSON da permissão GestLOG em ${result.url}. Possível HTML de proxy/WAF.`;
      }

      if (!msg) {
        const data = result.data;
        const messageFromData = (() => {
          if (typeof data === 'object' && data !== null) {
            const m = (data as Record<string, unknown>).message;
            if (typeof m === 'string') return m;
          }
          return undefined;
        })();
        msg = messageFromData ?? 'Usuário sem permissão para GestLOG';
      }
      throw new Error(msg);
    }

    const data = result.data;
    const permitido = (() => {
      if (typeof data === 'object' && data !== null) {
        const p = (data as Record<string, unknown>).permitido;
        if (typeof p === 'boolean') return p;
      }
      return true;
    })();
    const message = (() => {
      if (typeof data === 'object' && data !== null) {
        const m = (data as Record<string, unknown>).message;
        if (typeof m === 'string') return m;
      }
      return undefined;
    })();

    return { permitido, message };
  } catch (error: unknown) {
    console.error('Erro ao validar permissão GestLOG:', error);
    const msg = error instanceof Error ? error.message : 'Falha na validação de permissão';
    throw new Error(msg);
  }
};