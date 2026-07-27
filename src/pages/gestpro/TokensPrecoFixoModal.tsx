import React from "react";

interface Props {
  onClose: () => void;
}

const TokensPrecoFixoModal: React.FC<Props> = ({ onClose }) => {
  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 3398, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3403 }}>
        <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
          <div className="modal-content" style={{ fontSize: "0.85rem", maxHeight: "92vh", minHeight: "70vh" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.95rem" }}>Tokens de Preço Fixo</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ minHeight: "68vh" }}>
              —
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TokensPrecoFixoModal;