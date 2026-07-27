import React, { useState } from "react";
import { Card } from "react-bootstrap";
import { FileEarmarkText, Upload } from "react-bootstrap-icons";
import ImportarPlanilhaModal from "./modals/contasApagar/ImportarPlanilhaModal";

interface ContasApagarProps {
  onClose: () => void;
}

const ContasApagar: React.FC<ContasApagarProps> = ({ onClose }) => {
  const [showImportarPlanilha, setShowImportarPlanilha] = useState(false);

  return (
    <div className="p-3 h-100 overflow-auto">
      <Card className="shadow-sm border-0 h-100 d-flex flex-column">
        <Card.Header className="bg-danger text-white d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <FileEarmarkText size={18} />
            <h5 className="mb-0">Contas à Pagar</h5>
          </div>
          <button type="button" className="btn-close btn-close-white" aria-label="Fechar" onClick={onClose} />
        </Card.Header>
        <Card.Body className="flex-grow-1 overflow-auto">
          <div className="text-muted">Conteúdo em desenvolvimento...</div>
        </Card.Body>
        <Card.Footer className="bg-white d-flex justify-content-end">
          <button
            type="button"
            className="btn btn-primary btn-sm d-flex align-items-center gap-1 py-1 px-2"
            style={{ fontSize: "0.75rem", lineHeight: 1.1 }}
            onClick={() => setShowImportarPlanilha(true)}
          >
            <Upload size={16} />
            <span>Importar planilha</span>
          </button>
        </Card.Footer>
      </Card>
      <ImportarPlanilhaModal show={showImportarPlanilha} onHide={() => setShowImportarPlanilha(false)} />
    </div>
  );
};

export default ContasApagar;
