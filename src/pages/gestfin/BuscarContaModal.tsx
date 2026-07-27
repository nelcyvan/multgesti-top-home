import React, { useState } from "react";
import { type ContaItem } from "../../services/gestfin/NovoLancamento";
import ModalNovaConta from "./ModalNovaConta";

interface BuscarContaModalProps {
  isOpen: boolean;
  term: string;
  onTermChange: (v: string) => void;
  onBuscar: () => void;
  loading: boolean;
  resultados: ContaItem[];
  onSelect: (it: ContaItem) => void;
  onClose: () => void;
}

const BuscarContaModal: React.FC<BuscarContaModalProps> = ({ isOpen, term, onTermChange, onBuscar, loading, resultados, onSelect, onClose }) => {
  const [showModalNovaConta, setShowModalNovaConta] = useState<boolean>(false);

  const handleNovaContaSuccess = (novaConta: { CODCONTA: number; CONTA: string }) => {
    // Fecha o modal de nova conta
    setShowModalNovaConta(false);
    
    // Seleciona automaticamente a conta recém-criada
    const contaItem: ContaItem = {
      CODCONTA: novaConta.CODCONTA,
      CONTA: novaConta.CONTA
    };
    onSelect(contaItem);
  };
  if (!isOpen) return null;
  return (
    <>
      {/* Backdrop adicional para destacar sobre o modal principal */}
      <div className="modal-backdrop fade show" style={{ zIndex: 3995, backgroundColor: "rgba(0,0,0,0.45)" }} />

      {/* Modal de Busca de Contas */}
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 4000 }}>
        <div className="modal-dialog modal-md modal-dialog-centered" role="document">
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Buscar Conta</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
              <div className="mb-3">
                <label className="form-label">Digite nome ou código</label>
                <div className="input-group input-group-sm">
                  <input type="text" className="form-control form-control-sm" value={term} onChange={(e) => onTermChange(e.target.value)} style={{ fontSize: "0.7rem", height: "28px" }} />
                  <button className="btn btn-outline-primary btn-sm py-1 px-2" type="button" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onBuscar} disabled={loading}>
                    {loading ? "Buscando..." : "Buscar"}
                  </button>
                </div>
              </div>
              <div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="table table-sm table-hover" style={{ fontSize: "0.7rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Código</th>
                      <th>Conta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((it) => (
                      <tr key={`conta-${it.CODCONTA}`} style={{ cursor: "pointer" }} onClick={() => onSelect(it)}>
                        <td>{it.CODCONTA}</td>
                        <td>{it.CONTA}</td>
                      </tr>
                    ))}
                    {!loading && resultados.length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-muted">Nenhum resultado</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onClose}>Fechar</button>
              <button type="button" className="btn btn-primary btn-sm py-1 px-2 ms-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={() => setShowModalNovaConta(true)}>Nova Conta</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nova Conta */}
      <ModalNovaConta
        isOpen={showModalNovaConta}
        onClose={() => setShowModalNovaConta(false)}
        onSuccess={handleNovaContaSuccess}
      />
    </>
  );
};

export default BuscarContaModal;