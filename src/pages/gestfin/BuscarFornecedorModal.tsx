import React from "react";
import { type FornecedorItem } from "../../services/gestfin/NovoLancamento";

interface BuscarFornecedorModalProps {
  isOpen: boolean;
  term: string;
  onTermChange: (v: string) => void;
  onBuscar: () => void;
  loading: boolean;
  resultados: FornecedorItem[];
  onSelect: (it: FornecedorItem) => void;
  onClose: () => void;
}

const BuscarFornecedorModal: React.FC<BuscarFornecedorModalProps> = ({ isOpen, term, onTermChange, onBuscar, loading, resultados, onSelect, onClose }) => {
  if (!isOpen) return null;
  return (
    <>
      {/* Backdrop adicional para destacar sobre o modal principal */}
      <div className="modal-backdrop fade show" style={{ zIndex: 3995, backgroundColor: "rgba(0,0,0,0.45)" }} />

      {/* Modal de Busca de Fornecedores */}
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 4000 }}>
        <div className="modal-dialog modal-md modal-dialog-centered" role="document">
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Buscar Fornecedor</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
              <div className="mb-3">
                <label className="form-label">Digite nome ou código</label>
                <div className="input-group input-group-sm">
                  <input type="text" className="form-control form-control-sm" value={term} onChange={(e) => onTermChange(e.target.value)} style={{ fontSize: "0.7rem", height: "28px" }} />
                  <button className="btn btn-outline-primary btn-sm py-1 px-2" type="button" onClick={onBuscar} disabled={loading} style={{ fontSize: "0.7rem", lineHeight: 1.1 }}>
                    {loading ? "Buscando..." : "Buscar"}
                  </button>
                </div>
              </div>
              <div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Código</th>
                      <th>Fornecedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map((it) => (
                      <tr key={`fornec-${it.CODFORNEC}`} style={{ cursor: "pointer" }} onClick={() => onSelect(it)}>
                        <td>{it.CODFORNEC}</td>
                        <td>{it.FORNECEDOR}</td>
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
            <div className="modal-footer py-2">
              <button type="button" className="btn btn-secondary btn-sm py-1 px-2" onClick={onClose} style={{ fontSize: "0.7rem", lineHeight: 1.1 }}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BuscarFornecedorModal;