import React from 'react';
import type { PedidoAnaliseGroup } from './PedidosParaAnaliseModal';

interface Props {
  pedidos: PedidoAnaliseGroup[];
  onClose: () => void;
  onTriagem: (g: PedidoAnaliseGroup) => void;
  PedidoCardComponent: React.ComponentType<{
    g: PedidoAnaliseGroup;
    onTriagem: (g: PedidoAnaliseGroup) => void;
  }>;
}

const ColetaSeparandoStatus21Modal: React.FC<Props> = ({ pedidos, onClose, onTriagem, PedidoCardComponent }) => {
  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content">
          <div className="modal-header bg-warning text-dark">
            <h5 className="modal-title">Pedidos Coleta Separando (Status 21)</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body bg-light">
             {pedidos.length === 0 && (
                <div className="alert alert-info">Nenhum pedido neste status.</div>
             )}
             <div className="d-flex flex-column gap-2">
                {pedidos.map(g => (
                   <PedidoCardComponent key={g.pedido} g={g} onTriagem={onTriagem} />
                ))}
             </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColetaSeparandoStatus21Modal;
