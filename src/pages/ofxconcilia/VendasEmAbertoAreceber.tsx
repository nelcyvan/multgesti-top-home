import React, { useState, useEffect, useCallback } from "react";
import { Button, Form, Spinner, Alert, Row, Col, Card } from "react-bootstrap";
import { fetchCarteira, calculateCarteiraSummary, COBRANCA_DESCRICAO } from "./.ts/contasAreceber/AreceberService";
import type { PedidoCarteira, CarteiraSummary } from "./.ts/contasAreceber/AreceberService";
import { getDateRange, DATE_RANGE_OPTIONS } from "./.ts/logistica/DateHelpers";
import Detalhes from "./modals/Areceber/Detalhes";

const VendasEmAbertoAreceber: React.FC = () => {
  const [dataInicio, setDataInicio] = useState("2025-01-01");
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDateRange, setSelectedDateRange] = useState("currentMonth");

  const [pedidos, setPedidos] = useState<PedidoCarteira[]>([]);
  const [summary, setSummary] = useState<CarteiraSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [filteredPedidos, setFilteredPedidos] = useState<PedidoCarteira[]>([]);

  useEffect(() => {
    const { start, end } = getDateRange("currentMonth");
    setDataInicio(start);
    setDataFim(end);
  }, []);

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedDateRange(value);
    
    if (value) {
      const { start, end } = getDateRange(value);
      setDataInicio(start);
      setDataFim(end);
    }
  };

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError("");
    setSummary(null);
    setPedidos([]);

    try {
      const params = {
        dataInicio,
        dataFim,
      };

      const rows = await fetchCarteira(params);
      setPedidos(rows);
      setSummary(calculateCarteiraSummary(rows));
      setFiltersCollapsed(true);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  const handleShowDetail = (vendedor: string) => {
    setSelectedVendedor(vendedor);
    const filtered = pedidos.filter(p => (p.NOME || "NÃO INFORMADO") === vendedor);
    setFilteredPedidos(filtered);
    setShowDetailModal(true);
  };

  return (
    <div className="p-1 h-100 d-flex flex-column overflow-auto">
      <Card className="mb-1 shadow-sm">
        <Card.Header 
          className="py-1 bg-light d-flex justify-content-between align-items-center" 
          style={{ cursor: 'pointer' }}
          onClick={() => setFiltersCollapsed(!filtersCollapsed)}
        >
          <div className="d-flex align-items-center gap-2 overflow-hidden">
            <span className="fw-bold small text-nowrap">Filtros de Pesquisa</span>
            {filtersCollapsed && summary && (
                <span className="small text-muted text-truncate border-start ps-2 ms-1">
                    {(() => {
                        const selectedOption = DATE_RANGE_OPTIONS.find(opt => opt.value === selectedDateRange);
                        const label = selectedOption ? selectedOption.label : 'Período Personalizado';
                        return label;
                    })()}
                </span>
            )}
          </div>
          <span className="small text-muted">{filtersCollapsed ? 'Mostrar' : 'Ocultar'}</span>
        </Card.Header>
        {!filtersCollapsed && (
          <Card.Body className="py-2">
            <Form>
              <Row className="g-2 align-items-end">
                <Col md={3}>
                  <Form.Group controlId="periodoRapido">
                    <Form.Label className="mb-0 small">Período</Form.Label>
                    <Form.Select 
                      size="sm" 
                      value={selectedDateRange} 
                      onChange={handleDateRangeChange}
                    >
                      {DATE_RANGE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs="auto">
                    <Button variant="primary" size="sm" onClick={handleSearch} disabled={loading}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : "Buscar"}
                    </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        )}
      </Card>

      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      {summary && (
        <div className="mb-1">
          <Row className="g-1">
            <Col md={4}>
              <Card className="text-center h-100 border-primary shadow-sm">
                <Card.Header className="bg-primary text-white py-1">Total Pedidos</Card.Header>
                <Card.Body className="d-flex align-items-center justify-content-center p-1">
                  <h2 className="mb-0 text-primary">{summary.totalPedidos}</h2>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center h-100 border-success shadow-sm">
                <Card.Header className="bg-success text-white py-1">Valor Total</Card.Header>
                <Card.Body className="d-flex align-items-center justify-content-center p-1">
                  <h3 className="mb-0 text-success">
                    {summary.totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </h3>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center h-100 border-warning shadow-sm">
                <Card.Header className="bg-warning text-dark py-1">Por Cobrança</Card.Header>
                <Card.Body className="d-flex align-items-center justify-content-around p-1 flex-wrap">
                    {Object.entries(summary.porCobranca).map(([cobranca, valor]) => (
                        <div key={cobranca} className="d-flex flex-column px-2 mb-1 text-center">
                            <small className="text-muted mb-0" style={{ fontSize: '0.7rem' }}>
                                {COBRANCA_DESCRICAO[cobranca] || cobranca}
                            </small>
                            <span className="text-dark fw-bold" style={{ fontSize: '0.8rem' }}>
                                {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                        </div>
                    ))}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="g-1 mt-1">
            {Object.entries(summary.porVendedor).map(([vendedor, valor]) => (
                <Col md={3} key={vendedor}>
                    <Card 
                      className="h-100 shadow-sm border-0" 
                    >
                        <Card.Body className="p-2 position-relative">
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="position-absolute top-0 end-0 p-1 text-decoration-none" 
                              style={{ fontSize: '0.7rem' }}
                              onClick={() => handleShowDetail(vendedor)}
                            >
                              Ver detalhes
                            </Button>
                            <h6 className="text-truncate small text-muted mb-1 pe-4" title={vendedor}>{vendedor}</h6>
                            <h5 className="mb-0 text-dark">
                                {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </h5>
                        </Card.Body>
                    </Card>
                </Col>
            ))}
          </Row>
        </div>
      )}

      <Detalhes 
        show={showDetailModal} 
        onHide={() => setShowDetailModal(false)} 
        vendedor={selectedVendedor} 
        pedidos={filteredPedidos} 
      />
    </div>
  );
};

export default VendasEmAbertoAreceber;
