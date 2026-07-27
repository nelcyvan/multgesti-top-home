import React, { useState } from "react";
import type { NotaTV7 } from "../../ConciliacaoTV7Modal";

interface ConciliarModalProps {
  nota: NotaTV7;
  onClose: () => void;
}

interface PedidoTV7Item {
  NUMPED: number;
  TV7: number;
  CODUSUR: number;
  NOME: string;
  DATA: string;
  CODCLI: number;
  CODFILIAL: string;
  VLTOTAL: number;
  CODPROD: number;
  DESCRICAO: string;
  CODAUXILIAR: number;
  QT: number;
  PVENDA: number;
}

const resolveBaseApi = () => {
  const envRaw = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
  if (envRaw && typeof envRaw === "string") {
    const trimmed = envRaw.replace(/\/+$/, "");
    if (isHttps && /^http:\/\//i.test(trimmed)) return "/api";
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  return "/api";
};

const currency = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

const formatDate = (dateString: string) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

const ConciliarModal: React.FC<ConciliarModalProps> = ({ nota, onClose }) => {
  const [pedido, setPedido] = useState<PedidoTV7Item[]>([]);
  const [loadingPedido, setLoadingPedido] = useState(false);
  const [numpedInput, setNumpedInput] = useState<string>("");

  const handleBuscarPedido = async () => {
    if (!numpedInput) return;

    setLoadingPedido(true);
    setPedido([]);
    try {
      const baseApi = resolveBaseApi();
      const response = await fetch(`${baseApi}/gestpro/conciliacao-tv7/buscar-pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numped: Number(numpedInput) }),
      });
      if (response.ok) {
        const data = await response.json();
        setPedido(data.rows || []);
      }
    } catch (error) {
      console.error("Erro ao buscar pedido:", error);
    } finally {
      setLoadingPedido(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleBuscarPedido();
    }
  };

  const pedidoHeader = pedido[0];

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
      <div className="modal fade show" style={{ display: "block", zIndex: 1065 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-header py-1 px-3 bg-light">
              <h5 className="modal-title fs-6 fw-bold text-primary">
                <i className="bi bi-check2-square me-2"></i>
                Conciliar Nota {nota.NUMNOTA}
              </h5>
              <button type="button" className="btn-close btn-sm" onClick={onClose} aria-label="Close"></button>
            </div>
            <div className="modal-body p-2">
              <div className="row g-2">
                {/* Coluna da Nota (Vermelho) */}
                <div className="col-12">
                  <div className="card shadow-sm mb-2">
                    <div className="card-header bg-danger text-white py-1">
                      <i className="bi bi-file-text me-2"></i>
                      Nota Fiscal / Selecionado
                    </div>
                    <div className="card-body p-2 d-flex flex-column">
                      {/* Cabeçalho Compacto */}
                      <div className="card mb-2">
                        <div className="card-body p-2">
                          <div className="row g-0 align-items-center text-nowrap">
                            <div className="col-auto pe-3 border-end border-opacity-25">
                              <small className="text-danger d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>Nº NOTA</small>
                              <span className="fw-bold text-dark">{nota.NUMNOTA}</span>
                            </div>
                            <div className="col-auto px-3 border-end border-opacity-25">
                              <small className="text-danger d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>TRANS.</small>
                              <span className="fw-bold text-dark">{nota.NUMTRANSENT}</span>
                            </div>
                            <div className="col-auto px-3 border-end border-opacity-25">
                              <small className="text-danger d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>FILIAL</small>
                              <span className="fw-bold text-dark">{nota.CODFILIAL}</span>
                            </div>
                            <div className="col-auto px-3 border-end border-opacity-25">
                              <small className="text-danger d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>EMISSÃO</small>
                              <span className="fw-bold text-dark">{nota.DTEMISSAO}</span>
                            </div>
                            <div className="col-auto px-3 border-end border-opacity-25">
                              <small className="text-danger d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>ENTRADA</small>
                              <span className="fw-bold text-dark">{nota.DTENT}</span>
                            </div>
                          </div>
                          <div className="row g-0 align-items-center text-nowrap mt-2">
                            <div className="col overflow-hidden border-end border-opacity-25 pe-3">
                              <small className="text-danger d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>CLIENTE</small>
                              <div className="fw-bold text-dark text-truncate" title={`${nota.CODCLI} - ${nota.CLIENTE}`}>
                                {nota.CODCLI} - {nota.CLIENTE}
                              </div>
                            </div>
                            <div className="col-auto ps-3 text-end">
                              <small className="text-danger d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>TOTAL</small>
                              <span className="text-danger fw-bold fs-5">{currency(nota.VLTOTAL)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tabela de Itens */}
                      <div className="card shadow-sm">
                        <div className="card-header bg-white py-1 border-bottom">
                          <span className="fw-bold small text-danger">
                            <i className="bi bi-list-ul me-1"></i>
                            Itens da Nota ({nota.items.length})
                          </span>
                        </div>
                        <div className="card-body p-0">
                          <div className="table-responsive" style={{ maxHeight: "300px" }}>
                            <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.8rem" }}>
                              <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
                                <tr>
                                  <th className="ps-3">Cód.</th>
                                  <th>Descrição</th>
                                  <th className="text-center">Qtd</th>
                                  <th className="text-end">Total</th>
                                  <th>Pedido</th>
                                </tr>
                              </thead>
                              <tbody>
                                {nota.items.map((item, idx) => (
                                  <tr key={`${item.CODPROD}-${idx}`}>
                                    <td className="ps-3">{item.CODPROD}</td>
                                    <td className="text-truncate" style={{ maxWidth: "150px" }} title={item.DESCRICAO}>{item.DESCRICAO}</td>
                                    <td className="text-center fw-bold bg-light">{item.QT}</td>
                                    <td className="text-end fw-bold">{currency(item.QT * item.PUNIT)}</td>
                                    <td>
                                      <span className="badge bg-light text-dark border me-1">{item.NUMPED}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna do Pedido Pesquisado (Verde) */}
                <div className="col-12">
                  <div className="card shadow-sm">
                    <div className="card-header bg-success text-white py-1">
                      <i className="bi bi-search me-2"></i>
                      Pedido Pesquisado
                    </div>
                    <div className="card-body p-2 d-flex flex-column">
                      {/* Input de Busca do Pedido */}
                      <div className="d-flex align-items-end gap-2 mb-2 p-2 bg-white border rounded">
                        <div className="flex-grow-1">
                          <label className="form-label mb-0 small text-success fw-bold">Número do Pedido</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={numpedInput}
                            onChange={(e) => setNumpedInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite o Nº do Pedido para conciliar"
                            autoFocus
                          />
                        </div>
                        <button 
                          className="btn btn-sm btn-success px-3"
                          onClick={handleBuscarPedido}
                          disabled={loadingPedido || !numpedInput}
                        >
                          {loadingPedido ? (
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          ) : (
                            <>
                              <i className="bi bi-search me-1"></i> Buscar
                            </>
                          )}
                        </button>
                      </div>

                      {loadingPedido && (
                        <div className="text-center py-5">
                          <div className="spinner-border text-success" role="status">
                            <span className="visually-hidden">Carregando pedido...</span>
                          </div>
                          <p className="text-success mt-2">Buscando informações do pedido...</p>
                        </div>
                      )}

                      {/* Card Verde do Pedido e Tabela de Itens do Pedido */}
                      {pedidoHeader && !loadingPedido && (
                        <>
                          <div className="card mb-2">
                            <div className="card-body p-2">
                              <div className="row g-0 align-items-center text-nowrap">
                                <div className="col-auto pe-3 border-end border-opacity-25">
                                  <small className="text-success d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>Nº PEDIDO</small>
                                  <span className="fw-bold text-dark">{pedidoHeader.NUMPED}</span>
                                </div>
                                <div className="col-auto px-3 border-end border-opacity-25">
                                  <small className="text-success d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>TV7</small>
                                  <span className="fw-bold text-dark">{pedidoHeader.TV7 || '—'}</span>
                                </div>
                                <div className="col-auto px-3 border-end border-opacity-25">
                                  <small className="text-success d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>RCA</small>
                                  <span className="fw-bold text-dark" title={pedidoHeader.NOME}>{pedidoHeader.CODUSUR} - {pedidoHeader.NOME.split(' ')[0]}</span>
                                </div>
                                <div className="col-auto px-3 border-end border-opacity-25">
                                  <small className="text-success d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>DATA</small>
                                  <span className="fw-bold text-dark">{formatDate(pedidoHeader.DATA)}</span>
                                </div>
                              </div>
                              <div className="row g-0 align-items-center text-nowrap mt-2">
                                <div className="col overflow-hidden border-end border-opacity-25 pe-3">
                                   <small className="text-success d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>ITENS NO PEDIDO</small>
                                   <span className="fw-bold text-dark">{pedido.length} item(s)</span>
                                </div>
                                <div className="col-auto ps-3 text-end">
                                  <small className="text-success d-block" style={{ fontSize: '0.65rem', lineHeight: 1 }}>TOTAL PEDIDO</small>
                                  <span className="text-success fw-bold fs-5">{currency(pedidoHeader.VLTOTAL)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Tabela de Itens do Pedido */}
                          <div className="card shadow-sm">
                            <div className="card-header bg-white py-1 border-bottom">
                              <span className="fw-bold small text-success">
                                <i className="bi bi-cart-check me-1"></i>
                                Itens do Pedido {pedidoHeader.NUMPED}
                              </span>
                            </div>
                            <div className="card-body p-0">
                              <div className="table-responsive" style={{ maxHeight: "300px" }}>
                                <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.8rem" }}>
                                  <thead className="table-light sticky-top">
                                    <tr>
                                      <th className="ps-3">Cód.</th>
                                      <th>Descrição</th>
                                      <th className="text-center">Qtd</th>
                                      <th className="text-end pe-3">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {pedido.map((item, idx) => (
                                      <tr key={`ped-${item.CODPROD}-${idx}`}>
                                        <td className="ps-3">{item.CODPROD}</td>
                                        <td className="text-truncate" style={{ maxWidth: "150px" }} title={item.DESCRICAO}>{item.DESCRICAO}</td>
                                        <td className="text-center fw-bold bg-light">{item.QT}</td>
                                        <td className="text-end fw-bold pe-3">{currency(item.QT * item.PVENDA)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {!pedidoHeader && !loadingPedido && (
                        <div className="d-flex align-items-center justify-content-center text-muted flex-column opacity-50 py-5">
                          <i className="bi bi-search display-1"></i>
                          <p className="mt-2">Pesquise um pedido para conciliar</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer py-1 px-3 bg-light">
              <div className="me-auto text-muted small">
                <i className="bi bi-info-circle me-1"></i>
                Conciliação em desenvolvimento
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary px-3" onClick={onClose}>Cancelar</button>
              <button type="button" className="btn btn-sm btn-primary px-4" disabled>
                <i className="bi bi-check2 me-1"></i>
                Confirmar Conciliação
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConciliarModal;
