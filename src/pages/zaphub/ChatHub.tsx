import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  ChatDotsFill,
  LightningChargeFill,
  ShieldCheck,
  PeopleFill,
  ArrowRightCircle,
  GearFill,
  HouseDoorFill,
  ArrowClockwise,
  BootstrapReboot,
  PlusLg,
  PlugFill,
  Plug,
  PersonCircle,
} from "react-bootstrap-icons";
import TopBar from "../../components/TopBar";
import MensagensModal from "./modals/MensagensModal";

const cardStyle: React.CSSProperties = {
  borderRadius: "14px",
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
};

const ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT = [
  "Consultor(a)",
  "Comprador(a)",
  "Analista",
  "Gerente",
  "Operador(a)",
  "SAC",
  "Financeiro",
  "Comercial",
  "Marketing",
];

const ZAPHUB_HEADER_ROLE_STORAGE_KEYS = {
  options: "zaphub.headerRoleOptions",
  selected: "zaphub.headerRoleSelected",
};

function sanitizeHeaderRoleOption(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/:$/, "")
    .trim();
}

function loadHeaderRoleOptions(): string[] {
  try {
    const raw = localStorage.getItem(ZAPHUB_HEADER_ROLE_STORAGE_KEYS.options);
    if (!raw) return [...ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT];
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [];
    const normalized = list
      .map((item) => sanitizeHeaderRoleOption(String(item ?? "")))
      .filter(Boolean);
    const unique = Array.from(new Set(normalized));
    return unique.length ? unique : [...ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT];
  } catch {
    return [...ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT];
  }
}

function loadHeaderRoleSelected(options: string[]) {
  try {
    const raw = localStorage.getItem(ZAPHUB_HEADER_ROLE_STORAGE_KEYS.selected);
    const candidate = sanitizeHeaderRoleOption(String(raw || ""));
    if (candidate && options.includes(candidate)) return candidate;
  } catch {
    void 0;
  }
  return options[0] || ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT[0] || "Consultor(a)";
}

function persistHeaderRoleConfig(options: string[], selected: string) {
  try {
    localStorage.setItem(ZAPHUB_HEADER_ROLE_STORAGE_KEYS.options, JSON.stringify(options));
    localStorage.setItem(ZAPHUB_HEADER_ROLE_STORAGE_KEYS.selected, selected);
  } catch {
    void 0;
  }
  try {
    window.dispatchEvent(new Event("zaphub:config-changed"));
  } catch {
    void 0;
  }
}

type ZapHubInstance = {
  instanceName: string;
  status: string;
  number?: string | null;
  profileName?: string | null;
  isTelevendasPrincipal?: boolean;
  responsavel?: {
    matricula?: string | null;
    nome?: string | null;
    areaAtuacao?: string | null;
    funcao?: string | null;
    updatedAt?: string | null;
  } | null;
  responsavelMatricula?: string | null;
};

type ZapHubAction = "sincronizar" | "reiniciar" | "desconectar" | "reconectar";

type ZapHubUsuario = {
  matricula: string | number;
  nome: string;
  areaAtuacao?: string | null;
  funcao?: string | null;
};

type ZapHubAcessoInstanceRow = {
  instanceName: string;
  matricula: string;
  nome?: string | null;
  areaAtuacao?: string | null;
  funcao?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ZapHubAcessoResumoRow = {
  matricula: string;
  nome?: string | null;
  areaAtuacao?: string | null;
  funcao?: string | null;
  totalInstancias?: number | null;
  instances?: string[] | null;
};

const ACTION_LABELS: Record<ZapHubAction, string> = {
  sincronizar: "Sincronizar instância",
  reiniciar: "Reiniciar instância",
  desconectar: "Desconectar instância",
  reconectar: "Reconectar instância",
};

const ChatHub: React.FC = () => {
  const [showConfigModal, setShowConfigModal] = React.useState(false);
  const [configTab, setConfigTab] = React.useState<"instancias" | "acessos" | "mensagens">("instancias");
  const [showUsuariosModal, setShowUsuariosModal] = React.useState(false);
  const [usuariosModalInstanceName, setUsuariosModalInstanceName] = React.useState<string | null>(null);
  const [showUsuariosAcessoModal, setShowUsuariosAcessoModal] = React.useState(false);
  const [showAddInstanciaModal, setShowAddInstanciaModal] = React.useState(false);
  const [showMensagensModal, setShowMensagensModal] = React.useState(false);
  const [loadingInstancias, setLoadingInstancias] = React.useState(false);
  const [erroInstancias, setErroInstancias] = React.useState<string | null>(null);
  const [instancias, setInstancias] = React.useState<ZapHubInstance[]>([]);
  const [acaoEmAndamento, setAcaoEmAndamento] = React.useState<Record<string, ZapHubAction | null>>({});
  const [vinculoEmAndamento, setVinculoEmAndamento] = React.useState<Record<string, "vincular" | "desvincular" | null>>({});
  const [televendasEmAndamento, setTelevendasEmAndamento] = React.useState<Record<string, "definir" | null>>({});
  const [mensagemAcao, setMensagemAcao] = React.useState<string | null>(null);
  const [erroAcao, setErroAcao] = React.useState<string | null>(null);
  const [usuarioPesquisaByInstance, setUsuarioPesquisaByInstance] = React.useState<Record<string, string>>({});
  const [usuariosLoadingByInstance, setUsuariosLoadingByInstance] = React.useState<Record<string, boolean>>({});
  const [usuariosErroByInstance, setUsuariosErroByInstance] = React.useState<Record<string, string | null>>({});
  const [usuariosByInstance, setUsuariosByInstance] = React.useState<Record<string, ZapHubUsuario[]>>({});
  const [usuarioSelecionadoByInstance, setUsuarioSelecionadoByInstance] = React.useState<Record<string, ZapHubUsuario | null>>({});
  const [acessoUsuarioPesquisa, setAcessoUsuarioPesquisa] = React.useState("");
  const [acessoUsuariosLoading, setAcessoUsuariosLoading] = React.useState(false);
  const [acessoUsuariosErro, setAcessoUsuariosErro] = React.useState<string | null>(null);
  const [acessoUsuarios, setAcessoUsuarios] = React.useState<ZapHubUsuario[]>([]);
  const [acessoUsuarioSelecionado, setAcessoUsuarioSelecionado] = React.useState<ZapHubUsuario | null>(null);
  const [acessoPermitidasSet, setAcessoPermitidasSet] = React.useState<Record<string, boolean>>({});
  const [acessoPermissoesLoading, setAcessoPermissoesLoading] = React.useState(false);
  const [acessoPermissoesErro, setAcessoPermissoesErro] = React.useState<string | null>(null);
  const [acessoAcaoEmAndamento, setAcessoAcaoEmAndamento] = React.useState<Record<string, "grant" | "revoke" | null>>({});
  const [acessoResumoLoading, setAcessoResumoLoading] = React.useState(false);
  const [acessoResumoErro, setAcessoResumoErro] = React.useState<string | null>(null);
  const [acessoResumoRows, setAcessoResumoRows] = React.useState<ZapHubAcessoResumoRow[]>([]);
  const [novaInstanciaNome, setNovaInstanciaNome] = React.useState("");
  const [novaInstanciaLoading, setNovaInstanciaLoading] = React.useState(false);
  const [novaInstanciaErro, setNovaInstanciaErro] = React.useState<string | null>(null);
  const [novaInstanciaMensagem, setNovaInstanciaMensagem] = React.useState<string | null>(null);
  const [novaInstanciaQrCodeUrl, setNovaInstanciaQrCodeUrl] = React.useState<string | null>(null);
  const [novaInstanciaPairingCode, setNovaInstanciaPairingCode] = React.useState<string | null>(null);
  const [headerRoleOptions, setHeaderRoleOptions] = React.useState<string[]>(() => loadHeaderRoleOptions());
  const [headerRoleSelected, setHeaderRoleSelected] = React.useState<string>(() =>
    loadHeaderRoleSelected(loadHeaderRoleOptions())
  );
  const [novoHeaderRole, setNovoHeaderRole] = React.useState("");

  React.useEffect(() => {
    const options = loadHeaderRoleOptions();
    const selected = loadHeaderRoleSelected(options);
    setHeaderRoleOptions(options);
    setHeaderRoleSelected(selected);
  }, []);

  React.useEffect(() => {
    if (!showConfigModal) return;
    const options = loadHeaderRoleOptions();
    const selected = loadHeaderRoleSelected(options);
    setHeaderRoleOptions(options);
    setHeaderRoleSelected(selected);
  }, [showConfigModal]);

  const getBaseApi = React.useCallback(() => {
    const env = import.meta.env.VITE_API_URL || "";
    const trimmed = typeof env === "string" ? env.replace(/\/$/, "") : "";
    return trimmed ? (trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`) : "/api";
  }, []);

  const carregarInstancias = React.useCallback(async () => {
    setLoadingInstancias(true);
    setErroInstancias(null);
    try {
      const baseApi = getBaseApi();
      const response = await fetch(`${baseApi}/zaphub/instancias`);
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const payload: unknown = isJson ? await response.json() : { message: await response.text() };
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao consultar instâncias do manager";
        throw new Error(message);
      }
      const rowsRaw = payload && typeof payload === "object" && "rows" in payload ? (payload as { rows?: unknown }).rows : [];
      setInstancias(Array.isArray(rowsRaw) ? (rowsRaw as ZapHubInstance[]) : []);
    } catch (err) {
      setInstancias([]);
      setErroInstancias(err instanceof Error ? err.message : "Erro ao carregar instâncias");
    } finally {
      setLoadingInstancias(false);
    }
  }, [getBaseApi]);

  const executarAcaoInstancia = React.useCallback(async (instanceName: string, action: ZapHubAction) => {
    setMensagemAcao(null);
    setErroAcao(null);
    setAcaoEmAndamento((prev) => ({ ...prev, [instanceName]: action }));
    try {
      const response = await fetch(`${getBaseApi()}/zaphub/instancias/acao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, action }),
      });
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const payload: unknown = isJson ? await response.json() : { message: await response.text() };

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : `Falha ao executar ${ACTION_LABELS[action].toLowerCase()}`;
        throw new Error(message);
      }

      const row =
        payload && typeof payload === "object" && "row" in payload
          ? (payload as { row?: ZapHubInstance }).row
          : undefined;
      const message =
        payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : `${ACTION_LABELS[action]} executada com sucesso`;

      if (row && row.instanceName) {
        setInstancias((prev) =>
          prev.map((item) => (item.instanceName === row.instanceName ? row : item))
        );
      } else {
        await carregarInstancias();
      }

      setMensagemAcao(`${instanceName}: ${message}`);
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : "Erro ao executar ação da instância");
    } finally {
      setAcaoEmAndamento((prev) => ({ ...prev, [instanceName]: null }));
    }
  }, [carregarInstancias, getBaseApi]);

  const pesquisarUsuarios = React.useCallback(
    async (instanceName: string, termo: string) => {
      const safeInstance = String(instanceName || "").trim();
      if (!safeInstance) return;
      const q = String(termo || "").trim();
      setUsuariosErroByInstance((prev) => ({ ...prev, [safeInstance]: null }));
      setUsuariosLoadingByInstance((prev) => ({ ...prev, [safeInstance]: true }));
      try {
        const response = await fetch(`${getBaseApi()}/zaphub/usuarios?q=${encodeURIComponent(q)}`);
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : { message: await response.text() };

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao pesquisar usuários";
          throw new Error(message);
        }

        const rowsRaw = payload && typeof payload === "object" && "rows" in payload ? (payload as { rows?: unknown }).rows : [];
        const list = Array.isArray(rowsRaw) ? (rowsRaw as ZapHubUsuario[]) : [];
        setUsuariosByInstance((prev) => ({ ...prev, [safeInstance]: list }));
      } catch (err) {
        setUsuariosByInstance((prev) => ({ ...prev, [safeInstance]: [] }));
        setUsuariosErroByInstance((prev) => ({ ...prev, [safeInstance]: err instanceof Error ? err.message : "Erro ao pesquisar usuários" }));
      } finally {
        setUsuariosLoadingByInstance((prev) => ({ ...prev, [safeInstance]: false }));
      }
    },
    [getBaseApi]
  );

  const pesquisarUsuariosAcesso = React.useCallback(async (termo: string) => {
    const q = String(termo || "").trim();
    setAcessoUsuariosErro(null);
    setAcessoUsuariosLoading(true);
    try {
      const response = await fetch(`${getBaseApi()}/zaphub/usuarios?q=${encodeURIComponent(q)}`);
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const payload: unknown = isJson ? await response.json() : { message: await response.text() };

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao pesquisar usuários";
        throw new Error(message);
      }

      const rowsRaw = payload && typeof payload === "object" && "rows" in payload ? (payload as { rows?: unknown }).rows : [];
      const list = Array.isArray(rowsRaw) ? (rowsRaw as ZapHubUsuario[]) : [];
      setAcessoUsuarios(list);
    } catch (err) {
      setAcessoUsuarios([]);
      setAcessoUsuariosErro(err instanceof Error ? err.message : "Erro ao pesquisar usuários");
    } finally {
      setAcessoUsuariosLoading(false);
    }
  }, [getBaseApi]);

  const carregarPermissoesAcesso = React.useCallback(async (matricula: string | number) => {
    const safeMatricula = String(matricula ?? "").trim();
    if (!safeMatricula) {
      setAcessoPermitidasSet({});
      return;
    }

    setAcessoPermissoesErro(null);
    setAcessoPermissoesLoading(true);
    try {
      const response = await fetch(`${getBaseApi()}/zaphub/instancias/permissoes?matricula=${encodeURIComponent(safeMatricula)}`);
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const payload: unknown = isJson ? await response.json() : { message: await response.text() };

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao carregar permissões";
        throw new Error(message);
      }

      const rowsRaw = payload && typeof payload === "object" && "rows" in payload ? (payload as { rows?: unknown }).rows : [];
      const rows = Array.isArray(rowsRaw) ? (rowsRaw as ZapHubAcessoInstanceRow[]) : [];
      const next: Record<string, boolean> = {};
      rows.forEach((row) => {
        const key = String(row.instanceName || "").trim();
        if (!key) return;
        next[key] = true;
      });
      setAcessoPermitidasSet(next);
    } catch (err) {
      setAcessoPermitidasSet({});
      setAcessoPermissoesErro(err instanceof Error ? err.message : "Erro ao carregar permissões");
    } finally {
      setAcessoPermissoesLoading(false);
    }
  }, [getBaseApi]);

  const carregarResumoPermissoesAcesso = React.useCallback(async () => {
    setAcessoResumoErro(null);
    setAcessoResumoLoading(true);
    try {
      const response = await fetch(`${getBaseApi()}/zaphub/instancias/permissoes/resumo`);
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const payload: unknown = isJson ? await response.json() : { message: await response.text() };

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao carregar resumo de permissões";
        throw new Error(message);
      }

      const rowsRaw = payload && typeof payload === "object" && "rows" in payload ? (payload as { rows?: unknown }).rows : [];
      setAcessoResumoRows(Array.isArray(rowsRaw) ? (rowsRaw as ZapHubAcessoResumoRow[]) : []);
    } catch (err) {
      setAcessoResumoRows([]);
      setAcessoResumoErro(err instanceof Error ? err.message : "Erro ao carregar resumo de permissões");
    } finally {
      setAcessoResumoLoading(false);
    }
  }, [getBaseApi]);

  const atualizarPermissaoAcesso = React.useCallback(async (instanceName: string, allow: boolean) => {
    const user = acessoUsuarioSelecionado;
    if (!user?.matricula) {
      setErroAcao("Selecione um usuário para gerenciar permissões");
      return;
    }
    const safeInstance = String(instanceName || "").trim();
    if (!safeInstance) return;

    const matricula = String(user.matricula ?? "").trim();
    if (!matricula) return;

    setMensagemAcao(null);
    setErroAcao(null);
    setAcessoAcaoEmAndamento((prev) => ({ ...prev, [safeInstance]: allow ? "grant" : "revoke" }));
    try {
      if (allow) {
        const response = await fetch(`${getBaseApi()}/zaphub/instancias/permissoes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceName: safeInstance,
            matricula,
            nome: user.nome,
            areaAtuacao: user.areaAtuacao ?? null,
            funcao: user.funcao ?? null,
          }),
        });
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : { message: await response.text() };
        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao conceder permissão";
          throw new Error(message);
        }
        setAcessoPermitidasSet((prev) => ({ ...prev, [safeInstance]: true }));
      } else {
        const response = await fetch(
          `${getBaseApi()}/zaphub/instancias/permissoes?instanceName=${encodeURIComponent(safeInstance)}&matricula=${encodeURIComponent(matricula)}`,
          { method: "DELETE" }
        );
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : { message: await response.text() };
        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao revogar permissão";
          throw new Error(message);
        }
        setAcessoPermitidasSet((prev) => ({ ...prev, [safeInstance]: false }));
      }
      setMensagemAcao(`Permissão atualizada: ${safeInstance}`);
      carregarResumoPermissoesAcesso().catch(() => {});
    } catch (err) {
      setErroAcao(err instanceof Error ? err.message : "Erro ao atualizar permissão");
    } finally {
      setAcessoAcaoEmAndamento((prev) => ({ ...prev, [safeInstance]: null }));
    }
  }, [acessoUsuarioSelecionado, carregarResumoPermissoesAcesso, getBaseApi]);

  const vincularResponsavel = React.useCallback(
    async (instanceName: string) => {
      const selected = usuarioSelecionadoByInstance[instanceName] || null;
      if (!selected?.matricula) {
        setErroAcao("Selecione um usuário para vincular");
        return;
      }

      setMensagemAcao(null);
      setErroAcao(null);
      setVinculoEmAndamento((prev) => ({ ...prev, [instanceName]: "vincular" }));
      try {
        const response = await fetch(`${getBaseApi()}/zaphub/instancias/responsavel/oracle`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceName, matricula: selected.matricula }),
        });
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : { message: await response.text() };

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao vincular responsável";
          throw new Error(message);
        }

        setMensagemAcao(`Responsável vinculado para ${instanceName}`);
        await carregarInstancias();
      } catch (err) {
        setErroAcao(err instanceof Error ? err.message : "Erro ao vincular responsável");
      } finally {
        setVinculoEmAndamento((prev) => ({ ...prev, [instanceName]: null }));
      }
    },
    [carregarInstancias, getBaseApi, usuarioSelecionadoByInstance]
  );

  const desvincularResponsavel = React.useCallback(
    async (instanceName: string) => {
      setMensagemAcao(null);
      setErroAcao(null);
      setVinculoEmAndamento((prev) => ({ ...prev, [instanceName]: "desvincular" }));
      try {
        const response = await fetch(`${getBaseApi()}/zaphub/instancias/responsavel/${encodeURIComponent(instanceName)}`, {
          method: "DELETE",
        });
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : { message: await response.text() };

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao desvincular responsável";
          throw new Error(message);
        }

        setMensagemAcao(`Responsável removido de ${instanceName}`);
        setUsuarioSelecionadoByInstance((prev) => ({ ...prev, [instanceName]: null }));
        await carregarInstancias();
      } catch (err) {
        setErroAcao(err instanceof Error ? err.message : "Erro ao desvincular responsável");
      } finally {
        setVinculoEmAndamento((prev) => ({ ...prev, [instanceName]: null }));
      }
    },
    [carregarInstancias, getBaseApi]
  );

  const definirTelevendasPrincipal = React.useCallback(
    async (instanceName: string) => {
      const safeInstance = String(instanceName || "").trim();
      if (!safeInstance) return;

      setMensagemAcao(null);
      setErroAcao(null);
      setTelevendasEmAndamento((prev) => ({ ...prev, [safeInstance]: "definir" }));
      try {
        const response = await fetch(`${getBaseApi()}/zaphub/instancias/televendas-principal`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceName: safeInstance }),
        });
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : { message: await response.text() };

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao definir televendas principal";
          throw new Error(message);
        }

        setMensagemAcao(`Televendas principal definido: ${safeInstance}`);
        await carregarInstancias();
      } catch (err) {
        setErroAcao(err instanceof Error ? err.message : "Erro ao definir televendas principal");
      } finally {
        setTelevendasEmAndamento((prev) => ({ ...prev, [safeInstance]: null }));
      }
    },
    [carregarInstancias, getBaseApi]
  );

  const gerarQrNovaInstancia = React.useCallback(async () => {
    const instanceName = String(novaInstanciaNome || "").trim();
    if (!instanceName) {
      setNovaInstanciaErro("Informe o nome da instância");
      return;
    }

    setNovaInstanciaErro(null);
    setNovaInstanciaMensagem(null);
    setNovaInstanciaQrCodeUrl(null);
    setNovaInstanciaPairingCode(null);
    setNovaInstanciaLoading(true);
    try {
      const response = await fetch(`${getBaseApi()}/zaphub/instancias/nova`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName }),
      });
      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const payload: unknown = isJson ? await response.json() : { message: await response.text() };

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Falha ao criar instância";
        throw new Error(message);
      }

      const message =
        payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : "Instância criada";
      const qrCodeDataUrl =
        payload && typeof payload === "object" && "qrCodeDataUrl" in payload && typeof (payload as { qrCodeDataUrl?: unknown }).qrCodeDataUrl === "string"
          ? (payload as { qrCodeDataUrl: string }).qrCodeDataUrl
          : null;
      const pairingCode =
        payload && typeof payload === "object" && "pairingCode" in payload && typeof (payload as { pairingCode?: unknown }).pairingCode === "string"
          ? (payload as { pairingCode: string }).pairingCode
          : null;

      setNovaInstanciaMensagem(message);
      setNovaInstanciaQrCodeUrl(qrCodeDataUrl);
      setNovaInstanciaPairingCode(pairingCode);
      await carregarInstancias();
    } catch (err) {
      setNovaInstanciaErro(err instanceof Error ? err.message : "Erro ao criar instância");
    } finally {
      setNovaInstanciaLoading(false);
    }
  }, [carregarInstancias, getBaseApi, novaInstanciaNome]);

  React.useEffect(() => {
    if (!showUsuariosModal) return;
    if (!usuariosModalInstanceName) return;
    const termo = usuarioPesquisaByInstance[usuariosModalInstanceName] ?? "";
    pesquisarUsuarios(usuariosModalInstanceName, termo);
  }, [showUsuariosModal, usuariosModalInstanceName, usuarioPesquisaByInstance, pesquisarUsuarios]);

  React.useEffect(() => {
    if (!showConfigModal) return;
    carregarInstancias();
  }, [showConfigModal, carregarInstancias]);

  React.useEffect(() => {
    if (!showUsuariosAcessoModal) return;
    pesquisarUsuariosAcesso(acessoUsuarioPesquisa);
  }, [showUsuariosAcessoModal, pesquisarUsuariosAcesso, acessoUsuarioPesquisa]);

  React.useEffect(() => {
    if (!showConfigModal) return;
    if (configTab !== "acessos") return;
    carregarResumoPermissoesAcesso().catch(() => {});
    if (acessoUsuarioSelecionado?.matricula) {
      carregarPermissoesAcesso(acessoUsuarioSelecionado.matricula);
    } else {
      setAcessoPermitidasSet({});
    }
  }, [showConfigModal, configTab, acessoUsuarioSelecionado, carregarPermissoesAcesso, carregarResumoPermissoesAcesso]);

  const abrirUsuariosModal = React.useCallback((instanceName: string) => {
    const safe = String(instanceName || "").trim();
    if (!safe) return;
    setUsuariosModalInstanceName(safe);
    setShowUsuariosModal(true);
  }, []);

  const usuariosModalActiveInstance = usuariosModalInstanceName || "";
  const usuarioPesquisaAtual = usuariosModalActiveInstance ? (usuarioPesquisaByInstance[usuariosModalActiveInstance] ?? "") : "";
  const usuariosAtual = usuariosModalActiveInstance ? (usuariosByInstance[usuariosModalActiveInstance] ?? []) : [];
  const usuariosLoadingAtual = usuariosModalActiveInstance ? Boolean(usuariosLoadingByInstance[usuariosModalActiveInstance]) : false;
  const usuariosErroAtual = usuariosModalActiveInstance ? (usuariosErroByInstance[usuariosModalActiveInstance] ?? null) : null;
  const usuarioSelecionadoAtual = usuariosModalActiveInstance ? (usuarioSelecionadoByInstance[usuariosModalActiveInstance] ?? null) : null;

  const instanciasAcessoAgrupadas = React.useMemo(() => {
    const selectedMatricula = String(acessoUsuarioSelecionado?.matricula ?? "").trim();
    const clean = instancias
      .filter((row) => String(row?.instanceName || "").trim())
      .slice()
      .sort((a, b) => String(a.instanceName || "").localeCompare(String(b.instanceName || ""), "pt-BR"));

    const televendasPrincipal = clean.filter((row) => Boolean(row.isTelevendasPrincipal));
    const meuNumero = clean.filter((row) => {
      if (!selectedMatricula) return false;
      if (row.isTelevendasPrincipal) return false;
      const responsavelMatricula = String(row.responsavel?.matricula || row.responsavelMatricula || "").trim();
      return responsavelMatricula && responsavelMatricula === selectedMatricula;
    });
    const outrasInstancias = clean.filter((row) => {
      if (row.isTelevendasPrincipal) return false;
      if (!selectedMatricula) return true;
      const responsavelMatricula = String(row.responsavel?.matricula || row.responsavelMatricula || "").trim();
      return !responsavelMatricula || responsavelMatricula !== selectedMatricula;
    });

    return { televendasPrincipal, meuNumero, outrasInstancias };
  }, [acessoUsuarioSelecionado?.matricula, instancias]);

  const renderAcessoInstanceCard = React.useCallback((instancia: ZapHubInstance) => {
    const instanceName = String(instancia.instanceName || "").trim();
    if (!instanceName) return null;
    const permitido = Boolean(acessoPermitidasSet[instanceName]);
    const selectedMatricula = String(acessoUsuarioSelecionado?.matricula ?? "").trim();
    const responsavelMatricula = String(instancia.responsavel?.matricula || instancia.responsavelMatricula || "").trim();
    const isMeuNumero = Boolean(selectedMatricula && responsavelMatricula && responsavelMatricula === selectedMatricula);
    const isTelevendas = Boolean(instancia.isTelevendasPrincipal);
    const classificationLabel = isTelevendas ? "Televendas principal" : isMeuNumero ? "Meu número" : "Outras";
    const televisaoBusy = Boolean(televendasEmAndamento[instanceName]);
    const responsavelBusy = Boolean(vinculoEmAndamento[instanceName]);

    const vincularResponsavelDireto = async (matricula: string) => {
      const safeMatricula = String(matricula || "").trim();
      if (!safeMatricula) return;
      setMensagemAcao(null);
      setErroAcao(null);
      setVinculoEmAndamento((prev) => ({ ...prev, [instanceName]: "vincular" }));
      try {
        const response = await fetch(`${getBaseApi()}/zaphub/instancias/responsavel/oracle`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceName, matricula: safeMatricula }),
        });
        const contentType = response.headers.get("content-type") || "";
        const isJson = contentType.toLowerCase().includes("application/json");
        const payload: unknown = isJson ? await response.json() : { message: await response.text() };

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string"
              ? (payload as { message: string }).message
              : "Falha ao vincular responsável";
          throw new Error(message);
        }

        setMensagemAcao(`Responsável vinculado para ${instanceName}`);
        await carregarInstancias();
      } catch (err) {
        setErroAcao(err instanceof Error ? err.message : "Erro ao vincular responsável");
      } finally {
        setVinculoEmAndamento((prev) => ({ ...prev, [instanceName]: null }));
      }
    };

    return (
      <div key={`acesso-${instanceName}`} className="col-12 col-md-4">
        <div className="border rounded-3 px-3 py-2 h-100" style={{ backgroundColor: "#f8f9fa" }}>
          <div className="d-flex align-items-start justify-content-between" style={{ gap: "10px" }}>
            <div style={{ minWidth: 0 }}>
              <div className="fw-semibold text-truncate">{instanceName}</div>
              <div className="text-muted text-truncate" style={{ fontSize: "0.78rem", lineHeight: 1.2 }}>
                {instancia.profileName || "-"}
              </div>
            </div>
            <span
              className={`badge rounded-pill ${isTelevendas ? "bg-success" : isMeuNumero ? "bg-primary" : "bg-secondary"}`}
              style={{ alignSelf: "flex-start" }}
              title={classificationLabel}
            >
              {classificationLabel}
            </span>
          </div>
          <div className="d-flex align-items-center justify-content-between mt-2" style={{ gap: "8px", flexWrap: "wrap" }}>
            <span className={`fw-semibold ${permitido ? "text-success" : "text-muted"}`} style={{ fontSize: "0.82rem" }}>
              {permitido ? "Permitido" : "Bloqueado"}
            </span>
            <div className="d-flex align-items-center" style={{ gap: "8px" }}>
              <div className="btn-group" role="group" aria-label="Classificação">
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm"
                  title="Definir como Televendas principal"
                  aria-label="Definir como Televendas principal"
                  disabled={televisaoBusy || responsavelBusy || isTelevendas}
                  onClick={() => definirTelevendasPrincipal(instanceName)}
                >
                  {televisaoBusy ? <div className="spinner-border spinner-border-sm" role="status" /> : <LightningChargeFill size={14} />}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  title="Definir como Meu número"
                  aria-label="Definir como Meu número"
                  disabled={!selectedMatricula || televisaoBusy || responsavelBusy || isMeuNumero}
                  onClick={() => vincularResponsavelDireto(selectedMatricula)}
                >
                  {responsavelBusy && vinculoEmAndamento[instanceName] === "vincular"
                    ? <div className="spinner-border spinner-border-sm" role="status" />
                    : <PersonCircle size={14} />}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  title="Marcar como Outras instâncias"
                  aria-label="Marcar como Outras instâncias"
                  disabled={!isMeuNumero || televisaoBusy || responsavelBusy}
                  onClick={() => {
                    if (!isMeuNumero) return;
                    desvincularResponsavel(instanceName);
                  }}
                >
                  {responsavelBusy && vinculoEmAndamento[instanceName] === "desvincular"
                    ? <div className="spinner-border spinner-border-sm" role="status" />
                    : <PlugFill size={14} />}
                </button>
              </div>

              <button
                type="button"
                className={`btn btn-sm ${permitido ? "btn-outline-danger" : "btn-outline-success"}`}
                disabled={Boolean(acessoAcaoEmAndamento[instanceName])}
                onClick={() => atualizarPermissaoAcesso(instanceName, !permitido)}
              >
                {acessoAcaoEmAndamento[instanceName]
                  ? "Aguarde..."
                  : permitido
                    ? "Remover"
                    : "Permitir"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    acessoAcaoEmAndamento,
    acessoPermitidasSet,
    acessoUsuarioSelecionado?.matricula,
    atualizarPermissaoAcesso,
    carregarInstancias,
    definirTelevendasPrincipal,
    desvincularResponsavel,
    getBaseApi,
    televendasEmAndamento,
    vinculoEmAndamento,
  ]);

  return (
    <div
      className="d-flex flex-column"
      style={{
        fontFamily: "'Poppins', sans-serif",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
      }}
    >
      <TopBar
        title=""
        titleClassName="d-none"
        showBack
        backLink="/dashboard"
        children={
          <button
            type="button"
            className="btn btn-primary d-flex align-items-center ms-0 ms-md-3"
            style={{ gap: "8px" }}
            onClick={() => setShowMensagensModal(true)}
          >
            <ChatDotsFill size={16} />
            <span>Mensagens</span>
          </button>
        }
        actions={
          <button
            type="button"
            className="btn btn-outline-primary d-flex align-items-center"
            style={{ gap: "8px" }}
            onClick={() => setShowConfigModal(true)}
          >
            <GearFill size={16} />
            <span>Config</span>
          </button>
        }
      />

      <main className="container py-3 flex-grow-1">
        <div
          className="rounded-4 text-white p-3 p-lg-4 mb-3"
          style={{
            background: "linear-gradient(135deg, #198754 0%, #0d6efd 100%)",
            boxShadow: "0 10px 30px rgba(13, 110, 253, 0.18)",
          }}
        >
          <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between" style={{ gap: "12px" }}>
            <div>
              <div className="d-inline-flex align-items-center mb-1" style={{ gap: "6px", fontSize: "0.86rem", opacity: 0.92 }}>
                <ChatDotsFill size={16} />
                <span>Painel inicial</span>
              </div>
              <h1 className="h4 fw-bold mb-1">Bem-vindo ao ChatHub</h1>
              <p className="mb-0" style={{ maxWidth: "760px", opacity: 0.95, lineHeight: 1.4 }}>
                Esta e a nova pagina inicial do ChatHub. Aqui voce pode centralizar atalhos, indicadores e acessos
                rapidos para a operacao de mensagens.
              </p>
            </div>

            <div className="bg-white text-dark rounded-4 px-3 py-2" style={{ minWidth: "200px" }}>
              <div className="text-muted" style={{ fontSize: "0.78rem" }}>Status do modulo</div>
              <div className="fw-bold text-success d-flex align-items-center mt-1" style={{ gap: "8px" }}>
                <ShieldCheck size={16} />
                <span>Acesso liberado</span>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="card h-100 border-0" style={cardStyle}>
              <div className="card-body p-3">
                <div className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-2" style={{ width: "40px", height: "40px", backgroundColor: "#198754" }}>
                  <LightningChargeFill size={18} />
                </div>
                <h2 className="h6 fw-semibold mb-1">Acesso rapido</h2>
                <p className="text-muted mb-0" style={{ lineHeight: 1.4 }}>
                  Use esta area como ponto de entrada para os fluxos principais do ChatHub.
                </p>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="card h-100 border-0" style={cardStyle}>
              <div className="card-body p-3">
                <div className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-2" style={{ width: "40px", height: "40px", backgroundColor: "#0d6efd" }}>
                  <PeopleFill size={18} />
                </div>
                <h2 className="h6 fw-semibold mb-1">Atendimento</h2>
                <p className="text-muted mb-0" style={{ lineHeight: 1.4 }}>
                  Reserve este espaco para filas, equipes, conversas e distribuicao de atendimentos.
                </p>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="card h-100 border-0" style={cardStyle}>
              <div className="card-body p-3">
                <div className="d-inline-flex align-items-center justify-content-center rounded-circle text-white mb-2" style={{ width: "40px", height: "40px", backgroundColor: "#6f42c1" }}>
                  <ArrowRightCircle size={18} />
                </div>
                <h2 className="h6 fw-semibold mb-1">Proximos passos</h2>
                <p className="text-muted mb-0" style={{ lineHeight: 1.4 }}>
                  A estrutura inicial ja esta pronta para receber dashboards, atalhos e integracoes do modulo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showConfigModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
            onClick={() => setShowConfigModal(false)}
          />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-fullscreen" role="document" style={{ margin: 0 }}>
              <div className="modal-content border-0" style={{ height: "100vh", overflow: "hidden" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ gap: "8px" }}>
                    <GearFill size={18} />
                    <span>Config</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    onClick={() => setShowConfigModal(false)}
                  />
                </div>
                <div className="modal-body py-3" style={{ overflowY: "auto" }}>
                  <ul className="nav nav-tabs mb-3">
                    <li className="nav-item">
                      <button
                        type="button"
                        className={`nav-link ${configTab === "instancias" ? "active" : ""}`}
                        onClick={() => setConfigTab("instancias")}
                      >
                        Instâncias
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        type="button"
                        className={`nav-link ${configTab === "acessos" ? "active" : ""}`}
                        onClick={() => setConfigTab("acessos")}
                      >
                        Acessos
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        type="button"
                        className={`nav-link ${configTab === "mensagens" ? "active" : ""}`}
                        onClick={() => setConfigTab("mensagens")}
                      >
                        Mensagens
                      </button>
                    </li>
                  </ul>

                  {configTab === "acessos" ? (
                    <div className="border rounded-3 bg-white p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between" style={{ gap: "12px" }}>
                        <div>
                          <div className="fw-semibold">Gestão de instâncias vinculadas ao usuário</div>
                          <div className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.25 }}>
                            Selecione um usuário do Oracle e defina quais instâncias ele pode acessar.
                          </div>
                        </div>
                        <div className="d-flex align-items-center" style={{ gap: "8px" }}>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => {
                              setAcessoUsuariosErro(null);
                              setShowUsuariosAcessoModal(true);
                            }}
                          >
                            Selecionar usuário
                          </button>
                          <div className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.2 }}>
                            Selecionado:{" "}
                            <span className="fw-semibold">
                              {acessoUsuarioSelecionado
                                ? `${acessoUsuarioSelecionado.nome} (${String(acessoUsuarioSelecionado.matricula)})`
                                : "-"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 border rounded-3 bg-light" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                        <div className="px-3 py-2 border-bottom" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                          <div className="fw-semibold" style={{ fontSize: "0.86rem" }}>Usuários com permissões</div>
                          <div className="text-muted" style={{ fontSize: "0.78rem", lineHeight: 1.2 }}>
                            Lista pré-carregada de usuários que já possuem instâncias permitidas.
                          </div>
                        </div>
                        <div style={{ maxHeight: "220px", overflow: "auto" }}>
                          {acessoResumoLoading ? (
                            <div className="p-3 text-muted d-flex align-items-center" style={{ gap: "8px" }}>
                              <div className="spinner-border spinner-border-sm" role="status" />
                              <span>Carregando...</span>
                            </div>
                          ) : acessoResumoErro ? (
                            <div className="p-3 text-danger">{acessoResumoErro}</div>
                          ) : acessoResumoRows.length === 0 ? (
                            <div className="p-3 text-muted">Nenhuma permissão concedida ainda.</div>
                          ) : (
                            acessoResumoRows.map((row) => {
                              const matricula = String(row.matricula || "").trim();
                              const nome = String(row.nome || "").trim();
                              const total = Number(row.totalInstancias) || 0;
                              const selected = acessoUsuarioSelecionado && String(acessoUsuarioSelecionado.matricula) === matricula;
                              return (
                                <button
                                  key={`acesso-resumo-${matricula}`}
                                  type="button"
                                  className={`btn w-100 text-start btn-sm ${selected ? "btn-primary" : "btn-light"}`}
                                  style={{ borderRadius: 0 }}
                                  onClick={() => {
                                    const u: ZapHubUsuario = {
                                      matricula,
                                      nome: nome || matricula || "-",
                                      areaAtuacao: row.areaAtuacao ?? null,
                                      funcao: row.funcao ?? null,
                                    };
                                    setAcessoUsuarioSelecionado(u);
                                    carregarPermissoesAcesso(matricula);
                                  }}
                                >
                                  <div className="d-flex align-items-start justify-content-between" style={{ gap: "10px" }}>
                                    <div style={{ minWidth: 0 }}>
                                      <div className="fw-semibold text-truncate">{nome || "-"}</div>
                                      <div className="opacity-75" style={{ fontSize: "0.72rem", lineHeight: 1.15 }}>
                                        {matricula}{" • "}{(row.areaAtuacao || "-") + " • " + (row.funcao || "-")}
                                      </div>
                                    </div>
                                    <span className="badge rounded-pill bg-secondary">{total}</span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {acessoPermissoesErro ? <div className="alert alert-danger py-2 mt-2 mb-0">{acessoPermissoesErro}</div> : null}

                      <div className="mt-3">
                        {!acessoUsuarioSelecionado ? (
                          <div className="text-muted">Selecione um usuário para gerenciar permissões.</div>
                        ) : acessoPermissoesLoading ? (
                          <div className="d-flex align-items-center text-muted" style={{ gap: "8px" }}>
                            <div className="spinner-border spinner-border-sm" role="status" />
                            <span>Carregando permissões...</span>
                          </div>
                        ) : instancias.length === 0 ? (
                          <div className="text-muted">Nenhuma instância disponível para configurar.</div>
                        ) : (
                          <div className="d-flex flex-column" style={{ gap: "14px" }}>
                            <div>
                              <div className="d-flex align-items-center justify-content-between" style={{ gap: "10px" }}>
                                <div className="d-flex align-items-center" style={{ gap: "8px" }}>
                                  <LightningChargeFill size={14} className="text-success" />
                                  <div className="fw-semibold">Televendas principal</div>
                                </div>
                                <span className="badge rounded-pill bg-secondary">{instanciasAcessoAgrupadas.televendasPrincipal.length}</span>
                              </div>
                              {instanciasAcessoAgrupadas.televendasPrincipal.length ? (
                                <div className="row g-2 mt-1">
                                  {instanciasAcessoAgrupadas.televendasPrincipal.map(renderAcessoInstanceCard)}
                                </div>
                              ) : (
                                <div className="text-muted mt-1" style={{ fontSize: "0.82rem" }}>Nenhuma instância marcada como Televendas principal.</div>
                              )}
                            </div>

                            <div>
                              <div className="d-flex align-items-center justify-content-between" style={{ gap: "10px" }}>
                                <div className="d-flex align-items-center" style={{ gap: "8px" }}>
                                  <PersonCircle size={14} className="text-primary" />
                                  <div className="fw-semibold">Meu número</div>
                                </div>
                                <span className="badge rounded-pill bg-secondary">{instanciasAcessoAgrupadas.meuNumero.length}</span>
                              </div>
                              {instanciasAcessoAgrupadas.meuNumero.length ? (
                                <div className="row g-2 mt-1">
                                  {instanciasAcessoAgrupadas.meuNumero.map(renderAcessoInstanceCard)}
                                </div>
                              ) : (
                                <div className="text-muted mt-1" style={{ fontSize: "0.82rem" }}>
                                  Nenhuma instância vinculada a esta matrícula como responsável.
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="d-flex align-items-center justify-content-between" style={{ gap: "10px" }}>
                                <div className="d-flex align-items-center" style={{ gap: "8px" }}>
                                  <PlugFill size={14} className="text-muted" />
                                  <div className="fw-semibold">Outras instâncias</div>
                                </div>
                                <span className="badge rounded-pill bg-secondary">{instanciasAcessoAgrupadas.outrasInstancias.length}</span>
                              </div>
                              {instanciasAcessoAgrupadas.outrasInstancias.length ? (
                                <div className="row g-2 mt-1">
                                  {instanciasAcessoAgrupadas.outrasInstancias.map(renderAcessoInstanceCard)}
                                </div>
                              ) : (
                                <div className="text-muted mt-1" style={{ fontSize: "0.82rem" }}>Nenhuma outra instância encontrada.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {configTab === "mensagens" ? (
                    <div className="border rounded-3 bg-white p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                      <div className="fw-semibold">Cabeçalho do atendente</div>
                      <div className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.25 }}>
                        Define o cargo que aparece no início das mensagens enviadas. Exemplo: <span className="fw-semibold">*Consultor(a): PCADMIN*</span>
                      </div>

                      <div className="row g-2 align-items-end mt-2">
                        <div className="col-12 col-md-4">
                          <label className="form-label mb-1" style={{ fontSize: "0.78rem" }}>
                            Cargo selecionado
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={headerRoleSelected}
                            onChange={(e) => {
                              const next = sanitizeHeaderRoleOption(e.target.value);
                              const safe = next && headerRoleOptions.includes(next) ? next : loadHeaderRoleSelected(headerRoleOptions);
                              setHeaderRoleSelected(safe);
                              persistHeaderRoleConfig(headerRoleOptions, safe);
                            }}
                          >
                            {headerRoleOptions.map((item) => (
                              <option key={`header-role-${item}`} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-12 col-md-5">
                          <label className="form-label mb-1" style={{ fontSize: "0.78rem" }}>
                            Adicionar novo cargo
                          </label>
                          <input
                            className="form-control form-control-sm"
                            value={novoHeaderRole}
                            placeholder="Ex: Supervisor(a)"
                            onChange={(e) => setNovoHeaderRole(e.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-3">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm w-100"
                            onClick={() => {
                              const normalized = sanitizeHeaderRoleOption(novoHeaderRole);
                              if (!normalized) return;
                              const nextOptions = Array.from(new Set([...headerRoleOptions, normalized]));
                              const nextSelected = headerRoleSelected && nextOptions.includes(headerRoleSelected)
                                ? headerRoleSelected
                                : loadHeaderRoleSelected(nextOptions);
                              setHeaderRoleOptions(nextOptions);
                              setHeaderRoleSelected(nextSelected);
                              setNovoHeaderRole("");
                              persistHeaderRoleConfig(nextOptions, nextSelected);
                            }}
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                          Opções disponíveis
                        </div>
                        <div className="d-flex flex-wrap mt-1" style={{ gap: "8px" }}>
                          {headerRoleOptions.map((item) => {
                            const selected = item === headerRoleSelected;
                            const disableRemove = headerRoleOptions.length <= 1;
                            return (
                              <div
                                key={`role-pill-${item}`}
                                className={`badge rounded-pill ${selected ? "bg-primary" : "bg-secondary"}`}
                                style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 10px" }}
                              >
                                <span>{item}</span>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link text-white p-0"
                                  style={{ lineHeight: 1, textDecoration: "none" }}
                                  disabled={disableRemove}
                                  onClick={() => {
                                    const nextOptions = headerRoleOptions.filter((opt) => opt !== item);
                                    const safeOptions = nextOptions.length ? nextOptions : [...ZAPHUB_HEADER_ROLE_OPTIONS_DEFAULT];
                                    const nextSelected = safeOptions.includes(headerRoleSelected)
                                      ? headerRoleSelected
                                      : loadHeaderRoleSelected(safeOptions);
                                    setHeaderRoleOptions(safeOptions);
                                    setHeaderRoleSelected(nextSelected);
                                    persistHeaderRoleConfig(safeOptions, nextSelected);
                                  }}
                                  aria-label={`Remover ${item}`}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {configTab === "instancias" ? (
                  <div>
                  <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: "10px" }}>
                    <p className="text-muted mb-0" style={{ lineHeight: 1.35 }}>
                      Instâncias configuradas no manager `http://72.60.247.126:8888/manager`.
                    </p>
                    <div className="d-flex align-items-start" style={{ gap: "12px" }}>
                      <div className="d-flex flex-column align-items-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-primary rounded-circle d-inline-flex align-items-center justify-content-center text-decoration-none"
                          style={{ width: "34px", height: "34px", padding: 0 }}
                          aria-label="Atualizar instâncias"
                          onClick={carregarInstancias}
                          disabled={loadingInstancias}
                        >
                          {loadingInstancias ? <div className="spinner-border spinner-border-sm" role="status" /> : <ArrowClockwise size={16} />}
                        </button>
                        <div className="text-muted text-center" style={{ fontSize: "0.68rem", lineHeight: 1.1, marginTop: "2px" }}>
                          {loadingInstancias ? "Atualizando..." : "Atualizar"}
                        </div>
                      </div>

                      <div className="d-flex flex-column align-items-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-success rounded-circle d-inline-flex align-items-center justify-content-center text-decoration-none"
                          style={{ width: "34px", height: "34px", padding: 0 }}
                          aria-label="Adicionar instância"
                          onClick={() => {
                            setNovaInstanciaErro(null);
                            setNovaInstanciaMensagem(null);
                            setNovaInstanciaQrCodeUrl(null);
                            setNovaInstanciaPairingCode(null);
                            setNovaInstanciaNome("");
                            setShowAddInstanciaModal(true);
                          }}
                        >
                          <PlusLg size={16} />
                        </button>
                        <div className="text-muted text-center" style={{ fontSize: "0.68rem", lineHeight: 1.1, marginTop: "2px" }}>
                          Adicionar
                        </div>
                      </div>
                    </div>
                  </div>

                  {erroInstancias && <div className="alert alert-danger py-2">{erroInstancias}</div>}
                  {erroAcao && <div className="alert alert-danger py-2">{erroAcao}</div>}
                  {mensagemAcao && <div className="alert alert-success py-2">{mensagemAcao}</div>}

                  {loadingInstancias ? (
                    <div className="d-flex align-items-center text-muted" style={{ gap: "8px" }}>
                      <div className="spinner-border spinner-border-sm" role="status" />
                      <span>Carregando instâncias...</span>
                    </div>
                  ) : instancias.length === 0 ? (
                    <div className="alert alert-light border mb-0">Nenhuma instância configurada foi encontrada.</div>
                  ) : (
                    <div className="row g-2">
                      {instancias.map((instancia, index) => (
                        <div key={`${instancia.instanceName}-${index}`} className="col-12 col-md-4">
                          <div className="border rounded-3 px-3 py-2 h-100" style={{ backgroundColor: "#f8f9fa" }}>
                            <div className="d-flex align-items-start justify-content-between" style={{ gap: "12px" }}>
                              <div className="flex-grow-1">
                              <div className="fw-semibold">{instancia.instanceName || "-"}</div>
                              <div className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                                Status: <span className="fw-semibold">{instancia.status || "-"}</span>
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                                Perfil: <span className="fw-semibold">{instancia.profileName || "-"}</span>
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                                Número: <span className="fw-semibold">{instancia.number || "-"}</span>
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                                Televendas:{" "}
                                <span className={`fw-semibold ${instancia.isTelevendasPrincipal ? "text-success" : ""}`}>
                                  {instancia.isTelevendasPrincipal ? "Principal" : "-"}
                                </span>
                              </div>
                              <div className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>
                                Responsável:{" "}
                                <span className="fw-semibold">
                                  {instancia.responsavel?.nome
                                    ? `${instancia.responsavel.nome} (${instancia.responsavel.matricula || "-"})`
                                    : instancia.responsavelMatricula || "-"}
                                </span>
                              </div>
                              {(instancia.responsavel?.areaAtuacao || instancia.responsavel?.funcao) && (
                                <div className="text-muted" style={{ fontSize: "0.78rem", lineHeight: 1.2 }}>
                                  {(instancia.responsavel?.areaAtuacao || "-") + " • " + (instancia.responsavel?.funcao || "-")}
                                </div>
                              )}

                              <div className="border rounded-3 px-2 py-2 mt-2" style={{ backgroundColor: "#ffffff", fontSize: "0.75rem" }}>
                                <div className="fw-semibold">Vincular responsável</div>
                                <div className="text-muted" style={{ lineHeight: 1.2 }}>
                                  {instancia.responsavelMatricula
                                    ? "Esta instância já possui um responsável vinculado. Desvincule para selecionar outro usuário."
                                    : "Abra a listagem de usuários do Oracle e selecione o responsável para a instância."}
                                </div>
                                <div className="d-flex align-items-center justify-content-between flex-wrap mt-2" style={{ gap: "10px" }}>
                                  <div className="d-flex align-items-center" style={{ gap: "10px", minWidth: 0 }}>
                                    {!instancia.responsavelMatricula ? (
                                      <button
                                        type="button"
                                        className="btn btn-outline-primary btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                        style={{ width: "34px", height: "34px", padding: 0 }}
                                        aria-label="Selecionar usuário"
                                        title="Selecionar usuário"
                                        onClick={() => abrirUsuariosModal(instancia.instanceName)}
                                      >
                                        <PersonCircle size={16} />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                        style={{ width: "34px", height: "34px", padding: 0 }}
                                        aria-label="Seleção bloqueada"
                                        title="Seleção bloqueada"
                                        disabled
                                      >
                                        <PersonCircle size={16} />
                                      </button>
                                    )}

                                    <div className="text-muted" style={{ lineHeight: 1.1, minWidth: 0 }}>
                                      <div style={{ fontSize: "0.68rem" }}>Selecionado</div>
                                      <div className="fw-semibold text-truncate" style={{ fontSize: "0.78rem", maxWidth: "340px" }}>
                                        {usuarioSelecionadoByInstance[instancia.instanceName]
                                          ? `${usuarioSelecionadoByInstance[instancia.instanceName]?.nome} (${String(usuarioSelecionadoByInstance[instancia.instanceName]?.matricula)})`
                                          : "-"}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="d-flex align-items-center flex-wrap" style={{ gap: "8px" }}>
                                    {!instancia.isTelevendasPrincipal ? (
                                      <button
                                        type="button"
                                        className="btn btn-outline-success btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                        style={{ width: "34px", height: "34px", padding: 0 }}
                                        aria-label="Definir Televendas principal"
                                        title="Definir Televendas principal"
                                        disabled={
                                          Boolean(televendasEmAndamento[instancia.instanceName]) ||
                                          Boolean(vinculoEmAndamento[instancia.instanceName]) ||
                                          Boolean(acaoEmAndamento[instancia.instanceName])
                                        }
                                        onClick={() => definirTelevendasPrincipal(instancia.instanceName)}
                                      >
                                        {televendasEmAndamento[instancia.instanceName] === "definir"
                                          ? <div className="spinner-border spinner-border-sm" role="status" />
                                          : <LightningChargeFill size={16} />}
                                      </button>
                                    ) : null}

                                    {instancia.responsavelMatricula ? (
                                      <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                        style={{ width: "34px", height: "34px", padding: 0 }}
                                        aria-label="Desvincular responsável"
                                        title="Desvincular responsável"
                                        disabled={Boolean(vinculoEmAndamento[instancia.instanceName]) || Boolean(acaoEmAndamento[instancia.instanceName])}
                                        onClick={() => desvincularResponsavel(instancia.instanceName)}
                                      >
                                        {vinculoEmAndamento[instancia.instanceName] === "desvincular"
                                          ? <div className="spinner-border spinner-border-sm" role="status" />
                                          : <Plug size={16} />}
                                      </button>
                                    ) : null}

                                    <button
                                      type="button"
                                      className="btn btn-outline-primary btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                      style={{ width: "34px", height: "34px", padding: 0 }}
                                      aria-label={usuarioSelecionadoByInstance[instancia.instanceName] ? "Vincular selecionado" : "Selecione um usuário"}
                                      title={usuarioSelecionadoByInstance[instancia.instanceName] ? "Vincular selecionado" : "Selecione um usuário"}
                                      disabled={
                                        !usuarioSelecionadoByInstance[instancia.instanceName] ||
                                        Boolean(vinculoEmAndamento[instancia.instanceName]) ||
                                        Boolean(acaoEmAndamento[instancia.instanceName]) ||
                                        String(instancia.responsavelMatricula || "") ===
                                          String(usuarioSelecionadoByInstance[instancia.instanceName]?.matricula || "")
                                      }
                                      onClick={() => vincularResponsavel(instancia.instanceName)}
                                    >
                                      {vinculoEmAndamento[instancia.instanceName] === "vincular"
                                        ? <div className="spinner-border spinner-border-sm" role="status" />
                                        : <PlugFill size={16} />}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="d-flex flex-wrap justify-content-end" style={{ gap: "10px" }}>
                              <div className="d-flex flex-column align-items-center" style={{ minWidth: "78px" }}>
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                  style={{ width: "34px", height: "34px", padding: 0 }}
                                  aria-label="Sincronizar instância"
                                  disabled={Boolean(acaoEmAndamento[instancia.instanceName])}
                                  onClick={() => executarAcaoInstancia(instancia.instanceName, "sincronizar")}
                                >
                                  <ArrowClockwise size={16} />
                                </button>
                                <div className="text-muted text-center" style={{ fontSize: "0.68rem", lineHeight: 1.1, marginTop: "4px" }}>
                                  {acaoEmAndamento[instancia.instanceName] === "sincronizar" ? "Sincronizando..." : "Sincronizar"}
                                </div>
                              </div>

                              <div className="d-flex flex-column align-items-center" style={{ minWidth: "78px" }}>
                                <button
                                  type="button"
                                  className="btn btn-outline-warning btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                  style={{ width: "34px", height: "34px", padding: 0 }}
                                  aria-label="Reiniciar instância"
                                  disabled={Boolean(acaoEmAndamento[instancia.instanceName])}
                                  onClick={() => executarAcaoInstancia(instancia.instanceName, "reiniciar")}
                                >
                                  <BootstrapReboot size={16} />
                                </button>
                                <div className="text-muted text-center" style={{ fontSize: "0.68rem", lineHeight: 1.1, marginTop: "4px" }}>
                                  {acaoEmAndamento[instancia.instanceName] === "reiniciar" ? "Reiniciando..." : "Reiniciar"}
                                </div>
                              </div>

                              <div className="d-flex flex-column align-items-center" style={{ minWidth: "78px" }}>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                  style={{ width: "34px", height: "34px", padding: 0 }}
                                  aria-label="Desconectar instância"
                                  disabled={Boolean(acaoEmAndamento[instancia.instanceName])}
                                  onClick={() => executarAcaoInstancia(instancia.instanceName, "desconectar")}
                                >
                                  <PlugFill size={16} />
                                </button>
                                <div className="text-muted text-center" style={{ fontSize: "0.68rem", lineHeight: 1.1, marginTop: "4px" }}>
                                  {acaoEmAndamento[instancia.instanceName] === "desconectar" ? "Desconectando..." : "Desconectar"}
                                </div>
                              </div>

                              <div className="d-flex flex-column align-items-center" style={{ minWidth: "78px" }}>
                                <button
                                  type="button"
                                  className="btn btn-outline-success btn-sm rounded-circle d-inline-flex align-items-center justify-content-center"
                                  style={{ width: "34px", height: "34px", padding: 0 }}
                                  aria-label="Reconectar instância"
                                  disabled={Boolean(acaoEmAndamento[instancia.instanceName])}
                                  onClick={() => executarAcaoInstancia(instancia.instanceName, "reconectar")}
                                >
                                  <Plug size={16} />
                                </button>
                                <div className="text-muted text-center" style={{ fontSize: "0.68rem", lineHeight: 1.1, marginTop: "4px" }}>
                                  {acaoEmAndamento[instancia.instanceName] === "reconectar" ? "Reconectando..." : "Reconectar"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                  ) : null}
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowConfigModal(false)}
                  >
                    Fechar
                  </button>
                  <a href="/dashboard" className="btn btn-primary d-inline-flex align-items-center" style={{ gap: "8px" }}>
                    <HouseDoorFill size={16} />
                    <span>Voltar</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showUsuariosModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1060 }}
            onClick={() => {
              setShowUsuariosModal(false);
              setUsuariosModalInstanceName(null);
            }}
          />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
              <div className="modal-content border-0" style={{ borderRadius: "16px", overflow: "hidden" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title">Selecionar usuário</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    onClick={() => {
                      setShowUsuariosModal(false);
                      setUsuariosModalInstanceName(null);
                    }}
                  />
                </div>
                <div className="modal-body py-3">
                  <div className="d-flex flex-column flex-md-row" style={{ gap: "8px" }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={usuarioPesquisaAtual}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!usuariosModalActiveInstance) return;
                        setUsuarioPesquisaByInstance((prev) => ({ ...prev, [usuariosModalActiveInstance]: value }));
                      }}
                      placeholder="Pesquisar por matrícula, nome, área ou função"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        if (!usuariosModalActiveInstance) return;
                        pesquisarUsuarios(usuariosModalActiveInstance, usuarioPesquisaAtual);
                      }}
                      disabled={!usuariosModalActiveInstance || usuariosLoadingAtual}
                    >
                      {usuariosLoadingAtual ? "Pesquisando..." : "Pesquisar"}
                    </button>
                  </div>

                  {usuariosErroAtual && <div className="alert alert-danger py-2 mt-2 mb-0">{usuariosErroAtual}</div>}

                  <div className="mt-3 border rounded-3 bg-white" style={{ maxHeight: "360px", overflow: "auto" }}>
                    {usuariosLoadingAtual ? (
                      <div className="p-3 text-muted">Carregando usuários...</div>
                    ) : usuariosAtual.length === 0 ? (
                      <div className="p-3 text-muted">Nenhum usuário encontrado.</div>
                    ) : (
                      usuariosAtual.map((u) => {
                        const matricula = String(u.matricula ?? "").trim();
                        const selected = usuarioSelecionadoAtual && String(usuarioSelecionadoAtual.matricula) === String(u.matricula);
                        return (
                          <button
                            key={matricula || u.nome}
                            type="button"
                            className={`btn w-100 text-start btn-sm ${selected ? "btn-primary" : "btn-light"}`}
                            style={{ borderRadius: 0 }}
                            onClick={() => {
                              if (!usuariosModalActiveInstance) return;
                              setUsuarioSelecionadoByInstance((prev) => ({ ...prev, [usuariosModalActiveInstance]: u }));
                              setShowUsuariosModal(false);
                              setUsuariosModalInstanceName(null);
                            }}
                          >
                            <div className="fw-semibold">
                              {u.nome} <span className="opacity-75">({matricula || "-"})</span>
                            </div>
                            <div className="opacity-75" style={{ fontSize: "0.7rem", lineHeight: 1.15 }}>
                              {(u.areaAtuacao || "-") + " • " + (u.funcao || "-")}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showUsuariosAcessoModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1070 }}
            onClick={() => setShowUsuariosAcessoModal(false)}
          />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ zIndex: 1075 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
              <div className="modal-content border-0" style={{ borderRadius: "16px", overflow: "hidden" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title">Selecionar usuário</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    onClick={() => setShowUsuariosAcessoModal(false)}
                  />
                </div>
                <div className="modal-body py-3">
                  <div className="d-flex flex-column flex-md-row" style={{ gap: "8px" }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={acessoUsuarioPesquisa}
                      onChange={(e) => setAcessoUsuarioPesquisa(e.target.value)}
                      placeholder="Pesquisar por matrícula, nome, área ou função"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => pesquisarUsuariosAcesso(acessoUsuarioPesquisa)}
                      disabled={acessoUsuariosLoading}
                    >
                      {acessoUsuariosLoading ? "Pesquisando..." : "Pesquisar"}
                    </button>
                  </div>

                  {acessoUsuariosErro ? <div className="alert alert-danger py-2 mt-2 mb-0">{acessoUsuariosErro}</div> : null}

                  <div className="mt-3 border rounded-3 bg-white" style={{ maxHeight: "360px", overflow: "auto" }}>
                    {acessoUsuariosLoading ? (
                      <div className="p-3 text-muted">Carregando usuários...</div>
                    ) : acessoUsuarios.length === 0 ? (
                      <div className="p-3 text-muted">Nenhum usuário encontrado.</div>
                    ) : (
                      acessoUsuarios.map((u) => {
                        const matricula = String(u.matricula ?? "").trim();
                        const selected =
                          acessoUsuarioSelecionado && String(acessoUsuarioSelecionado.matricula) === String(u.matricula);
                        return (
                          <button
                            key={matricula || u.nome}
                            type="button"
                            className={`btn w-100 text-start btn-sm ${selected ? "btn-primary" : "btn-light"}`}
                            style={{ borderRadius: 0 }}
                            onClick={() => {
                              setAcessoUsuarioSelecionado(u);
                              setShowUsuariosAcessoModal(false);
                              carregarPermissoesAcesso(u.matricula);
                            }}
                          >
                            <div className="fw-semibold">
                              {u.nome} <span className="opacity-75">({matricula || "-"})</span>
                            </div>
                            <div className="opacity-75" style={{ fontSize: "0.7rem", lineHeight: 1.15 }}>
                              {(u.areaAtuacao || "-") + " • " + (u.funcao || "-")}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showAddInstanciaModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1060 }}
            onClick={() => setShowAddInstanciaModal(false)}
          />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" style={{ zIndex: 1065 }}>
            <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "560px" }}>
              <div className="modal-content border-0" style={{ borderRadius: "16px", overflow: "hidden" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title">Adicionar instância</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    onClick={() => setShowAddInstanciaModal(false)}
                  />
                </div>
                <div className="modal-body py-3">
                  <div className="text-muted" style={{ fontSize: "0.78rem", lineHeight: 1.2 }}>
                    Informe um nome para a instância e gere o QR Code para vincular um novo número.
                  </div>
                  <div className="mt-2 d-flex flex-column flex-md-row" style={{ gap: "8px" }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={novaInstanciaNome}
                      onChange={(e) => setNovaInstanciaNome(e.target.value)}
                      placeholder="Nome da instância (ex: loja01)"
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={gerarQrNovaInstancia}
                      disabled={novaInstanciaLoading}
                    >
                      {novaInstanciaLoading ? "Gerando..." : "Gerar QR Code"}
                    </button>
                  </div>

                  {novaInstanciaErro && <div className="alert alert-danger py-2 mt-2 mb-0">{novaInstanciaErro}</div>}
                  {novaInstanciaMensagem && <div className="alert alert-success py-2 mt-2 mb-0">{novaInstanciaMensagem}</div>}

                  {(novaInstanciaQrCodeUrl || novaInstanciaPairingCode) && (
                    <div className="mt-3 d-flex flex-column align-items-center">
                      {novaInstanciaQrCodeUrl && (
                        <img
                          src={novaInstanciaQrCodeUrl}
                          alt="QRCode"
                          style={{ width: "260px", height: "260px", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)" }}
                        />
                      )}
                      {novaInstanciaPairingCode && (
                        <div className="mt-2 text-center">
                          <div className="text-muted" style={{ fontSize: "0.78rem" }}>Instância (chave)</div>
                          <div
                            className="fw-bold"
                            style={{
                              letterSpacing: "0.4px",
                              wordBreak: "break-all",
                              overflowWrap: "anywhere",
                              userSelect: "text",
                              maxWidth: "520px",
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                            }}
                          >
                            {novaInstanciaPairingCode}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm mt-3"
                        onClick={gerarQrNovaInstancia}
                        disabled={novaInstanciaLoading}
                      >
                        {novaInstanciaLoading ? "Atualizando..." : "Atualizar QR"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <MensagensModal show={showMensagensModal} onClose={() => setShowMensagensModal(false)} />
    </div>
  );
};

export default ChatHub;
