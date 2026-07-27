import React from 'react';
import type { PedidoAnaliseGroup } from './PedidosParaAnaliseModal';

interface Props {
  pedido: PedidoAnaliseGroup;
  onClose: () => void;
  onSuccess?: () => void;
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

const TriagemModal: React.FC<Props> = ({ pedido, onClose, onSuccess }) => {
  const [loading, setLoading] = React.useState(false);

  const handleStatusUpdate = async (status: number) => {
    setLoading(true);
    try {
      let usuario = 'APP';
      try {
        const stored = localStorage.getItem('usuarioLogado');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.nome) usuario = parsed.nome;
          else if (parsed && parsed.usuario) usuario = parsed.usuario;
        }
      } catch (e) {
        console.warn('Erro ao ler usuarioLogado', e);
      }

      const baseApi = resolveBaseApi();
      const response = await fetch(`${baseApi}/gestlog/atualizar-status-especial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numped: pedido.pedido,
          status: status,
          usuario: usuario,
        }),
      });

      if (response.ok) {
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content shadow-lg">
          <div className="modal-header bg-light py-2 px-3">
            <h5 className="modal-title fs-6">Triagem - Pedido {pedido.pedido}</h5>
            <button type="button" className="btn-close btn-sm" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body p-2">
             {/* Resumo do Pedido */}
             <div className="card mb-2 border-0 bg-light">
                <div className="card-body p-2">
                   <div className="row g-1">
                      <div className="col-md-6">
                         <div className="d-flex flex-column">
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>Cliente</span>
                            <span className="fw-bold" style={{ fontSize: '0.75rem' }}>{pedido.cliente} ({pedido.codCli})</span>
                         </div>
                      </div>
                      <div className="col-md-3">
                         <div className="d-flex flex-column">
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>Data</span>
                            <span className="fw-bold" style={{ fontSize: '0.75rem' }}>{pedido.data}</span>
                         </div>
                      </div>
                      <div className="col-md-3">
                         <div className="d-flex flex-column">
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>Filial</span>
                            <span className="fw-bold" style={{ fontSize: '0.75rem' }}>{pedido.codFilial}</span>
                         </div>
                      </div>
                      
                      <div className="col-md-6">
                         <div className="d-flex flex-column">
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>Vendedor</span>
                            <span className="fw-bold" style={{ fontSize: '0.75rem' }}>{pedido.vendedor}</span>
                         </div>
                      </div>
                      <div className="col-md-3">
                         <div className="d-flex flex-column">
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>Tipo Entrega</span>
                            <span className="fw-bold" style={{ fontSize: '0.75rem' }}>{pedido.tipoEntrega}</span>
                         </div>
                      </div>
                      <div className="col-md-3">
                         <div className="d-flex flex-column">
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>Posição</span>
                            <span className="fw-bold" style={{ fontSize: '0.75rem' }}>{pedido.posicao}</span>
                         </div>
                      </div>
                   </div>
                   
                   {/* Observações */}
                   {(() => {
                      const obsList = [
                        pedido.obs, pedido.obs1, pedido.obs2, 
                        pedido.obsEntrega1, pedido.obsEntrega2, pedido.obsEntrega3
                      ].filter(o => o && o.trim().length > 0);
                      
                      if (obsList.length === 0) return null;
                      
                      return (
                        <div className="mt-2 pt-2 border-top">
                          <span className="text-muted d-block" style={{ fontSize: '0.65rem' }}>Observações</span>
                          <span className="fw-bold text-danger" style={{ fontSize: '0.75rem' }}>{obsList.join(', ')}</span>
                        </div>
                      );
                   })()}
                </div>
             </div>

             {/* Itens */}
             <h6 className="mb-1 text-secondary" style={{ fontSize: '0.75rem' }}>Itens do Pedido</h6>
             <div className="table-responsive border rounded bg-white" style={{ maxHeight: '300px' }}>
                <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.7rem' }}>
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{ width: '10%' }}>Cód.</th>
                      <th style={{ width: '50%' }}>Descrição</th>
                      <th style={{ width: '20%' }} className="text-center">Qtd</th>
                      <th style={{ width: '20%' }} className="text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.items.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.codProd}</td>
                        <td>{it.descricao}</td>
                        <td className="text-center">{it.quantidade}</td>
                        <td className="text-center">{it.qtTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
          <div className="modal-footer bg-light py-1 px-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose} style={{ fontSize: '0.75rem' }} disabled={loading}>Cancelar</button>
            <button 
              type="button" 
              className="btn btn-primary btn-sm px-3" 
              style={{ fontSize: '0.75rem' }}
              onClick={() => handleStatusUpdate(15)}
              disabled={loading}
            >
              {loading ? 'Aguarde...' : 'Só faturar'}
            </button>
            <button 
              type="button" 
              className="btn btn-info btn-sm px-3 text-white" 
              style={{ fontSize: '0.75rem' }}
              onClick={() => handleStatusUpdate(10)}
              disabled={loading}
            >
              {loading ? 'Aguarde...' : 'Aguar. Fornec.'}
            </button>
            <button 
              type="button" 
              className="btn btn-danger btn-sm px-3" 
              style={{ fontSize: '0.75rem' }}
              onClick={() => handleStatusUpdate(13)}
              disabled={loading}
            >
              {loading ? 'Aguarde...' : 'Corte'}
            </button>
            <button 
              type="button" 
              className="btn btn-warning btn-sm px-3 text-dark" 
              style={{ fontSize: '0.75rem' }}
              onClick={() => handleStatusUpdate(17)}
              disabled={loading}
            >
              {loading ? 'Aguarde...' : 'Coletar'}
            </button>
            <button 
              type="button" 
              className="btn btn-info btn-sm px-3 text-white" 
              style={{ fontSize: '0.75rem' }}
              onClick={() => handleStatusUpdate(20)}
              disabled={loading}
            >
              {loading ? 'Aguarde...' : 'Ret. Messejana'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TriagemModal;