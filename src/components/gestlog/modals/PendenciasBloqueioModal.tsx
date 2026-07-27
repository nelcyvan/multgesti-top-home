import React from 'react';

export type PendenciaItem = {
  pedido: number;
  cliente: string;
  bairro?: string | null;
  data?: Date | null;
  itens: number;
  status: number;
};

type Props = {
  show: boolean;
  podeFechar: boolean;
  onClose: () => void;
  abrirPedido: (pedidoNum: number) => void;
  cortes: PendenciaItem[];
  localizacoes: PendenciaItem[];
  onValidar: () => void | Promise<void>;
  validando?: boolean;
  coletas?: PendenciaItem[];
};

const PendenciasBloqueioModal: React.FC<Props> = ({ show, podeFechar, onClose, abrirPedido, cortes, localizacoes, onValidar, validando, coletas = [] }) => {
  let code: number | null = null;
  try {
    const raw = localStorage.getItem("usuarioLogado") || "";
    if (raw) {
      const u = JSON.parse(raw || "{}");
      const codeStr = String(u?.codusur ?? u?.CODUSUR ?? u?.matricula ?? u?.MATRICULA ?? "").trim();
      const n = Number(codeStr);
      code = Number.isFinite(n) ? n : null;
    }
  } catch {}
  const bloqueioAtivo = new Set([60, 64]).has(Number(code));
  if (!show || !bloqueioAtivo) return null;
  const podeFecharReal = podeFechar || !bloqueioAtivo;
  const totalPendencias = (cortes?.length || 0) + (localizacoes?.length || 0) + (coletas?.length || 0);
  const handleClose = () => {
    if (podeFecharReal) onClose();
  };
  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 1100, backdropFilter: 'blur(5px)' }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1110 }}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable" style={{ maxWidth: '1600px', width: '98vw' }}>
          <div className="modal-content" style={{ position: 'relative' }}>
            <div className="modal-header py-1">
              <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pendências obrigatórias • Corte • Localização • Coletas</h6>
              <button type="button" className="btn-close" disabled={!podeFecharReal} onClick={handleClose}></button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.74rem' }}>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span className="badge bg-danger">Total pendências: {totalPendencias}</span>
                {!podeFecharReal && (
                  <span className="badge bg-warning text-dark">Tratativa obrigatória para continuar</span>
                )}
              </div>

              <div className="d-flex flex-column gap-2">
                <div className="card border-danger" style={{ height: '230px', display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header py-1 bg-danger bg-opacity-10 text-danger-emphasis fw-bold d-flex justify-content-between align-items-center" style={{ fontSize: '0.74rem' }}>
                    <span>Pedidos para Corte</span>
                    <span className="badge bg-danger rounded-pill">{cortes.length}</span>
                  </div>
                  <div className="card-body p-0" style={{ fontSize: '0.6rem', flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    {cortes.length === 0 ? (
                      <span className="text-muted">Sem pedidos em corte</span>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm" style={{ fontSize: '0.6rem', lineHeight: 1.08 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '10%' }}>TV8</th>
                              <th style={{ width: '50%' }}>Cliente</th>
                              <th style={{ width: '20%' }}>Bairro</th>
                              <th style={{ width: '10%' }}>Data</th>
                              <th style={{ width: '10%' }}>Itens</th>
                              <th style={{ width: '10%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {cortes.map((g, idx) => (
                              <tr key={`corte-${g.pedido}-${idx}`}>
                                <td>{g.pedido}</td>
                                <td>{g.cliente}</td>
                                <td>{g.bairro || '-'}</td>
                                <td>{g.data ? g.data.toLocaleDateString('pt-BR') : '-'}</td>
                                <td>{g.itens}</td>
                                <td>
                                  <button
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: '0.62rem', lineHeight: 1 }}
                                    onClick={() => abrirPedido(Number(g.pedido))}
                                  >
                                    Visualizar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card border-primary" style={{ height: '230px', display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header py-1 bg-primary bg-opacity-10 text-primary-emphasis fw-bold d-flex justify-content-between align-items-center" style={{ fontSize: '0.74rem' }}>
                    <span>Pedidos aguardando Localização</span>
                    <span className="badge bg-primary rounded-pill">{localizacoes.length}</span>
                  </div>
                  <div className="card-body p-0" style={{ fontSize: '0.6rem', flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    {localizacoes.length === 0 ? (
                      <span className="text-muted">Sem pedidos em localização</span>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm" style={{ fontSize: '0.6rem', lineHeight: 1.08 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '10%' }}>TV8</th>
                              <th style={{ width: '50%' }}>Cliente</th>
                              <th style={{ width: '20%' }}>Bairro</th>
                              <th style={{ width: '10%' }}>Data</th>
                              <th style={{ width: '10%' }}>Itens</th>
                              <th style={{ width: '10%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {localizacoes.map((g, idx) => (
                              <tr key={`local-${g.pedido}-${idx}`}>
                                <td>{g.pedido}</td>
                                <td>{g.cliente}</td>
                                <td>{g.bairro || '-'}</td>
                                <td>{g.data ? g.data.toLocaleDateString('pt-BR') : '-'}</td>
                                <td>{g.itens}</td>
                                <td>
                                  <button
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: '0.62rem', lineHeight: 1 }}
                                    onClick={() => abrirPedido(Number(g.pedido))}
                                  >
                                    Visualizar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card border-warning" style={{ height: '230px', display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header py-1 bg-warning bg-opacity-10 text-warning-emphasis fw-bold d-flex justify-content-between align-items-center" style={{ fontSize: '0.74rem' }}>
                    <span>Pedidos para Coleta</span>
                    <span className="badge bg-warning rounded-pill text-dark">{coletas.length}</span>
                  </div>
                  <div className="card-body p-0" style={{ fontSize: '0.6rem', flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    {coletas.length === 0 ? (
                      <span className="text-muted">Sem pedidos para coleta</span>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm" style={{ fontSize: '0.6rem', lineHeight: 1.08 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '12%' }}>TV8</th>
                              <th style={{ width: '28%' }}>Cliente</th>
                              <th style={{ width: '20%' }}>Bairro</th>
                              <th style={{ width: '20%' }}>Data</th>
                              <th style={{ width: '10%' }}>Itens</th>
                              <th style={{ width: '10%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {coletas.map((g, idx) => (
                              <tr key={`coleta-${g.pedido}-${idx}`}>
                                <td>{g.pedido}</td>
                                <td>{g.cliente}</td>
                                <td>{g.bairro || '-'}</td>
                                <td>{g.data ? g.data.toLocaleDateString('pt-BR') : '-'}</td>
                                <td>{g.itens}</td>
                                <td>
                                  <button
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: '0.62rem', lineHeight: 1 }}
                                    onClick={() => abrirPedido(Number(g.pedido))}
                                  >
                                    Visualizar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer py-1">
              <button
                className="btn btn-primary btn-sm py-1 px-2 d-inline-flex align-items-center gap-2"
                style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '55px' }}
                disabled={!!validando}
                onClick={() => onValidar()}
              >
                {validando && (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                )}
                {validando ? 'Validando...' : 'Validar'}
              </button>
            </div>
            {validando && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(255,255,255,0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 5,
                }}
              >
                <div className="d-flex align-items-center gap-3" style={{ fontSize: '0.8rem' }}>
                  <div className="spinner-border text-primary" role="status" style={{ width: '1.6rem', height: '1.6rem' }}>
                    <span className="visually-hidden">Validando</span>
                  </div>
                  <span className="fw-semibold">Validando carregando…</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendenciasBloqueioModal;
