export interface ClientesSemVendaRow {
  CODCLI: number;
  CLIENTE: string;
  MUNICENT: string;
  BAIRROENT: string;
  TELENT: string;
  TELCOB: string;
  DATA_ULTIMA_COMPRA: string;
  VALOR_ULTIMA_COMPRA: number;
  VENDEDOR_ULT_VENDA: string;
  CODUSUR_RESPONSAVEL_CLIENTE?: number;
  NOME_RESPONSAVEL?: string;
  CONTACTADO?: string;
  STATUS_ATUAL?: string;
}

export interface ClientesSemVendaResponse {
  rows: ClientesSemVendaRow[];
  count: number;
}

const resolveBaseApi = () => {
  const envRaw = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL;
  const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
  if (envRaw && typeof envRaw === "string") {
    const trimmed = envRaw.replace(/\/+$/, "");
    if (isHttps && /^http:\/\//i.test(trimmed)) return "/api";
    return trimmed;
  }
  return "/api";
};

export const buscarClientesSemVenda = async (): Promise<ClientesSemVendaRow[]> => {
  const baseUrl = resolveBaseApi();
  const url = `${baseUrl}/gestpro/clientes-sem-venda`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro HTTP! status: ${response.status}`);
    }
    const data = await response.json() as ClientesSemVendaResponse;
    return data.rows || [];
  } catch (error) {
    console.error("Erro ao buscar clientes sem venda:", error);
    throw new Error("Falha ao buscar clientes sem venda");
  }
};

export const salvarClienteSemVenda = async (payload: {
  codcli: number;
  codusur: number | null;
  contactado: Date;
  status: number;
  ultimaData: Date;
  nomeResponsavel?: string | null;
}) => {
  const baseUrl = resolveBaseApi();
  const url = `${baseUrl}/gestpro/salvar-cliente-sem-venda`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Erro ao salvar cliente sem venda: ${response.statusText}`);
  }
  return response.json();
};
