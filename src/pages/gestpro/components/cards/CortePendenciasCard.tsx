import React, { useMemo } from "react";
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
  TIPOENTREGA?: string;
  CODFILIALRETIRA?: string;
  POSICAO: string;
  CODPROD: number;
  QT: number;
  DESCRICAO: string;
  MOTIVO_CORTE?: string;
  NOME?: string;
  OBS?: string;
  OBS1?: string;
  OBS2?: string;
  OBSENTREGA1?: string;
  OBSENTREGA2?: string;
  OBSENTREGA3?: string;
};

type Props = {
  pendencias: PendenciaGestproRow[];
  onRefresh?: () => void;
  bodyHeight?: string;
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

const CortePendenciasCard: React.FC<Props> = ({ pendencias, onRefresh, bodyHeight }) => {
  const pendenciasCorte = useMemo(
    () => pendencias.filter(p => String(p.LOG2) === "13"),
    [pendencias]
  );

  const groups = useMemo(() => Array.from(groupPendencias(pendenciasCorte)), [pendenciasCorte]);

  const [loadingCorte, setLoadingCorte] = React.useState<number | null>(null);
  const [showConfirmCorte, setShowConfirmCorte] = React.useState<boolean>(false);
  const [corteTarget, setCorteTarget] = React.useState<number | null>(null);

  const handleCorteRealizado = (numped: number) => {
    if (loadingCorte !== null) return;
    setCorteTarget(numped);
    setShowConfirmCorte(true);
  };

  const executeCorteRealizado = async () => {
    if (!corteTarget) return;

    const numped = corteTarget;
    setShowConfirmCorte(false);
    setLoadingCorte(numped);

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
        numped,
        status: 22,
        usuario
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Erro ao marcar corte realizado:", err);
      alert("Erro ao marcar corte realizado.");
    } finally {
      setLoadingCorte(null);
      setCorteTarget(null);
    }
  };

  const corteInfo = useMemo(() => {
    if (!corteTarget) return null;
    return pendenciasCorte.find(p => p.NUMPED === corteTarget) || null;
  }, [corteTarget, pendenciasCorte]);

  return (
    <>
      <div className="card border-0 bg-light shadow-lg h-100" style={{ borderLeft: "4px solid #dc3545" }}>
        <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-bold text-danger" style={{ fontSize: "0.9rem" }}>Corte</h6>
          <span className="badge bg-danger rounded-pill px-2" style={{ fontSize: "0.75rem" }}>{pendenciasCorte.length}</span>
        </div>
        <div className="card-body p-0" style={{ height: bodyHeight ?? "calc(50vh - 100px)", overflowY: "auto" }}>
          <div className="table-responsive">
            {pendenciasCorte.length === 0 ? (
              <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum item de Corte.</div>
            ) : (
              groups.map(([numped, items]) => {
                const head = items[0];
                return (
                  <div key={numped} className="card mb-3 mx-2 border shadow-sm">
                    <div className="card-header bg-light px-2 py-2">
                      <div className="row g-1">
                        <div className="col-12 border-bottom pb-1 mb-1">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center text-truncate" style={{ fontSize: "0.85rem" }}>
                              <strong className="me-1">Pedido:</strong> <span className="text-dark fw-bold me-3">{numped}</span>
                              <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate" style={{ maxWidth: "400px" }}>{head.CODCLI} - {head.CLIENTE}</span>
                            </div>
                            <button
                              className="btn btn-sm btn-success py-0 px-2"
                              style={{ fontSize: "0.75rem" }}
                              onClick={() => handleCorteRealizado(numped)}
                              disabled={loadingCorte === numped}
                            >
                              {loadingCorte === numped ? "Enviando..." : "Corte Realizado"}
                            </button>
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
                          <div className="mb-0 d-flex"><strong className="me-1">Motivo:</strong> <span className="text-muted text-truncate" title={head.MOTIVO_CORTE}>{head.MOTIVO_CORTE || "-"}</span></div>
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
                            <th className="py-1" style={{ width: "10%" }}>Qtd</th>
                            <th className="py-1" style={{ width: "10%" }}>Posição</th>
                            <th className="py-1" style={{ width: "30%" }}>Motivo Corte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((p, idx) => (
                            <tr key={`corte-${p.NUMPED}-${p.CODPROD}-${idx}`}>
                              <td className="py-1 ps-3">{p.CODPROD}</td>
                              <td className="py-1">{p.DESCRICAO}</td>
                              <td className="py-1">{p.QT}</td>
                              <td className="py-1">{p.POSICAO}</td>
                              <td className="py-1">{p.MOTIVO_CORTE || "-"}</td>
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

      {showConfirmCorte && corteTarget && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4000, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4010 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow">
                <div className="modal-header py-1 px-3">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Confirmação</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    style={{ fontSize: "0.8rem" }}
                    onClick={() => {
                      setShowConfirmCorte(false);
                      setCorteTarget(null);
                    }}
                  />
                </div>
                <div className="modal-body py-2 px-3" style={{ fontSize: "0.85rem" }}>
                  {corteInfo && (
                    <div className="mb-3 p-2 bg-light rounded border">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Pedido:</span>
                        <span className="fw-bold">{corteTarget}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Cliente:</span>
                        <span className="fw-bold text-end text-truncate" style={{ maxWidth: "200px" }}>{corteInfo.CODCLI} - {corteInfo.CLIENTE}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Vendedor:</span>
                        <span className="fw-bold text-end">{corteInfo.NOME}</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Total:</span>
                        <span className="fw-bold text-danger">{currency(corteInfo.VLTOTAL)}</span>
                      </div>
                    </div>
                  )}
                  <p className="mb-0 text-center">
                    Confirma marcar <strong>corte realizado</strong>?
                  </p>
                </div>
                <div className="modal-footer py-1 px-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-0 px-2"
                    style={{ fontSize: "0.8rem" }}
                    onClick={() => {
                      setShowConfirmCorte(false);
                      setCorteTarget(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm py-0 px-2"
                    style={{ fontSize: "0.8rem" }}
                    onClick={executeCorteRealizado}
                  >
                    Confirmar
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

export default CortePendenciasCard;
