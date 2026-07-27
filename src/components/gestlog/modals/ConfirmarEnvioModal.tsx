import React from 'react';
import { listarSeparadores, definirSeparador, type Separador } from '../../../services/gestlog/Separadores';
import { atualizarStatusEspecial } from '../../../services/gestlog/MarcarVisualizacao';
import type { PedidoDetalhe } from './VisualizarPedidoModal';

interface ConfirmarEnvioModalProps {
  show: boolean;
  onClose: () => void;
  pedido: PedidoDetalhe;
  onStatusUpdated?: () => void;
  zIndex?: number;
  targetStatus?: number;
}

const ConfirmarEnvioModal: React.FC<ConfirmarEnvioModalProps> = ({ show, onClose, pedido, onStatusUpdated, zIndex, targetStatus }) => {
  const [separadores, setSeparadores] = React.useState<Separador[]>([]);
  const [separadorSelecionado, setSeparadorSelecionado] = React.useState<number | null>(null);
  const [pegarLocalizacao, setPegarLocalizacao] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (show) {
      listarSeparadores().then(r => setSeparadores(r.rows || [])).catch(() => setSeparadores([]));
      setSeparadorSelecionado(null);
      setPegarLocalizacao(false);
    }
  }, [show]);

  if (!show) return null;

  const modalZIndex = zIndex ?? 1130;
  const backdropZIndex = modalZIndex - 10;

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: backdropZIndex }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: modalZIndex }}>
        <div className="modal-dialog">
          <div className="modal-content">
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
            <div className="modal-header py-1">
              <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Confirmar envio</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.8rem' }}>
              <div><strong>Pedido:</strong> {pedido.pedido}</div>
              <div><strong>Cliente:</strong> {pedido.cliente}</div>
              <div><strong>Bairro:</strong> {pedido.bairroEnt ?? '-'}</div>
              <div><strong>Itens:</strong> {pedido.items.length}</div>
              <div className="mt-2">Deseja enviar para a separação?</div>
              <div className="mt-2">
                <label htmlFor="select-separador" className="form-label" style={{ fontSize: '0.8rem' }}>Selecione o separador</label>
                
                <select
                  id="select-separador"
                  className="form-select form-select-sm"
                  value={separadorSelecionado ?? ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSeparadorSelecionado(Number.isFinite(v) ? v : null);
                  }}
                >
                  <option value="">Selecione...</option>
                  {separadores.map((s) => (
                    <option key={s.MATRICULA} value={s.MATRICULA}>{s.NOME} ({s.MATRICULA})</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="switch-pegar-localizacao"
                  checked={pegarLocalizacao}
                  onChange={(e) => setPegarLocalizacao(!!e.target.checked)}
                />
                <label className="form-check-label" htmlFor="switch-pegar-localizacao">
                  {pegarLocalizacao ? 'Pegar Localização' : 'Não pegar Localização'}
                </label>
              </div>
            </div>
            <div className="modal-footer py-1">
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2"
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                onClick={onClose}
              >
                Não
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2 ms-2"
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                disabled={!Number.isFinite(separadorSelecionado as number)}
                onClick={async () => {
                  const usuarioInfo = (() => {
                    try {
                      const raw = localStorage.getItem('usuarioLogado');
                      if (!raw) return { nome: 'APP', codigo: null as number | null };
                      const obj = JSON.parse(raw);
                      const nome = (obj?.usuario ?? '').toString().trim() || 'APP';
                      const codeStr = String(
                        obj?.codusur ??
                        obj?.CODUSUR ??
                        obj?.matricula ??
                        obj?.MATRICULA ??
                        ''
                      ).trim();
                      const n = Number(codeStr);
                      const codigo = Number.isFinite(n) ? n : null;
                      return { nome, codigo };
                    } catch {
                      return { nome: 'APP', codigo: null as number | null };
                    }
                  })();
                  setLoading(true);
                  try {
                    if (!Number.isFinite(separadorSelecionado as number)) return;
                    await definirSeparador({ numped: Number(pedido.pedido), codigoSeparador: Number(separadorSelecionado) });
                    await atualizarStatusEspecial({
                      numped: Number(pedido.pedido),
                      status: targetStatus ?? 2,
                      usuario: usuarioInfo.nome,
                      codFuncEmissaoMapa: usuarioInfo.codigo ?? undefined
                    });
                    onStatusUpdated?.();
                    onClose();
                  } catch (error) {
                    console.error('Erro ao confirmar envio:', error);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmarEnvioModal;
