import React, { useMemo } from "react";
import type { PedidoDetalhe } from "../../../../components/gestlog/VisualizarPedido";
import type { PendenciaGestproRow } from "../types/ColetaSeparandoPendencias.types";
import { Coleta } from "../Coleta";
import { Faltando } from "../Faltando";

type Props = {
  pendencias: PendenciaGestproRow[];
  onPrint?: (pd: PedidoDetalhe) => void;
  onRefresh?: () => void;
  onValidate?: (items: PendenciaGestproRow[]) => void;
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

const ColetaSeparandoPendenciasCard: React.FC<Props> = ({ pendencias, onPrint, onRefresh, onValidate, bodyHeight }) => {
  const pendenciasColetaSeparando = useMemo(
    () =>
      pendencias.filter(p => {
        const s = (p as any).LOG2_REAL ?? (p as any).LOG2;
        return String(s) === "21";
      }),
    [pendencias]
  );

  const groups = useMemo(() => Array.from(groupPendencias(pendenciasColetaSeparando)), [pendenciasColetaSeparando]);

  const [printedPedidos, setPrintedPedidos] = React.useState<number[]>([]);

  return (
    <>
      <div className="card border-0 bg-light shadow-lg h-100 d-flex flex-column" style={{ borderLeft: "4px solid #198754", minHeight: 0 }}>
        <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-bold text-success" style={{ fontSize: "0.9rem" }}>Coleta Separando</h6>
          <span className="badge bg-success text-white rounded-pill px-2" style={{ fontSize: "0.75rem" }}>{pendenciasColetaSeparando.length}</span>
        </div>
        <div
          className="card-body p-0"
          style={{
            height: bodyHeight ?? "calc(50vh - 100px)",
            overflowY: "auto",
            overscrollBehavior: "contain"
          }}
        >
          <div className="table-responsive">
            {pendenciasColetaSeparando.length === 0 ? (
              <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum item de Coleta Separando.</div>
            ) : (
              groups.map(([numped, items]) => {
                const head = items[0];
                const hasVias = (head.NUMVIASMAPASEP || 0) > 0;
                const isPrinted = printedPedidos.includes(numped);
                return (
                  <div
                    key={numped}
                    className="card mb-3 mx-2 border shadow-sm d-flex flex-column"
                    style={
                      isPrinted
                        ? { borderLeft: "5px solid #fd7e14" }
                        : hasVias
                          ? { borderLeft: "5px solid #198754" }
                          : undefined
                    }
                  >
                    <div className={`card-header px-2 py-2 ${isPrinted ? "bg-warning-subtle" : hasVias ? "bg-success-subtle" : "bg-light"}`}>
                      <div className="row g-1">
                        <div className="col-12 border-bottom pb-1 mb-1">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center text-truncate" style={{ fontSize: "0.85rem" }}>
                              <strong className="me-1">Pedido:</strong> <span className="text-dark fw-bold me-3">{numped}</span>
                              <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate" style={{ maxWidth: "400px" }}>{head.CODCLI} - {head.CLIENTE}</span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <Coleta
                                items={items}
                                head={head}
                                onPrint={onPrint}
                                onPrinted={() => setPrintedPedidos(prev => (prev.includes(numped) ? prev : [...prev, numped]))}
                              />
                              <Faltando numped={numped} cliente={head.CLIENTE} onRefresh={onRefresh} />
                              {onValidate && (
                                <button
                                  className="btn btn-sm btn-outline-primary py-0 px-2"
                                  style={{ fontSize: "0.75rem" }}
                                  onClick={() => onValidate(items)}
                                >
                                  Validações
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="col-12" style={{ fontSize: "0.8rem" }}>
                          <div className="mb-0 d-flex"><strong className="me-1">Data:</strong> <span className="text-muted text-truncate">{formatDate(head.DATA)}</span></div>
                          <div className="mb-0 d-flex"><strong className="me-1">Vendedor(a):</strong> <span className="text-muted text-truncate">{head.CODUSUR} - {head.NOME}</span></div>
                          <div className="mb-0 d-flex"><strong className="me-1">Total:</strong> <span className="text-danger fw-bold">{currency(head.VLTOTAL)}</span></div>
                          <div className="mb-0 d-flex"><strong className="me-1">Entrega:</strong> <span className="text-muted text-truncate">{head.TIPOENTREGA || "-"}</span></div>
                          {head.CODFILIALRETIRA && <div className="mb-0 d-flex"><strong className="me-1">Retira:</strong> <span className="text-muted text-truncate">{head.CODFILIALRETIRA}</span></div>}
                          {head.SEPERADOR && <div className="mb-0 d-flex"><strong className="me-1">Separador:</strong> <span className="text-muted text-truncate">{head.SEPERADOR}</span></div>}
                          {head.EMISSOR_MAPA && <div className="mb-0 d-flex"><strong className="me-1">Emissor mapa:</strong> <span className="text-muted text-truncate">{head.EMISSOR_MAPA}</span></div>}
                          {typeof head.NUMVIASMAPASEP === "number" && <div className="mb-0 d-flex"><strong className="me-1">Vias mapa:</strong> <span className="text-muted text-truncate">{head.NUMVIASMAPASEP}</span></div>}
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
                    <div
                      className="card-body p-0"
                      style={{
                        maxHeight: 320,
                        overflowY: "auto",
                        overscrollBehavior: "contain"
                      }}
                    >
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
                            <tr key={`coleta-separando-${p.NUMPED}-${p.CODPROD}-${idx}`}>
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
    </>
  );
};

export default ColetaSeparandoPendenciasCard;
