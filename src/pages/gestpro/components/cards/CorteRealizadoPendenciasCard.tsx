import React, { useMemo } from "react";

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

const CorteRealizadoPendenciasCard: React.FC<Props> = ({ pendencias, bodyHeight }) => {
  const pendenciasCorteRealizado = useMemo(
    () => pendencias.filter(p => String(p.LOG2) === "22"),
    [pendencias]
  );

  const groups = useMemo(
    () => Array.from(groupPendencias(pendenciasCorteRealizado)),
    [pendenciasCorteRealizado]
  );

  return (
    <div className="card border-0 bg-light shadow-lg h-100" style={{ borderLeft: "4px solid #198754" }}>
      <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
        <h6 className="mb-0 fw-bold text-success" style={{ fontSize: "0.9rem" }}>Corte Realizado</h6>
        <span className="badge bg-success rounded-pill px-2" style={{ fontSize: "0.75rem" }}>
          {pendenciasCorteRealizado.length}
        </span>
      </div>
      <div className="card-body p-0" style={{ height: bodyHeight ?? "calc(50vh - 100px)", overflowY: "auto" }}>
        <div className="table-responsive">
          {pendenciasCorteRealizado.length === 0 ? (
            <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum item de Corte Realizado.</div>
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
                          <tr key={`corte22-${p.NUMPED}-${p.CODPROD}-${idx}`}>
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
  );
};

export default CorteRealizadoPendenciasCard;
