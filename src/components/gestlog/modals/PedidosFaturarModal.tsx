import React from 'react';
import { Eye, XLg } from 'react-bootstrap-icons';
// unused import removed

export type PedidoGroup = {
  pedido: string;
  data: string | Date;
  tipoEntrega: string;
  cliente: string;
  codFilial: string;
  codFilialRetira?: string;
  codCli?: number;
  cobranca?: string;
  vendedor?: string;
  bairroEnt?: string;
  enderEnt?: string;
  numeroEnt?: string;
  municEnt?: string;
  telEnt?: string;
  posicao?: string;
  obs?: string;
  obs1?: string;
  obs2?: string;
  obsEntrega1?: string;
  obsEntrega2?: string;
  obsEntrega3?: string;
  log3?: string;
  vlFrete?: number;
  items: { descricao: string; quantidade: number | string; codigoDeBarras?: string; codProd?: number; multiplo?: number; embalagem?: string; qtTotal?: string }[];
  ageDays: number;
  normalizedDate: Date | null;
  statusPedido: number;
  ultimoStatusRaw?: string;
  statusEspecialPrioridade?: string;
  statusEspecialSeparado?: string;
  statusEspecialColeta?: string;
  statusEspecialRota?: string;
  statusEspecialLocalizacao?: string;
  statusEspecialFatura?: string;
  statusEspecialCorte?: string;
  statusEspecialEnvMessejana?: string;
  dtInicialSep?: string;
};

interface PedidosFaturarModalProps {
  show: boolean;
  onClose: () => void;
  pedidos: PedidoGroup[];
  viewedPedidos: Set<string>;
  onViewPedido: (pedido: PedidoGroup) => void;
}

const PedidosFaturarModal: React.FC<PedidosFaturarModalProps> = ({
  show,
  onClose,
  pedidos,
  viewedPedidos,
  onViewPedido,
}) => {
  const [tab, setTab] = React.useState<'P' | 'L' | 'M' | 'O'>('P');

  React.useEffect(() => {
    if (show) setTab('P');
  }, [show]);

  if (!show) return null;

  // Filtragem dos grupos
  const pendentes = pedidos.filter(p => p.posicao === 'P');
  const liberados = pedidos.filter(p => p.posicao === 'L');
  const montados = pedidos.filter(p => p.posicao === 'M');
  // Opcional: Outros (sem posição ou posição desconhecida)
  const outros = pedidos.filter(p => p.posicao !== 'P' && p.posicao !== 'L' && p.posicao !== 'M');

  const tabList = tab === 'P' ? pendentes : tab === 'L' ? liberados : tab === 'M' ? montados : outros;

  const renderPedidoCards = (list: PedidoGroup[], keyPrefix: string, emptyMessage: string) => {
    if (list.length === 0) {
      return <div className="p-2 text-muted text-center" style={{ fontSize: '0.7rem' }}>{emptyMessage}</div>;
    }
    const sorted = [...list].sort((a, b) => (b.ageDays - a.ageDays) || String(a.pedido).localeCompare(String(b.pedido)));
    return (
      <div className="d-flex flex-column gap-2 p-2">
        {sorted.map((p) => {
          const viewed = viewedPedidos.has(String(p.pedido));
          return (
            <div key={`${keyPrefix}-${p.pedido}`} className={`card ${viewed ? 'border-success' : 'border-secondary'}`}>
              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                    Pedido TV8: {p.pedido}
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={p.cliente ?? ''}
                  >
                    {p.cliente ?? '-'}
                  </div>
                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Posição: {p.posicao ?? '-'}</span>
                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.codFilialRetira ?? '-'}</span>
                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.tipoEntrega ?? '-'}</span>
                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Bairro: {p.bairroEnt ?? '-'}</span>
                    {p.normalizedDate ? (
                      <span className="badge bg-secondary">Data: {p.normalizedDate.toLocaleDateString('pt-BR')}</span>
                    ) : (
                      <span className="badge bg-secondary">Data: -</span>
                    )}
                  </div>
                </div>

                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-secondary">{p.items.length}</span>
                    <button
                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                      onClick={() => onViewPedido(p)}
                    >
                      <Eye size={12} />
                      <span>Visualizar</span>
                    </button>
                  </div>
                  {viewed ? (
                    <span className="badge bg-success" style={{ fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                      Visto
                    </span>
                  ) : (
                    <span className="badge bg-secondary" style={{ fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                      Não visto
                    </span>
                  )}
                  <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                    Dias úteis: {p.ageDays}
                  </span>
                </div>
              </div>

              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-borderless table-sm mb-0" style={{ fontSize: '0.70rem', ['--bs-table-border-color' as any]: 'transparent' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '14%' }}>Cód.</th>
                        <th style={{ width: '56%' }}>Descrição</th>
                        <th style={{ width: '15%' }}>Qtd</th>
                        <th style={{ width: '15%' }}>Qt Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.items.map((it, idx) => (
                        <tr key={`${keyPrefix}-${p.pedido}-it-${it.codProd ?? 'x'}-${idx}`}>
                          <td>{it.codProd ?? '-'}</td>
                          <td>{it.descricao}</td>
                          <td>{it.quantidade}</td>
                          <td>{it.qtTotal ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 1055, backdropFilter: 'blur(5px)' }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
        <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
          <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
            <div className="modal-header py-1">
              <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos para Faturar</h6>
              <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={onClose}></button>
            </div>
            <div className="modal-body bg-light" style={{ fontSize: '0.74rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
              {pedidos.length === 0 ? (
                <div className="alert alert-info m-2">Sem pedidos para faturar</div>
              ) : (
                <>
                  <ul className="nav nav-tabs" style={{ fontSize: '0.72rem' }}>
                    <li className="nav-item">
                      <button type="button" className={`nav-link ${tab === 'P' ? 'active' : ''}`} onClick={() => setTab('P')}>
                        Pendente <span className="badge bg-warning text-dark rounded-pill ms-1">{pendentes.length}</span>
                      </button>
                    </li>
                    <li className="nav-item">
                      <button type="button" className={`nav-link ${tab === 'L' ? 'active' : ''}`} onClick={() => setTab('L')}>
                        Liberado <span className="badge bg-success rounded-pill ms-1">{liberados.length}</span>
                      </button>
                    </li>
                    <li className="nav-item">
                      <button type="button" className={`nav-link ${tab === 'M' ? 'active' : ''}`} onClick={() => setTab('M')}>
                        Montado <span className="badge bg-primary rounded-pill ms-1">{montados.length}</span>
                      </button>
                    </li>
                    <li className="nav-item">
                      <button type="button" className={`nav-link ${tab === 'O' ? 'active' : ''}`} onClick={() => setTab('O')}>
                        Outros <span className="badge bg-secondary rounded-pill ms-1">{outros.length}</span>
                      </button>
                    </li>
                  </ul>

                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    {tab === 'P' && renderPedidoCards(tabList, 'faturar-p', 'Nenhum pedido pendente')}
                    {tab === 'L' && renderPedidoCards(tabList, 'faturar-l', 'Nenhum pedido liberado')}
                    {tab === 'M' && renderPedidoCards(tabList, 'faturar-m', 'Nenhum pedido montado')}
                    {tab === 'O' && renderPedidoCards(tabList, 'faturar-o', 'Nenhum pedido em outra posição')}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer py-1">
              <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={onClose}>
                <XLg size={12} />
                <span>Fechar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedidosFaturarModal;
