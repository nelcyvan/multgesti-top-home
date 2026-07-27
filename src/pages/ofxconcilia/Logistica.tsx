import React, { useState, useEffect, useCallback } from "react";
import { Button, Form, Spinner, Alert, Row, Col, Card, Dropdown } from "react-bootstrap";
import { fetchPedidos, calculateSummary, TIPO_ENTREGA_LABELS, POSICAO_LABELS, FILIAL_RETIRA_LABELS, FILIAL_ORIGEM_LABELS, STATUS_ORDER } from "./.ts/logistica/LogisticaService";
import type { Pedido, DashboardSummary } from "./.ts/logistica/LogisticaService";
import { getDateRange, DATE_RANGE_OPTIONS } from "./.ts/logistica/DateHelpers";
import Detalhes from "./modals/logistica/Detalhes";

const Logistica: React.FC = () => {
  const [dataInicio, setDataInicio] = useState("2025-01-01");
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDateRange, setSelectedDateRange] = useState("currentMonth");

  // Efeito para inicializar as datas com o período padrão
  React.useEffect(() => {
    const { start, end } = getDateRange("currentMonth");
    setDataInicio(start);
    setDataFim(end);
  }, []);
  const [filiais, setFiliais] = useState<string[]>(["1"]);

  const [tiposEntrega, setTiposEntrega] = useState<string[]>(["EN", "EF", "RP"]);
  const [filiaisRetira, setFiliaisRetira] = useState<string[]>(["1", "3"]);
  const [posicoesPedido, setPosicoesPedido] = useState<string[]>(["P", "L", "M"]);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  // Estados para o modal de detalhamento
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedDateRange(value);
    
    if (value) {
      const { start, end } = getDateRange(value);
      setDataInicio(start);
      setDataFim(end);
    }
  };

  const toggleItem = (list: string[], item: string) => {
    return list.includes(item) 
      ? list.filter(i => i !== item)
      : [...list, item];
  };

  const handleSearch = useCallback(async (isAutoRefresh = false) => {
    if (!isAutoRefresh) setLoading(true);
    setError("");
    // Não limpa o summary ou pedidos durante o refresh automático para evitar "piscar"
    if (!isAutoRefresh) {
      setSummary(null);
      setPedidos([]);
    }
    
    try {
      const params = {
        dataInicio,
        dataFim,
        filiais: filiais,
        tiposEntrega: tiposEntrega,
        filiaisRetira: filiaisRetira,
        posicoesPedido: posicoesPedido,
      };

      const rows = await fetchPedidos(params);
      setPedidos(rows);
      setSummary(calculateSummary(rows));
      if (!isAutoRefresh) setFiltersCollapsed(true);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, [dataInicio, dataFim, filiais, tiposEntrega, filiaisRetira, posicoesPedido]);

  // Efeito para atualização automática a cada 1 minuto
  useEffect(() => {
    const intervalId = setInterval(() => {
      handleSearch(true);
    }, 60000); // 60000 ms = 1 minuto

    return () => clearInterval(intervalId);
  }, [handleSearch]);

  const handleShowDetail = (group: string) => {
    setSelectedGroup(group);
    setShowDetailModal(true);
  };
  
  const getFilterSummary = () => {
    if (!summary) return "";
    
    // Obter label do período selecionado
    const selectedDateOption = DATE_RANGE_OPTIONS.find(opt => opt.value === selectedDateRange);
    const dateLabel = selectedDateOption ? selectedDateOption.label : "Período Personalizado";
    
    // Formatar filiais
    const filiaisLabels = filiais.map(f => FILIAL_ORIGEM_LABELS[f] || f).join(', ');

    // Formatar filiais retira
    const filiaisRetiraLabels = filiaisRetira.map(f => FILIAL_RETIRA_LABELS[f] || f).join(', ');
    
    return `${dateLabel} | Filiais: ${filiaisLabels} | Retira: ${filiaisRetiraLabels} | ${summary.totalPedidos} pedidos`;
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
                    {getFilterSummary()}
                </span>
            )}
          </div>
          <span className="small text-muted">{filtersCollapsed ? 'Mostrar' : 'Ocultar'}</span>
        </Card.Header>
        {!filtersCollapsed && (
          <Card.Body className="py-2">
            <Form>
              <Row className="g-2 align-items-end">
              <Col md={2}>
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
              <Col md={2}>
                <Form.Group controlId="filiais">
                  <Form.Label className="mb-0 small">Filiais</Form.Label>
                  <Dropdown>
                    <Dropdown.Toggle 
                      variant="outline-secondary" 
                      size="sm" 
                      className="w-100 text-start d-flex justify-content-between align-items-center bg-white text-dark"
                      style={{ height: '31px', borderColor: '#ced4da' }}
                    >
                      <span className="text-truncate">{filiais.length} selecionadas</span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="p-2 shadow-sm" style={{ minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                      {Object.entries(FILIAL_ORIGEM_LABELS).map(([value, label]) => (
                        <Form.Check 
                          key={value}
                          type="switch"
                          id={`switch-filial-${value}`}
                          label={label}
                          checked={filiais.includes(value)}
                          onChange={() => setFiliais(toggleItem(filiais, value))}
                          className="mb-1"
                        />
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group controlId="tiposEntrega">
                  <Form.Label className="mb-0 small">Entrega/Retira</Form.Label>
                  <Dropdown>
                    <Dropdown.Toggle 
                      variant="outline-secondary" 
                      size="sm" 
                      className="w-100 text-start d-flex justify-content-between align-items-center bg-white text-dark"
                      style={{ height: '31px', borderColor: '#ced4da' }}
                    >
                      <span className="text-truncate">{tiposEntrega.length} selecionados</span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="p-2 shadow-sm" style={{ minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                      {Object.entries(TIPO_ENTREGA_LABELS).map(([value, label]) => (
                        <Form.Check 
                          key={value}
                          type="switch"
                          id={`switch-tipo-${value}`}
                          label={label}
                          checked={tiposEntrega.includes(value)}
                          onChange={() => setTiposEntrega(toggleItem(tiposEntrega, value))}
                          className="mb-1"
                        />
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group controlId="posicoesPedido">
                  <Form.Label className="mb-0 small">Posições</Form.Label>
                  <Dropdown>
                    <Dropdown.Toggle 
                      variant="outline-secondary" 
                      size="sm" 
                      className="w-100 text-start d-flex justify-content-between align-items-center bg-white text-dark"
                      style={{ height: '31px', borderColor: '#ced4da' }}
                    >
                      <span className="text-truncate">{posicoesPedido.length} selecionadas</span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="p-2 shadow-sm" style={{ minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                      {Object.entries(POSICAO_LABELS).map(([value, label]) => (
                        <Form.Check 
                          key={value}
                          type="switch"
                          id={`switch-pos-${value}`}
                          label={label}
                          checked={posicoesPedido.includes(value)}
                          onChange={() => setPosicoesPedido(toggleItem(posicoesPedido, value))}
                          className="mb-1"
                        />
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group controlId="filiaisRetira">
                  <Form.Label className="mb-0 small">Fil. Retira</Form.Label>
                  <Dropdown>
                    <Dropdown.Toggle 
                      variant="outline-secondary" 
                      size="sm" 
                      className="w-100 text-start d-flex justify-content-between align-items-center bg-white text-dark"
                      style={{ height: '31px', borderColor: '#ced4da' }}
                    >
                      <span className="text-truncate">{filiaisRetira.length} selecionadas</span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="p-2 shadow-sm" style={{ minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                      {Object.entries(FILIAL_RETIRA_LABELS).map(([value, label]) => (
                        <Form.Check 
                          key={value}
                          type="switch"
                          id={`switch-filretira-${value}`}
                          label={label}
                          checked={filiaisRetira.includes(value)}
                          onChange={() => setFiliaisRetira(toggleItem(filiaisRetira, value))}
                          className="mb-1"
                        />
                      ))}
                    </Dropdown.Menu>
                  </Dropdown>
                </Form.Group>
              </Col>
              <Col md={12} className="mt-2">
                <Button variant="primary" size="sm" onClick={() => handleSearch(false)} disabled={loading} className="w-100">
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
            {/* Total Pedidos */}
            <Col md={3}>
              <Card className="text-center h-100 border-primary shadow-sm">
                <Card.Header className="bg-primary text-white py-1">Total Pedidos</Card.Header>
                <Card.Body className="d-flex align-items-center justify-content-center p-1">
                  <h2 className="mb-0 text-primary">{summary.totalPedidos}</h2>
                </Card.Body>
              </Card>
            </Col>

            {/* Valor Frete */}
            <Col md={3}>
              <Card className="text-center h-100 border-success shadow-sm">
                <Card.Header className="bg-success text-white py-1">Total Frete</Card.Header>
                <Card.Body className="d-flex align-items-center justify-content-center p-1">
                  <h3 className="mb-0 text-success">
                    {summary.totalFrete.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </h3>
                </Card.Body>
              </Card>
            </Col>

            {/* Por Tipo de Entrega - Card Único */}
            <Col md={3}>
              <Card className="text-center h-100 border-info shadow-sm">
                <Card.Header className="bg-info text-white py-1">Por Tipo de Entrega</Card.Header>
                <Card.Body className="d-flex align-items-center justify-content-around p-1">
                  {Object.entries(summary.porTipoEntrega).map(([key, value]) => {
                      const label = TIPO_ENTREGA_LABELS[key] || key;
                      return (
                        <div key={key} className="d-flex flex-column px-2">
                          <small className="text-muted mb-1" style={{ fontSize: '0.7rem' }}>{label}</small>
                          <h4 className="mb-0 text-info">{value}</h4>
                        </div>
                      );
                  })}
                </Card.Body>
              </Card>
            </Col>

            {/* Por Posição - Card Único */}
            <Col md={3}>
              <Card className="text-center h-100 border-warning shadow-sm">
                <Card.Header className="bg-warning text-dark py-1">Por Posição</Card.Header>
                <Card.Body className="d-flex align-items-center justify-content-around p-1">
                  {Object.entries(summary.porPosicao).map(([key, value]) => {
                      const label = POSICAO_LABELS[key] || key;
                      return (
                        <div key={key} className="d-flex flex-column px-2">
                          <small className="text-muted mb-1" style={{ fontSize: '0.7rem' }}>{label}</small>
                          <h4 className="mb-0 text-warning">{value}</h4>
                        </div>
                      );
                  })}
                </Card.Body>
              </Card>
            </Col>
            
            {/* Resumo por Grupo de Status - Cards Individuais */}
            {Object.entries(summary.porGrupoStatus)
              .sort(([groupA], [groupB]) => {
                const indexA = STATUS_ORDER.indexOf(groupA);
                const indexB = STATUS_ORDER.indexOf(groupB);
                
                // Se ambos estiverem na lista de ordem, ordena pelo índice de forma decrescente (invertido)
                if (indexA !== -1 && indexB !== -1) return indexB - indexA;
                
                // Se apenas A estiver na lista, vem primeiro (mantém prioridade para itens conhecidos)
                if (indexA !== -1) return -1;
                
                // Se apenas B estiver na lista, vem primeiro
                if (indexB !== -1) return 1;
                
                // Se nenhum estiver na lista, ordena alfabeticamente
                return groupA.localeCompare(groupB);
              })
              .map(([group, value]) => {
                  const percentage = (value / summary.totalPedidos) * 100;
                  return (
                    <Col md={3} key={group}>
                      <Card className="h-100 shadow-sm border-0">
                        <Card.Body className="p-3 d-flex flex-column justify-content-between">
                          <div>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                                <h6 className="text-secondary text-truncate m-0" title={group} style={{ maxWidth: '65%' }}>{group}</h6>
                                <Button 
                                    variant="link" 
                                    size="sm" 
                                    className="p-0 text-decoration-none"
                                    style={{ fontSize: '0.75rem' }}
                                    onClick={() => handleShowDetail(group)}
                                >
                                    Ver Detalhes
                                </Button>
                            </div>
                            <div className="d-flex align-items-baseline mb-2">
                              <h2 className="mb-0 me-2 fw-bold text-dark">{value}</h2>
                              <small className="text-muted">({percentage.toFixed(1)}%)</small>
                            </div>
                            <div className="progress" style={{ height: '6px' }}>
                              <div 
                                className="progress-bar" 
                                role="progressbar" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  );
              })}

            {/* Modal de Detalhamento */}
            <Detalhes 
              show={showDetailModal} 
              onHide={() => setShowDetailModal(false)} 
              group={selectedGroup} 
              pedidos={pedidos} 
            />
          </Row>
        </div>
      )}
    </div>
  );
};

export default Logistica;
