import React, { useMemo } from "react";
import type { PedidoDetalhe, PedidoItem } from "../../../../components/gestlog/VisualizarPedido";
import { atualizarStatusEspecial } from "../../../../services/gestlog/MarcarVisualizacao";

type PendenciaGestproRow = {
  NUMPED: number;
  CODCLI: number;
  CLIENTE: string;
  VLTOTAL: number;
  CODFILIAL: string;
  DATA: string;
  CODUSUR: number;
  LOG2: string;
  LOG2_REAL?: string;
  TIPOENTREGA?: string;
  CODFILIALRETIRA?: string;
  POSICAO: string;
  CODPROD: number;
  QT: number;
  DESCRICAO: string;
  CODAUXILIAR: string;
  MULTIPLO?: number;
  EMBALAGEMMASTER?: string | number;
  QTD_TOTAL?: string;
  NOME?: string;
  ENDERENT?: string;
  NUMEROENT?: string;
  BAIRROENT?: string;
  MUNICENT?: string;
  CEP?: string;
  OBS?: string;
  OBS1?: string;
  OBS2?: string;
  OBSENTREGA1?: string;
  OBSENTREGA2?: string;
  OBSENTREGA3?: string;
  SEPERADOR?: string;
  NUMVIASMAPASEP?: number;
  EMISSOR_MAPA?: string;
  NUMVIASMAPASEP2?: number;
};

type Props = {
  pendencias: PendenciaGestproRow[];
  onColeta: (pd: PedidoDetalhe) => void;
  onRefresh?: () => void;
  bodyHeight?: string;
  onBeforeColeta?: () => void;
};

const currency = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

const groupPendencias = (list: PendenciaGestproRow[]) => {
  const groups = new Map<number, PendenciaGestproRow[]>();
  list.forEach(p => {
    const arr = groups.get(p.NUMPED) || [];
    arr.push(p);
    groups.set(p.NUMPED, arr);
  });
  return groups;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
};

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : undefined;
};

const ColetaPendenciasCard: React.FC<Props> = ({ pendencias, onColeta, onRefresh, bodyHeight, onBeforeColeta }) => {
  const pendenciasColeta = useMemo(
    () => pendencias.filter(p => String(p.LOG2) === "17"),
    [pendencias]
  );

  const groups = useMemo(() => Array.from(groupPendencias(pendenciasColeta)), [pendenciasColeta]);

  const [showConfirmFalta, setShowConfirmFalta] = React.useState<boolean>(false);
  const [faltaTarget, setFaltaTarget] = React.useState<{ numped: number; cliente: string } | null>(null);
  const [sendingFalta, setSendingFalta] = React.useState<boolean>(false);

  const handleOpenFalta = (numped: number, cliente: string) => {
    setFaltaTarget({ numped, cliente });
    setShowConfirmFalta(true);
  };

  const handleConfirmFalta = async () => {
    if (!faltaTarget) return;
    if (!Number.isFinite(faltaTarget.numped)) return;
    setSendingFalta(true);
    try {
      const usuario = (() => {
        try {
          const raw = localStorage.getItem("usuarioLogado");
          if (!raw) return "APP";
          const obj = JSON.parse(raw);
          const nome = (obj?.usuario ?? "").toString().trim();
          return nome || "APP";
        } catch {
          return "APP";
        }
      })();
      await atualizarStatusEspecial({
        numped: Number(faltaTarget.numped),
        status: 10,
        usuario
      });
      setShowConfirmFalta(false);
      setFaltaTarget(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Erro ao enviar para Falta de Mercadoria:", err);
    } finally {
      setSendingFalta(false);
    }
  };

  return (
    <>
      <div className="card border-0 bg-light shadow-lg h-100" style={{ borderLeft: "4px solid #0dcaf0" }}>
        <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-bold text-info" style={{ fontSize: "0.9rem" }}>Coleta</h6>
          <span className="badge bg-info text-white rounded-pill px-2" style={{ fontSize: "0.75rem" }}>{pendenciasColeta.length}</span>
        </div>
        <div className="card-body p-0" style={{ height: bodyHeight ?? "calc(50vh - 100px)", overflowY: "auto" }}>
          <div className="table-responsive">
            {pendenciasColeta.length === 0 ? (
              <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum item de Coleta.</div>
            ) : (
              groups.map(([numped, items]) => {
                const head = items[0];
                const hasVias = (head.NUMVIASMAPASEP || 0) > 0;
                return (
                  <div key={numped} className="card mb-3 mx-2 border shadow-sm" style={hasVias ? { borderLeft: "5px solid #198754" } : undefined}>
                    <div className={`card-header px-2 py-2 ${hasVias ? "bg-success-subtle" : "bg-light"}`}>
                      <div className="row g-1">
                        <div className="col-12 border-bottom pb-1 mb-1">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center text-truncate" style={{ fontSize: "0.85rem" }}>
                              <strong className="me-1">Pedido:</strong> <span className="text-dark fw-bold me-3">{numped}</span>
                              <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate" style={{ maxWidth: "400px" }}>{head.CODCLI} - {head.CLIENTE}</span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <button
                                className="btn btn-warning text-dark btn-gestpro py-0 px-3"
                                style={{ fontSize: "0.75rem", height: "24px" }}
                                type="button"
                                onClick={() => {
                                  const pedidoItems: PedidoItem[] = items.map(p => ({
                                    descricao: p.DESCRICAO,
                                    quantidade: p.QT,
                                    codigoDeBarras: p.CODAUXILIAR,
                                    codProd: p.CODPROD,
                                    posicao: p.POSICAO,
                                    multiplo: p.MULTIPLO,
                                    embalagemMaster: toFiniteNumber(p.EMBALAGEMMASTER)
                                  }));
                                  const pd: PedidoDetalhe = {
                                    pedido: String(head.NUMPED),
                                    data: head.DATA,
                                    tipoEntrega: head.TIPOENTREGA || "-",
                                    cliente: head.CLIENTE,
                                    codFilial: head.CODFILIAL,
                                    codFilialRetira: head.CODFILIALRETIRA,
                                    codCli: head.CODCLI,
                                    posicao: head.POSICAO,
                                    items: pedidoItems,
                                    ageDays: 0,
                                    normalizedDate: null,
                                    statusPedido: Number(head.LOG2_REAL || head.LOG2),
                                    log2Real: head.LOG2_REAL || head.LOG2,
                                    enderEnt: head.ENDERENT,
                                    numeroEnt: head.NUMEROENT,
                                    bairroEnt: head.BAIRROENT,
                                    municEnt: head.MUNICENT
                                  };
                                  if (onBeforeColeta) onBeforeColeta();
                                  onColeta(pd);
                                }}
                              >
                                Coleta
                              </button>
                              <button
                                className="btn btn-outline-danger btn-gestpro py-0 px-3"
                                style={{ fontSize: "0.75rem", height: "24px" }}
                                type="button"
                                onClick={() => handleOpenFalta(numped, head.CLIENTE)}
                              >
                                Faltando
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="col-12" style={{ fontSize: "0.8rem" }}>
                          <div className="mb-0 d-flex"><strong className="me-1">Data:</strong> <span className="text-muted text-truncate">{formatDate(head.DATA)}</span></div>
                          <div className="mb-0 d-flex"><strong className="me-1">Vendedor(a):</strong> <span className="text-muted text-truncate">{head.CODUSUR} - {head.NOME}</span></div>
                          <div className="mb-0 d-flex"><strong className="me-1">Total:</strong> <span className="text-danger fw-bold">{currency(head.VLTOTAL)}</span></div>
                          <div className="mb-0 d-flex"><strong className="me-1">Entrega:</strong> <span className="text-muted text-truncate">{head.TIPOENTREGA || "-"}</span></div>
                          {head.CODFILIALRETIRA && (
                            <div className="mb-0 d-flex"><strong className="me-1">Retira:</strong> <span className="text-muted text-truncate">{head.CODFILIALRETIRA}</span></div>
                          )}
                          {head.SEPERADOR && (
                            <div className="mb-0 d-flex"><strong className="me-1">Separador:</strong> <span className="text-muted text-truncate">{head.SEPERADOR}</span></div>
                          )}
                          {head.EMISSOR_MAPA && (
                            <div className="mb-0 d-flex"><strong className="me-1">Emissor mapa:</strong> <span className="text-muted text-truncate">{head.EMISSOR_MAPA}</span></div>
                          )}
                          {typeof head.NUMVIASMAPASEP === "number" && (
                            <div className="mb-0 d-flex"><strong className="me-1">Vias mapa:</strong> <span className="text-muted text-truncate">{head.NUMVIASMAPASEP}</span></div>
                          )}
                          {[head.OBS, head.OBS1, head.OBS2].some(Boolean) && (
                            <div className="mb-0 text-break">
                              <strong className="me-1">Obs:</strong>
                              <span className="text-muted">{[head.OBS, head.OBS1, head.OBS2].filter(Boolean).join(" ")}</span>
                            </div>
                          )}
                          {[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].some(Boolean) && (
                            <div className="mb-0 text-break">
                              <strong className="me-1">Obs Entrega:</strong>
                              <span className="text-muted">{[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].filter(Boolean).join(" ")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="card-body p-0">
                      <table className="table table-hover table-sm mb-0" style={{ fontSize: "0.75rem" }}>
                        <thead>
                          <tr>
                            <th className="py-1 ps-3" style={{ width: "10%" }}>Produto</th>
                            <th className="py-1" style={{ width: "40%" }}>Descrição</th>
                            <th className="py-1" style={{ width: "10%" }}>Múltiplo</th>
                            <th className="py-1" style={{ width: "10%" }}>Master</th>
                            <th className="py-1" style={{ width: "10%" }}>Qtd</th>
                            <th className="py-1" style={{ width: "10%" }}>Qtd Total</th>
                            <th className="py-1" style={{ width: "10%" }}>Posição</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((p, idx) => (
                            <tr key={`coleta-${p.NUMPED}-${p.CODPROD}-${idx}`}>
                              <td className="py-1 ps-3">{p.CODPROD}</td>
                              <td className="py-1">{p.DESCRICAO}</td>
                              <td className="py-1">{p.MULTIPLO || "-"}</td>
                              <td className="py-1">{p.EMBALAGEMMASTER || "-"}</td>
                              <td className="py-1">{p.QT}</td>
                              <td className="py-1">{p.QTD_TOTAL || "-"}</td>
                              <td className="py-1">{p.POSICAO}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showConfirmFalta && faltaTarget && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4000, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4010 }}>
            <div className="modal-dialog modal-fullscreen">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "0.95rem" }}>Enviar para Falta de Mercadoria</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    disabled={sendingFalta}
                    onClick={() => {
                      if (sendingFalta) return;
                      setShowConfirmFalta(false);
                      setFaltaTarget(null);
                    }}
                  />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <p className="mb-2">
                    Pedido <strong>{faltaTarget.numped}</strong>
                  </p>
                  <p className="mb-3">
                    Cliente <strong>{faltaTarget.cliente}</strong>
                  </p>
                  <p className="mb-0">
                    Deseja enviar este pedido para a situação <strong>Falta de Mercadoria (Aguardando Fornecedor)</strong>?
                  </p>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={sendingFalta}
                    onClick={() => {
                      if (sendingFalta) return;
                      setShowConfirmFalta(false);
                      setFaltaTarget(null);
                    }}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={sendingFalta}
                    onClick={handleConfirmFalta}
                  >
                    {sendingFalta ? "Enviando..." : "Sim, enviar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ColetaPendenciasCard;
