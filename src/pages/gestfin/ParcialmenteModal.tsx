import React from "react";
import { type LancamentosApagarRow } from "../../services/gestfin/BucarLancamentosApagar";

interface ParcialmenteModalProps {
  isOpen: boolean;
  onClose: () => void;
  dadosLinha: LancamentosApagarRow | null;
}

const ParcialmenteModal: React.FC<ParcialmenteModalProps> = ({ isOpen, onClose, dadosLinha }) => {
  const visible = !!dadosLinha && isOpen;

  const formatISODateToBR = (iso?: string): string | null => {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
  };

  const renderWithCommaBreaks = (val: unknown) => {
    if (val === null || val === undefined) return null;
    const str = String(val);
    const parts = str.split(/,(?!\d)/);
    if (parts.length === 1) return str;
    return (
      <>
        {parts.map((p, i) => (
          <span key={i}>
            {p.trim()}
            {i < parts.length - 1 && (<><span>,</span><br /></>)}
          </span>
        ))}
      </>
    );
  };

  if (!visible) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} onClick={onClose}></div>
      <div
        className={`modal fade ${visible ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        style={{ display: "block", zIndex: 1070 }}
      >
        <div className="modal-dialog modal-md modal-dialog-centered" role="document" style={{ maxWidth: "40vw" }}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Conciliação Parcial</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar"></button>
            </div>

            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
              <div className="row mb-2">
                <div className="col-md-12">
                  <h6 className="text-primary mb-2">Resumo do Lançamento</h6>
                </div>
              </div>

              <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.7rem" }}>
                <tbody>
                  <tr>
                    <td><strong>ID Importação OFX:</strong></td>
                    <td>{dadosLinha?.ID_IMPORTACAO_OFX ?? '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Dt. Trans.:</strong></td>
                    <td>{formatISODateToBR(dadosLinha?.DATA_TRANSACAO) ?? '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Histórico OFX:</strong></td>
                    <td style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{renderWithCommaBreaks(dadosLinha?.HISTORICO)}</td>
                  </tr>
                  <tr>
                    <td><strong>Recnum:</strong></td>
                    <td>{renderWithCommaBreaks(dadosLinha?.RECNUM_PRINCIPAL_OU_PARCIAIS)}</td>
                  </tr>
                  <tr>
                    <td><strong>Valor:</strong></td>
                    <td>{renderWithCommaBreaks(dadosLinha?.VALOR_LANCAMENTO_INTERNO)}</td>
                  </tr>
                  <tr>
                    <td><strong>Desc.:</strong></td>
                    <td className="text-primary">{renderWithCommaBreaks(dadosLinha?.DESCONTOFIN)}</td>
                  </tr>
                  <tr>
                    <td><strong>Juros:</strong></td>
                    <td className="text-danger">{renderWithCommaBreaks(dadosLinha?.JUROS)}</td>
                  </tr>
                  <tr>
                    <td><strong>Dt. Pgto:</strong></td>
                    <td>{renderWithCommaBreaks(dadosLinha?.DTPAGTO)}</td>
                  </tr>
                  <tr>
                    <td><strong>Status:</strong></td>
                    <td>{renderWithCommaBreaks(dadosLinha?.STATUS_PAGAMENTO)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ParcialmenteModal;