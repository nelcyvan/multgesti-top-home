import React from 'react';
import type { PedidoDetalhe, PedidoResumo } from '../VisualizarPedido';

interface MapaExpedicaoModalProps {
  show: boolean;
  onClose: () => void;
  pedido: PedidoDetalhe;
  outrosPedidos?: PedidoResumo[];
  printAt: Date | null;
  printUser: string;
}

const MapaExpedicaoModal: React.FC<MapaExpedicaoModalProps> = ({
  show,
  onClose,
  pedido,
  outrosPedidos = [],
  printAt,
  printUser,
}) => {
  if (!show) return null;

  // Helpers
  const formatDateBR = (d: string | Date) => {
    try {
      const date = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(date.getTime())) return String(d);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return String(d);
    }
  };

  const formatCurrencyBRL = (v?: number) => {
    if (v == null) return '-';
    try {
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch {
      return String(v);
    }
  };

  const formatDateTimeBR = (d: Date) => {
    try {
      return d.toLocaleString('pt-BR');
    } catch {
      return String(d);
    }
  };

  const SCALE = 1_000_000n;
  const toScaled = (val?: number | string): bigint | null => {
    if (val == null) return null;
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) return null;
      const s = val.toFixed(6);
      const [iRaw, fRaw = ''] = s.split('.');
      const iClean = iRaw.replace(/[^\d-]/g, '') || '0';
      let f = fRaw.replace(/[^\d]/g, '');
      if (f.length > 6) f = f.slice(0, 6);
      while (f.length < 6) f += '0';
      try {
        const iBig = BigInt(iClean);
        const fBig = BigInt(f);
        const scaled = iBig * SCALE + (iBig < 0n ? -fBig : fBig);
        return scaled;
      } catch {
        return null;
      }
    } else {
      let s = String(val).trim();
      if (!s) return null;
      s = s.replace(',', '.');
      let sign: 1n | -1n = 1n;
      if (s.startsWith('-')) sign = -1n;
      s = s.replace(/^[+-]/, '');
      s = s.replace(/[^0-9.]/g, '');
      if (!s) return null;
      const [iRaw, fRaw = ''] = s.split('.');
      const iClean = iRaw || '0';
      let f = fRaw;
      if (f.length > 6) f = f.slice(0, 6);
      while (f.length < 6) f += '0';
      try {
        const iBig = BigInt(iClean);
        const fBig = BigInt(f);
        let scaled = iBig * SCALE + fBig;
        if (sign < 0n) scaled = -scaled;
        return scaled;
      } catch {
        return null;
      }
    }
  };

  const fromScaledToString = (scaled: bigint): string => {
    const neg = scaled < 0n;
    const abs = neg ? -scaled : scaled;
    const intPart = abs / SCALE;
    let fracPart = (abs % SCALE).toString().padStart(6, '0');
    fracPart = fracPart.replace(/0+$/, '');
    const base = fracPart.length ? `${intPart.toString()}.${fracPart}` : intPart.toString();
    return neg ? `-${base}` : base;
  };

  const formatQuantidade = (quantidade?: number | string): string => {
    const qScaled = toScaled(quantidade);
    if (qScaled == null) return '-';
    return fromScaledToString(qScaled);
  };

  const renderEnderecoEntrega = () => {
    const locStr = pedido.log3 || '';
    // "Nenhuma localização cadastrada." é o fallback visual quando log3 é vazio, 
    // mas o usuário pode ter salvo a string "Entregar no Endereço de Cadastro".
    // Verificamos se está vazio ou se contém a frase específica.
    const shouldUseCadastro = !locStr || locStr.includes('Nenhuma localização cadastrada') || locStr === 'Entregar no Endereço de Cadastro';

    if (shouldUseCadastro) {
      return (
        <div className="mt-1 ps-2">
          <div><strong>Endereço:</strong> {(pedido.enderEnt || '').trim() || '-'}</div>
          <div><strong>Número:</strong> {(pedido.numeroEnt || '').trim() || '-'}</div>
          <div><strong>Bairro:</strong> {(pedido.bairroEnt || '').trim() || '-'}</div>
          <div><strong>Município:</strong> {(pedido.municEnt || '').trim() || '-'}</div>
        </div>
      );
    }

    let display = locStr;
    try {
      if (locStr.startsWith('{')) {
        const parsed = JSON.parse(locStr);
        const address = parsed.address || '';
        const num = parsed.number ? `, ${parsed.number}` : '';
        const comp = parsed.complement ? ` - ${parsed.complement}` : '';
        display = `${address}${num}${comp}`;
      }
    } catch {}

    return <div className="mt-1 ps-2">{display}</div>;
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: 80mm 297mm; margin: 0; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; }
          #print-area table { width: 100%; border-collapse: collapse; }
          #print-area th, #print-area td { padding: 3px; font-size: 13px; }
          #print-area .modal-header, #print-area .modal-footer, #print-area .screen-only { display: none !important; }
          #print-text { display: none !important; }
          #print-structured { display: block !important; font-size: 13px; line-height: 1.35; padding: 2mm 0 2mm 2mm; }
          /* Forçar hr preto na impressão */
          #print-area hr, #print-structured hr { border: 0 !important; border-top: 1px solid #000 !important; color: #000 !important; opacity: 1 !important; margin: 4px 0 !important; }
          /* Ajuste de cores no print */
          #print-area *, #print-structured * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          img, svg { display: none !important; }
          #print-structured img.print-qr { display: block !important; }
        }
      `}</style>
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 1140, backdropFilter: 'blur(5px)' }}>
        <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1145 }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content" id="print-area">
              <div className="modal-header py-1">
                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Mapa de Expedição</h5>
                <button type="button" className="btn-close" onClick={onClose}></button>
              </div>
              <div className="modal-body" style={{ fontSize: '0.8rem' }}>
                <div className="screen-only">
                  <div className="mb-2" style={{ fontSize: '0.74rem' }}>
                    <div><strong>TV8</strong> {pedido.pedido}</div>
                    <div><strong>Código:</strong> {pedido.codCli ?? '-'}</div>
                    <div><strong>Cliente:</strong> {pedido.cliente ?? '-'}</div>
                    <div><strong>Vendedor(a):</strong> {pedido.vendedor ?? '-'}</div>
                    <div><strong>Filial Retira:</strong> {pedido.codFilialRetira ?? '-'}</div>
                    <div><strong>Filial:</strong> {pedido.codFilial}</div>
                    <div><strong>Entrega/Retira:</strong> {pedido.tipoEntrega}</div>
                    <div><strong>Data:</strong> {pedido.data ? formatDateBR(pedido.data) : '-'}</div>
                    <div><strong>Cobrança:</strong> {pedido.cobranca ?? '-'}</div>
                    <div><strong>Frete:</strong> {formatCurrencyBRL(pedido.vlFrete)}</div>
                    <div><strong>Dias úteis após a compra:</strong> {pedido.ageDays ?? '-'}</div>
                    {(pedido.obs || pedido.obs1 || pedido.obs2) && (
                      <>
                        <hr className="my-1" />
                        <div className="mt-1">
                          <strong>Observações:</strong>
                          <div className="mt-1 ps-2" style={{ borderLeft: '2px solid #000' }}>
                            {pedido.obs && <div className="mb-1"><strong>OBS:</strong> {pedido.obs}</div>}
                            {pedido.obs1 && <div className="mb-1">{pedido.obs1}</div>}
                            {pedido.obs2 && <div>{pedido.obs2}</div>}
                          </div>
                        </div>
                      </>
                    )}
                    <hr className="my-1" />
                    <div className="mt-1">
                      <strong>Localização de Entrega:</strong>
                      {renderEnderecoEntrega()}
                      {(pedido.obsEntrega1 || pedido.obsEntrega2 || pedido.obsEntrega3) && (
                        <>
                          <hr className="my-1" />
                          <div className="mt-1">
                            <strong>Observações de Entrega:</strong>
                            <div className="mt-1 ps-2" style={{ borderLeft: '2px solid #000' }}>
                              {pedido.obsEntrega1 && <div className="mb-1"><strong>Obs 1:</strong> {pedido.obsEntrega1}</div>}
                              {pedido.obsEntrega2 && <div className="mb-1"><strong>Obs 2:</strong> {pedido.obsEntrega2}</div>}
                              {pedido.obsEntrega3 && <div><strong>Obs 3:</strong> {pedido.obsEntrega3}</div>}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {outrosPedidos && outrosPedidos.length > 0 && (
                      <>
                        <hr className="my-1" />
                        <div className="mt-1">
                          <strong>Outros pedidos em aberto:</strong>
                          <div className="mt-1 ps-2" style={{ borderLeft: '2px solid #000' }}>
                            {outrosPedidos.map((op) => (
                              <div key={op.pedido}>
                                {op.pedido} - {op.normalizedDate ? formatDateBR(op.normalizedDate) : '-'}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mb-2" style={{ fontSize: '0.74rem' }}>
                    <h6 className="mb-1" style={{ fontSize: '0.9rem' }}>Itens ({pedido.items.length})</h6>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '15%' }}>Cod. Produto</th>
                            <th style={{ width: '35%' }}>Produto</th>
                            <th style={{ width: '20%' }}>Código de Barras</th>
                            <th style={{ width: '10%' }}>Múltiplo</th>
                            <th style={{ width: '10%' }}>Produto</th>
                            <th style={{ width: '10%' }}>Quantidade Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pedido.items.map((it, idx) => (
                            <tr key={`print-item-${idx}`}>
                              <td>{it.codProd ?? '-'}</td>
                              <td>{it.descricao}</td>
                              <td>{it.codigoDeBarras ?? '-'}</td>
                              <td>{it.multiplo ?? '-'}</td>
                              <td>{formatQuantidade(it.quantidade)}</td>
                              <td>{it.qtTotal ?? '-'}</td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={6}>
                              <hr style={{ borderTop: '1px solid #000', margin: '4px 0' }} />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.74rem' }}>
                    <div><strong>Data e hora:</strong> {printAt ? formatDateTimeBR(printAt) : '-'}</div>
                    <div><strong>Usuário impressão:</strong> {printUser}</div>
                  </div>
                </div>
                <div id="print-structured" className="d-none">
                  <div>
                    <div className="mb-2" style={{ fontWeight: 600 }}>Mapa de Expedição</div>
                    <div className="mb-2">
                      <div className="mb-1" style={{ backgroundColor: '#000', color: '#fff', padding: '2px 4px', fontWeight: 'bold' }}>Dados do Pedido:</div>
                      <div className="mt-1 ps-2">
                        <div><strong>TV8</strong> {pedido.pedido}</div>
                        <div><strong>Código:</strong> {pedido.codCli ?? '-'}</div>
                        <div><strong>Cliente:</strong> {pedido.cliente ?? '-'}</div>
                        <div><strong>Vendedor(a):</strong> {pedido.vendedor ?? '-'}</div>
                        <div><strong>Filial Retira:</strong> {pedido.codFilialRetira ?? '-'}</div>
                        <div><strong>Filial:</strong> {pedido.codFilial}</div>
                        <div><strong>Entrega/Retira:</strong> {pedido.tipoEntrega}</div>
                        <div><strong>Data:</strong> {pedido.data ? formatDateBR(pedido.data) : '-'}</div>
                        <div><strong>Cobrança:</strong> {pedido.cobranca ?? '-'}</div>
                        <div><strong>Frete:</strong> {formatCurrencyBRL(pedido.vlFrete)}</div>
                        <div><strong>Dias úteis após a compra:</strong> {pedido.ageDays ?? '-'}</div>
                      </div>
                      {(pedido.obs || pedido.obs1 || pedido.obs2) && (
                        <>
                          <hr style={{ borderTop: '1px solid #000', margin: '4px 0' }} />
                          <div className="mt-2">
                            <div style={{ backgroundColor: '#000', color: '#fff', padding: '2px 4px', fontWeight: 'bold', marginBottom: '4px' }}>Observações</div>
                            <div>
                              {pedido.obs && <div><strong>OBS:</strong> {pedido.obs}</div>}
                              {pedido.obs1 && <div>{pedido.obs1}</div>}
                              {pedido.obs2 && <div>{pedido.obs2}</div>}
                            </div>
                          </div>
                        </>
                      )}
                      <hr style={{ borderTop: '1px solid #000', margin: '4px 0' }} />
                      <div className="mt-1">
                      <div style={{ backgroundColor: '#000', color: '#fff', padding: '2px 4px', fontWeight: 'bold' }}>Localização de Entrega:</div>
                      {renderEnderecoEntrega()}
                      {(pedido.obsEntrega1 || pedido.obsEntrega2 || pedido.obsEntrega3) && (
                        <>
                          <hr style={{ borderTop: '1px solid #000', margin: '4px 0' }} />
                          <div className="mt-1">
                            <div style={{ backgroundColor: '#000', color: '#fff', padding: '2px 4px', fontWeight: 'bold' }}>Observações de Entrega:</div>
                            <div className="mt-1 ps-2">
                              {pedido.obsEntrega1 && <div><strong>Obs 1:</strong> {pedido.obsEntrega1}</div>}
                              {pedido.obsEntrega2 && <div><strong>Obs 2:</strong> {pedido.obsEntrega2}</div>}
                              {pedido.obsEntrega3 && <div><strong>Obs 3:</strong> {pedido.obsEntrega3}</div>}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                      {outrosPedidos && outrosPedidos.length > 0 && (
                        <>
                          <hr style={{ borderTop: '1px solid #000', margin: '4px 0' }} />
                          <div className="mt-1">
                            <div style={{ backgroundColor: '#000', color: '#fff', padding: '2px 4px', fontWeight: 'bold' }}>Outros pedidos em aberto:</div>
                            <div className="mt-1 ps-2">
                            {outrosPedidos.map((op) => (
                                <div key={op.pedido}>
                                  {op.pedido} - {op.normalizedDate ? formatDateBR(op.normalizedDate) : '-'}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <hr />
                    <div className="mb-2">
                      {pedido.items.map((it, idx) => {
                        const qScaled = toScaled(it.quantidade);
                        const qStr = qScaled == null ? '-' : fromScaledToString(qScaled);
                        return (
                          <div key={`print-structured-item-${idx}`} className="mt-2">
                            <div style={{ fontWeight: 600, marginBottom: '2px' }}>Item {idx + 1}</div>
                            <div style={{ paddingLeft: '5px' }}>
                              <div><strong>Cod. Produto:</strong> {it.codProd ?? '-'}</div>
                              <div><strong>Cód. Barras:</strong> {it.codigoDeBarras ?? '-'}</div>
                              <div><strong>Desc:</strong> {it.descricao}</div>
                              <div style={{ display: 'flex', gap: '15px' }}>
                                <div><strong>Múltiplo:</strong> {it.multiplo ?? '-'}</div>
                                <div><strong>Qtd:</strong> {qStr}</div>
                              </div>
                              <div><strong>Qtd Total:</strong> {it.qtTotal ?? '-'}</div>
                            </div>
                            {idx < pedido.items.length - 1 && <hr style={{ borderTop: '1px solid #000', margin: '4px 0' }} />}
                          </div>
                        );
                      })}
                    </div>
                    <hr />
                    <div>
                      <div className="mt-2">
                        <div style={{ backgroundColor: '#000', color: '#fff', padding: '2px 4px', fontWeight: 'bold' }}>
                          Data e hora: {printAt ? formatDateTimeBR(printAt) : '-'}
                        </div>
                        <div style={{ backgroundColor: '#000', color: '#fff', padding: '2px 4px', fontWeight: 'bold', marginTop: '2px' }}>
                          Usuário impressão: {printUser}
                        </div>
                      </div>
                      <br />
                      <br />
                      <br />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 700 }}>{pedido.pedido}</div>
                        <img
                          className="print-qr"
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(String(pedido.pedido))}`}
                          alt={`QR ${pedido.pedido}`}
                          style={{ width: '140px', height: '140px' }}
                        />
                      </div>
                      <div><strong>GestLOG</strong></div>
                      <div style={{ textAlign: 'center' }}><strong>*** Sem valor Fiscal ***</strong></div>
                      <br />
                      <br />
                      <br />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer py-1">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm py-1 px-2"
                  style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                  onClick={onClose}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm py-1 px-2 ms-2"
                  style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                  onClick={() => window.print()}
                >
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MapaExpedicaoModal;
