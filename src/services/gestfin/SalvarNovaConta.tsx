// Serviço para criar nova conta no GestFIN

export interface NovaContaPayload {
  CODCONTA: number;
  CONTA: string;
  GRUPOCONTA: number;
  TIPO: string;
  INVESTIMENTO: string;
  USARATEIOCENTROCUSTO?: string;
  RESTRINGIRNOBALANCETE?: string;
  UTILIZACENTROCUSTORESTRITO?: string;
  FIXAVARIAVEL?: string;
}

export interface NovaContaResponse {
  success: boolean;
  message?: string;
  codConta?: number;
}

function resolveBaseApi(): string {
  const envApiGestfin = (import.meta as any)?.env?.VITE_GESTFIN_API_URL as string | undefined;
  const envApi = envApiGestfin || ((import.meta as any)?.env?.VITE_API_URL as string | undefined);
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  if (envApi && typeof envApi === "string") {
    const isEnvHttp = /^http:\/\//i.test(envApi);
    if (isHttps && isEnvHttp) return "/api";
    const trimmed = envApi.replace(/\/+$/, "");
    const hasApiSuffix = /\/(api)$/i.test(trimmed);
    return hasApiSuffix ? trimmed : `${trimmed}/api`;
  }

  return "/api";
}

export const salvarNovaConta = async (contaData: NovaContaPayload): Promise<NovaContaResponse> => {
  const baseApi = resolveBaseApi();
  const url = `${baseApi}/gestfin/salvar-nova-conta`;

  // Mapeia os dados do formulário para o formato esperado pela API
  // e adiciona os valores padrão para os campos não presentes no formulário
  const payload: NovaContaPayload = {
    CODCONTA: parseInt(String(contaData.CODCONTA), 10), // Converte para número
    CONTA: contaData.CONTA,
    GRUPOCONTA: parseInt(String(contaData.GRUPOCONTA), 10), // Converte para número
    TIPO: contaData.TIPO,
    INVESTIMENTO: contaData.INVESTIMENTO,
    USARATEIOCENTROCUSTO: contaData.USARATEIOCENTROCUSTO || 'N', // Valor padrão
    RESTRINGIRNOBALANCETE: contaData.RESTRINGIRNOBALANCETE || 'N', // Valor padrão
    UTILIZACENTROCUSTORESTRITO: contaData.UTILIZACENTROCUSTORESTRITO || 'N', // Valor padrão
    FIXAVARIAVEL: contaData.FIXAVARIAVEL || 'F', // Valor padrão
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const message = typeof data === 'object' && data !== null ? (data as any).message : String(data || 'Falha ao salvar nova conta');
      throw new Error(message);
    }

    return data as NovaContaResponse; // Retorna a resposta da API em caso de sucesso
  } catch (error) {
    console.error("Erro na requisição da API salvarNovaConta:", error);
    throw error; // Re-lança o erro para ser tratado no componente que chamou
  }
};