import React from 'react';
import { ArrowClockwise, Calendar3, PencilSquare, Plus, PlusCircle, Trash, Truck, Person, X, ClipboardCheck, FileText, GeoAlt, PinMap } from 'react-bootstrap-icons';
import type { PedidoDetalhe, PedidoItem, PedidoResumo } from '../../modals/VisualizarPedidoModal';
import SelecionarVeiculoModal from './SelecionarVeiculoModal';
import SelecionarMotoristaModal from './SelecionarMotoristaModal';
import NovaRotaModal from './NovaRotaModal';

export interface RotasPedidosModalProps {
  show: boolean;
  embedded?: boolean;
  zIndexBase?: number;
  onClose: () => void;
  pedido: PedidoDetalhe;
  outrosPedidos?: PedidoResumo[];
  abrirPedido?: (pedidoNum: number) => void;

  loading: boolean;
  statusTextoAtual: string;
  getStatusLabel: (statusPedido: number) => string;
  formatQuantidade: (quantidade?: number | string) => string;
  pendentesInventario: number[];
  addressData: {
    enderEnt?: string;
    numeroEnt?: string;
    bairroEnt?: string;
    municEnt?: string;
    cepEnt?: string;
  };
  hasValidatedAddress: boolean;
  validatedCepData: {
    cep: string;
    logradouro: string;
    complemento: string;
    bairro: string;
    localidade: string;
    uf: string;
    erro?: boolean;
  } | null;

  bloquearPorSeparacao: (permitirSeparado?: boolean) => boolean;
  onValidarCepCliente: () => void | Promise<void>;
  onAbrirValidarCepObservacao: () => void;
  onPegarLocalizacao: () => void;
  onInserirLocalizacao: () => void;
  onInventariar: (item: PedidoItem) => void;
}

const isPresent = (s?: string) => {
  if (s == null) return false;
  const t = String(s).trim();
  if (t.length === 0) return false;
  const hyphenOnly = /^[-–—]+$/.test(t);
  return !hyphenOnly;
};

const formatDateBR = (d: string | Date) => {
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return String(d);
  }
};

const formatPosicao = (p?: string | null): string => {
  if (!isPresent(p ?? undefined)) return '-';
  const raw = String(p).trim();
  const upper = raw.toUpperCase();
  const labels: Record<string, string> = {
    L: 'Liberado',
    M: 'Montada',
    P: 'Pendente',
  };
  const labelFromCode = labels[upper];
  if (labelFromCode) return labelFromCode;
  const first = upper[0];
  if (first && labels[first]) return labels[first];
  const labelFromText = Object.values(labels).find(v => v.toUpperCase() === upper);
  if (labelFromText) return labelFromText;
  return raw;
};

const formatTipoEntrega = (t?: string | null): string => {
  if (!isPresent(t ?? undefined)) return '-';
  const raw = String(t).trim();
  const upper = raw.toUpperCase();
  const labels: Record<string, string> = {
    EF: 'Entrega Futura',
    RP: 'Retira Posterior',
    EN: 'Entrega',
  };
  if (labels[upper]) return labels[upper];
  const token = upper.split(/[\s-]+/)[0];
  if (token && labels[token]) return labels[token];
  const labelFromText = Object.values(labels).find(v => v.toUpperCase() === upper);
  if (labelFromText) return labelFromText;
  return raw;
};

const RotasPedidosModal: React.FC<RotasPedidosModalProps> = ({
  show,
  embedded = false,
  zIndexBase,
  onClose,
  pedido,
  outrosPedidos = [],
  abrirPedido,
  loading,
  statusTextoAtual,
  getStatusLabel,
  formatQuantidade,
  pendentesInventario,
  addressData,
  hasValidatedAddress,
  validatedCepData,
  bloquearPorSeparacao,
  onValidarCepCliente,
  onAbrirValidarCepObservacao,
  onPegarLocalizacao,
  onInserirLocalizacao,
  onInventariar,
}) => {
  if (!show) return null;

  const baseZ = Number.isFinite(Number(zIndexBase)) ? Number(zIndexBase) : 2000;
  const modalBackdropZ = baseZ;
  const modalZ = baseZ + 10;

  const hasObs = isPresent(pedido.obs) || isPresent(pedido.obs1) || isPresent(pedido.obs2);
  const hasObsEntrega = isPresent(pedido.obsEntrega1) || isPresent(pedido.obsEntrega2) || isPresent(pedido.obsEntrega3);
  const disabledValidarCepCliente = Number(pedido.statusPedido) === 18 && pedido.log3?.trim() !== 'Entregar no Endereço de Cadastro';
  const disabledValidarCepObs = Number(pedido.statusPedido) === 18;
  const disabledPegarLocalizacao = Number(pedido.statusPedido) === 18 || statusTextoAtual === 'Pegar Localização';
  const disabledInserirLocalizacao = Number(pedido.statusPedido) === 18;

  const renderLocalizacaoAtual = () => {
    if (hasValidatedAddress) return null;
    const locStr = pedido.log3 || null;
    if (!locStr) return <span className="text-muted">Nenhuma localização cadastrada.</span>;

    try {
      if (locStr.startsWith('{')) {
        const parsed = JSON.parse(locStr);
        const address = (parsed?.address || '').toString();
        const num = parsed?.number ? `, ${parsed.number}` : '';
        const comp = parsed?.complement ? ` - ${parsed.complement}` : '';
        const fullAddress = `${address}${num}${comp}`;

        if (address.startsWith('http')) {
          return (
            <div>
              <a href={address} target="_blank" rel="noopener noreferrer">Link do Mapa</a>
              <span>{num}{comp}</span>
            </div>
          );
        }
        return <span>{fullAddress || '-'}</span>;
      }
    } catch {
      void 0;
    }

    if (locStr.startsWith('http')) {
      return <a href={locStr} target="_blank" rel="noopener noreferrer">{locStr}</a>;
    }
    return <span>{locStr}</span>;
  };

  const leftCard = (
    <div style={{ fontSize: '0.72rem', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="card" style={{ border: '1px solid rgba(0,0,0,0.175)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="card-header py-0 px-2 d-flex justify-content-between align-items-center" style={{ fontSize: '0.8rem', backgroundColor: '#f8f9fa', minHeight: '30px' }}>
          <div>
            <strong>Incluir em Rota</strong> — Pedido {pedido.pedido}
          </div>
          {!embedded && (
            <button type="button" className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center" style={{ fontSize: '0.68rem', lineHeight: 1.1 }} onClick={onClose}>
              <X size={12} className="me-1" /> Fechar
            </button>
          )}
        </div>
        <div className="card-body py-2 px-2" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="mb-2" style={{ fontSize: '0.75rem' }}><strong>Detalhes do Pedido</strong></div>
          <div className="row g-1" style={{ fontSize: '0.7rem' }}>
            <div className="col-12">
              <div className="d-flex align-items-center" style={{ fontSize: '0.8rem', marginBottom: '2px' }}>
                <strong className="me-1">Cliente:</strong> <span className="text-muted me-2 text-truncate" style={{ maxWidth: '300px' }}>{pedido.cliente ?? '-'}</span>
                <span className="text-muted mx-1">|</span>
                <strong className="me-1">Cód:</strong> <span className="text-muted">{pedido.codCli ?? '-'}</span>
              </div>
            </div>
            <div className="col-md-6" style={{ borderRight: '1px solid #dee2e6' }}>
              <div className="mb-0"><strong>Data:</strong> <span className="text-muted ms-1">{formatDateBR(pedido.data)}</span></div>
              <div className="mb-0 text-truncate"><strong>Entrega/Retira:</strong> <span className="text-muted ms-1">{formatTipoEntrega(pedido.tipoEntrega)}</span></div>
              <div className="mb-0"><strong>Posição:</strong> <span className="text-muted ms-1">{formatPosicao(pedido.posicao)}</span></div>
              <div className="mb-0 text-truncate"><strong>Cobrança:</strong> <span className="text-muted ms-1">{pedido.cobranca ?? '-'}</span></div>
              <div className="mb-0"><strong>Frete:</strong> <span className="text-muted ms-1">{pedido.vlFrete != null ? `R$ ${pedido.vlFrete.toFixed(2).replace('.', ',')}` : '-'}</span></div>
            </div>
            <div className="col-md-6 ps-2">
              <div className="mb-0"><strong>Filial Venda:</strong> <span className="text-muted ms-1">{pedido.codFilial ?? '-'}</span></div>
              {pedido.codFilialRetira && (
                <div className="mb-0"><strong>Filial Retira:</strong> <span className="text-muted ms-1">{pedido.codFilialRetira}</span></div>
              )}
              <div className="mb-0 text-truncate"><strong>Vendedor(a):</strong> <span className="text-muted ms-1">{pedido.vendedor ?? '-'}</span></div>
              <div className="mb-0 text-truncate">
                <strong>Status:</strong> <span className="text-muted ms-1">{statusTextoAtual}</span>
              </div>
              <div className="mb-0"><strong>Dias úteis após a Compra:</strong> <span className="text-muted ms-1">{Number.isFinite(pedido.ageDays) ? pedido.ageDays : '-'}</span></div>
            </div>
          </div>

          <hr className="my-2" />

          <div className="mb-1" style={{ fontSize: '0.75rem' }}><strong>TV8</strong> {pedido.pedido}</div>
          <h6 className="mb-1" style={{ fontSize: '0.8rem' }}>Itens ({pedido.items.length})</h6>
          <div className="table-responsive">
            <table className="table table-sm" style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Cod. Produto</th>
                  <th style={{ width: '28%' }}>Produto</th>
                  <th style={{ width: '15%' }}>Código de Barras</th>
                  <th style={{ width: '10%' }}>Múltiplo</th>
                  <th style={{ width: '10%' }}>Qtd</th>
                  <th style={{ width: '10%' }}>Qtd Total</th>
                  <th style={{ width: '15%' }}>P/ Inventariar?</th>
                </tr>
              </thead>
              <tbody>
                {pedido.items.map((it, idx) => (
                  <tr key={`inclui-rota-item-${idx}`}>
                    <td style={{ width: '12%' }}>{it.codProd ?? '-'}</td>
                    <td style={{ width: '28%' }}>{it.descricao}</td>
                    <td style={{ width: '15%' }}>{it.codigoDeBarras ?? '-'}</td>
                    <td style={{ width: '10%' }}>{it.multiplo ?? '-'}</td>
                    <td style={{ width: '10%' }}>{formatQuantidade(it.quantidade)}</td>
                    <td style={{ width: '10%' }}>{it.qtTotal ?? '-'}</td>
                    <td style={{ width: '15%' }}>
                      {it.codProd != null && pendentesInventario.includes(it.codProd) ? (
                        <span className="text-muted" style={{ fontSize: '0.65rem', fontStyle: 'italic' }}>Em inventário</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-0 px-1"
                          style={{ fontSize: '0.65rem' }}
                          title="Inventariar"
                          onClick={() => onInventariar(it)}
                        >
                          Inventariar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <hr className="my-2" />

          <div className="mb-1" style={{ fontSize: '0.75rem' }}><strong>Observações</strong></div>
          <div style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
            <div className="row g-1">
              {isPresent(pedido.obs) && (
                <div className="col-md-12 mb-1">{String(pedido.obs)}</div>
              )}
              {isPresent(pedido.obs1) && (
                <div className="col-md-12 mb-1">{String(pedido.obs1)}</div>
              )}
              {isPresent(pedido.obs2) && (
                <div className="col-md-12 mb-1">{String(pedido.obs2)}</div>
              )}
              {isPresent(pedido.obsEntrega1) && (
                <div className="col-md-12 mb-1">{String(pedido.obsEntrega1)}</div>
              )}
              {isPresent(pedido.obsEntrega2) && (
                <div className="col-md-12 mb-1">{String(pedido.obsEntrega2)}</div>
              )}
              {isPresent(pedido.obsEntrega3) && (
                <div className="col-md-12 mb-1">{String(pedido.obsEntrega3)}</div>
              )}
              {!hasObs && !hasObsEntrega && (
                <div className="col-md-12"><span className="text-muted">Sem observações.</span></div>
              )}
            </div>
          </div>

          <hr className="my-2" />

          <div className="d-flex justify-content-between align-items-center mb-2" style={{ fontSize: '0.75rem' }}>
            <div className="d-flex align-items-center gap-2">
              <span><strong>Localização de Entrega</strong></span>
            </div>
            <div className="d-flex gap-2 flex-wrap justify-content-end">
              <button
                type="button"
                className="btn btn-info btn-sm py-1 px-2 d-inline-flex align-items-center"
                disabled={disabledValidarCepCliente}
                style={{ fontSize: '0.68rem', lineHeight: 1.1 }}
                title="Validar CEP do cadastro do cliente"
                onClick={() => {
                  if (bloquearPorSeparacao()) return;
                  void onValidarCepCliente();
                }}
              >
                <ClipboardCheck size={12} className="me-1" /> Validar CEP
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2 d-inline-flex align-items-center"
                disabled={disabledValidarCepObs}
                style={{ fontSize: '0.68rem', lineHeight: 1.1 }}
                title="Validar CEP informado nas observações"
                onClick={() => {
                  if (bloquearPorSeparacao(true)) return;
                  onAbrirValidarCepObservacao();
                }}
              >
                <FileText size={12} className="me-1" /> Validar CEP da Obs.
              </button>
              <button
                type="button"
                className="btn btn-warning btn-sm py-1 px-2 d-inline-flex align-items-center"
                disabled={disabledPegarLocalizacao}
                style={{ fontSize: '0.68rem', lineHeight: 1.1 }}
                title="Solicitar localização"
                onClick={() => {
                  if (bloquearPorSeparacao()) return;
                  onPegarLocalizacao();
                }}
              ><GeoAlt size={12} className="me-1" /> Pegar Localização</button>
              <button
                type="button"
                className="btn btn-success btn-sm py-1 px-2 d-inline-flex align-items-center"
                disabled={disabledInserirLocalizacao}
                style={{ fontSize: '0.68rem', lineHeight: 1.1 }}
                title="Inserir localização"
                onClick={() => {
                  if (bloquearPorSeparacao(true)) return;
                  onInserirLocalizacao();
                }}
              >
                <PinMap size={12} className="me-1" /> Inserir Localização
              </button>
            </div>
          </div>
          <div style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
            {hasValidatedAddress ? (
              <div className="row g-2">
                <div className="col-6" style={{ borderRight: '1px solid #dee2e6' }}>
                  {validatedCepData ? (
                    <div>
                      <div className="text-success mb-1" style={{ fontWeight: 'bold' }}>CEP Consultado (ViaCEP):</div>
                      <div>{validatedCepData.logradouro}{validatedCepData.complemento ? ` - ${validatedCepData.complemento}` : ''}</div>
                      <div>{validatedCepData.bairro ? `${validatedCepData.bairro} - ` : ''}{validatedCepData.localidade}{validatedCepData.uf ? `/${validatedCepData.uf}` : ''}</div>
                      <div><strong>CEP:</strong> {validatedCepData.cep}</div>
                    </div>
                  ) : (
                    <div className="text-muted">
                      <em>Sem dados de validação externa (CEP não encontrado ou inválido).</em>
                    </div>
                  )}
                </div>
                <div className="col-6">
                  <div>
                    <div className="text-muted mb-1" style={{ fontWeight: 'bold' }}>CEP de Cadastro (Interno):</div>
                    <div>{(addressData.enderEnt || '').trim() || '-'}, {(addressData.numeroEnt || '').trim() || '-'}</div>
                    <div>{(addressData.bairroEnt || '').trim() || '-'} - {(addressData.municEnt || '').trim() || '-'}</div>
                    <div><strong>CEP:</strong> {addressData.cepEnt || '-'}</div>
                  </div>
                </div>
              </div>
            ) : (
              renderLocalizacaoAtual()
            )}
          </div>

          <hr className="my-2" />

          <div className="py-1 px-2 mb-2" style={{ fontSize: '0.75rem', backgroundColor: '#ffe8cc', color: '#5c3d0b', border: '1px solid #ffc078', borderRadius: 6 }}>
            <strong>Outros pedidos em aberto do mesmo cliente</strong>
          </div>
          {Array.isArray(outrosPedidos) && outrosPedidos.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-sm mb-0" style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>TV8</th>
                    <th style={{ width: '22%' }}>Cliente</th>
                    <th style={{ width: '14%' }}>Bairro</th>
                    <th style={{ width: '12%' }}>Data</th>
                    <th style={{ width: '8%' }}>Itens</th>
                    <th style={{ width: '10%' }}>Posição</th>
                    <th style={{ width: '10%' }}>Filial Retira</th>
                    <th style={{ width: '14%' }}>Status do pedido</th>
                    <th style={{ width: '10%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {outrosPedidos.map((op, idx) => (
                    <tr key={`outro-inclui-rota-${op.pedido}-${idx}`}>
                      <td>{op.pedido}</td>
                      <td>{op.cliente}</td>
                      <td>{op.bairroEnt ?? '-'}</td>
                      <td>{op.normalizedDate ? op.normalizedDate.toLocaleDateString('pt-BR') : '-'}</td>
                      <td>{op.itens}</td>
                      <td>{formatPosicao(op.posicao)}</td>
                      <td>{op.codFilialRetira ?? '-'}</td>
                      <td>{getStatusLabel(Number(op.statusPedido))}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-0 px-2"
                          style={{ fontSize: '0.62rem', lineHeight: 1 }}
                          onClick={() => {
                            const num = Number(op.pedido);
                            if (!Number.isFinite(num)) return;
                            if (typeof abrirPedido === 'function') {
                              abrirPedido(num);
                            }
                          }}
                        >
                          Visualizar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <span className="text-muted" style={{ fontSize: '0.7rem' }}>Nenhum outro pedido em aberto para este cliente.</span>
          )}
        </div>
      </div>
    </div>
  );

  const body = (
    <div className="p-0 d-flex" style={{ overflow: 'hidden', height: '100%', minHeight: 0, alignItems: 'stretch' }}>
      <div style={{ width: '50%', borderRight: '1px solid #dee2e6', padding: '0.75rem', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {loading && (
          <div className="position-absolute w-100 h-100" style={{ inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-center">
              <div className="spinner-border text-danger" role="status" style={{ width: '2rem', height: '2rem' }}>
                <span className="visually-hidden">Carregando...</span>
              </div>
              <div className="mt-2" style={{ fontSize: '0.8rem', color: '#dc3545' }}>Processando...</div>
            </div>
          </div>
        )}
        {leftCard}
      </div>
      <div style={{ width: '50%', padding: '0.75rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <RotaActionsCard pedido={pedido} zIndexBase={baseZ} />
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: modalBackdropZ }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: modalZ }}>
        <div className="modal-dialog modal-fullscreen" role="document">
          <div className="modal-content">
            <div className="modal-body p-0" style={{ overflow: 'hidden' }}>
              {body}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RotasPedidosModal;

export interface RotasCardModalProps {
  show: boolean;
  onClose: () => void;
  dataInicial?: string;
  zIndexBase?: number;
}

export const RotasCardModal: React.FC<RotasCardModalProps> = ({ show, onClose, dataInicial, zIndexBase }) => {
  if (!show) return null;

  const baseZ = Number.isFinite(Number(zIndexBase)) ? Number(zIndexBase) : 6000;

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: baseZ }}>
      <div className="modal d-block" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: baseZ + 10 }}>
        <div className="modal-dialog modal-dialog-centered modal-xl" role="document" style={{ maxWidth: 1200 }}>
          <div className="modal-content" style={{ overflow: 'hidden' }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: '0.95rem' }}>Rotas</h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body p-2" style={{ height: '85vh', overflow: 'hidden' }}>
              <div style={{ height: '100%', minHeight: 0, display: 'flex' }}>
                <RotaActionsCard pedido={undefined} zIndexBase={baseZ} dataInicial={dataInicial} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RotaActionsCard: React.FC<{ pedido?: PedidoDetalhe; zIndexBase?: number; dataInicial?: string }> = ({ pedido, zIndexBase, dataInicial }) => {
  const baseZ = Number.isFinite(Number(zIndexBase)) ? Number(zIndexBase) : 2000;
  const confirmBackdropZ = baseZ + 1990;
  const confirmModalZ = baseZ + 1995;
  const messageBackdropZ = baseZ + 2000;
  const messageModalZ = baseZ + 2010;

  type PedidoRotaResumo = {
    numped: number;
    cliente: string;
    codcli?: number;
    posicao?: string;
    statusDescricao?: string;
    statusLog?: string;
    separadorPedido?: string;
    dataAdd?: string;
    itens: number;
    qt: number;
    valor: number;
    produtosPreview: string[];
    prioridade?: boolean;
    separado?: boolean;
    coleta?: boolean;
    localizacao?: boolean;
    fatura?: boolean;
    corte?: boolean;
    envMessejana?: boolean;
    itensDetalhe: Array<{ codprod?: number; descricao?: string; qt?: number }>;
  };

  type MessageState = {
    show: boolean;
    title: string;
    content: string;
    isError?: boolean;
  };

  type ConfirmAddState = {
    show: boolean;
    title: string;
    content: string;
    idRota: number | null;
    numPedido: number | null;
    clienteNome: string;
    rotaNome: string;
  };

  type ConfirmDeleteState = {
    show: boolean;
    title: string;
    content: string;
    idRota: number | null;
  };

  type ConfirmRemovePedidoState = {
    show: boolean;
    title: string;
    content: string;
    idRota: number | null;
    numped: number | null;
  };

  type VinculoRota = {
    idRota: number;
    descricaoRota?: string | null;
    dataRota?: string | Date | null;
    turnoSeparacao?: string | null;
    codMotorista?: number | null;
    motoristaNome?: string | null;
    codVeiculo?: number | null;
    veiculoDescricao?: string | null;
    veiculoPlaca?: string | null;
    dataAdd?: string | Date | null;
  };

  type VinculoPedidoResponse = {
    found: boolean;
    rota?: VinculoRota;
  };

  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editIdRota, setEditIdRota] = React.useState<number | null>(null);
  const [editDescricao, setEditDescricao] = React.useState('');
  const [editBairro1, setEditBairro1] = React.useState('');
  const [editBairro2, setEditBairro2] = React.useState('');
  const [editBairro3, setEditBairro3] = React.useState('');
  const [editBairro4, setEditBairro4] = React.useState('');
  const [editBairro5, setEditBairro5] = React.useState('');
  const [editCodMotorista, setEditCodMotorista] = React.useState<string>('');
  const [editCodVeiculo, setEditCodVeiculo] = React.useState<string>('');
  const [editDataRota, setEditDataRota] = React.useState<string>('');
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [editMsg, setEditMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [addSubmittingId, setAddSubmittingId] = React.useState<number | null>(null);
  const [checkVinculoSubmittingId, setCheckVinculoSubmittingId] = React.useState<number | null>(null);
  const [removeSubmittingKey, setRemoveSubmittingKey] = React.useState<string | null>(null);
  const [pedidosByRota, setPedidosByRota] = React.useState<Record<number, PedidoRotaResumo[]>>({});
  const [pedidosLoading, setPedidosLoading] = React.useState(false);
  const [dataBusca, setDataBusca] = React.useState<string>(() => {
    const initial = String(dataInicial ?? '').trim();
    if (initial) return initial;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [rotasLoading, setRotasLoading] = React.useState(false);
  const [rotasError, setRotasError] = React.useState<string | null>(null);
  const [rotas, setRotas] = React.useState<Array<Record<string, unknown>>>([]);
  const [descricao, setDescricao] = React.useState('');
  const [bairro1, setBairro1] = React.useState('');
  const [bairro2, setBairro2] = React.useState('');
  const [bairro3, setBairro3] = React.useState('');
  const [bairro4, setBairro4] = React.useState('');
  const [bairro5, setBairro5] = React.useState('');
  const [codMotorista, setCodMotorista] = React.useState<string>('');
  const [motoristaLabel, setMotoristaLabel] = React.useState<string>('');
  const [motoristaModalOpen, setMotoristaModalOpen] = React.useState(false);
  const [codVeiculo, setCodVeiculo] = React.useState<string>('');
  const [veiculoLabel, setVeiculoLabel] = React.useState<string>('');
  const [veiculoModalOpen, setVeiculoModalOpen] = React.useState(false);
  const [gerirVeiculosModalOpen, setGerirVeiculosModalOpen] = React.useState(false);
  const [gerirMotoristasModalOpen, setGerirMotoristasModalOpen] = React.useState(false);
  const [dataRota, setDataRota] = React.useState<string>('');
  const [turnoSeparacao, setTurnoSeparacao] = React.useState<string>('');
  const [codUsurCriacao, setCodUsurCriacao] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [messageModal, setMessageModal] = React.useState<MessageState>({ show: false, title: '', content: '' });
  const [confirmAddModal, setConfirmAddModal] = React.useState<ConfirmAddState>({
    show: false,
    title: '',
    content: '',
    idRota: null,
    numPedido: null,
    clienteNome: '',
    rotaNome: '',
  });
  const [activeTurno, setActiveTurno] = React.useState<string>('');
  const [cimentoQtByRota, setCimentoQtByRota] = React.useState<Record<number, number>>({});
  const [deleteSubmittingId, setDeleteSubmittingId] = React.useState<number | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = React.useState<ConfirmDeleteState>({
    show: false,
    title: "",
    content: "",
    idRota: null,
  });
  const [confirmRemoveModal, setConfirmRemoveModal] = React.useState<ConfirmRemovePedidoState>({
    show: false,
    title: "",
    content: "",
    idRota: null,
    numped: null,
  });

  const weekdayLabel = React.useMemo(() => {
    if (!dataBusca) return '';
    const parts = dataBusca.split('-').map(p => p.trim());
    if (parts.length !== 3) return '';
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
    const dt = new Date(y, m - 1, d);
    if (!Number.isFinite(dt.getTime())) return '';
    const wd = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
    return wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : '';
  }, [dataBusca]);

  const parseQt = (v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const raw = String(v).trim();
    if (!raw) return null;
    const hasComma = raw.includes(',');
    const normalized = hasComma ? raw.replaceAll('.', '').replaceAll(',', '.') : raw;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const getCimentoQtFromPedido = (p: PedidoDetalhe): number => {
    const items = Array.isArray(p?.items) ? p.items : [];
    let sum = 0;
    for (const it of items) {
      const cod = typeof it?.codProd === 'number' ? it.codProd : Number(it?.codProd);
      if (!Number.isFinite(cod) || cod !== 64305) continue;
      const qt = parseQt(it?.quantidade);
      if (qt != null) sum += qt;
    }
    return sum;
  };

  const pedidoTemCimento = (p: PedidoDetalhe): boolean => {
    const items = Array.isArray(p?.items) ? p.items : [];
    for (const it of items) {
      const cod = typeof it?.codProd === 'number' ? it.codProd : Number(it?.codProd);
      if (Number.isFinite(cod) && cod === 64305) return true;
    }
    return false;
  };

  const formatVinculoRotaText = (rota: VinculoRota): string => {
    const idRota = Number(rota?.idRota);
    const rotaTitulo = `${Number.isFinite(idRota) ? `Rota ${idRota}` : 'Rota'}${rota?.descricaoRota ? ` - ${String(rota.descricaoRota).trim()}` : ''}`;
    const dataRota = rota?.dataRota ? formatDateBR(rota.dataRota) : '-';
    const dataAdd = rota?.dataAdd ? formatDateBR(rota.dataAdd) : '-';
    const turno = getTurnoLabel(String(rota?.turnoSeparacao ?? ''));
    const motorista = (
      String(rota?.motoristaNome ?? '').trim().length > 0 || rota?.codMotorista != null
        ? `${String(rota?.motoristaNome ?? '').trim() || '-'}${rota?.codMotorista != null ? ` (${rota.codMotorista})` : ''}`
        : '-'
    );
    const veiculoDesc = String(rota?.veiculoDescricao ?? '').trim();
    const veiculoPlaca = String(rota?.veiculoPlaca ?? '').trim();
    const veiculoCod = rota?.codVeiculo != null ? ` (${rota.codVeiculo})` : '';
    const veiculo = veiculoDesc ? `${veiculoDesc}${veiculoPlaca ? ` (${veiculoPlaca})` : ''}${veiculoCod}` : (veiculoPlaca ? `${veiculoPlaca}${veiculoCod}` : (veiculoCod ? veiculoCod.trim() : '-'));
    return `Pedido já está em rota.\n${rotaTitulo}\nData: ${dataRota}\n${turno}\nMotorista: ${motorista}\nVeículo: ${veiculo}\nIncluído em: ${dataAdd}`;
  };

  const addPedidoToRota = (params: { idRota: number; numPedido: number; clienteNome: string; rotaNome: string }) => {
    const { idRota, numPedido, clienteNome } = params;
    const codUsurAdd = (() => {
      try {
        const raw = localStorage.getItem("usuarioLogado") || "";
        if (!raw) return null;
        const u = JSON.parse(raw);
        const codeStr = String(u?.codusur ?? u?.CODUSUR ?? u?.matricula ?? u?.MATRICULA ?? "").trim();
        const code = Number(codeStr);
        return Number.isFinite(code) ? code : null;
      } catch {
        return null;
      }
    })();
    if (!codUsurAdd) {
      setMsg({ type: 'error', text: 'Não foi possível obter a matrícula do usuário (CODUSUR_ADD).' });
      setMessageModal({ show: true, title: 'Erro', content: 'Não foi possível obter a matrícula do usuário (CODUSUR_ADD).', isError: true });
      return;
    }
    setAddSubmittingId(idRota);
    setMsg(null);
    fetch(`/api/gestlog/rotas/${idRota}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numped: numPedido, codUsurAdd })
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const t = typeof data?.message === 'string' ? data.message : 'Falha ao vincular pedido na rota';
          const err = new Error(t);
          (err as Error & { status?: number; data?: unknown }).status = res.status;
          (err as Error & { status?: number; data?: unknown }).data = data;
          throw err;
        }
        return data;
      })
      .then(() => {
        setMsg({ type: 'success', text: `Pedido ${numPedido} vinculado à rota ${idRota}.` });
        setPedidosByRota((prev) => {
          const next = { ...prev };
          const list = Array.isArray(next[idRota]) ? [...next[idRota]] : [];
          if (!list.some((p) => p.numped === numPedido)) {
            list.unshift({
              numped: numPedido,
              cliente: clienteNome,
              itens: 0,
              qt: 0,
              valor: 0,
              produtosPreview: [],
              itensDetalhe: [],
            });
          }
          next[idRota] = list;
          return next;
        });
        void fetchRotas(dataBusca);
      })
      .catch((err) => {
        const e = err as (Error & { status?: number; data?: unknown }) | unknown;
        const t = e instanceof Error ? e.message : 'Erro ao comunicar com o servidor.';
        const data = e && typeof e === 'object' ? (e as { data?: unknown }).data : undefined;
        const rota = data && typeof data === 'object' ? (data as { rota?: VinculoRota }).rota : undefined;
        const status = e && typeof e === 'object' && e != null && 'status' in e ? Number((e as { status?: unknown }).status) : null;
        if (status === 409 && rota && Number.isFinite(Number(rota.idRota))) {
          const text = formatVinculoRotaText(rota);
          setMsg({ type: 'error', text: t });
          setMessageModal({ show: true, title: 'Pedido já está em rota', content: text, isError: true });
          return;
        }
        setMsg({ type: 'error', text: t });
        setMessageModal({ show: true, title: 'Erro', content: t, isError: true });
      })
      .finally(() => {
        setAddSubmittingId(null);
      });
  };

  const fetchRotas = React.useCallback(async (data: string) => {
    setRotasError(null);
    if (!data) {
      setRotas([]);
      setPedidosByRota({});
      setCimentoQtByRota({});
      return;
    }
    setRotasLoading(true);
    setPedidosLoading(true);
    try {
      const qs = new URLSearchParams({ dataRota: data });
      const res = await fetch(`/api/gestlog/rotas?${qs.toString()}`);
      if (!res.ok) {
        const r = await res.json().catch(() => ({}));
        const t = typeof r?.message === 'string' ? r.message : 'Falha ao listar rotas';
        setRotasError(t);
        setRotas([]);
        setPedidosByRota({});
        return;
      }
      const r = await res.json();
      const fullRows = Array.isArray(r?.rows) ? (r.rows as Array<Record<string, unknown>>) : [];

      const rotasMap = new Map<number, Record<string, unknown>>();
      const pedidosGrouped: Record<number, Record<number, PedidoRotaResumo>> = {};
      const cimentoQtNext: Record<number, number> = {};

      for (const row of fullRows) {
        const idRota = Number(row?.id_rota);
        if (!Number.isFinite(idRota)) continue;

        if (!rotasMap.has(idRota)) {
          const codMotoristaRaw = row?.cod_motorista ?? null;
          const codVeiculoRaw = row?.cod_veiculo ?? null;
          const codMotoristaNum = typeof codMotoristaRaw === 'number' ? codMotoristaRaw : Number(codMotoristaRaw);
          const codVeiculoNum = typeof codVeiculoRaw === 'number' ? codVeiculoRaw : Number(codVeiculoRaw);
          const capCimentoRaw = (row as Record<string, unknown>)?.veiculo_capacidade_cimento ?? null;
          const capCimentoNum = typeof capCimentoRaw === 'number' ? capCimentoRaw : Number(capCimentoRaw);
          rotasMap.set(idRota, {
            ID_ROTA: idRota,
            DESCRICAO_ROTA: typeof row?.descricao_rota === 'string' ? row.descricao_rota : '',
            BAIRRO_ROTA_1: typeof row?.bairro1 === 'string' ? row.bairro1 : '',
            BAIRRO_ROTA_2: typeof row?.bairro2 === 'string' ? row.bairro2 : '',
            BAIRRO_ROTA_3: typeof row?.bairro3 === 'string' ? row.bairro3 : '',
            BAIRRO_ROTA_4: typeof row?.bairro4 === 'string' ? row.bairro4 : '',
            BAIRRO_ROTA_5: typeof row?.bairro5 === 'string' ? row.bairro5 : '',
            COD_MOTORISTA: Number.isFinite(codMotoristaNum) ? codMotoristaNum : null,
            COD_VEICULO: Number.isFinite(codVeiculoNum) ? codVeiculoNum : null,
            DATA_ROTA: typeof row?.data_rota === 'string' ? row.data_rota : row?.data_rota ?? null,
            TURNO_SEPARACAO: typeof row?.turno_separacao === 'string' ? row.turno_separacao : row?.turno_separacao ?? null,
            MOTORISTA_NOME: typeof row?.motorista_nome === 'string' ? row.motorista_nome : '',
            VEICULO_DESCRICAO: typeof row?.veiculo_descricao === 'string' ? row.veiculo_descricao : '',
            VEICULO_PLACA: typeof row?.veiculo_placa === 'string' ? row.veiculo_placa : '',
            VEICULO_CAPACIDADE_CIMENTO: Number.isFinite(capCimentoNum) ? capCimentoNum : null,
          });
        }

        const numped = Number(row?.numped);
        if (!Number.isFinite(numped) || numped === 0) continue;
        const cliente = typeof row?.cliente === 'string' ? row.cliente : '';
        const codcli = Number(row?.codcli);
        const posicao = typeof row?.posicao === 'string' ? row.posicao : undefined;
        const statusDescricao = typeof row?.status_descricao === 'string' ? row.status_descricao : undefined;
        const statusLog = row?.status_log != null ? String(row.status_log) : undefined;
        const separadorPedido = typeof row?.separador_pedido === 'string' ? row.separador_pedido : undefined;
        const dataAdd =
          typeof row?.data_add_rota === 'string'
            ? row.data_add_rota
            : row?.data_add_rota != null
              ? String(row.data_add_rota)
              : undefined;
        const qt = parseQt(row?.qt);
        const pvenda = Number(row?.pvenda);
        const valorItem = qt != null && Number.isFinite(pvenda) ? qt * pvenda : 0;
        const descProd = typeof row?.descricao_produto === 'string' ? row.descricao_produto.trim() : '';
        const prioridade = String(row?.prioridade ?? '').toUpperCase() === 'S';
        const separado = String(row?.separado ?? '').toUpperCase() === 'S';
        const coleta = String(row?.coleta ?? '').toUpperCase() === 'S';
        const localizacao = String(row?.localizacao ?? '').toUpperCase() === 'S';
        const fatura = String(row?.fatura ?? '').toUpperCase() === 'S';
        const corte = String(row?.corte ?? '').toUpperCase() === 'S';
        const envMessejana = String(row?.env_messejana ?? '').toUpperCase() === 'S';
        const codprod = Number(row?.codprod);

        if (Number.isFinite(codprod) && codprod === 64305 && qt != null) {
          cimentoQtNext[idRota] = (cimentoQtNext[idRota] || 0) + qt;
        }

        if (!pedidosGrouped[idRota]) pedidosGrouped[idRota] = {};
        const existing = pedidosGrouped[idRota][numped];
        if (!existing) {
          pedidosGrouped[idRota][numped] = {
            numped,
            cliente,
            codcli: Number.isFinite(codcli) ? codcli : undefined,
            posicao,
            statusDescricao,
            statusLog,
            separadorPedido,
            dataAdd,
            itens: 1,
            qt: qt ?? 0,
            valor: valorItem,
            produtosPreview: descProd ? [descProd] : [],
            prioridade,
            separado,
            coleta,
            localizacao,
            fatura,
            corte,
            envMessejana,
          itensDetalhe: [{
            codprod: Number.isFinite(codprod) ? codprod : undefined,
            descricao: descProd || undefined,
            qt: qt ?? undefined
          }],
        };
        } else {
          existing.itens += 1;
          if (qt != null) existing.qt += qt;
          existing.valor += valorItem;
          if (!existing.dataAdd && dataAdd) existing.dataAdd = dataAdd;
          if (!existing.posicao && posicao) existing.posicao = posicao;
          if (!existing.statusDescricao && statusDescricao) existing.statusDescricao = statusDescricao;
          if (!existing.statusLog && statusLog) existing.statusLog = statusLog;
          if (!existing.separadorPedido && separadorPedido) existing.separadorPedido = separadorPedido;
          if (existing.codcli == null && Number.isFinite(codcli)) existing.codcli = codcli;
          if (!existing.prioridade && prioridade) existing.prioridade = true;
          if (!existing.separado && separado) existing.separado = true;
          if (!existing.coleta && coleta) existing.coleta = true;
          if (!existing.localizacao && localizacao) existing.localizacao = true;
          if (!existing.fatura && fatura) existing.fatura = true;
          if (!existing.corte && corte) existing.corte = true;
          if (!existing.envMessejana && envMessejana) existing.envMessejana = true;
          if (descProd && existing.produtosPreview.length < 3 && !existing.produtosPreview.includes(descProd)) {
            existing.produtosPreview.push(descProd);
          }
          const jaTem = existing.itensDetalhe.some(it => (Number.isFinite(codprod) ? it.codprod === codprod : it.descricao === descProd));
          if (!jaTem && existing.itensDetalhe.length < 5) {
            existing.itensDetalhe.push({
              codprod: Number.isFinite(codprod) ? codprod : undefined,
              descricao: descProd || undefined,
              qt: qt ?? undefined
            });
          }
        }
      }

      const pedidosListByRota: Record<number, PedidoRotaResumo[]> = {};
      for (const k of Object.keys(pedidosGrouped)) {
        const id = Number(k);
        const perPedido = pedidosGrouped[id] || {};
        pedidosListByRota[id] = Object.values(perPedido).sort((a, b) => b.numped - a.numped);
      }

      const rotasList = Array.from(rotasMap.values()).sort((a, b) => {
        const idA = Number((a || {})?.ID_ROTA);
        const idB = Number((b || {})?.ID_ROTA);
        const nA = Number.isFinite(idA) ? idA : Number.POSITIVE_INFINITY;
        const nB = Number.isFinite(idB) ? idB : Number.POSITIVE_INFINITY;
        return nA - nB;
      });

      setRotas(rotasList);
      setPedidosByRota(pedidosListByRota);
      setCimentoQtByRota(cimentoQtNext);
    } catch {
      setRotasError('Erro ao comunicar com o servidor.');
      setRotas([]);
      setPedidosByRota({});
      setCimentoQtByRota({});
    } finally {
      setRotasLoading(false);
      setPedidosLoading(false);
    }
  }, []);

  const getTurnoFromRow = (row: Record<string, unknown>): string => {
    const v = (row as Record<string, unknown>)['TURNO_SEPARACAO'];
    const s = typeof v === 'string' ? v : v == null ? '' : String(v);
    const out = s.trim();
    return out || '-';
  };

  const turnos = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rotas) {
      const row = (r || {}) as Record<string, unknown>;
      set.add(getTurnoFromRow(row));
    }
    const arr = Array.from(set);
    const rank = (v: string) => (v === 'M' ? 0 : v === 'T' ? 1 : v === '-' ? 99 : 50);
    return arr.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
  }, [rotas]);

  React.useEffect(() => {
    if (!activeTurno && turnos.length > 0) {
      setActiveTurno(turnos[0]);
    } else if (activeTurno && !turnos.includes(activeTurno) && turnos.length > 0) {
      setActiveTurno(turnos[0]);
    }
  }, [turnos, activeTurno]);

  const rotasFiltradas = React.useMemo(() => {
    const alvo = activeTurno || '';
    return rotas.filter((r) => {
      const row = (r || {}) as Record<string, unknown>;
      const v = getTurnoFromRow(row);
      return !alvo ? true : v === alvo;
    });
  }, [rotas, activeTurno]);

  const turnoCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rotas) {
      const row = (r || {}) as Record<string, unknown>;
      const v = getTurnoFromRow(row);
      map.set(v, (map.get(v) || 0) + 1);
    }
    return map;
  }, [rotas]);

  const removerPedidoDaRota = React.useCallback(
    async (idRota: number, numped: number) => {
      if (!Number.isFinite(idRota) || !Number.isFinite(numped)) return;

      setMsg(null);
      const key = `${idRota}-${numped}`;
      setRemoveSubmittingKey(key);
      try {
        const res = await fetch(`/api/gestlog/rotas/${idRota}/pedidos/${numped}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const t = typeof data?.message === 'string' ? data.message : 'Falha ao remover pedido da rota';
          throw new Error(t);
        }

        setPedidosByRota((prev) => {
          const next = { ...prev };
          const list = Array.isArray(next[idRota]) ? next[idRota] : [];
          next[idRota] = list.filter((p) => p.numped !== numped);
          return next;
        });
        setMsg({ type: 'success', text: `Pedido ${numped} removido da rota ${idRota}.` });
        void fetchRotas(dataBusca);
      } catch (err) {
        const t = err instanceof Error ? err.message : 'Erro ao comunicar com o servidor.';
        setMsg({ type: 'error', text: t });
      } finally {
        setRemoveSubmittingKey(null);
      }
    },
    [dataBusca, fetchRotas]
  );

  React.useEffect(() => {
    void fetchRotas(dataBusca);
  }, [dataBusca, fetchRotas]);

  const getStr = (v: unknown): string => {
    if (v == null) return '';
    return String(v);
  };

  const getNumOrDash = (v: unknown): string => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? String(n) : '-';
  };

  const getBairros = (row: Record<string, unknown>): string => {
    const parts = [
      getStr(row.BAIRRO_ROTA_1),
      getStr(row.BAIRRO_ROTA_2),
      getStr(row.BAIRRO_ROTA_3),
      getStr(row.BAIRRO_ROTA_4),
      getStr(row.BAIRRO_ROTA_5),
    ].map(s => s.trim()).filter(s => s.length);
    return parts.length ? parts.join(' • ') : '-';
  };

  const getTurnoLabel = (t: string): string => {
    const code = (t || '').trim() || '-';
    if (code === 'M') return 'Turno: Manhã';
    if (code === 'T') return 'Turno: Tarde';
    if (code === '-') return 'Sem turno';
    return `Turno: ${code}`;
  };

  const onSubmit = async () => {
    setMsg(null);
    const codUsurNum = Number(codUsurCriacao);
    if (!descricao.trim()) {
      setMsg({ type: 'error', text: 'Informe a descrição da rota.' });
      return;
    }
    if (!Number.isFinite(codUsurNum)) {
      setMsg({ type: 'error', text: 'Informe a matrícula (numérica).' });
      return;
    }
    const bairros = [bairro1, bairro2, bairro3, bairro4, bairro5].map(b => b.trim()).filter(b => b.length);
    const payload = {
      descricaoRota: descricao.trim(),
      bairros,
      codMotorista: codMotorista.trim() ? Number(codMotorista) : null,
      codVeiculo: codVeiculo.trim() ? Number(codVeiculo) : null,
      dataRota: dataRota || null,
      codUsurCriacao: codUsurNum,
      turnoSeparacao: (turnoSeparacao || '').trim().toUpperCase(),
    };
    setSubmitting(true);
    try {
      const res = await fetch('/api/gestlog/rotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const t = typeof data?.message === 'string' ? data.message : 'Falha ao criar rota';
        setMsg({ type: 'error', text: t });
        return;
      }
      const data = await res.json();
      setMsg({ type: 'success', text: `Rota criada: ID ${data?.idRota ?? ''}`.trim() });
      setDescricao('');
      setBairro1(''); setBairro2(''); setBairro3(''); setBairro4(''); setBairro5('');
      setCodMotorista(''); setCodVeiculo('');
      setMotoristaLabel(''); setVeiculoLabel('');
      setTurnoSeparacao('');
      setDataRota('');
      if (dataRota) {
        setDataBusca(dataRota);
        void fetchRotas(dataRota);
      }
    } catch {
      setMsg({ type: 'error', text: 'Erro ao comunicar com o servidor.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="card shadow-sm" style={{ border: '1px solid rgba(0,0,0,0.175)', flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header py-1 d-flex justify-content-between align-items-center" style={{ fontSize: '0.85rem' }}>
          <strong>Rotas</strong>
          <div className="d-flex align-items-center" style={{ gap: '6px' }}>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm py-0 px-1 d-inline-flex align-items-center"
              onClick={() => setGerirVeiculosModalOpen(true)}
              title="Consultar veículos"
            >
              <Truck size={12} className="me-1" /> Gerir Veículos
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm py-0 px-1 d-inline-flex align-items-center"
              onClick={() => setGerirMotoristasModalOpen(true)}
              title="Consultar motoristas"
            >
              <Person size={12} className="me-1" /> Gerir Motoristas
            </button>
            <button
              type="button"
              className={`btn ${open ? 'btn-outline-secondary' : 'btn-success'} btn-sm py-0 px-1 d-inline-flex align-items-center`}
              onClick={() => {
                setEditOpen(false);
                setEditMsg(null);
                setOpen((v) => {
                  const next = !v;
                  if (next) {
                    setMsg(null);
                    setDataRota(dataBusca || '');
                  }
                  return next;
                });
              }}
              title={open ? 'Fechar' : 'Nova Rota'}
            >
              {open ? <X size={12} className="me-1" /> : <Plus size={12} className="me-1" />} {open ? 'Fechar' : 'Nova Rota'}
            </button>
          </div>
        </div>
        <div className="card-body" style={{ fontSize: '0.75rem', position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="d-flex align-items-end justify-content-between gap-2 mb-2">
            <div style={{ flex: 1 }}>
              <label className="form-label mb-1 d-flex align-items-center gap-1">
                <Calendar3 size={12} /> Data
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={dataBusca}
                onChange={(e) => setDataBusca(e.target.value)}
              />
            </div>
            {!!weekdayLabel && (
              <div
                className="border border-warning rounded bg-warning text-dark px-2 d-flex align-items-center justify-content-center text-nowrap"
                style={{ height: '30px', fontSize: '0.72rem' }}
                title={weekdayLabel}
              >
                <div className="d-flex align-items-center justify-content-center w-100">{weekdayLabel}</div>
              </div>
            )}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm py-0 px-1 d-inline-flex align-items-center"
              style={{ height: '30px' }}
              onClick={() => void fetchRotas(dataBusca)}
              disabled={rotasLoading || !dataBusca}
              title="Atualizar"
            >
              <ArrowClockwise size={12} className="me-1" /> Atualizar
            </button>
          </div>

          {rotasError && (
            <div className="alert alert-danger py-2" role="alert" style={{ fontSize: '0.75rem' }}>
              {rotasError}
            </div>
          )}
          {!open && msg && (
            <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'} py-2`} role="alert" style={{ fontSize: '0.75rem' }}>
              {msg.text}
            </div>
          )}
          {!editOpen && editMsg && (
            <div className={`alert ${editMsg.type === 'success' ? 'alert-success' : 'alert-danger'} py-2`} role="alert" style={{ fontSize: '0.75rem' }}>
              {editMsg.text}
            </div>
          )}

        <div className="mb-2">
          {turnos.length > 0 && (
            <ul className="nav nav-tabs mb-2">
              {turnos.map((t) => (
                <li className="nav-item" key={`turno-tab-${t}`}>
                  <button
                    type="button"
                    className={`nav-link ${activeTurno === t ? 'active' : ''}`}
                    onClick={() => setActiveTurno(t)}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    {getTurnoLabel(t)} {typeof turnoCounts.get(t) === 'number' ? `(${turnoCounts.get(t)})` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rotasLoading ? (
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Carregando rotas...</div>
          ) : rotasFiltradas.length === 0 ? (
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>Nenhuma rota encontrada para a data selecionada.</div>
          ) : (
            <div className="d-flex flex-column" style={{ gap: '8px' }}>
              {rotasFiltradas.map((r, idx) => {
                const row = (r || {}) as Record<string, unknown>;
                const idRota = getNumOrDash(row.ID_ROTA);
                const descricaoRota = getStr(row.DESCRICAO_ROTA) || '-';
                const bairrosRota = getBairros(row);
                const dataRotaStr = getStr(row.DATA_ROTA) || '-';
                const motorista = getNumOrDash(row.COD_MOTORISTA);
                const veiculo = getNumOrDash(row.COD_VEICULO);
                const motoristaNome = getStr(row.MOTORISTA_NOME).trim();
                const veiculoDescricao = getStr(row.VEICULO_DESCRICAO).trim();
                const veiculoPlaca = getStr(row.VEICULO_PLACA).trim();
                const motoristaTexto = motoristaNome || motorista;
                const veiculoTexto = veiculoDescricao
                  ? (veiculoPlaca ? `${veiculoDescricao} (${veiculoPlaca})` : veiculoDescricao)
                  : (veiculoPlaca || veiculo);
                const idRotaNum = Number(row.ID_ROTA);
                const canAdd = Number.isFinite(idRotaNum) && Number.isFinite(Number(pedido?.pedido));
                const capMax = (() => {
                  const n = Number(row.VEICULO_CAPACIDADE_CIMENTO);
                  return Number.isFinite(n) && n > 0 ? n : 150;
                })();
                const cimentoAtual = Number.isFinite(cimentoQtByRota[idRotaNum]) ? cimentoQtByRota[idRotaNum] : 0;
                const fmtCap = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
                const capTexto = `${fmtCap(cimentoAtual)}/${fmtCap(capMax)}`;

                return (
                  <div key={`rota-${getStr(row.ID_ROTA) || idx}`} className="card" style={{ border: '1px solid rgba(0,0,0,0.175)' }}>
                    <div className="card-body py-2 px-2" style={{ fontSize: '0.72rem' }}>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div style={{ minWidth: 0 }}>
                          <div className="d-flex flex-wrap align-items-center" style={{ gap: '6px' }}>
                            <span className="badge text-bg-secondary" style={{ fontSize: '0.68rem' }}>ID {idRota}</span>
                            <span className="badge text-bg-primary" style={{ fontSize: '0.68rem' }}>Capacidade Cimento: {capTexto}</span>
                            <div
                              className="border rounded px-2 py-1"
                              style={{ backgroundColor: '#fd7e14', color: '#fff', fontSize: '0.68rem', lineHeight: 1 }}
                            >
                              {formatDateBR(dataRotaStr)}
                            </div>
                          </div>
                          <div className="fw-semibold text-truncate" style={{ maxWidth: '100%', fontSize: '0.8rem' }}>
                            {descricaoRota}
                          </div>
                          <div className="mt-1 text-muted" style={{ fontSize: '0.68rem' }}>
                            Bairros rota:
                          </div>
                          <div
                            className="d-inline-block border border-warning rounded bg-warning text-dark px-2 py-1 lh-sm"
                            title={bairrosRota === '-' ? 'Sem bairros vinculados.' : bairrosRota}
                            style={{ maxWidth: '100%' }}
                          >
                            <div className="text-truncate" style={{ maxWidth: '100%' }}>
                              {bairrosRota === '-' ? 'Sem bairros vinculados.' : bairrosRota}
                            </div>
                          </div>
                          <div className="text-muted" style={{ fontSize: '0.68rem' }}>
                            Motorista: {motoristaTexto} | Veículo: {veiculoTexto}
                          </div>
                        </div>
                        <div className="d-flex flex-row align-items-center justify-content-end flex-wrap" style={{ gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm py-0 px-1 d-inline-flex align-items-center"
                            title="Excluir rota"
                            disabled={
                              !Number.isFinite(idRotaNum) ||
                              (Array.isArray(pedidosByRota[idRotaNum]) && pedidosByRota[idRotaNum].length > 0) ||
                              deleteSubmittingId === idRotaNum
                            }
                            onClick={() => {
                              if (!Number.isFinite(idRotaNum)) return;
                              const hasPedidos = Array.isArray(pedidosByRota[idRotaNum]) && pedidosByRota[idRotaNum].length > 0;
                              if (hasPedidos) return;
                              const detalhes = [
                                `ID: ${idRota}`,
                                `Descrição: ${descricaoRota || '-'}`,
                                `Data: ${formatDateBR(dataRotaStr)}`,
                                `Motorista: ${motoristaTexto || '-'}`,
                                `Veículo: ${veiculoTexto || '-'}`,
                                `Bairros: ${bairrosRota === '-' ? 'Sem bairros vinculados.' : bairrosRota}`,
                              ].join('\n');
                              setConfirmDeleteModal({
                                show: true,
                                title: 'Confirmação',
                                content: `Deseja realmente excluir a rota selecionada?\n\n${detalhes}`,
                                idRota: idRotaNum,
                              });
                            }}
                          >
                            <Trash size={12} className="me-1" /> Excluir
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm py-0 px-1 d-inline-flex align-items-center"
                            title="Editar rota"
                            disabled={!Number.isFinite(idRotaNum)}
                            onClick={() => {
                              setOpen(false);
                              setMsg(null);
                              setEditMsg(null);
                              const id = Number.isFinite(idRotaNum) ? idRotaNum : null;
                              setEditIdRota(id);
                              setEditDescricao(getStr(row.DESCRICAO_ROTA) || '');
                              setEditBairro1(getStr(row.BAIRRO_ROTA_1) || '');
                              setEditBairro2(getStr(row.BAIRRO_ROTA_2) || '');
                              setEditBairro3(getStr(row.BAIRRO_ROTA_3) || '');
                              setEditBairro4(getStr(row.BAIRRO_ROTA_4) || '');
                              setEditBairro5(getStr(row.BAIRRO_ROTA_5) || '');
                              setEditCodMotorista(getStr(row.COD_MOTORISTA) || '');
                              setEditCodVeiculo(getStr(row.COD_VEICULO) || '');
                              setEditDataRota(getStr(row.DATA_ROTA) || dataBusca || '');
                              setEditOpen(true);
                            }}
                          >
                            <PencilSquare size={12} className="me-1" /> Editar
                          </button>
                          {pedido && (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm py-0 px-1 d-inline-flex align-items-center"
                              title="Adicionar pedido a essa Rota"
                              onClick={() => {
                                if (!pedido) return;
                                const numPedido = Number(pedido.pedido);
                                if (!Number.isFinite(idRotaNum)) {
                                  setMsg({ type: 'error', text: 'ID da rota inválido.' });
                                  return;
                                }
                                if (!Number.isFinite(numPedido)) {
                                  setMsg({ type: 'error', text: 'Número do pedido inválido.' });
                                  return;
                                }
                                const qtCimentoPedido = getCimentoQtFromPedido(pedido);
                                const qtCimentoAtual = Number.isFinite(cimentoQtByRota[idRotaNum]) ? cimentoQtByRota[idRotaNum] : 0;
                                const qtCimentoNovo = qtCimentoAtual + qtCimentoPedido;
                                if (pedidoTemCimento(pedido) && qtCimentoNovo > capMax) {
                                  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
                                  const text = `Capacidade de cimento excedida (cód 64305): atual ${fmt(qtCimentoAtual)} + pedido ${fmt(qtCimentoPedido)} = ${fmt(qtCimentoNovo)} (máx ${fmt(capMax)}).`;
                                  setMsg({ type: 'error', text });
                                  setMessageModal({ show: true, title: 'Capacidade ultrapassada', content: text, isError: true });
                                  return;
                                }
                                const clienteNome = (pedido.cliente ?? '').toString().trim() || '-';
                                const rotaNome = (getStr(row.DESCRICAO_ROTA) || `Rota ${idRotaNum}`).toString().trim();
                                setCheckVinculoSubmittingId(idRotaNum);
                                fetch(`/api/gestlog/rotas/pedidos/${numPedido}/vinculo`)
                                  .then(async (res) => {
                                    const data = await res.json().catch(() => ({}));
                                    if (!res.ok) {
                                      const t = typeof data?.message === 'string' ? data.message : 'Falha ao validar vínculo do pedido';
                                      throw new Error(t);
                                    }
                                    return data as VinculoPedidoResponse;
                                  })
                                  .then((data) => {
                                    if (data?.found && data?.rota && Number.isFinite(Number(data.rota.idRota))) {
                                      const text = formatVinculoRotaText(data.rota);
                                      setMsg({ type: 'error', text: 'Pedido já está em rota.' });
                                      setMessageModal({ show: true, title: 'Pedido já está em rota', content: text, isError: true });
                                      return;
                                    }
                                    setConfirmAddModal({
                                      show: true,
                                      title: 'Confirmação',
                                      content: `Deseja realmente adicionar o pedido ${numPedido}, cliente ${clienteNome} à rota ${rotaNome}?`,
                                      idRota: idRotaNum,
                                      numPedido,
                                      clienteNome,
                                      rotaNome,
                                    });
                                  })
                                  .catch((err) => {
                                    const t = err instanceof Error ? err.message : 'Erro ao comunicar com o servidor.';
                                    setMsg({ type: 'error', text: t });
                                    setMessageModal({ show: true, title: 'Erro', content: t, isError: true });
                                  })
                                  .finally(() => {
                                    setCheckVinculoSubmittingId(null);
                                  });
                              }}
                              disabled={!canAdd || addSubmittingId === idRotaNum || checkVinculoSubmittingId === idRotaNum}
                            >
                              <PlusCircle size={12} className="me-1" /> Add Pedido
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2">
                        {(() => {
                          const list = Number.isFinite(idRotaNum) ? (pedidosByRota[idRotaNum] || []) : [];
                          if (pedidosLoading) {
                            return (
                              <>
                                <div className="text-muted" style={{ fontSize: '0.72rem' }}>Pedidos da rota:</div>
                                <div className="border rounded p-2 bg-light" style={{ fontSize: '0.72rem', overflowX: 'auto' }}>
                                  <div className="text-muted">Carregando...</div>
                                </div>
                              </>
                            );
                          }
                          if (!list.length) {
                            return <div className="text-muted" style={{ fontSize: '0.72rem' }}>Nenhum pedido adicionado para essa rota.</div>;
                          }
                          return (
                            <>
                              <div className="text-muted" style={{ fontSize: '0.72rem' }}>Pedidos da rota:</div>
                              <div className="border rounded p-2 bg-light" style={{ fontSize: '0.72rem', overflowX: 'auto' }}>
                                <div className="d-flex flex-column" style={{ gap: '6px' }}>
                                  {list.map((p) => (
                                  <div key={`rota-${idRotaNum}-pedido-${p.numped}`} className="border rounded px-2 py-1 bg-white">
                                    <div className="d-flex align-items-start justify-content-between" style={{ gap: '10px' }}>
                                      <div style={{ minWidth: 520, flex: 1 }}>
                                        <div className="d-flex align-items-center flex-wrap" style={{ gap: '6px', minWidth: 0 }}>
                                          <span className="text-nowrap" style={{ fontWeight: 600 }}>{p.numped}</span>
                                          <span className="text-nowrap">|</span>
                                          <span className="text-nowrap">Cliente:</span>
                                          <span className="text-truncate" style={{ flex: 1, minWidth: 0 }}>
                                            {Number.isFinite(p.codcli) ? `${p.codcli} - ` : ''}{p.cliente || '-'}
                                          </span>
                                        </div>
                                        <div className="mt-1 d-flex align-items-center flex-wrap" style={{ fontSize: '0.72rem', gap: '10px' }}>
                                          <span><strong>Status Aux:</strong></span>
                                          <span className="badge text-bg-primary" style={{ fontSize: '0.66rem' }}>
                                            {p.posicao ? formatPosicao(p.posicao) : (p.statusDescricao || '-')}
                                          </span>
                                          {p.corte && (<span className="badge text-bg-primary" style={{ fontSize: '0.66rem' }}>Corte</span>)}
                                          {p.separado && (<span className="badge text-bg-primary" style={{ fontSize: '0.66rem' }}>Separado</span>)}
                                          {p.coleta && (<span className="badge text-bg-primary" style={{ fontSize: '0.66rem' }}>Coleta</span>)}
                                          {p.localizacao && (<span className="badge text-bg-primary" style={{ fontSize: '0.66rem' }}>Localização</span>)}
                                          {p.fatura && (<span className="badge text-bg-primary" style={{ fontSize: '0.66rem' }}>Fatura</span>)}
                                          {p.envMessejana && (<span className="badge text-bg-primary" style={{ fontSize: '0.66rem' }}>Env. Messejana</span>)}
                                          {p.prioridade && (<span className="badge text-bg-primary" style={{ fontSize: '0.66rem' }}>Prioridade</span>)}
                                        </div>
                                        <div className="text-muted mt-1 d-flex align-items-center flex-wrap" style={{ fontSize: '0.68rem', gap: '8px' }}>
                                          <span><strong>Itens:</strong> {p.itens}</span>
                                          <span className="text-muted">|</span>
                                          <span><strong>Valor:</strong> R$ {Number.isFinite(p.valor) ? p.valor.toFixed(2).replace('.', ',') : '-'}</span>
                                          {p.separadorPedido && (
                                            <>
                                              <span className="text-muted">|</span>
                                              <span className="text-truncate" style={{ maxWidth: '260px' }}><strong>Separador:</strong> {p.separadorPedido}</span>
                                            </>
                                          )}
                                          {p.dataAdd && (
                                            <>
                                              <span className="text-muted">|</span>
                                              <span className="text-nowrap"><strong>Incluido em:</strong> {formatDateBR(p.dataAdd)}</span>
                                            </>
                                          )}
                                        </div>
                                        {p.itensDetalhe && p.itensDetalhe.length > 0 && (
                                          <div className="mt-1" style={{ fontSize: '0.68rem' }}>
                                            <div className="text-muted"><strong>Produtos:</strong></div>
                                            <div className="d-flex flex-column" style={{ gap: '2px' }}>
                                              {p.itensDetalhe.slice(0, 5).map((it, idx) => (
                                                <div key={`p-${p.numped}-it-${idx}`} className="d-flex align-items-center flex-wrap" style={{ gap: '6px' }}>
                                                  <span><strong>Cód:</strong> {Number.isFinite(it.codprod || NaN) ? it.codprod : '-'}</span>
                                                  <span className="text-muted">|</span>
                                                  <span className="text-truncate" style={{ maxWidth: '60%' }}><strong>Desc:</strong> {it.descricao || '-'}</span>
                                                  <span className="text-muted">|</span>
                                                  <span><strong>Qtd:</strong> {Number.isFinite(it.qt || NaN) ? it.qt : '-'}</span>
                                                </div>
                                              ))}
                                              {p.itens > p.itensDetalhe.length && (
                                                <div className="text-muted">… e mais {p.itens - p.itensDetalhe.length} item(ns)</div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div className="d-flex flex-column align-items-end" style={{ gap: '6px' }}>
                                        <button
                                          type="button"
                                          className="btn btn-outline-danger btn-sm py-0 px-1 d-inline-flex align-items-center"
                                          style={{ fontSize: '0.68rem' }}
                                          title="Remover pedido da rota"
                                          disabled={removeSubmittingKey === `${idRotaNum}-${p.numped}` || !Number.isFinite(idRotaNum)}
                                          onClick={() => {
                                            if (!Number.isFinite(idRotaNum)) return;
                                            const detalhes = [
                                              `Rota ID: ${idRota}`,
                                              `Pedido: ${p.numped}`,
                                              `Cliente: ${Number.isFinite(p.codcli || NaN) ? `${p.codcli} - ` : ''}${p.cliente || '-'}`,
                                              `Status: ${p.posicao ? formatPosicao(p.posicao) : (p.statusDescricao || '-')}`,
                                              `Itens: ${p.itens}`,
                                              `Valor: R$ ${Number.isFinite(p.valor) ? p.valor.toFixed(2).replace('.', ',') : '-'}`,
                                              p.dataAdd ? `Incluído em: ${formatDateBR(p.dataAdd)}` : null,
                                            ].filter(Boolean).join('\n');
                                            setConfirmRemoveModal({
                                              show: true,
                                              title: 'Confirmação',
                                              content: `Deseja realmente remover o pedido da rota?\n\n${detalhes}`,
                                              idRota: idRotaNum,
                                              numped: p.numped,
                                            });
                                          }}
                                        >
                                          <Trash size={12} className="me-1" /> Remover
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!open && (
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>Use “Nova Rota” para cadastrar uma rota.</div>
        )}

        <NovaRotaModal
          open={open}
          setOpen={setOpen}
          submitting={submitting}
          msg={msg}
          setMsg={setMsg}
          descricao={descricao}
          setDescricao={setDescricao}
          bairro1={bairro1}
          setBairro1={setBairro1}
          bairro2={bairro2}
          setBairro2={setBairro2}
          bairro3={bairro3}
          setBairro3={setBairro3}
          bairro4={bairro4}
          setBairro4={setBairro4}
          bairro5={bairro5}
          setBairro5={setBairro5}
          codMotorista={codMotorista}
          motoristaLabel={motoristaLabel}
          setMotoristaModalOpen={setMotoristaModalOpen}
          codVeiculo={codVeiculo}
          veiculoLabel={veiculoLabel}
          setVeiculoModalOpen={setVeiculoModalOpen}
          dataRota={dataRota}
          setDataRota={setDataRota}
          turnoSeparacao={turnoSeparacao}
          setTurnoSeparacao={setTurnoSeparacao}
          codUsurCriacao={codUsurCriacao}
          setCodUsurCriacao={setCodUsurCriacao}
          onSubmit={onSubmit}
        />

        {editOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 21 }}>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.12)' }} />
            <div style={{ position: 'absolute', inset: '8px', display: 'flex' }}>
              <div className="card shadow" style={{ border: '1px solid rgba(0,0,0,0.175)', width: '100%', overflow: 'hidden' }}>
                <div className="card-header py-1 d-flex justify-content-between align-items-center" style={{ fontSize: '0.85rem' }}>
                  <strong>Editar Rota</strong>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-1 d-inline-flex align-items-center"
                    onClick={() => {
                      setEditOpen(false);
                      setEditMsg(null);
                    }}
                    disabled={editSubmitting}
                    title="Fechar"
                  >
                    <X size={12} className="me-1" /> Fechar
                  </button>
                </div>

                <div className="card-body" style={{ overflowY: 'auto' }}>
                  {editMsg && (
                    <div className={`alert ${editMsg.type === 'success' ? 'alert-success' : 'alert-danger'} py-2`} role="alert" style={{ fontSize: '0.75rem' }}>
                      {editMsg.text}
                    </div>
                  )}

                  <div className="mb-2">
                    <label className="form-label mb-1">ID Rota</label>
                    <input type="text" className="form-control form-control-sm" value={editIdRota ?? ''} disabled />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Descrição da Rota</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={editDescricao}
                      onChange={e => setEditDescricao(e.target.value)}
                    />
                  </div>

                  <div className="row g-2">
                    <div className="col-12">
                      <label className="form-label mb-1">Bairros (até 5)</label>
                    </div>
                    <div className="col-12">
                      <input className="form-control form-control-sm mb-1" value={editBairro1} onChange={e => setEditBairro1(e.target.value)} placeholder="Bairro 1" />
                      <input className="form-control form-control-sm mb-1" value={editBairro2} onChange={e => setEditBairro2(e.target.value)} placeholder="Bairro 2" />
                      <input className="form-control form-control-sm mb-1" value={editBairro3} onChange={e => setEditBairro3(e.target.value)} placeholder="Bairro 3" />
                      <input className="form-control form-control-sm mb-1" value={editBairro4} onChange={e => setEditBairro4(e.target.value)} placeholder="Bairro 4" />
                      <input className="form-control form-control-sm" value={editBairro5} onChange={e => setEditBairro5(e.target.value)} placeholder="Bairro 5" />
                    </div>
                  </div>

                  <div className="row g-2 mt-2">
                    <div className="col-6">
                      <label className="form-label mb-1">Cod. Motorista</label>
                      <input type="number" className="form-control form-control-sm" value={editCodMotorista} onChange={e => setEditCodMotorista(e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label className="form-label mb-1">Cod. Veículo</label>
                      <input type="number" className="form-control form-control-sm" value={editCodVeiculo} onChange={e => setEditCodVeiculo(e.target.value)} />
                    </div>
                  </div>

                  <div className="row g-2 mt-2">
                    <div className="col-6">
                      <label className="form-label mb-1">Data da Rota</label>
                      <input type="date" className="form-control form-control-sm" value={editDataRota} onChange={e => setEditDataRota(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="card-footer py-2 d-flex justify-content-end gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-0 px-1 d-inline-flex align-items-center"
                    onClick={() => {
                      setEditOpen(false);
                      setEditMsg(null);
                    }}
                    disabled={editSubmitting}
                    title="Cancelar"
                    aria-label="Cancelar"
                  >
                    <X size={12} className="me-1" /> Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm py-0 px-1 d-inline-flex align-items-center"
                    onClick={async () => {
                      setEditMsg(null);
                      if (!editIdRota || !Number.isFinite(editIdRota)) {
                        setEditMsg({ type: 'error', text: 'ID da rota inválido.' });
                        return;
                      }
                      const bairros = [editBairro1, editBairro2, editBairro3, editBairro4, editBairro5].map(b => b.trim()).filter(b => b.length);
                      const payload = {
                        descricaoRota: editDescricao.trim(),
                        bairros,
                        codMotorista: editCodMotorista.trim() ? Number(editCodMotorista) : null,
                        codVeiculo: editCodVeiculo.trim() ? Number(editCodVeiculo) : null,
                        dataRota: editDataRota || null,
                      };
                      setEditSubmitting(true);
                      try {
                        const res = await fetch(`/api/gestlog/rotas/${editIdRota}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(payload)
                        });
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          const t = typeof data?.message === 'string' ? data.message : 'Falha ao editar rota';
                          setEditMsg({ type: 'error', text: t });
                          return;
                        }
                        setEditMsg({ type: 'success', text: 'Rota atualizada com sucesso.' });
                        await fetchRotas(dataBusca);
                        setEditOpen(false);
                      } catch {
                        setEditMsg({ type: 'error', text: 'Erro ao comunicar com o servidor.' });
                      } finally {
                        setEditSubmitting(false);
                      }
                    }}
                    disabled={editSubmitting}
                    title={editSubmitting ? 'Salvando...' : 'Salvar'}
                    aria-label="Salvar"
                  >
                    <PencilSquare size={12} className="me-1" /> {editSubmitting ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <SelecionarVeiculoModal
        show={veiculoModalOpen}
        onClose={() => setVeiculoModalOpen(false)}
        onSelect={(v) => {
          setCodVeiculo(String(v.id));
          setVeiculoLabel(String(v.descricao || '').trim());
        }}
      />
      <SelecionarVeiculoModal
        show={gerirVeiculosModalOpen}
        variant="manage"
        onClose={() => setGerirVeiculosModalOpen(false)}
      />
      <SelecionarMotoristaModal
        show={motoristaModalOpen}
        onClose={() => setMotoristaModalOpen(false)}
        onSelect={(m) => {
          setCodMotorista(String(m.id));
          setMotoristaLabel(String(m.nome || '').trim());
        }}
      />
      <SelecionarMotoristaModal
        show={gerirMotoristasModalOpen}
        variant="manage"
        onClose={() => setGerirMotoristasModalOpen(false)}
      />
      </div>

      {confirmDeleteModal.show && (
        <>
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: confirmBackdropZ }}></div>
          <div className="modal d-block" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: confirmModalZ }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header py-2 bg-secondary text-white">
                  <h5 className="modal-title" style={{ fontSize: '1rem' }}>{confirmDeleteModal.title}</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setConfirmDeleteModal(prev => ({ ...prev, show: false }))}
                  ></button>
                </div>
                <div className="modal-body text-start py-3">
                  <p className="mb-0" style={{ fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{confirmDeleteModal.content}</p>
                </div>
                <div className="modal-footer py-1 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-3"
                    onClick={() => setConfirmDeleteModal(prev => ({ ...prev, show: false }))}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm px-3"
                    onClick={async () => {
                      const idRota = confirmDeleteModal.idRota;
                      setConfirmDeleteModal(prev => ({ ...prev, show: false }));
                      if (!idRota || !Number.isFinite(idRota)) return;
                      setMsg(null);
                      setDeleteSubmittingId(idRota);
                      try {
                        const res = await fetch(`/api/gestlog/rotas/${idRota}`, { method: 'DELETE' });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          const t = typeof data?.message === 'string' ? data.message : 'Falha ao excluir rota';
                          setMsg({ type: 'error', text: t });
                          return;
                        }
                        setMsg({ type: 'success', text: `Rota ${idRota} excluída com sucesso.` });
                        await fetchRotas(dataBusca);
                      } catch {
                        setMsg({ type: 'error', text: 'Erro ao comunicar com o servidor.' });
                      } finally {
                        setDeleteSubmittingId(null);
                      }
                    }}
                    disabled={deleteSubmittingId === confirmDeleteModal.idRota}
                  >
                    Sim
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {confirmRemoveModal.show && (
        <>
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: confirmBackdropZ }}></div>
          <div className="modal d-block" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: confirmModalZ }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header py-2 bg-secondary text-white">
                  <h5 className="modal-title" style={{ fontSize: '1rem' }}>{confirmRemoveModal.title}</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setConfirmRemoveModal(prev => ({ ...prev, show: false }))}
                  ></button>
                </div>
                <div className="modal-body text-start py-3">
                  <p className="mb-0" style={{ fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{confirmRemoveModal.content}</p>
                </div>
                <div className="modal-footer py-1 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-3"
                    onClick={() => setConfirmRemoveModal(prev => ({ ...prev, show: false }))}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm px-3"
                    onClick={async () => {
                      const idRota = confirmRemoveModal.idRota;
                      const numped = confirmRemoveModal.numped;
                      setConfirmRemoveModal(prev => ({ ...prev, show: false }));
                      if (!idRota || !Number.isFinite(idRota) || !numped || !Number.isFinite(numped)) return;
                      await removerPedidoDaRota(idRota, numped);
                    }}
                    disabled={removeSubmittingKey === `${confirmRemoveModal.idRota}-${confirmRemoveModal.numped}`}
                  >
                    Sim
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {confirmAddModal.show && (
        <>
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: confirmBackdropZ }}></div>
          <div className="modal d-block" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: confirmModalZ }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header py-2 bg-secondary text-white">
                  <h5 className="modal-title" style={{ fontSize: '1rem' }}>{confirmAddModal.title}</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setConfirmAddModal(prev => ({ ...prev, show: false }))}
                  ></button>
                </div>
                <div className="modal-body text-center py-4">
                  <p className="mb-0" style={{ fontSize: '0.95rem' }}>{confirmAddModal.content}</p>
                </div>
                <div className="modal-footer py-1 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-3"
                    onClick={() => setConfirmAddModal(prev => ({ ...prev, show: false }))}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm px-3"
                    onClick={() => {
                      const idRota = confirmAddModal.idRota;
                      const numPedido = confirmAddModal.numPedido;
                      const clienteNome = confirmAddModal.clienteNome;
                      const rotaNome = confirmAddModal.rotaNome;
                      setConfirmAddModal(prev => ({ ...prev, show: false }));
                      if (!idRota || !Number.isFinite(idRota) || !numPedido || !Number.isFinite(numPedido)) return;
                      addPedidoToRota({ idRota, numPedido, clienteNome, rotaNome });
                    }}
                  >
                    Sim
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {messageModal.show && (
        <>
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: messageBackdropZ }}></div>
          <div className="modal d-block" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: messageModalZ }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className={`modal-header py-2 ${messageModal.isError ? 'bg-danger text-white' : 'bg-success text-white'}`}>
                  <h5 className="modal-title" style={{ fontSize: '1rem' }}>{messageModal.title}</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setMessageModal(prev => ({ ...prev, show: false }))}
                  ></button>
                </div>
                <div className="modal-body text-center py-4">
                  <p className="mb-0" style={{ fontSize: '0.95rem', whiteSpace: 'pre-line' }}>{messageModal.content}</p>
                </div>
                <div className="modal-footer py-1 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-3"
                    onClick={() => setMessageModal(prev => ({ ...prev, show: false }))}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
