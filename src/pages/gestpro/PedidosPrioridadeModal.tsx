import React, { useState, useEffect, useMemo } from "react";
import { Search, BoxArrowUpRight, Person, Calendar, Shop, PlusCircle } from "react-bootstrap-icons";

interface PedidosPrioridadeModalProps {
  onClose: () => void;
}

interface PedidoItem {
  NUMPED: number;
  NUMPEDENTFUT: number | null;
  OBS: string;
  OBS1: string;
  OBS2: string;
  CODCLI: number;
  CLIENTE: string;
  VLTOTAL: number;
  CODFILIAL: string;
  DATA: string;
  CODUSUR: number;
  NOME: string; // Vendedor
  ENDERENT: string;
  NUMEROENT: string;
  BAIRROENT: string;
  MUNICENT: string;
  CEP: string;
  LOG2: string;
  // Item details
  CODPROD: number;
  DESCRICAO: string;
  QT: number;
  POSICAO: string;
  SEPERADOR_ITEM: string;
  SEPERADOR: string;
  MOTIVO_CORTE?: string;
}

interface OrderGroup {
  NUMPED: number;
  header: PedidoItem;
  items: PedidoItem[];
}

// Interface simplificada para o retorno da busca individual
interface PedidoBuscaItem {
  NUMPED: number;
  TV7: number | null;
  CODUSUR: number;
  NOME: string;
  DATA: string;
  CODCLI: number;
  CLIENTE: string;
  CODFILIAL: string;
  VLTOTAL: number;
  CODPROD: number;
  DESCRICAO: string;
  CODAUXILIAR: string;
  QT: number;
  PVENDA: number;
  STATUS_PEDIDO?: string | number;
}

const STATUS_LABELS: Record<number, string> = {
  0: 'Aguardando Visualização',
  1: 'Visualizado',
  2: 'Separando',
  3: 'Separado',
  4: 'Aguardando rota',
  5: 'Incluído em rota',
  6: 'Saindo em rota',
  7: 'Entregue',
  8: 'Retornou',
  9: 'Entrega em dia Específico',
  10: 'Aguardando Fornecedor',
  11: 'Entrega Fracionada',
  12: 'Entrega em horário Específico',
  13: 'Corte',
  14: 'Pegar Localização',
  15: 'Faturar',
  16: 'Separação Cancelada',
  17: 'Coleta',
  18: 'Localização Inserida',
  19: 'Coleta Separada',
  20: 'Enviar p/ Messejana',
  21: 'Coleta Separando',
  22: 'Corte Realizado',
  23: 'Pedidos Prioridade',
  24: 'Entrega Futura',
  25: 'Retira Posterior',
};

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

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
};

const PedidosPrioridadeModal: React.FC<PedidosPrioridadeModalProps> = ({ onClose }) => {
  // Lista de prioridades (Status 23)
  const [rawItems, setRawItems] = useState<PedidoItem[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [errorList, setErrorList] = useState<string | null>(null);
  const [filterTerm, setFilterTerm] = useState("");

  // Busca individual
  const [searchNumped, setSearchNumped] = useState("");
  const [searchResult, setSearchResult] = useState<PedidoBuscaItem[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [errorSearch, setErrorSearch] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [addingPriority, setAddingPriority] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ visible: boolean, numped: number | null }>({ visible: false, numped: null });

  const fetchOrders = async () => {
    setLoadingList(true);
    setErrorList(null);
    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestpro/pedidos-prioridade`);
      
      if (!resp.ok) {
        throw new Error("Erro ao buscar pedidos prioridade");
      }

      const data = await resp.json();
      setRawItems(data.rows || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao buscar pedidos";
      setErrorList(msg);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSearchPedido = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchNumped.trim()) return;

    setLoadingSearch(true);
    setErrorSearch(null);
    setSearched(true);
    setSearchResult([]);

    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestpro/conciliacao-tv7/buscar-pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numped: searchNumped }),
      });

      if (!resp.ok) {
        throw new Error("Erro ao buscar pedido");
      }

      const data = await resp.json();
      setSearchResult(data.rows || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao buscar pedido";
      setErrorSearch(msg);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleAddPriority = (numped: number) => {
    setConfirmModal({ visible: true, numped });
  };

  const executeAddPriority = async () => {
    if (!confirmModal.numped) return;
    const numped = confirmModal.numped;
    
    setAddingPriority(true);
    try {
        const baseApi = resolveBaseApi();
        const resp = await fetch(`${baseApi}/gestpro/definir-prioridade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ numped }),
        });

        if (!resp.ok) {
            throw new Error("Erro ao definir prioridade");
        }

        // Atualizar status no GestLOG também
        await fetch(`${baseApi}/gestlog/atualizar-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                numped, 
                status: 23, 
                usuario: "GESTPRO" 
            }),
        });
        
        // Limpar busca e atualizar lista
        setSearchNumped("");
        setSearchResult([]);
        setSearched(false);
        setConfirmModal({ visible: false, numped: null });
        fetchOrders(); // Recarrega a lista
        
        // alert(`Pedido ${numped} definido como prioridade com sucesso!`); 
        // Não precisa mais de alert se já deu feedback visual ou podemos mostrar um toast, mas por hora apenas fecha.

    } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha ao definir prioridade";
        alert(msg);
    } finally {
        setAddingPriority(false);
    }
  };

  const groupedOrders = useMemo(() => {
    const groups: Record<number, OrderGroup> = {};
    
    rawItems.forEach(item => {
      if (!groups[item.NUMPED]) {
        groups[item.NUMPED] = {
          NUMPED: item.NUMPED,
          header: item,
          items: []
        };
      }
      groups[item.NUMPED].items.push(item);
    });

    let result = Object.values(groups).sort((a, b) => {
        return new Date(b.header.DATA).getTime() - new Date(a.header.DATA).getTime();
    });

    if (filterTerm) {
        const lower = filterTerm.toLowerCase();
        result = result.filter(g => 
            g.NUMPED.toString().includes(lower) || 
            g.header.CLIENTE.toLowerCase().includes(lower) ||
            g.header.CODCLI.toString().includes(lower)
        );
    }

    return result;
  }, [rawItems, filterTerm]);

  // Header do resultado da busca individual
  const searchHead = searchResult.length > 0 ? searchResult[0] : null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
      <div className="modal fade show" style={{ display: "block", zIndex: 1050 }} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-fullscreen">
          <div className="modal-content bg-light">
            <div className="modal-header bg-white border-bottom shadow-sm">
              <h5 className="modal-title d-flex align-items-center gap-2">
                 <BoxArrowUpRight className="text-danger" /> Pedidos Prioridade (Status 23)
              </h5>
              <div className="ms-auto">
                  <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
              </div>
            </div>
            
            <div className="modal-body p-4" style={{ backgroundColor: "#f8f9fa" }}>
              <div className="container-fluid" style={{ maxWidth: "1200px" }}>
                
                {/* Seção de Busca / Adição */}
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-white py-3">
                        <h6 className="mb-0 fw-bold text-primary">Consultar / Adicionar Pedido</h6>
                    </div>
                    <div className="card-body">
                        <form onSubmit={handleSearchPedido} className="row g-3 align-items-end">
                            <div className="col-auto">
                                <label htmlFor="searchNumped" className="form-label small fw-bold text-muted mb-1">Número do Pedido</label>
                                <div className="input-group">
                                    <input 
                                        type="text" 
                                        id="searchNumped"
                                        className="form-control" 
                                        placeholder="Ex: 123456"
                                        value={searchNumped}
                                        onChange={e => setSearchNumped(e.target.value)}
                                    />
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary"
                                        disabled={loadingSearch || !searchNumped}
                                    >
                                        {loadingSearch ? <span className="spinner-border spinner-border-sm" /> : <Search />} Buscar
                                    </button>
                                </div>
                            </div>
                        </form>

                        {errorSearch && (
                            <div className="alert alert-danger mt-3 py-2 mb-0">
                                {errorSearch}
                            </div>
                        )}

                        {searched && !loadingSearch && !errorSearch && searchResult.length === 0 && (
                            <div className="alert alert-warning mt-3 py-2 mb-0">
                                Pedido não encontrado.
                            </div>
                        )}

                        {searchHead && (
                            <div className="mt-3 border rounded p-3 bg-white animate__animated animate__fadeIn">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <div className="d-flex align-items-center gap-2">
                                            <h5 className="mb-0 fw-bold">Pedido #{searchHead.NUMPED}</h5>
                                            <span className="badge bg-light text-dark border">
                                                {formatDate(searchHead.DATA)}
                                            </span>
                                            {searchHead.STATUS_PEDIDO !== undefined && (
                                                <span className={`badge ${Number(searchHead.STATUS_PEDIDO) === 23 ? 'bg-danger' : 'bg-info'} ms-2`}>
                                                    {STATUS_LABELS[Number(searchHead.STATUS_PEDIDO)] || `Status ${searchHead.STATUS_PEDIDO}`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2 text-muted small">
                                            <span className="fw-bold text-uppercase me-3">Cliente:</span> 
                                            {searchHead.CODCLI} - {searchHead.CLIENTE || "Nome não disponível"}
                                        </div>
                                        <div className="text-muted small">
                                            <span className="fw-bold text-uppercase me-3">Vendedor:</span> 
                                            {searchHead.CODUSUR} - {searchHead.NOME}
                                        </div>
                                        <div className="text-muted small">
                                            <span className="fw-bold text-uppercase me-3">Data:</span> 
                                            {formatDate(searchHead.DATA)}
                                        </div>
                                        <div className="text-muted small">
                                            <span className="fw-bold text-uppercase me-3">Filial:</span> 
                                            {searchHead.CODFILIAL}
                                        </div>
                                        <div className="text-muted small">
                                            <span className="fw-bold text-uppercase me-3">Valor Total:</span> 
                                            {currency(searchHead.VLTOTAL)}
                                        </div>
                                        {searchHead.TV7 && (
                                          <div className="text-muted small">
                                              <span className="fw-bold text-uppercase me-3">TV7:</span> 
                                              {searchHead.TV7}
                                          </div>
                                        )}
                                    </div>
                                    <div>
                                        <button 
                                            className="btn btn-success d-flex align-items-center gap-2 shadow-sm"
                                            onClick={() => handleAddPriority(searchHead.NUMPED)}
                                            disabled={addingPriority}
                                        >
                                            {addingPriority ? <span className="spinner-border spinner-border-sm" /> : <PlusCircle />} Definir como Prioridade
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-top">
                                  <div className="table-responsive" style={{maxHeight: "200px"}}>
                                      <table className="table table-sm table-striped table-hover mb-0">
                                          <thead className="table-light sticky-top">
                                              <tr>
                                                  <th style={{fontSize: "0.75rem"}}>Cód. Aux.</th>
                                                  <th style={{fontSize: "0.75rem"}}>Produto</th>
                                                  <th className="text-end" style={{fontSize: "0.75rem"}}>Qtde</th>
                                                  <th className="text-end" style={{fontSize: "0.75rem"}}>P. Venda</th>
                                              </tr>
                                          </thead>
                                          <tbody>
                                              {searchResult.map((item, idx) => (
                                                  <tr key={`${item.NUMPED}-${item.CODPROD}-${idx}`}>
                                                      <td style={{fontSize: "0.8rem"}}>{item.CODAUXILIAR}</td>
                                                      <td style={{fontSize: "0.8rem"}}>
                                                          <div className="text-truncate" style={{maxWidth: "250px"}} title={item.DESCRICAO}>
                                                              {item.CODPROD} - {item.DESCRICAO}
                                                          </div>
                                                      </td>
                                                      <td className="text-end" style={{fontSize: "0.8rem"}}>{item.QT}</td>
                                                      <td className="text-end" style={{fontSize: "0.8rem"}}>{currency(item.PVENDA)}</td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <hr className="my-4 text-muted" />

                {/* Seção da Lista de Prioridades */}

                {/* Modal de Confirmação */}
                {confirmModal.visible && (
                    <div className="modal fade show" style={{ display: "block", zIndex: 1060, backgroundColor: "rgba(0,0,0,0.5)" }} aria-modal="true" role="dialog">
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content shadow-lg border-0">
                                <div className="modal-header bg-warning bg-opacity-10 border-bottom-0">
                                    <h5 className="modal-title text-warning fw-bold d-flex align-items-center">
                                        <BoxArrowUpRight className="me-2" /> Confirmação
                                    </h5>
                                    <button 
                                        type="button" 
                                        className="btn-close" 
                                        onClick={() => setConfirmModal({ visible: false, numped: null })}
                                        disabled={addingPriority}
                                    ></button>
                                </div>
                                <div className="modal-body text-center py-4">
                                    <h5 className="mb-3">Deseja definir o pedido <span className="fw-bold text-primary">{confirmModal.numped}</span> como prioridade?</h5>
                                    <p className="text-muted small mb-0">Essa ação alterará o status do pedido para 23 (Pedidos Prioridade).</p>
                                </div>
                                <div className="modal-footer border-top-0 justify-content-center pb-4">
                                    <button 
                                        type="button" 
                                        className="btn btn-light px-4" 
                                        onClick={() => setConfirmModal({ visible: false, numped: null })}
                                        disabled={addingPriority}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="button" 
                                        className="btn btn-warning px-4 fw-bold"
                                        onClick={executeAddPriority}
                                        disabled={addingPriority}
                                    >
                                        {addingPriority ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                                        Confirmar Prioridade
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0 fw-bold text-secondary">Fila de Prioridade</h5>
                    <div className="input-group input-group-sm" style={{ width: '300px' }}>
                        <span className="input-group-text bg-white border-end-0">
                            <Search />
                        </span>
                        <input 
                            type="text" 
                            className="form-control border-start-0" 
                            placeholder="Filtrar na lista..."
                            value={filterTerm}
                            onChange={e => setFilterTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loadingList && (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Carregando...</span>
                        </div>
                    </div>
                )}

                {errorList && (
                  <div className="alert alert-danger shadow-sm py-3" role="alert">
                    {errorList}
                  </div>
                )}

                {!loadingList && !errorList && groupedOrders.length === 0 && (
                  <div className="alert alert-info shadow-sm text-center py-4" role="alert">
                    Nenhum pedido na fila de prioridade.
                  </div>
                )}

                {!loadingList && !errorList && groupedOrders.length > 0 && (
                    <div className="row g-4">
                        {groupedOrders.map(order => (
                            <div key={order.NUMPED} className="col-12">
                                <div className="card border-0 shadow-sm overflow-hidden">
                                    <div className="card-header bg-white border-bottom py-3">
                                        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <span className="badge bg-danger">Prioridade</span>
                                                    <h5 className="mb-0 fw-bold">Pedido #{order.NUMPED}</h5>
                                                    {order.header.NUMPEDENTFUT && (
                                                        <span className="badge bg-secondary">TV7: {order.header.NUMPEDENTFUT}</span>
                                                    )}
                                                </div>
                                                <div className="text-muted small d-flex align-items-center gap-3">
                                                    <span className="d-flex align-items-center gap-1">
                                                        <Calendar size={12} /> {formatDate(order.header.DATA)}
                                                    </span>
                                                    <span className="d-flex align-items-center gap-1">
                                                        <Shop size={12} /> Filial {order.header.CODFILIAL}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-end">
                                                <div className="fw-bold fs-5 text-success">{currency(order.header.VLTOTAL)}</div>
                                                <div className="small text-muted text-uppercase fw-bold">Valor Total</div>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-3 p-2 bg-light rounded border d-flex flex-wrap gap-4 text-secondary small">
                                            <div className="d-flex align-items-center gap-2">
                                                <Person size={16} />
                                                <div>
                                                    <div className="fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>Cliente</div>
                                                    <div className="text-dark fw-bold">{order.header.CODCLI} - {order.header.CLIENTE}</div>
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <Person size={16} />
                                                <div>
                                                    <div className="fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>Vendedor</div>
                                                    <div className="text-dark">{order.header.CODUSUR} - {order.header.NOME}</div>
                                                </div>
                                            </div>
                                        </div>
                                        {(order.header.OBS || order.header.OBS1) && (
                                            <div className="mt-2 text-muted small fst-italic">
                                                <span className="fw-bold">Obs:</span> {order.header.OBS} {order.header.OBS1}
                                            </div>
                                        )}
                                    </div>
                                    <div className="card-body p-0">
                                        <div className="table-responsive">
                                            <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.9rem' }}>
                                                <thead className="bg-light text-muted text-uppercase small">
                                                    <tr>
                                                        <th className="ps-4">Cód.</th>
                                                        <th>Produto</th>
                                                        <th className="text-center">Qtd.</th>
                                                        <th>Posição</th>
                                                        <th>Separador</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.items.map((item, idx) => (
                                                        <tr key={`${item.NUMPED}-${item.CODPROD}-${idx}`}>
                                                            <td className="ps-4 fw-bold text-secondary" style={{ width: '80px' }}>{item.CODPROD}</td>
                                                            <td>
                                                                <div>{item.DESCRICAO}</div>
                                                                {item.MOTIVO_CORTE && <div className="text-danger small">Corte: {item.MOTIVO_CORTE}</div>}
                                                            </td>
                                                            <td className="text-center fw-bold">{item.QT}</td>
                                                            <td>{item.POSICAO}</td>
                                                            <td>{item.SEPERADOR_ITEM || item.SEPERADOR || "-"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
              </div>
            </div>
            
            <div className="modal-footer bg-white border-top">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PedidosPrioridadeModal;
