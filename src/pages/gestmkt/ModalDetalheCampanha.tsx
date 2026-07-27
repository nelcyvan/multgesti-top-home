import React from "react";
import type { ProdutoPromocaoRow } from "../../services/gestmkt/ProdutosPromocao";

interface ModalDetalheCampanhaProps {
  isOpen: boolean;
  onClose: () => void;
  row: ProdutoPromocaoRow;
}

const ModalDetalheCampanha: React.FC<ModalDetalheCampanhaProps> = ({ isOpen, onClose, row }) => {
  if (!isOpen) return null;

  const formatMesPromocao = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const s = String(val).trim();
    // ISO completo ou YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const [, yyyy, mm] = m;
      return `${mm}/${yyyy}`;
    }
    // YYYY-MM
    m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const [, yyyy, mm] = m;
      return `${mm}/${yyyy}`;
    }
    // DD/MM/YYYY
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const [, , mm, yyyy] = m;
      return `${mm}/${yyyy}`;
    }
    return s;
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2995, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3000 }}>
        <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(1400px, 96vw)" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Detalhes da Campanha</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ["--input-font-size" as any]: "0.7rem" }}>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="card border-0 bg-light h-100">
                    <div className="card-body">
                      <h6 className="text-muted mb-3">Identificação</h6>
                      <div className="table-responsive">
                        <table className="table table-sm" style={{ fontSize: "0.7rem" }}>
                          <tbody>
                             <tr><th style={{ width: 180 }}>Filial</th><td>{String(row.CODFILIAL ?? '')}</td></tr>
                             <tr><th>ID</th><td>{String(row.ID ?? '')}</td></tr>
                             <tr><th>Produto</th><td>{String(row.CODPROD ?? '')}</td></tr>
                            <tr><th>Auxiliar</th><td>{String(row.CODAUXILIAR ?? '')}</td></tr>
                            <tr><th>Descrição</th><td>{String(row.DESCRICAO ?? '')}</td></tr>
                            <tr><th>Marca</th><td>{String(row.MARCA ?? '')}</td></tr>
                            <tr><th>Tipo Campanha</th><td>{String(row.TIPOCAMPANHA ?? '')}</td></tr>
                            <tr><th>Cod Preço Prom</th><td>{String(row.CODPRECOPROM ?? '')}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <div className="card border-0 bg-light h-100">
                    <div className="card-body">
                      <h6 className="text-muted mb-3">Datas e Preços</h6>
                      <div className="table-responsive">
                        <table className="table table-sm" style={{ fontSize: "0.7rem" }}>
                          <tbody>
                            <tr><th style={{ width: 180 }}>Mês Promoção</th><td>{formatMesPromocao(row.MES_DATA_PROMOCAO)}</td></tr>
                            <tr><th>Adicionado</th><td>{String(row.DT_ADD ?? '')}</td></tr>
                            <tr><th>Usuário</th><td>{String(row.CODUSUR_ADD ?? '')}</td></tr>
                            <tr><th>Preço Fictício</th><td>{Number(row.PRECOFICTICIO ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                            <tr><th>Preço Fixo</th><td>{Number(row.PRECOFIXO ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                            <tr><th>Início Vigência</th><td>{String(row.DTINICIOVIGENCIA ?? '')}</td></tr>
                            <tr><th>Fim Vigência</th><td>{String(row.DTFIMVIGENCIA ?? '')}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
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

export default ModalDetalheCampanha;