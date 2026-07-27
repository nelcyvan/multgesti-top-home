import React, { useState, useMemo } from 'react';
import "bootstrap/dist/css/bootstrap.min.css";
import { PedidoCard, type PedidoGroup } from './Gestvendas';
import { Search } from "react-bootstrap-icons";

interface Props {
  onClose?: () => void;
  style?: React.CSSProperties;
  pedidos: PedidoGroup[];
  loading: boolean;
  error: string | null;
  embedded?: boolean;
}

const PedidosEmAbertoModal: React.FC<Props> = ({ onClose, style, pedidos, loading, error, embedded = false }) => {
  const [filtro, setFiltro] = useState('');

  const pedidosFiltrados = useMemo(() => {
    if (!filtro) return pedidos;
    const lower = filtro.toLowerCase();
    return pedidos.filter(p => p.cliente && p.cliente.toLowerCase().includes(lower));
  }, [pedidos, filtro]);

  const content = (
    <div className={`bg-light ${embedded ? 'h-100 d-flex flex-column' : 'modal-content'}`}>
      {!embedded && (
        <div className="modal-header py-2 px-3 border-bottom bg-white shadow-sm" style={{ height: '50px' }}>
          <h5 className="modal-title fs-6 fw-bold flex-grow-1">Pedidos em Aberto (01/01/2025 até hoje)</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
        </div>
      )}
      <div className={`${embedded ? 'flex-grow-1' : 'modal-body'} p-4 bg-light overflow-auto`}>
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Carregando...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger mx-2" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="container-fluid">
            <div className="row mb-3 align-items-center">
               <div className="col-12 col-md-6 mb-2 mb-md-0">
                 <div className="input-group">
                   <span className="input-group-text bg-white border-end-0">
                     <Search />
                   </span>
                   <input 
                     type="text" 
                     className="form-control border-start-0 ps-0" 
                     placeholder="Filtrar por nome do cliente..." 
                     value={filtro}
                     onChange={(e) => setFiltro(e.target.value)}
                   />
                 </div>
               </div>
               <div className="col-12 col-md-6 text-end">
                  <span className="badge bg-primary">{pedidosFiltrados.length} pedidos encontrados</span>
               </div>
            </div>
            {pedidosFiltrados.length === 0 ? (
              <div className="text-center py-5 card shadow-sm">
                <p className="mb-0 text-muted">Nenhum pedido encontrado{filtro ? ' com este filtro' : ''}.</p>
              </div>
            ) : (
              pedidosFiltrados.map((g) => (
                <PedidoCard key={g.pedido} g={g} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", ...style }}>
      <div className="modal-dialog modal-fullscreen">
        {content}
      </div>
    </div>
  );
};

export default PedidosEmAbertoModal;
