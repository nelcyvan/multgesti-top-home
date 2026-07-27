import React from "react";
import { Modal, Table, Badge } from "react-bootstrap";
import { type PedidoCarteira, COBRANCA_DESCRICAO } from "../../.ts/contasAreceber/AreceberService";

interface DetalhesProps {
  show: boolean;
  onHide: () => void;
  vendedor: string;
  pedidos: PedidoCarteira[];
}

const Detalhes: React.FC<DetalhesProps> = ({ show, onHide, vendedor, pedidos }) => {
  const totalValor = pedidos.reduce((acc, curr) => acc + curr.VALOR, 0);

  // Ordena os pedidos por data (ano, mês, dia) do mais antigo para o mais recente
  const sortedPedidos = [...pedidos].sort((a, b) => {
    // Assume que a data está no formato DD/MM/YYYY
    const [diaA, mesA, anoA] = a.DTEMISSAO.split('/').map(Number);
    const [diaB, mesB, anoB] = b.DTEMISSAO.split('/').map(Number);

    const dateA = new Date(anoA, mesA - 1, diaA);
    const dateB = new Date(anoB, mesB - 1, diaB);

    return dateA.getTime() - dateB.getTime();
  });

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-white border-bottom py-3">
        <Modal.Title className="h5 text-primary">
          {vendedor}
          <Badge bg="light" text="dark" className="ms-2 border" style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>
            {pedidos.length} pedidos
          </Badge>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0 bg-light">
        <div className="table-responsive" style={{ maxHeight: '60vh' }}>
          <Table hover borderless className="mb-0 small align-middle">
            <thead className="bg-white sticky-top border-bottom" style={{ zIndex: 1 }}>
              <tr>
                <th className="py-3 ps-4 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Data</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Pedido</th>
                <th className="py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Cliente</th>
                <th className="text-end py-3 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Valor</th>
                <th className="text-center py-3 pe-4 text-muted fw-normal text-uppercase" style={{ fontSize: '0.7rem' }}>Cobrança</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {sortedPedidos.map((pedido, idx) => (
                <tr key={`${pedido.NUMPED}-${idx}`} className="border-bottom">
                  <td className="ps-4 py-3 text-secondary">{pedido.DTEMISSAO}</td>
                  <td className="py-3 fw-bold text-dark">{pedido.NUMPED}</td>
                  <td className="py-3 text-truncate" style={{ maxWidth: '200px' }} title={`${pedido.CODCLI} - ${pedido.CLIENTE}`}>
                    <span className="text-muted small me-1">{pedido.CODCLI}</span>
                    <span className="text-dark">{pedido.CLIENTE}</span>
                  </td>
                  <td className="text-end py-3 fw-bold text-dark">
                    {pedido.VALOR.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="text-center py-3 pe-4">
                    <Badge bg="light" text="dark" className="border fw-normal px-2 py-1">
                      {COBRANCA_DESCRICAO[pedido.CODCOB] || pedido.CODCOB}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-light sticky-bottom border-top" style={{ zIndex: 1 }}>
              <tr>
                <td colSpan={3} className="text-end py-3 text-muted small text-uppercase">Total Geral</td>
                <td className="text-end py-3 fw-bold text-success fs-5">
                  {totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="py-3 pe-4"></td>
              </tr>
            </tfoot>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default Detalhes;
