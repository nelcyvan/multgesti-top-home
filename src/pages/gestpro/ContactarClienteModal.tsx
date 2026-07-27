import React from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import type { ClientesSemVendaRow } from "../../services/gestpro/ClientesSemVenda";

interface ContactarClienteModalProps {
  cliente: ClientesSemVendaRow | null;
  onClose: () => void;
}

const ContactarClienteModal: React.FC<ContactarClienteModalProps> = ({ cliente, onClose }) => {
  const [showContacts, setShowContacts] = React.useState(false);
  const [isContacting, setIsContacting] = React.useState(false);

  const contactsVisible = React.useMemo(() => {
    if (showContacts) return true;
    if (!cliente) return false;
    // Se tiver qualquer status definido (não nulo/vazio), libera visualização
    return cliente.STATUS_ATUAL !== null && cliente.STATUS_ATUAL !== undefined && String(cliente.STATUS_ATUAL).trim() !== '';
  }, [showContacts, cliente]);

  React.useEffect(() => {
    if (cliente) {
      const isStatus1 = String(cliente.STATUS_ATUAL) === "1";
      setShowContacts(isStatus1);
      setIsContacting(isStatus1);
    }
  }, [cliente]);

  const handleContactar = async () => {
    if (!cliente) return;
    try {
      const storedUser = localStorage.getItem("usuarioLogado");
      const user = storedUser ? JSON.parse(storedUser) : {};
      const codusur = user.codusur || user.CODUSUR || user.matricula || user.MATRICULA;
      const nomeResponsavel = user.nome || user.NOME || user.nome_guerra || user.NOME_GUERRA;

      await fetch("/api/gestpro/salvar-cliente-sem-venda", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          codcli: cliente.CODCLI,
          codusur: codusur ? Number(codusur) : null,
          contactado: new Date(),
          status: 1, // Status 1 = Iniciou contato
          ultimaData: new Date(),
          nomeResponsavel: nomeResponsavel || null
        }),
      });
    } catch (error) {
      console.error("Erro ao salvar contato:", error);
    }
    setShowContacts(true);
    setIsContacting(true);
  };

  const handleFinalizar = async () => {
    if (!cliente) return;
    try {
      const storedUser = localStorage.getItem("usuarioLogado");
      const user = storedUser ? JSON.parse(storedUser) : {};
      const codusur = user.codusur || user.CODUSUR || user.matricula || user.MATRICULA;
      const nomeResponsavel = user.nome || user.NOME || user.nome_guerra || user.NOME_GUERRA;

      await fetch("/api/gestpro/salvar-cliente-sem-venda", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          codcli: cliente.CODCLI,
          codusur: codusur ? Number(codusur) : null,
          contactado: new Date(),
          status: 2, // Status 2 = Finalizado
          ultimaData: new Date(),
          nomeResponsavel: nomeResponsavel || null
        }),
      });
      onClose();
    } catch (error) {
      console.error("Erro ao finalizar contato:", error);
    }
  };

  if (!cliente) return null;

  const currency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <>
      <style>
        {`
          .custom-modal-shadow .modal-content {
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
            border: none;
          }
          .custom-backdrop-contactar {
            z-index: 3150 !important;
            background-color: rgba(0, 0, 0, 0.6) !important;
            backdrop-filter: blur(30px);
          }
        `}
      </style>
      <Modal 
        show={!!cliente} 
        onHide={onClose} 
        centered 
        dialogClassName="custom-modal-shadow"
        backdropClassName="custom-backdrop-contactar"
        style={{ zIndex: 3200 }}
      >
        <Modal.Header closeButton className="py-2 bg-light">
          <Modal.Title style={{ fontSize: "1rem" }}>Contactar Cliente</Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-2">
          <div className="container-fluid" style={{ fontSize: "0.85rem" }}>
            {/* Seção 1: Dados Principais e Contato (lado a lado se possível, ou stackado melhor) */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body p-2">
                <Row className="align-items-start">
                  <Col xs={12} className="mb-2 border-bottom pb-1">
                    <strong className="text-primary" style={{ fontSize: "0.9rem" }}>{cliente.CLIENTE}</strong>
                  </Col>
                  
                  {/* Detalhes Cliente */}
                  <Col xs={6} md={7}>
                    <div className="mb-1">
                      <small className="text-muted d-block">Localização</small>
                      <span className="fw-medium">{cliente.MUNICENT} - {cliente.BAIRROENT}</span>
                    </div>
                    <div>
                      <small className="text-muted d-block">Código</small>
                      <span className="fw-medium">{cliente.CODCLI}</span>
                    </div>
                  </Col>

                  {/* Contatos - Sempre visível mas destacado */}
                  <Col xs={6} md={5} className="bg-light rounded p-2 border">
                     <div className="mb-2">
                        <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>TELEFONE</small>
                        <span className="fw-bold text-dark" style={{ fontSize: "0.95rem" }}>
                          {contactsVisible ? (cliente.TELENT || "-") : <span className="text-muted" style={{ letterSpacing: '2px' }}>•••••••••••</span>}
                        </span>
                     </div>
                     <div>
                        <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>TEL. COBRANÇA</small>
                        <span className="fw-bold text-dark" style={{ fontSize: "0.95rem" }}>
                          {contactsVisible ? (cliente.TELCOB || "-") : <span className="text-muted" style={{ letterSpacing: '2px' }}>•••••••••••</span>}
                        </span>
                     </div>
                  </Col>
                </Row>
              </div>
            </div>

            {/* Seção 2: Histórico de Venda */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body p-2">
                <Row>
                  <Col xs={12} className="mb-2 border-bottom pb-1">
                     <strong className="text-secondary">Histórico de Venda</strong>
                  </Col>
                  <Col xs={6} md={3} className="mb-2 mb-md-0">
                    <small className="d-block text-muted">Últ. Compra</small>
                    <span className="fw-bold text-dark">
                      {new Date(cliente.DATA_ULTIMA_COMPRA).toLocaleDateString("pt-BR")}
                    </span>
                  </Col>
                  <Col xs={6} md={3} className="mb-2 mb-md-0">
                    <small className="d-block text-muted">Dias s/ Compra</small>
                    <span className="fw-bold text-danger">
                      {(() => {
                        if (!cliente.DATA_ULTIMA_COMPRA) return "-";
                        try {
                          const today = new Date();
                          const lastPurchase = new Date(cliente.DATA_ULTIMA_COMPRA);
                          today.setHours(0, 0, 0, 0);
                          lastPurchase.setHours(0, 0, 0, 0);
                          const diffTime = today.getTime() - lastPurchase.getTime();
                          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                          return diffDays;
                        } catch {
                          return "-";
                        }
                      })()}
                    </span>
                  </Col>
                  <Col xs={6} md={3}>
                    <small className="d-block text-muted">Valor Últ. Compra</small>
                    <span className="fw-bold text-success">
                      {currency(cliente.VALOR_ULTIMA_COMPRA)}
                    </span>
                  </Col>
                  <Col xs={6} md={3}>
                    <small className="d-block text-muted">Vendedor</small>
                    <span className="fw-bold text-primary text-uppercase" style={{ fontSize: "0.75rem" }}>
                      {cliente.VENDEDOR_ULT_VENDA || "-"}
                    </span>
                  </Col>
                </Row>
              </div>
            </div>

            {/* Seção 3: Status e Responsável (Footer Info) */}
            <div className="bg-light rounded p-2 border">
              <Row className="align-items-center text-center">
                <Col xs={4}>
                  <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>RESPONSÁVEL</small>
                  <strong>{cliente.NOME_RESPONSAVEL ? `${cliente.NOME_RESPONSAVEL} (${cliente.CODUSUR_RESPONSAVEL_CLIENTE})` : (cliente.CODUSUR_RESPONSAVEL_CLIENTE || "-")}</strong>
                </Col>
                <Col xs={4} className="border-start border-end">
                  <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>STATUS ATUAL</small>
                  <strong className={String(cliente.STATUS_ATUAL) === "1" ? "text-primary" : ""}>
                    {String(cliente.STATUS_ATUAL) === "1" ? "Contactando" : (cliente.STATUS_ATUAL || "-")}
                  </strong>
                </Col>
                <Col xs={4}>
                  <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>DATA CONTATO</small>
                  <strong>{cliente.CONTACTADO || "-"}</strong>
                </Col>
              </Row>
            </div>

          </div>
        </Modal.Body>
        <Modal.Footer className="py-2 justify-content-center gap-2 border-top-0">
          <Button 
            variant={showContacts ? "outline-primary" : "primary"}
            size="sm" 
            onClick={handleContactar}
            disabled={showContacts}
            style={{ fontSize: "0.85rem", minWidth: "110px", fontWeight: 500 }}
          >
            {showContacts ? "Contactando..." : "Iniciar Contato"}
          </Button>

          <Button 
            variant="success" 
            size="sm" 
            onClick={handleFinalizar}
            disabled={!isContacting && String(cliente.STATUS_ATUAL) !== "1"}
            style={{ fontSize: "0.85rem", minWidth: "110px", fontWeight: 500 }}
          >
            Finalizar
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onClose}
            style={{ fontSize: "0.85rem", minWidth: "90px" }}
          >
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ContactarClienteModal;
