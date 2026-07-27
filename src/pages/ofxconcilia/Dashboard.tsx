import React, { useState, useEffect } from "react";
import { Row, Col, Card, Spinner, Alert } from "react-bootstrap";
import { Truck, Wallet2 } from "react-bootstrap-icons";
import { fetchPedidos, calculateSummary } from "./.ts/logistica/LogisticaService";
import { fetchCarteira, calculateCarteiraSummary } from "./.ts/contasAreceber/AreceberService";
import { getDateRange } from "./.ts/logistica/DateHelpers";

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logisticaSummary, setLogisticaSummary] = useState<any>(null);
  const [carteiraSummary, setCarteiraSummary] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const { start, end } = getDateRange("last3Months");

        // Fetch Logística
        const logisticaParams = {
          dataInicio: start,
          dataFim: end,
          filiais: ["1", "2", "3"], // Default filiais
          tiposEntrega: ['EN', 'EF', 'RP'], // Default types
          posicoesPedido: ['P', 'L', 'M'], // Default positions
          filiaisRetira: []
        };
        const logisticaRows = await fetchPedidos(logisticaParams);
        setLogisticaSummary(calculateSummary(logisticaRows));

        // Fetch Carteira
        const carteiraParams = {
          dataInicio: start,
          dataFim: end,
        };
        const carteiraRows = await fetchCarteira(carteiraParams);
        setCarteiraSummary(calculateCarteiraSummary(carteiraRows));

      } catch (err: any) {
        console.error("Erro ao carregar dashboard:", err);
        setError("Não foi possível carregar o resumo do dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3">
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="p-3 h-100 overflow-auto">
      <h4 className="mb-4 text-secondary">Visão Geral - Últimos 3 Meses</h4>
      
      <Row className="g-3">
        {/* Card Logística */}
        <Col md={6}>
          <Card className="h-100 shadow-sm border-0">
            <Card.Header className="bg-primary text-white d-flex align-items-center gap-2">
              <Truck size={20} />
              <h5 className="mb-0">Logística</h5>
            </Card.Header>
            <Card.Body>
              {logisticaSummary ? (
                <Row className="text-center g-3">
                  <Col xs={6}>
                    <div className="border rounded p-2">
                      <small className="text-muted d-block text-uppercase">Total Pedidos</small>
                      <span className="fs-4 fw-bold text-primary">{logisticaSummary.totalPedidos}</span>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="border rounded p-2">
                      <small className="text-muted d-block text-uppercase">Entregas</small>
                      <span className="fs-4 fw-bold text-success">{logisticaSummary.porTipoEntrega['EN'] || 0}</span>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="border rounded p-2">
                      <small className="text-muted d-block text-uppercase">Retira Post.</small>
                      <span className="fs-4 fw-bold text-warning">{logisticaSummary.porTipoEntrega['RP'] || 0}</span>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="border rounded p-2">
                      <small className="text-muted d-block text-uppercase">Entrega Futura</small>
                      <span className="fs-4 fw-bold text-info">{logisticaSummary.porTipoEntrega['EF'] || 0}</span>
                    </div>
                  </Col>
                </Row>
              ) : (
                <p className="text-muted text-center">Sem dados disponíveis.</p>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Card Carteira */}
        <Col md={6}>
          <Card className="h-100 shadow-sm border-0">
            <Card.Header className="bg-warning text-dark d-flex align-items-center gap-2">
              <Wallet2 size={20} />
              <h5 className="mb-0">Vendas Carteira em Aberto</h5>
            </Card.Header>
            <Card.Body>
              {carteiraSummary ? (
                <Row className="text-center g-3">
                  <Col xs={6}>
                    <div className="border rounded p-2">
                      <small className="text-muted d-block text-uppercase">Total Pedidos</small>
                      <span className="fs-4 fw-bold text-primary">{carteiraSummary.totalPedidos}</span>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="border rounded p-2">
                      <small className="text-muted d-block text-uppercase">Valor Total</small>
                      <span className="fs-5 fw-bold text-success text-truncate" title={carteiraSummary.totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}>
                        {carteiraSummary.totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </Col>
                  <Col xs={12}>
                    <div className="border rounded p-2">
                      <small className="text-muted d-block text-uppercase mb-2">Vendedores</small>
                      <div className="d-flex justify-content-around flex-wrap" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {Object.entries(carteiraSummary.porVendedor)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .map(([nome, valor]) => (
                            <div key={nome} className="d-flex flex-column align-items-center px-2 mb-2">
                                <span className="small text-dark fw-bold text-truncate" style={{ maxWidth: '100px' }} title={nome}>{nome}</span>
                                <span className="small text-muted">
                                    {(valor as number).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </Col>
                </Row>
              ) : (
                <p className="text-muted text-center">Sem dados disponíveis.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
