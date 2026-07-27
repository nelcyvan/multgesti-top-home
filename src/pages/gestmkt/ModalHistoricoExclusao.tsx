import React, { useEffect, useState } from "react";
import { buscarHistoricoCampanhas, type HistoricoCampanhaRow } from "../../services/gestmkt/HistoricoCampanhas";

interface ModalHistoricoExclusaoProps {
  isOpen: boolean;
  onClose: () => void;
  codProd: number;
}

// Formatters
const toDMY = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

const ModalHistoricoExclusao: React.FC<ModalHistoricoExclusaoProps> = ({ isOpen, onClose, codProd }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<HistoricoCampanhaRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && codProd) {
      setLoading(true);
      setError("");
      buscarHistoricoCampanhas(codProd)
        .then((res) => setRows(res.rows))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen, codProd]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 3200, backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3210 }}>
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Histórico de Campanhas (Prod: {codProd})</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem" }}>
              {loading && <div className="text-center py-3">Carregando...</div>}
              {error && <div className="alert alert-danger py-2 mb-2" style={{ fontSize: "0.75rem" }}>{error}</div>}
              {!loading && !error && rows.length === 0 && (
                <div className="text-center text-muted py-3">Nenhum histórico encontrado.</div>
              )}
              {!loading && !error && rows.length > 0 && (
                <div className="table-responsive" style={{ maxHeight: "60vh" }}>
                  <table className="table table-sm table-striped table-hover small mb-0">
                    <thead>
                      <tr>
                        <th>Data Add</th>
                        <th>Tipo</th>
                        <th>Mês Promo</th>
                        <th>Preço Fixo</th>
                        <th>Início</th>
                        <th>Fim</th>
                        <th>Quem Add</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={r.ID || idx}>
                          <td>{toDMY(r.DT_ADD)}</td>
                          <td>{r.TIPO_CAMPANHA}</td>
                          <td>{toDMY(r.MES_DATA_PROMOCAO)}</td>
                          <td>{r.PRECOFIXO?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                          <td>{toDMY(r.DT_INICIO_CAMPANHA)}</td>
                          <td>{toDMY(r.DT_FIM_CAMPANHA)}</td>
                          <td>{r.CODUSUR_ADD}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer py-2">
               <button 
                 type="button" 
                 className="btn btn-secondary btn-sm py-1 px-2" 
                 style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                 onClick={onClose}
               >
                 Fechar
               </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalHistoricoExclusao;
