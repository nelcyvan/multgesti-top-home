import React, { useMemo } from "react";
import type { PedidoDetalhe, PedidoItem } from "../../../../components/gestlog/VisualizarPedido";

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
  EMBALAGEMMASTER?: number;
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
};

type Props = {
  pendencias: PendenciaGestproRow[];
  onLocate: (pd: PedidoDetalhe, options?: { autoUpdateStatus18?: boolean }) => void;
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

const PegarLocalizacaoCard: React.FC<Props> = ({ pendencias, onLocate, bodyHeight }) => {
  const pendenciasLoc = useMemo(
    () => pendencias.filter(p => String(p.LOG2) === "14"),
    [pendencias]
  );

  const groups = useMemo(() => Array.from(groupPendencias(pendenciasLoc)), [pendenciasLoc]);

  return (
    <div className="card border-0 bg-light shadow-lg h-100" style={{ borderLeft: "4px solid #ffc107" }}>
      <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
        <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.9rem" }}>Pegar Localização</h6>
        <span className="badge bg-warning text-dark rounded-pill px-2" style={{ fontSize: "0.75rem" }}>{pendenciasLoc.length}</span>
      </div>
      <div className="card-body p-0" style={{ height: bodyHeight ?? "calc(50vh - 100px)", overflowY: "auto" }}>
        <div className="table-responsive">
          {pendenciasLoc.length === 0 ? (
            <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum item de Localização.</div>
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
                          </div>
                          <div>
                            <button
                              className="btn btn-info text-white btn-gestpro py-0 px-3"
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
                                  embalagemMaster: p.EMBALAGEMMASTER
                                }));
                                const pd: PedidoDetalhe = {
                                  pedido: String(head.NUMPED),
                                  data: head.DATA,
                                  tipoEntrega: head.TIPOENTREGA || "-",
                                  cliente: head.CLIENTE,
                                  vendedor: `${head.CODUSUR} - ${head.NOME || ""}`,
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
                                  municEnt: head.MUNICENT,
                                  cep: head.CEP,
                                  vlTotal: head.VLTOTAL,
                                  separador: head.SEPERADOR,
                                  emissorMapa: head.EMISSOR_MAPA,
                                  viasMapa: head.NUMVIASMAPASEP
                                };
                                onLocate(pd, { autoUpdateStatus18: true });
                              }}
                            >
                              Localização
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="col-12" style={{ fontSize: "0.8rem" }}>
                        <div className="mb-0 d-flex flex-wrap align-items-center">
                          <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate me-3">{head.CODCLI} - {head.CLIENTE}</span>
                          <strong className="me-1">Data:</strong> <span className="text-muted text-truncate">{formatDate(head.DATA)}</span>
                        </div>
                        <div className="mb-0 d-flex"><strong className="me-1">Vendedor(a):</strong> <span className="text-muted text-truncate">{head.CODUSUR} - {head.NOME}</span></div>
                        <div className="mb-0 d-flex"><strong className="me-1">Total:</strong> <span className="text-danger fw-bold">{currency(head.VLTOTAL)}</span></div>
                        <div className="mb-0 d-flex"><strong className="me-1">Entrega:</strong> <span className="text-muted text-truncate">{head.TIPOENTREGA || "-"}</span></div>
                        {head.CODFILIALRETIRA && (
                          <div className="mb-0 d-flex"><strong className="me-1">Retira:</strong> <span className="text-muted text-truncate">{head.CODFILIALRETIRA}</span></div>
                        )}

                        {(head.ENDERENT || head.BAIRROENT || head.MUNICENT || head.CEP) && (
                          <div className="mt-2 pt-1 border-top border-secondary-subtle">
                            <div className="fw-bold mb-1 text-secondary" style={{ fontSize: "0.8rem" }}>Endereço de Cadastro</div>
                            {head.ENDERENT && (
                              <div className="mb-0 d-flex"><strong className="me-1">Endereço:</strong> <span className="text-muted text-truncate">{[head.ENDERENT, head.NUMEROENT].filter(Boolean).join(", ")}</span></div>
                            )}
                            {head.BAIRROENT && (
                              <div className="mb-0 d-flex"><strong className="me-1">Bairro:</strong> <span className="text-muted text-truncate">{head.BAIRROENT}</span></div>
                            )}
                            {head.MUNICENT && (
                              <div className="mb-0 d-flex"><strong className="me-1">Cidade:</strong> <span className="text-muted text-truncate">{head.MUNICENT}</span></div>
                            )}
                            {head.CEP && (
                              <div className="mb-0 d-flex"><strong className="me-1">CEP:</strong> <span className="text-muted text-truncate">{head.CEP}</span></div>
                            )}
                            <hr className="my-1 text-secondary-subtle" />
                          </div>
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
                          <th className="py-1" style={{ width: "60%" }}>Descrição</th>
                          <th className="py-1" style={{ width: "15%" }}>Qtd</th>
                          <th className="py-1" style={{ width: "15%" }}>Posição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((p, idx) => (
                          <tr key={`loc-${p.NUMPED}-${p.CODPROD}-${idx}`}>
                            <td className="py-1 ps-3">{p.CODPROD}</td>
                            <td className="py-1">{p.DESCRICAO}</td>
                            <td className="py-1">{p.QT}</td>
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
  );
};

export default PegarLocalizacaoCard;
