import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRepeat,
  BarChart,
  BoxSeam,
  CalendarEvent,
  Check2Circle,
  CheckCircle,
  ClipboardCheck,
  CurrencyDollar,
  Diagram3,
  Download,
  ExclamationTriangle,
  Eye,
  Folder2Open,
  Hash,
  HourglassSplit,
  ListUl,
  People,
  Person,
  Rulers,
  Tags,
  Tag,
  Upc,
  X,
  XCircle,
} from "react-bootstrap-icons";

type AuditoriaRow = {
  CODAUDITORIA: number;
  DESCRICAO: string;
  SETOR: string;
  STATUS: string;
  CODUSUARIOCRIACAO: number;
  CODUSUARIOINI?: number | null;
  CODUSUARIOFIM?: number | null;
  NOME_USUARIO_CRIACAO?: string | null;
  MATRICULA_USUARIO_CRIACAO?: number | null;
  NOME_USUARIO_INI?: string | null;
  MATRICULA_USUARIO_INI?: number | null;
  NOME_USUARIO_FIM?: string | null;
  MATRICULA_USUARIO_FIM?: number | null;
  DTCADASTRO?: string;
  DTINICIO?: string | null;
  DTFINALIZACAO?: string | null;
  QTITENS?: number;
  QTDIVERGENCIAS?: number;
  OBSERVACAO?: string | null;
};

type AuditoriaProdutoRow = {
  CODAUDITORIAPROD: number;
  CODAUDITORIA: number;
  CODPROD: number;
  CODAUXILIAR?: string | null;
  PRECO_ETIQUETA?: number | null;
  PRECO_SISTEMA?: number | null;
  PRECO_PROMOCIONAL?: number | null;
  CODPRECOPROM?: number | null;
  STATUS_CAMPANHA?: string | null;
  DIVERGENTE?: string;
  DTCONFERENCIA?: string | null;
  OBSERVACAO?: string | null;
  QT_ETIQUETA?: number | null;
  COD_BARRAS_ERRADO?: string | null;
  COD_INTERNO_ERRADO?: string | null;
  UN_MEDIDA_ERRADO?: string | null;
  SEM_ETIQUETA?: string | null;
};

interface AuditoriaModalProps {
  onClose: () => void;
}

type AuditoriaResumoDia = {
  data: string;
  dataFormatada: string;
  resumo: {
    qtAuditorias: number;
    qtAberta: number;
    qtEmAndamento: number;
    qtFinalizada: number;
    qtCancelada: number;
    qtProdutos: number;
    qtDivergencias: number;
    qtProdutosOk: number;
    qtPrecoDivergente: number;
    qtBarrasErrado: number;
    qtCodInternoErrado: number;
    qtUnMedidaErrado: number;
    qtSemEtiqueta: number;
    qtEtiquetas: number;
  };
  porSetor: Array<{
    SETOR: string;
    QT_AUDITORIAS: number;
    QT_PRODUTOS: number;
    QT_DIVERGENCIAS: number;
  }>;
  porUsuario: Array<{
    NOME_USUARIO: string;
    COD_USUARIO: number | null;
    QT_AUDITORIAS: number;
    QT_PRODUTOS: number;
    QT_DIVERGENCIAS: number;
    QT_PRODUTOS_OK: number;
  }>;
  auditorias: AuditoriaRow[];
};

const hojeISO = () => {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const formatarDataBR = (iso: string) => {
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
};

const statusBadgeClass = (status: string) => {
  const s = String(status || "").toUpperCase();
  if (s === "ABERTA") return "bg-primary";
  if (s === "EM_ANDAMENTO") return "bg-warning text-dark";
  if (s === "FINALIZADA") return "bg-success";
  if (s === "CANCELADA") return "bg-secondary";
  return "bg-light text-dark";
};

const formatUsuarioAuditoria = (
  nome?: string | null,
  matricula?: number | null,
  codUsuario?: number | null
) => {
  const nomeFmt = String(nome || "").trim();
  const matriculaFmt =
    matricula != null
      ? String(matricula)
      : codUsuario != null
        ? String(codUsuario)
        : "";
  if (nomeFmt && matriculaFmt) return `${nomeFmt} (${matriculaFmt})`;
  return nomeFmt || matriculaFmt || "-";
};

const LINHA_VERTICAL_STYLE: React.CSSProperties = {
  width: "3px",
  borderRadius: "2px",
  backgroundColor: "#0d6efd",
  flexShrink: 0,
};

const CELULA_RESUMO_STYLE: React.CSSProperties = {
  width: "16.666%",
  padding: "4px 8px",
  fontSize: "0.78rem",
  lineHeight: 1.2,
  verticalAlign: "top",
};

const CelulaResumo: React.FC<{
  label: string;
  children: React.ReactNode;
  danger?: boolean;
  comBordaEsquerda?: boolean;
}> = ({ label, children, danger, comBordaEsquerda = false }) => (
  <td
    style={{
      ...CELULA_RESUMO_STYLE,
      borderLeft: comBordaEsquerda ? "1px solid #dee2e6" : undefined,
    }}
  >
    <div className="text-muted text-truncate" style={{ fontSize: "0.68rem" }}>
      {label}
    </div>
    <div
      className={`fw-medium text-truncate ${danger ? "text-danger" : "text-dark"}`}
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </div>
  </td>
);

const renderResumoAuditoria = (
  auditoria: AuditoriaRow,
  footer?: React.ReactNode
) => (
  <div className="card shadow-sm">
    <div className="card-body py-2 px-3">
      <div className="d-flex align-items-stretch gap-2">
        <div aria-hidden style={LINHA_VERTICAL_STYLE} />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <table
            className="mb-0"
            style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}
          >
            <tbody>
              <tr>
                <CelulaResumo label="Descrição">
                  <span className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                    {auditoria.DESCRICAO}
                  </span>
                </CelulaResumo>
                <CelulaResumo label="Status" comBordaEsquerda>
                  <span className={`badge ${statusBadgeClass(auditoria.STATUS)}`} style={{ fontSize: "0.68rem" }}>
                    {auditoria.STATUS}
                  </span>
                </CelulaResumo>
                <CelulaResumo label="Setor" comBordaEsquerda>
                  {auditoria.SETOR || "-"}
                </CelulaResumo>
                <CelulaResumo label="Itens" comBordaEsquerda>
                  {auditoria.QTITENS ?? 0}
                </CelulaResumo>
                <CelulaResumo label="Divergências" comBordaEsquerda danger={Number(auditoria.QTDIVERGENCIAS || 0) > 0}>
                  {auditoria.QTDIVERGENCIAS ?? 0}
                </CelulaResumo>
                <CelulaResumo label="Cadastro" comBordaEsquerda>
                  {auditoria.DTCADASTRO || "-"}
                </CelulaResumo>
              </tr>
              <tr>
                <CelulaResumo label="Criado por">
                  {formatUsuarioAuditoria(
                    auditoria.NOME_USUARIO_CRIACAO,
                    auditoria.MATRICULA_USUARIO_CRIACAO,
                    auditoria.CODUSUARIOCRIACAO
                  )}
                </CelulaResumo>
                <CelulaResumo label="Início" comBordaEsquerda>
                  {auditoria.DTINICIO || "-"}
                </CelulaResumo>
                <CelulaResumo label="Iniciado por" comBordaEsquerda>
                  {auditoria.DTINICIO
                    ? formatUsuarioAuditoria(
                        auditoria.NOME_USUARIO_INI,
                        auditoria.MATRICULA_USUARIO_INI,
                        null
                      )
                    : "-"}
                </CelulaResumo>
                <CelulaResumo label="Finalização" comBordaEsquerda>
                  {auditoria.DTFINALIZACAO || "-"}
                </CelulaResumo>
                <CelulaResumo label="Finalizado por" comBordaEsquerda>
                  {auditoria.DTFINALIZACAO
                    ? formatUsuarioAuditoria(
                        auditoria.NOME_USUARIO_FIM,
                        auditoria.MATRICULA_USUARIO_FIM,
                        null
                      )
                    : "-"}
                </CelulaResumo>
                <CelulaResumo label="Observação" comBordaEsquerda>
                  {auditoria.OBSERVACAO || "-"}
                </CelulaResumo>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    {footer}
  </div>
);

type AbaProdutosAuditoria = "ok" | "divergentes";

type StatusAuditoria = "ABERTA" | "EM_ANDAMENTO" | "FINALIZADA" | "CANCELADA";
type AbaStatusAuditoria = "todas" | StatusAuditoria;

const STATUS_AUDITORIA_TABS: Array<{ id: AbaStatusAuditoria; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "ABERTA", label: "Abertas" },
  { id: "EM_ANDAMENTO", label: "Em andamento" },
  { id: "FINALIZADA", label: "Finalizadas" },
  { id: "CANCELADA", label: "Canceladas" },
];

const statusAuditoriaBadgeClass = (status: AbaStatusAuditoria) => {
  if (status === "ABERTA") return "bg-primary";
  if (status === "EM_ANDAMENTO") return "bg-warning text-dark";
  if (status === "FINALIZADA") return "bg-success";
  if (status === "CANCELADA") return "bg-secondary";
  return "bg-dark";
};

const normalizarStatusAuditoria = (status: string): StatusAuditoria | null => {
  const s = String(status || "").trim().toUpperCase();
  if (s === "ABERTA" || s === "EM_ANDAMENTO" || s === "FINALIZADA" || s === "CANCELADA") {
    return s;
  }
  return null;
};

const formatFlagErrado = (valor?: string | null) => {
  const v = String(valor || "N").trim().toUpperCase();
  if (v === "S") {
    return <span className="badge bg-danger">Sim</span>;
  }
  return <span className="text-muted">Não</span>;
};

const isFlagSim = (valor?: string | null) => String(valor || "").trim().toUpperCase() === "S";

const isProdutoDivergente = (row: AuditoriaProdutoRow) =>
  isFlagSim(row.DIVERGENTE) ||
  isFlagSim(row.COD_BARRAS_ERRADO) ||
  isFlagSim(row.COD_INTERNO_ERRADO) ||
  isFlagSim(row.UN_MEDIDA_ERRADO) ||
  isFlagSim(row.SEM_ETIQUETA);

const COLUNAS_PRODUTO_TOTAL = 12;

/** Altura de referência do card "Tipos de divergência" + folga para "Auditorias do dia". */
const ALTURA_MIN_BLOCO_AUDITORIAS_DIA = 220;
const ALTURA_MIN_CARD_AUDITORIAS_DIA = ALTURA_MIN_BLOCO_AUDITORIAS_DIA * 2 + 72;

const nomeUsuarioResumoAuditoria = (row: AuditoriaRow) => {
  if (row.NOME_USUARIO_FIM || row.MATRICULA_USUARIO_FIM || row.CODUSUARIOFIM) {
    return formatUsuarioAuditoria(row.NOME_USUARIO_FIM, row.MATRICULA_USUARIO_FIM, row.CODUSUARIOFIM);
  }
  if (row.NOME_USUARIO_INI || row.MATRICULA_USUARIO_INI || row.CODUSUARIOINI) {
    return formatUsuarioAuditoria(row.NOME_USUARIO_INI, row.MATRICULA_USUARIO_INI, row.CODUSUARIOINI);
  }
  return formatUsuarioAuditoria(
    row.NOME_USUARIO_CRIACAO,
    row.MATRICULA_USUARIO_CRIACAO,
    row.CODUSUARIOCRIACAO
  );
};

const TabelaAuditoriasDia: React.FC<{ rows: AuditoriaRow[] }> = ({ rows }) => (
  <table
    className="table table-sm table-hover mb-0 align-middle"
    style={{ width: "100%", tableLayout: "fixed" }}
  >
    <colgroup>
      <col style={{ width: "7%" }} />
      <col style={{ width: "24%" }} />
      <col style={{ width: "20%" }} />
      <col style={{ width: "17%" }} />
      <col style={{ width: "16%" }} />
      <col style={{ width: "8%" }} />
      <col style={{ width: "8%" }} />
    </colgroup>
    <thead className="table-light sticky-top">
      <tr style={{ fontSize: "0.72rem" }}>
        <th className="text-truncate">#</th>
        <th className="text-truncate">Descrição</th>
        <th className="text-truncate">
          <Person size={12} className="me-1 text-muted" />
          Usuário
        </th>
        <th className="text-truncate">Setor</th>
        <th className="text-truncate">Status</th>
        <th className="text-center text-truncate">It.</th>
        <th className="text-center text-truncate">Div.</th>
      </tr>
    </thead>
    <tbody style={{ fontSize: "0.75rem" }}>
      {rows.map((row) => {
        const nomeUsuario = nomeUsuarioResumoAuditoria(row);
        return (
          <tr key={row.CODAUDITORIA}>
            <td className="text-muted text-truncate" title={String(row.CODAUDITORIA)}>
              {row.CODAUDITORIA}
            </td>
            <td className="text-truncate" title={row.DESCRICAO}>
              {row.DESCRICAO}
            </td>
            <td className="text-truncate" title={nomeUsuario}>
              {nomeUsuario}
            </td>
            <td className="text-truncate" title={row.SETOR || "-"}>
              {row.SETOR || "-"}
            </td>
            <td className="text-truncate">
              <span
                className={`badge ${statusBadgeClass(row.STATUS)}`}
                style={{ fontSize: "0.6rem", maxWidth: "100%" }}
                title={row.STATUS}
              >
                {row.STATUS}
              </span>
            </td>
            <td className="text-center">{row.QTITENS ?? 0}</td>
            <td className={`text-center ${Number(row.QTDIVERGENCIAS || 0) > 0 ? "text-danger fw-semibold" : ""}`}>
              {row.QTDIVERGENCIAS ?? 0}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const BlocoAuditoriasDia: React.FC<{ titulo: string; rows: AuditoriaRow[] }> = ({ titulo, rows }) => (
  <div
    className="card border shadow-sm d-flex flex-column flex-grow-1"
    style={{ minHeight: ALTURA_MIN_BLOCO_AUDITORIAS_DIA }}
  >
    <div
      className="card-header py-1 px-2 fw-semibold d-flex align-items-center gap-2 bg-white"
      style={{ fontSize: "0.72rem" }}
    >
      <ListUl size={13} className="text-primary" />
      {titulo}
      <span className="badge bg-light text-dark border ms-auto" style={{ fontSize: "0.62rem" }}>
        {rows.length}
      </span>
    </div>
    <div className="card-body p-0 flex-grow-1 overflow-auto">
      <TabelaAuditoriasDia rows={rows} />
    </div>
  </div>
);

const CardResumoDia: React.FC<{
  label: string;
  valor: number | string;
  icon: React.ReactNode;
  danger?: boolean;
  success?: boolean;
  muted?: boolean;
}> = ({ label, valor, icon, danger, success, muted }) => (
  <div className="col-6">
    <div
      className="d-flex align-items-center gap-2 rounded px-2 py-1 h-100"
      style={{ backgroundColor: "#f8f9fa", minHeight: "44px" }}
    >
      <span
        className={`d-flex align-items-center justify-content-center flex-shrink-0 ${
          danger ? "text-danger" : success ? "text-success" : muted ? "text-secondary" : "text-primary"
        }`}
        style={{ width: "22px" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-grow-1">
        <div className="text-muted text-truncate" style={{ fontSize: "0.62rem", lineHeight: 1.1 }}>
          {label}
        </div>
        <div
          className={`fw-semibold ${danger ? "text-danger" : success ? "text-success" : "text-dark"}`}
          style={{ fontSize: "0.95rem", lineHeight: 1.2 }}
        >
          {valor}
        </div>
      </div>
    </div>
  </div>
);

const SecaoResumoDia: React.FC<{
  titulo: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ titulo, icon, children }) => (
  <div className="col-12 col-xl-4">
    <div className="card shadow-sm h-100">
      <div className="card-header py-2 d-flex align-items-center gap-2" style={{ fontSize: "0.78rem" }}>
        <span className="text-primary d-flex">{icon}</span>
        <span className="fw-semibold">{titulo}</span>
      </div>
      <div className="card-body p-2">
        <div className="row g-1">{children}</div>
      </div>
    </div>
  </div>
);

const AuditoriaModal: React.FC<AuditoriaModalProps> = ({ onClose }) => {
  const [auditorias, setAuditorias] = useState<AuditoriaRow[]>([]);
  const [loadingAuditorias, setLoadingAuditorias] = useState(false);
  const [errorAuditorias, setErrorAuditorias] = useState<string | null>(null);

  const [auditoriaSelecionada, setAuditoriaSelecionada] = useState<AuditoriaRow | null>(null);
  const [produtos, setProdutos] = useState<AuditoriaProdutoRow[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [errorProdutos, setErrorProdutos] = useState<string | null>(null);
  const [abaProdutos, setAbaProdutos] = useState<AbaProdutosAuditoria>("ok");
  const [abaStatusAuditorias, setAbaStatusAuditorias] = useState<AbaStatusAuditoria>("todas");
  const [dataResumo, setDataResumo] = useState(hojeISO);
  const [showResumoDia, setShowResumoDia] = useState(false);
  const [loadingResumoDia, setLoadingResumoDia] = useState(false);
  const [errorResumoDia, setErrorResumoDia] = useState<string | null>(null);
  const [resumoDia, setResumoDia] = useState<AuditoriaResumoDia | null>(null);

  const carregarAuditorias = useCallback(async () => {
    setLoadingAuditorias(true);
    setErrorAuditorias(null);
    try {
      const params = new URLSearchParams();
      if (dataResumo) params.set("data", dataResumo);
      const query = params.toString();
      const resp = await fetch(
        query ? `/apis/gestpro/auditoria/usuario?${query}` : "/apis/gestpro/auditoria/usuario"
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(String(data?.message || "Erro ao listar auditorias"));
      setAuditorias(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      setErrorAuditorias(err instanceof Error ? err.message : "Erro ao listar auditorias");
      setAuditorias([]);
    } finally {
      setLoadingAuditorias(false);
    }
  }, [dataResumo]);

  const carregarProdutos = useCallback(async (codAuditoria: number) => {
    setLoadingProdutos(true);
    setErrorProdutos(null);
    try {
      const resp = await fetch(
        `/apis/gestpro/auditoria/produtos?codAuditoria=${encodeURIComponent(String(codAuditoria))}`
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(String(data?.message || "Erro ao listar produtos"));
      setProdutos(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      setErrorProdutos(err instanceof Error ? err.message : "Erro ao listar produtos");
      setProdutos([]);
    } finally {
      setLoadingProdutos(false);
    }
  }, []);

  useEffect(() => {
    void carregarAuditorias();
  }, [carregarAuditorias]);

  useEffect(() => {
    if (!auditoriaSelecionada?.CODAUDITORIA) {
      setProdutos([]);
      return;
    }
    void carregarProdutos(auditoriaSelecionada.CODAUDITORIA);
  }, [auditoriaSelecionada, carregarProdutos]);

  const handleAbrirProdutos = (row: AuditoriaRow) => {
    setAbaProdutos("ok");
    setAuditoriaSelecionada(row);
    setErrorProdutos(null);
  };

  const carregarResumoDia = useCallback(async () => {
    if (!dataResumo) {
      setErrorResumoDia("Selecione uma data");
      return;
    }
    setLoadingResumoDia(true);
    setErrorResumoDia(null);
    try {
      const resp = await fetch(
        `/apis/gestpro/auditoria/resumo-dia?data=${encodeURIComponent(dataResumo)}`
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(String(data?.message || "Erro ao gerar resumo do dia"));
      setResumoDia(data as AuditoriaResumoDia);
      setShowResumoDia(true);
    } catch (err) {
      setErrorResumoDia(err instanceof Error ? err.message : "Erro ao gerar resumo do dia");
      setResumoDia(null);
    } finally {
      setLoadingResumoDia(false);
    }
  }, [dataResumo]);

  const handleAbrirResumoDia = () => {
    void carregarResumoDia();
  };

  const handleFecharResumoDia = () => {
    setShowResumoDia(false);
  };

  const handleAtualizar = () => {
    void carregarAuditorias();
    if (auditoriaSelecionada?.CODAUDITORIA) {
      void carregarProdutos(auditoriaSelecionada.CODAUDITORIA);
    }
  };

  const contagemPorStatusAuditoria = useMemo(() => {
    const counts: Record<AbaStatusAuditoria, number> = {
      todas: auditorias.length,
      ABERTA: 0,
      EM_ANDAMENTO: 0,
      FINALIZADA: 0,
      CANCELADA: 0,
    };
    for (const row of auditorias) {
      const status = normalizarStatusAuditoria(row.STATUS);
      if (status) counts[status] += 1;
    }
    return counts;
  }, [auditorias]);

  const auditoriasFiltradas = useMemo(() => {
    if (abaStatusAuditorias === "todas") return auditorias;
    return auditorias.filter(
      (row) => normalizarStatusAuditoria(row.STATUS) === abaStatusAuditorias
    );
  }, [auditorias, abaStatusAuditorias]);

  const labelAbaStatusAuditoria = useMemo(
    () => STATUS_AUDITORIA_TABS.find((tab) => tab.id === abaStatusAuditorias)?.label || "Todas",
    [abaStatusAuditorias]
  );

  const produtosOk = useMemo(
    () => produtos.filter((row) => !isProdutoDivergente(row)),
    [produtos]
  );
  const produtosDivergentes = useMemo(
    () => produtos.filter((row) => isProdutoDivergente(row)),
    [produtos]
  );
  const produtosVisiveis = abaProdutos === "ok" ? produtosOk : produtosDivergentes;

  const handleBaixarBarrasDivergentes = () => {
    const linhas = produtosDivergentes
      .map((row) => String(row.CODAUXILIAR || "").trim())
      .filter(Boolean);
    const conteudo = linhas.join("\n");
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `auditoria-${auditoriaSelecionada?.CODAUDITORIA ?? "divergentes"}-barras.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderModalResumoDia = () => {
    if (!showResumoDia) return null;
    const resumo = resumoDia?.resumo;
    const temPorSetor = (resumoDia?.porSetor || []).length > 0;
    const temPorUsuario = (resumoDia?.porUsuario || []).length > 0;
    const temCardsLaterais = temPorSetor || temPorUsuario;
    const auditoriasDia = resumoDia?.auditorias || [];
    const meioAuditorias = Math.ceil(auditoriasDia.length / 2);
    const auditoriasColEsquerda = auditoriasDia.slice(0, meioAuditorias);
    const auditoriasColDireita = auditoriasDia.slice(meioAuditorias);

    return (
      <>
        <div
          className="modal-backdrop fade show"
          style={{ zIndex: 4600, backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={handleFecharResumoDia}
        />
        <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4610 }}>
          <div className="modal-dialog modal-fullscreen">
            <div className="modal-content d-flex flex-column">
              <div className="modal-header py-2 flex-shrink-0">
                <h6 className="modal-title mb-0 d-flex align-items-center" style={{ fontSize: "0.9rem" }}>
                  <BarChart className="me-2 text-primary" />
                  Resumo geral — {resumoDia?.dataFormatada || formatarDataBR(dataResumo)}
                </h6>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-flex align-items-center"
                    disabled={loadingResumoDia}
                    onClick={() => void carregarResumoDia()}
                  >
                    <ArrowRepeat className="me-1" />
                    Atualizar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center"
                    onClick={handleFecharResumoDia}
                    aria-label="Fechar"
                  >
                    <X className="me-1" />
                    Fechar
                  </button>
                </div>
              </div>
              <div
                className="modal-body p-2 flex-grow-1 overflow-auto"
                style={{ fontSize: "0.8rem", backgroundColor: "#f0f2f5" }}
              >
                {loadingResumoDia && (
                  <div className="d-flex align-items-center justify-content-center gap-2 text-muted py-5">
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    Gerando resumo...
                  </div>
                )}
                {!loadingResumoDia && errorResumoDia && (
                  <div className="alert alert-danger py-2 mb-0 d-flex align-items-center gap-2">
                    <ExclamationTriangle />
                    {errorResumoDia}
                  </div>
                )}
                {!loadingResumoDia && resumo && (
                  <div className="d-flex flex-column gap-2 h-100">
                    <div className="row g-2">
                      <SecaoResumoDia titulo="Auditorias" icon={<ClipboardCheck size={16} />}>
                        <CardResumoDia label="Total" valor={resumo.qtAuditorias} icon={<ClipboardCheck size={14} />} />
                        <CardResumoDia label="Finalizadas" valor={resumo.qtFinalizada} icon={<CheckCircle size={14} />} success />
                        <CardResumoDia label="Em andamento" valor={resumo.qtEmAndamento} icon={<HourglassSplit size={14} />} />
                        <CardResumoDia label="Abertas" valor={resumo.qtAberta} icon={<Folder2Open size={14} />} />
                        <CardResumoDia label="Canceladas" valor={resumo.qtCancelada} icon={<XCircle size={14} />} muted />
                      </SecaoResumoDia>

                      <SecaoResumoDia titulo="Produtos conferidos" icon={<BoxSeam size={16} />}>
                        <CardResumoDia label="Total produtos" valor={resumo.qtProdutos} icon={<BoxSeam size={14} />} />
                        <CardResumoDia label="Produtos OK" valor={resumo.qtProdutosOk} icon={<Check2Circle size={14} />} success />
                        <CardResumoDia label="Divergências" valor={resumo.qtDivergencias} icon={<ExclamationTriangle size={14} />} danger={resumo.qtDivergencias > 0} />
                        <CardResumoDia label="Qt. etiquetas" valor={resumo.qtEtiquetas} icon={<Tags size={14} />} />
                      </SecaoResumoDia>

                      <SecaoResumoDia titulo="Tipos de divergência" icon={<ExclamationTriangle size={16} />}>
                        <CardResumoDia label="Preço divergente" valor={resumo.qtPrecoDivergente} icon={<CurrencyDollar size={14} />} danger={resumo.qtPrecoDivergente > 0} />
                        <CardResumoDia label="Barras errado" valor={resumo.qtBarrasErrado} icon={<Upc size={14} />} danger={resumo.qtBarrasErrado > 0} />
                        <CardResumoDia label="Cód. interno errado" valor={resumo.qtCodInternoErrado} icon={<Hash size={14} />} danger={resumo.qtCodInternoErrado > 0} />
                        <CardResumoDia label="Un. medida errado" valor={resumo.qtUnMedidaErrado} icon={<Rulers size={14} />} danger={resumo.qtUnMedidaErrado > 0} />
                        <CardResumoDia label="Sem etiqueta" valor={resumo.qtSemEtiqueta} icon={<Tag size={14} />} danger={resumo.qtSemEtiqueta > 0} />
                      </SecaoResumoDia>
                    </div>

                    <div className="row g-2 align-items-stretch">
                      {temCardsLaterais && (
                        <div className="col-12 col-xl-4 d-flex flex-column gap-2">
                          {temPorSetor && (
                            <div className="card shadow-sm flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>
                              <div className="card-header py-2 fw-semibold d-flex align-items-center gap-2" style={{ fontSize: "0.78rem" }}>
                                <Diagram3 size={15} className="text-primary" />
                                Por setor
                              </div>
                              <div className="card-body p-0 flex-grow-1 overflow-auto">
                                <table className="table table-sm table-hover mb-0 align-middle">
                                  <thead className="table-light sticky-top">
                                    <tr style={{ fontSize: "0.72rem" }}>
                                      <th><Diagram3 size={12} className="me-1 text-muted" />Setor</th>
                                      <th className="text-center"><ClipboardCheck size={12} className="me-1 text-muted" />Aud.</th>
                                      <th className="text-center"><BoxSeam size={12} className="me-1 text-muted" />Prod.</th>
                                      <th className="text-center"><ExclamationTriangle size={12} className="me-1 text-muted" />Div.</th>
                                    </tr>
                                  </thead>
                                  <tbody style={{ fontSize: "0.75rem" }}>
                                    {(resumoDia?.porSetor || []).map((row) => (
                                      <tr key={row.SETOR}>
                                        <td className="text-truncate" style={{ maxWidth: "140px" }} title={row.SETOR}>
                                          {row.SETOR}
                                        </td>
                                        <td className="text-center">{row.QT_AUDITORIAS ?? 0}</td>
                                        <td className="text-center">{row.QT_PRODUTOS ?? 0}</td>
                                        <td className={`text-center ${Number(row.QT_DIVERGENCIAS || 0) > 0 ? "text-danger fw-semibold" : ""}`}>
                                          {row.QT_DIVERGENCIAS ?? 0}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {temPorUsuario && (
                            <div className="card shadow-sm flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}>
                              <div className="card-header py-2 fw-semibold d-flex align-items-center gap-2" style={{ fontSize: "0.78rem" }}>
                                <People size={15} className="text-primary" />
                                Por usuário
                                <span className="badge bg-secondary ms-1" style={{ fontSize: "0.65rem" }}>
                                  {(resumoDia?.porUsuario || []).length}
                                </span>
                              </div>
                              <div className="card-body p-0 flex-grow-1 overflow-auto">
                                <table className="table table-sm table-hover mb-0 align-middle">
                                  <thead className="table-light sticky-top">
                                    <tr style={{ fontSize: "0.72rem" }}>
                                      <th><Person size={12} className="me-1 text-muted" />Usuário</th>
                                      <th className="text-center"><ClipboardCheck size={12} className="me-1 text-muted" />Aud.</th>
                                      <th className="text-center"><BoxSeam size={12} className="me-1 text-muted" />Prod.</th>
                                      <th className="text-center"><Check2Circle size={12} className="me-1 text-muted" />OK</th>
                                      <th className="text-center"><ExclamationTriangle size={12} className="me-1 text-muted" />Div.</th>
                                    </tr>
                                  </thead>
                                  <tbody style={{ fontSize: "0.75rem" }}>
                                    {(resumoDia?.porUsuario || []).map((row) => {
                                      const chave = `${row.COD_USUARIO ?? "null"}-${row.NOME_USUARIO}`;
                                      const nomeExibicao = formatUsuarioAuditoria(row.NOME_USUARIO, null, row.COD_USUARIO);
                                      return (
                                        <tr key={chave}>
                                          <td className="text-truncate" style={{ maxWidth: "160px" }} title={nomeExibicao}>
                                            {nomeExibicao}
                                          </td>
                                          <td className="text-center">{row.QT_AUDITORIAS ?? 0}</td>
                                          <td className="text-center">{row.QT_PRODUTOS ?? 0}</td>
                                          <td className="text-center text-success">{row.QT_PRODUTOS_OK ?? 0}</td>
                                          <td className={`text-center ${Number(row.QT_DIVERGENCIAS || 0) > 0 ? "text-danger fw-semibold" : ""}`}>
                                            {row.QT_DIVERGENCIAS ?? 0}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`col-12 ${temCardsLaterais ? "col-xl-8" : ""} d-flex flex-column`}>
                        {auditoriasDia.length > 0 ? (
                          <div
                            className="card shadow-sm d-flex flex-column flex-grow-1"
                            style={{ minHeight: ALTURA_MIN_CARD_AUDITORIAS_DIA }}
                          >
                            <div className="card-header py-2 fw-semibold d-flex align-items-center gap-2" style={{ fontSize: "0.78rem" }}>
                              <ListUl size={15} className="text-primary" />
                              Auditorias do dia
                              <span className="badge bg-secondary ms-1" style={{ fontSize: "0.65rem" }}>
                                {auditoriasDia.length}
                              </span>
                            </div>
                            <div className="card-body p-2 d-flex flex-column gap-2 flex-grow-1 overflow-auto">
                              {auditoriasColEsquerda.length > 0 && (
                                <BlocoAuditoriasDia
                                  titulo={auditoriasColDireita.length > 0 ? "1ª parte" : "Lista completa"}
                                  rows={auditoriasColEsquerda}
                                />
                              )}
                              {auditoriasColDireita.length > 0 && (
                                <BlocoAuditoriasDia titulo="2ª parte" rows={auditoriasColDireita} />
                              )}
                            </div>
                          </div>
                        ) : (
                          <div
                            className="alert alert-light border mb-0 py-2 d-flex align-items-center gap-2"
                            style={{ minHeight: ALTURA_MIN_CARD_AUDITORIAS_DIA }}
                          >
                            <ClipboardCheck className="text-muted" />
                            Nenhuma auditoria encontrada para esta data.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const getColunaProdutoStyle = (index: number): React.CSSProperties => ({
    width: `${100 / COLUNAS_PRODUTO_TOTAL}%`,
    minWidth: index <= 1 ? "72px" : "88px",
    padding: "0.5rem 0.5rem",
    verticalAlign: "middle",
    fontSize: "0.78rem",
    ...(index > 0 ? { borderLeft: "1px solid #dee2e6" } : {}),
  });

  const renderTabelaProdutos = (lista: AuditoriaProdutoRow[]) => (
    <div className="table-responsive">
      <table
        className="table table-sm table-hover mb-0 align-middle"
        style={{ tableLayout: "fixed", width: "100%", minWidth: "1280px", borderCollapse: "separate", borderSpacing: 0 }}
      >
        <thead className="table-light">
          <tr>
            <th className="text-center" style={getColunaProdutoStyle(0)}>Cód.</th>
            <th className="text-center" style={getColunaProdutoStyle(1)}>Barras</th>
            <th className="text-center" style={getColunaProdutoStyle(2)}>Qt. etiqueta</th>
            <th className="text-center" style={getColunaProdutoStyle(3)}>Preço etiqueta</th>
            <th className="text-center" style={getColunaProdutoStyle(4)}>Preço sistema</th>
            <th className="text-center" style={getColunaProdutoStyle(5)}>Preço promo</th>
            <th className="text-center" style={getColunaProdutoStyle(6)}>Barras err.</th>
            <th className="text-center" style={getColunaProdutoStyle(7)}>Cód. int. err.</th>
            <th className="text-center" style={getColunaProdutoStyle(8)}>Un. med. err.</th>
            <th className="text-center" style={getColunaProdutoStyle(9)}>Sem etiqueta</th>
            <th className="text-center" style={getColunaProdutoStyle(10)}>Conferência</th>
            <th className="text-center" style={getColunaProdutoStyle(11)}>Observação</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((row) => (
            <tr key={row.CODAUDITORIAPROD}>
              <td className="text-center text-truncate" style={getColunaProdutoStyle(0)}>{row.CODPROD}</td>
              <td className="text-center text-truncate" style={getColunaProdutoStyle(1)}>{row.CODAUXILIAR || "-"}</td>
              <td className="text-center text-truncate" style={getColunaProdutoStyle(2)}>{row.QT_ETIQUETA ?? "-"}</td>
              <td className="text-center text-truncate" style={getColunaProdutoStyle(3)}>{row.PRECO_ETIQUETA ?? "-"}</td>
              <td className="text-center text-truncate" style={getColunaProdutoStyle(4)}>{row.PRECO_SISTEMA ?? "-"}</td>
              <td
                className={`text-center text-truncate ${row.PRECO_PROMOCIONAL != null ? "text-success fw-semibold" : ""}`}
                style={getColunaProdutoStyle(5)}
                title={row.STATUS_CAMPANHA === "ATIVA" ? "Promoção ativa" : undefined}
              >
                {row.PRECO_PROMOCIONAL ?? "-"}
              </td>
              <td className="text-center" style={getColunaProdutoStyle(6)}>{formatFlagErrado(row.COD_BARRAS_ERRADO)}</td>
              <td className="text-center" style={getColunaProdutoStyle(7)}>{formatFlagErrado(row.COD_INTERNO_ERRADO)}</td>
              <td className="text-center" style={getColunaProdutoStyle(8)}>{formatFlagErrado(row.UN_MEDIDA_ERRADO)}</td>
              <td className="text-center" style={getColunaProdutoStyle(9)}>{formatFlagErrado(row.SEM_ETIQUETA)}</td>
              <td className="text-center text-truncate" style={getColunaProdutoStyle(10)}>{row.DTCONFERENCIA || "-"}</td>
              <td className="text-center text-truncate" style={getColunaProdutoStyle(11)} title={row.OBSERVACAO || undefined}>
                {row.OBSERVACAO || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 4500, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4510 }}>
        <div className="modal-dialog modal-fullscreen">
          <div className="modal-content d-flex flex-column h-100">
            <div className="modal-header py-2 d-flex align-items-center flex-shrink-0">
              <h5 className="modal-title mb-0 d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                <ClipboardCheck className="me-2" />
                {auditoriaSelecionada ? `Auditoria #${auditoriaSelecionada.CODAUDITORIA}` : "Auditoria"}
              </h5>
              {auditoriaSelecionada && (
                <span className={`badge ms-2 ${statusBadgeClass(auditoriaSelecionada.STATUS)}`}>
                  {auditoriaSelecionada.STATUS}
                </span>
              )}
              <div className="d-flex align-items-center gap-2 ms-auto">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center"
                  onClick={handleAtualizar}
                  disabled={loadingAuditorias || loadingProdutos}
                >
                  <ArrowRepeat className="me-1" />
                  Atualizar
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-flex align-items-center"
                  onClick={auditoriaSelecionada ? () => setAuditoriaSelecionada(null) : onClose}
                >
                  <ArrowLeft className="me-1" />
                  Voltar
                </button>
              </div>
            </div>

            <div
              className="modal-body d-flex flex-column flex-grow-1 overflow-hidden"
              style={{ fontSize: "0.9rem", backgroundColor: "#f8f9fa", minHeight: 0 }}
            >
              {!auditoriaSelecionada ? (
                <div className="card shadow-sm h-100 d-flex flex-column overflow-hidden">
                  <div className="card-header py-2 d-flex flex-wrap justify-content-between align-items-center gap-2 flex-shrink-0">
                    <span className="fw-semibold">Todas as auditorias</span>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <label className="text-muted mb-0 d-flex align-items-center gap-1" style={{ fontSize: "0.78rem" }}>
                          <CalendarEvent />
                          Data
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          style={{ width: "145px" }}
                          value={dataResumo}
                          onChange={(e) => setDataResumo(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        onClick={handleAbrirResumoDia}
                        disabled={loadingResumoDia || !dataResumo}
                      >
                        <BarChart className="me-1" />
                        {loadingResumoDia ? "Gerando..." : "Resumo do dia"}
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2 border-bottom bg-white flex-shrink-0">
                    <ul className="nav nav-pills flex-wrap mb-0" style={{ gap: "0.35rem" }}>
                      {STATUS_AUDITORIA_TABS.map((tab) => (
                        <li className="nav-item" key={tab.id}>
                          <button
                            type="button"
                            className={`nav-link py-1 px-3 ${abaStatusAuditorias === tab.id ? "active" : ""}`}
                            onClick={() => setAbaStatusAuditorias(tab.id)}
                          >
                            {tab.label}
                            <span
                              className={`badge ms-2 ${statusAuditoriaBadgeClass(tab.id)}`}
                              style={{ fontSize: "0.65rem" }}
                            >
                              {contagemPorStatusAuditoria[tab.id]}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="card-body p-0 flex-grow-1 overflow-auto" style={{ minHeight: 0 }}>
                    {errorResumoDia && !showResumoDia && (
                      <div className="alert alert-warning m-3 py-2 mb-0">{errorResumoDia}</div>
                    )}
                    {loadingAuditorias && (
                      <div className="p-3 text-muted">Carregando auditorias...</div>
                    )}
                    {errorAuditorias && (
                      <div className="alert alert-danger m-3 py-2">{errorAuditorias}</div>
                    )}
                    {!loadingAuditorias && !errorAuditorias && auditorias.length === 0 && (
                      <div className="p-3 text-muted">
                        Nenhuma auditoria encontrada para {formatarDataBR(dataResumo)}.
                      </div>
                    )}
                    {!loadingAuditorias && auditorias.length > 0 && auditoriasFiltradas.length === 0 && (
                      <div className="p-3 text-muted">
                        Nenhuma auditoria com status &quot;{labelAbaStatusAuditoria}&quot; em{" "}
                        {formatarDataBR(dataResumo)}.
                      </div>
                    )}
                    {!loadingAuditorias && auditoriasFiltradas.length > 0 && (
                      <div className="d-flex flex-column gap-3 p-3">
                        {auditoriasFiltradas.map((row) => (
                            <div key={row.CODAUDITORIA}>
                              {renderResumoAuditoria(
                                row,
                                <div className="card-footer py-2 d-flex align-items-center justify-content-between bg-white border-top">
                                  <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                    #{row.CODAUDITORIA}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm"
                                    title="Ver produtos da auditoria"
                                    onClick={() => handleAbrirProdutos(row)}
                                  >
                                    <Eye className="me-1" />
                                    Produtos
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3 h-100 overflow-hidden" style={{ minHeight: 0 }}>
                  <div className="flex-shrink-0">{renderResumoAuditoria(auditoriaSelecionada)}</div>

                  <div className="card shadow-sm flex-grow-1 d-flex flex-column overflow-hidden" style={{ minHeight: 0 }}>
                    <div className="card-header py-2 d-flex flex-wrap align-items-center justify-content-between gap-2 flex-shrink-0">
                      <span className="fw-semibold">Produtos conferidos</span>
                      <ul className="nav nav-pills mb-0">
                        <li className="nav-item">
                          <button
                            type="button"
                            className={`nav-link py-1 px-3 ${abaProdutos === "ok" ? "active" : ""}`}
                            onClick={() => setAbaProdutos("ok")}
                          >
                            Produtos OK
                            <span className="badge bg-success ms-2">{produtosOk.length}</span>
                          </button>
                        </li>
                        <li className="nav-item">
                          <button
                            type="button"
                            className={`nav-link py-1 px-3 ${abaProdutos === "divergentes" ? "active" : ""}`}
                            onClick={() => setAbaProdutos("divergentes")}
                          >
                            Divergentes
                            <span className="badge bg-danger ms-2">{produtosDivergentes.length}</span>
                          </button>
                        </li>
                      </ul>
                    </div>
                    <div className="card-body p-0 flex-grow-1 overflow-auto" style={{ minHeight: 0 }}>
                      {loadingProdutos && <div className="p-3 text-muted">Carregando produtos...</div>}
                      {errorProdutos && <div className="alert alert-danger m-3 py-2">{errorProdutos}</div>}
                      {!loadingProdutos && !errorProdutos && produtos.length === 0 && (
                        <div className="p-3 text-muted">Nenhum produto nesta auditoria.</div>
                      )}
                      {!loadingProdutos && !errorProdutos && produtos.length > 0 && produtosVisiveis.length === 0 && (
                        <div className="p-3 text-muted">
                          {abaProdutos === "ok"
                            ? "Nenhum produto sem divergência."
                            : "Nenhum produto divergente."}
                        </div>
                      )}
                      {!loadingProdutos && produtosVisiveis.length > 0 && renderTabelaProdutos(produtosVisiveis)}
                    </div>
                    {abaProdutos === "divergentes" && (
                      <div className="card-footer py-2 d-flex justify-content-end bg-white border-top flex-shrink-0">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          disabled={loadingProdutos || produtosDivergentes.length === 0}
                          onClick={handleBaixarBarrasDivergentes}
                        >
                          <Download className="me-1" />
                          Baixar códigos de barras (.txt)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {renderModalResumoDia()}
    </>
  );
};

export default AuditoriaModal;
