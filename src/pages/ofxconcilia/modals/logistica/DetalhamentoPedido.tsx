import React from "react";
import { Button, Modal, Row, Col, Card } from "react-bootstrap";
import type { Pedido } from "../../.ts/logistica/LogisticaService";

interface DetalhamentoPedidoProps {
  show: boolean;
  onHide: () => void;
  pedido: Pedido | null;
  itens?: Pedido[];
}

const DetalhamentoPedido: React.FC<DetalhamentoPedidoProps> = ({ show, onHide, pedido, itens = [] }) => {
  if (!pedido) return null;
  
  // Garantir que temos itens, se não vier via prop, usa o próprio pedido como único item
  const listaItens = itens.length > 0 ? itens : [pedido];

  // Função auxiliar para formatar valores monetários
  const formatCurrency = (val: number | string | undefined) => {
    if (val === undefined || val === null) return "R$ 0,00";
    return Number(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Função auxiliar para formatar datas
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    // Tenta formatar se estiver no padrão YYYY-MM-DD
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [y, m, d] = dateStr.split('T')[0].split('-');
        return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  const formatCFATStatus = (status: string | undefined) => {
    if (!status) return "N/A";
    const parts = status.split('_');
    const cleanParts = parts.filter(p => p.trim() !== '');
    
    if (cleanParts.length >= 3) {
      const dataHora = cleanParts[1];
      const nome = cleanParts[2];
      return `${nome} - ${dataHora}`;
    }
    
    if (cleanParts.length === 2) {
       return cleanParts[1];
    }

    return status;
  };

  return (
    <Modal show={show} onHide={onHide} fullscreen centered>
      <Modal.Header closeButton className="bg-light py-2">
        <Modal.Title className="fs-6">
          Detalhamento do Pedido #{pedido.NUMERO_DO_PEDIDO_TV8}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-2 bg-light">
        <Row className="h-100 g-2">
          {/* Coluna da Esquerda: Informações do Pedido */}
          <Col md={7} className="h-100 overflow-auto">
            <Row className="g-2">
              {/* Informações Principais */}
              <Col md={12}>
                <Card className="border-0 shadow-sm">
              <Card.Body className="p-2">
                <h6 className="text-primary mb-2 border-bottom pb-1" style={{fontSize: '0.9rem'}}>Informações Gerais</h6>
                <Row className="g-1">
                  <Col md={3}>
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Data</small>
                    <strong style={{fontSize: '0.85rem'}}>{formatDate(pedido.DATA)}</strong>
                  </Col>
                  <Col md={3}>
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Filial Origem</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.CODFILIAL}</strong>
                  </Col>
                  <Col md={3}>
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Filial Retira</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.CODFILIALRETIRA || "-"}</strong>
                  </Col>
                  <Col md={3}>
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Vendedor</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.VENDEDOR}</strong>
                  </Col>
                  <Col md={6} className="mt-2">
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Cliente</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.CODCLI} - {pedido.CLIENTE}</strong>
                  </Col>
                  <Col md={3} className="mt-2">
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Cobrança</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.COBRANCA}</strong>
                  </Col>
                  <Col md={3} className="mt-2">
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Cond. Venda</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.CONDVENDA}</strong>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>

          {/* Status e Logística */}
          <Col md={12}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-2">
                <h6 className="text-success mb-2 border-bottom pb-1" style={{fontSize: '0.9rem'}}>Status e Logística</h6>
                <Row className="g-1">
                  <Col md={4}>
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Últ. Atualização Status</small>
                    <strong style={{fontSize: '0.85rem'}}>{formatCFATStatus(pedido.ULTIMASITUACAOCFAT)}</strong>
                  </Col>
                  <Col md={4}>
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Posição</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.POSICAO}</strong>
                  </Col>
                  <Col md={4}>
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Tipo Entrega</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.TIPOENTREGA}</strong>
                  </Col>
                  <Col md={4} className="mt-2">
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Valor Frete</small>
                    <strong style={{fontSize: '0.85rem'}}>{formatCurrency(pedido.VLFRETE)}</strong>
                  </Col>
                  <Col md={4} className="mt-2">
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Outras Despesas</small>
                    <strong style={{fontSize: '0.85rem'}}>{formatCurrency(pedido.VLOUTRASDESP)}</strong>
                  </Col>
                  <Col md={4} className="mt-2">
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Total Itens</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.QT_TOTAL || "-"}</strong>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>

          {/* Dados de Entrega */}
          <Col md={12}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-2">
                <h6 className="text-info mb-2 border-bottom pb-1" style={{fontSize: '0.9rem'}}>Endereço de Cadastro</h6>
                <Row className="g-1">
                  <Col md={8}>
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Endereço</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.ENDERENT}, {pedido.NUMEROENT}</strong>
                  </Col>
                  <Col md={4}>
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Bairro</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.BAIRROENT}</strong>
                  </Col>
                  <Col md={4} className="mt-2">
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Município</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.MUNICENT}</strong>
                  </Col>
                  <Col md={4} className="mt-2">
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Telefone</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.TELENT || "-"}</strong>
                  </Col>
                  <Col md={4} className="mt-2">
                    <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Praça</small>
                    <strong style={{fontSize: '0.85rem'}}>{pedido.CODPRACA}</strong>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>

              {/* Observações */}
              {(pedido.OBS || pedido.OBS1 || pedido.OBS2 || pedido.OBSENTREGA1) && (
                <Col md={12}>
                  <Card className="border-0 shadow-sm">
                    <Card.Body className="p-2">
                      <h6 className="text-warning mb-2 border-bottom pb-1" style={{fontSize: '0.9rem'}}>Observações</h6>
                      <div className="small" style={{fontSize: '0.8rem'}}>
                        {pedido.OBS && <p className="mb-1"><strong>Geral:</strong> {pedido.OBS}</p>}
                        {(pedido.OBS1 || pedido.OBS2) && <p className="mb-1"><strong>Notas:</strong> {pedido.OBS1} {pedido.OBS2}</p>}
                        {pedido.OBSENTREGA1 && <p className="mb-0"><strong>Entrega:</strong> {pedido.OBSENTREGA1} {pedido.OBSENTREGA2} {pedido.OBSENTREGA3}</p>}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              )}
            </Row>
          </Col>

          {/* Coluna da Direita: Itens do Pedido */}
          <Col md={5} className="h-100">
            <Card className="border-0 shadow-sm h-100">
              <Card.Header className="bg-white py-2">
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="text-secondary m-0" style={{fontSize: '0.9rem'}}>Itens do Pedido</h6>
                  <span className="badge bg-secondary rounded-pill" style={{fontSize: '0.75rem'}}>{listaItens.length} itens</span>
                </div>
              </Card.Header>
              <Card.Body className="p-0 overflow-auto">
                <div className="list-group list-group-flush">
                  {listaItens.map((item, idx) => (
                    <div key={idx} className="list-group-item p-2">
                      <div className="d-flex w-100 justify-content-between mb-1">
                        <small className="text-muted" style={{fontSize: '0.75rem'}}>Cód: {item.CODPROD}</small>
                        <small className="fw-bold text-primary" style={{fontSize: '0.8rem'}}>{item.QUANTIDADE_ITEM_PEDIDO} {item.EMBALAGEM || 'UN'}</small>
                      </div>
                      <p className="mb-1 fw-medium" style={{ fontSize: '0.8rem' }}>{item.DESCRICAO}</p>
                      {item.CODIGO_DE_BARRAS && (
                        <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>EAN: {item.CODIGO_DE_BARRAS}</small>
                      )}
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer className="bg-light py-1">
        <Button variant="secondary" size="sm" onClick={onHide}>
          Fechar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DetalhamentoPedido;
