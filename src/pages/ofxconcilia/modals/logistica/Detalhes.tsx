import React, { useState, useEffect } from "react";
import { Button, Modal, Table, Badge } from "react-bootstrap";
import type { Pedido } from "../../.ts/logistica/LogisticaService";
import DetalhamentoPedido from "./DetalhamentoPedido";

interface DetalhesProps {
  show: boolean;
  onHide: () => void;
  group: string;
  pedidos: Pedido[];
}

const Detalhes: React.FC<DetalhesProps> = ({ show, onHide, group, pedidos }) => {
  const [detailPedidos, setDetailPedidos] = useState<Pedido[]>([]);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [selectedItens, setSelectedItens] = useState<Pedido[]>([]);
  const [showDetalhamento, setShowDetalhamento] = useState(false);
  const [viewedPedidos, setViewedPedidos] = useState<Set<number>>(new Set());
  const [selectedPedidos, setSelectedPedidos] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (show && group) {
        const GROUP_MAPPING: Record<number, string> = {
            0: 'Aguardando Visualização',
            1: 'Visualizado',
            2: 'Separando',
            3: 'Separado',
            4: 'Aguardando rota',
            5: 'Incluído em rota',
            6: 'Saindo em rota',
            7: 'Entregue',
            8: 'Retornou',
            9: 'Entrega em dia Específico',
            10: 'Aguardando Fornecedor',
            11: 'Entrega Fracionada',
            12: 'Entrega em horário Específico',
            13: 'Corte',
            14: 'Pegar Localização',
            15: 'Faturar',
            16: 'Separação Cancelada',
            17: 'Coleta',
            18: 'Localização Inserida',
            19: 'Coleta Separada',
            20: 'Enviar p/ Messejana',
            21: 'Coleta Separando',
            22: 'Corte Realizado',
            23: 'Pedidos Prioridade',
            24: 'Entrega Futura',
            25: 'Retira Posterior',
        };

        const filtered = pedidos.filter(p => {
            const statusStr = p.ULTIMASITUACAOCFAT;
            const status = (statusStr !== null && statusStr !== undefined && statusStr !== '') 
                ? parseInt(statusStr, 10) 
                : 0;
            const pGroup = GROUP_MAPPING[status] || 'Outros';
            return pGroup === group;
        });

        // Remover duplicados baseados no NUMERO_DO_PEDIDO_TV8
        const uniquePedidosMap = new Map();
        filtered.forEach(p => {
            if (!uniquePedidosMap.has(p.NUMERO_DO_PEDIDO_TV8)) {
                uniquePedidosMap.set(p.NUMERO_DO_PEDIDO_TV8, p);
            }
        });
        const uniquePedidos = Array.from(uniquePedidosMap.values());

        // Ordenar por data (do mais antigo para o mais recente)
        uniquePedidos.sort((a, b) => {
            if (!a.DATA) return 1;
            if (!b.DATA) return -1;
            
            const [diaA, mesA, anoA] = a.DATA.split('/').map(Number);
            const [diaB, mesB, anoB] = b.DATA.split('/').map(Number);
            
            // Comparar Ano
            if (anoA !== anoB) return anoA - anoB;
            // Comparar Mês
            if (mesA !== mesB) return mesA - mesB;
            // Comparar Dia
            return diaA - diaB;
        });

        setDetailPedidos(uniquePedidos as Pedido[]);
    }
  }, [show, group, pedidos]);

  useEffect(() => {
    if (!show) {
      setSelectedPedidos(new Set());
    }
  }, [show]);

  const formatCFATStatus = (status: string | undefined) => {
    if (!status) return "";
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

  const getPosicaoLabel = (posicao: string) => {
    switch (posicao) {
      case 'P': return 'Pendente';
      case 'L': return 'Liberado';
      case 'M': return 'Montado';
      default: return posicao;
    }
  };

  const getTipoEntregaLabel = (tipo: string) => {
    switch (tipo) {
      case 'EF': return 'Entrega Futura';
      case 'EN': return 'Entrega';
      case 'RP': return 'Retira Posterior';
      default: return tipo;
    }
  };

  return (
    <Modal show={show} onHide={onHide} fullscreen centered>
      <Modal.Header closeButton className="bg-white border-bottom py-3">
        <Modal.Title className="h5 text-primary">
          {group}
          <Badge bg="light" text="dark" className="ms-2 border" style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>
            {detailPedidos.length} pedidos
          </Badge>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0 bg-light">
        <div className="table-responsive h-100">
          <Table hover borderless className="mb-0 small align-middle">
            <thead className="bg-white sticky-top border-bottom" style={{ zIndex: 1 }}>
              <tr>
                <th className="py-3 ps-4 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Data</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Filial</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Retira</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Pedido TV8</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Cliente</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Vendedor</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Cobrança</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Vl Frete</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Últ. Atualização Status</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Posição</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Tipo</th>
                <th className="py-3 text-center text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem', width: "120px" }}>Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {detailPedidos.map((p, i) => (
                <tr
                  key={p.NUMERO_DO_PEDIDO_TV8 ?? i}
                  onClick={() => {
                    setSelectedPedidos(prev => new Set(prev).add(p.NUMERO_DO_PEDIDO_TV8));
                  }}
                  className={[
                    "border-bottom",
                    selectedPedidos.has(p.NUMERO_DO_PEDIDO_TV8) ? "table-primary" : "",
                    !selectedPedidos.has(p.NUMERO_DO_PEDIDO_TV8) && viewedPedidos.has(p.NUMERO_DO_PEDIDO_TV8)
                      ? "bg-light"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td className="ps-4 py-3 text-secondary">{p.DATA}</td>
                  <td className="py-3 text-dark">{p.CODFILIAL}</td>
                  <td className="py-3 text-dark">{p.CODFILIALRETIRA}</td>
                  <td className="py-3 fw-bold text-dark">{p.NUMERO_DO_PEDIDO_TV8}</td>
                  <td className="py-3 text-truncate" style={{ maxWidth: "200px" }} title={`${p.CODCLI} - ${p.CLIENTE}`}>
                    <span className="text-muted small me-1">{p.CODCLI}</span>
                    <span className="text-dark">{p.CLIENTE}</span>
                  </td>
                  <td className="py-3 text-truncate" style={{ maxWidth: "150px" }} title={p.VENDEDOR}>{p.VENDEDOR}</td>
                  <td className="py-3">
                    <Badge bg="light" text="dark" className="border fw-normal px-2 py-1">{p.COBRANCA}</Badge>
                  </td>
                  <td className="py-3 text-dark">{p.VLFRETE}</td>
                  <td className="py-3 text-muted small">{formatCFATStatus(p.ULTIMASITUACAOCFAT)}</td>
                  <td className="py-3">{getPosicaoLabel(p.POSICAO)}</td>
                  <td className="py-3">{getTipoEntregaLabel(p.TIPOENTREGA)}</td>
                  <td className="text-center py-3">
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="py-1 px-3" 
                      style={{ fontSize: "0.75rem" }}
                      onClick={() => {
                        const itensDoPedido = pedidos.filter(item => item.NUMERO_DO_PEDIDO_TV8 === p.NUMERO_DO_PEDIDO_TV8);
                        setSelectedPedido(p);
                        setSelectedItens(itensDoPedido);
                        setViewedPedidos(prev => new Set(prev).add(p.NUMERO_DO_PEDIDO_TV8));
                        setSelectedPedidos(prev => new Set(prev).add(p.NUMERO_DO_PEDIDO_TV8));
                        setShowDetalhamento(true);
                      }}
                      title="Ver Detalhes"
                    >
                      Detalhar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
      <Modal.Footer className="bg-white border-top py-2">
        <Button variant="secondary" size="sm" onClick={onHide}>
          Fechar
        </Button>
      </Modal.Footer>

      <DetalhamentoPedido 
        show={showDetalhamento}
        onHide={() => setShowDetalhamento(false)}
        pedido={selectedPedido}
        itens={selectedItens}
      />
    </Modal>
  );
};

export default Detalhes;
