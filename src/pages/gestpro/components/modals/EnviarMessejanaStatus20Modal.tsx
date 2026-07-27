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

const EnviarMessejanaStatus20Modal: React.FC<Props> = ({ pedidos, onClose, onTriagem, PedidoCardComponent }) => {
  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content d-flex flex-column h-100">
          <div className="modal-header">
            <h5 className="modal-title">Pedidos Ret. Messejana (Status 20)</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body bg-light d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
            <div className="card flex-grow-1" style={{ minHeight: 0 }}>
              <div className="card-body" style={{ overflowY: "auto", minHeight: 0 }}>
                {pedidos.length === 0 ? (
                  <div className="alert alert-info mb-0">Nenhum pedido neste status.</div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {pedidos.map((g) => (
                      <PedidoCardComponent key={g.pedido} g={g} onTriagem={onTriagem} />
                    ))}
                  </div>
                )}
              </div>
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

export default EnviarMessejanaStatus20Modal;
