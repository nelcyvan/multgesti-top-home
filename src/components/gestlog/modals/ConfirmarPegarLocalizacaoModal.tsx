import React from 'react';
import { atualizarStatusEspecial } from '../../../services/gestlog/MarcarVisualizacao';
import { listarSeparadores, definirSeparador, type Separador } from '../../../services/gestlog/Separadores';
import type { PedidoDetalhe } from './VisualizarPedidoModal';

interface ConfirmarPegarLocalizacaoModalProps {
  show: boolean;
  onClose: () => void;
  pedido: PedidoDetalhe;
  onStatusUpdated?: () => void;
  zIndex?: number;
}

const ConfirmarPegarLocalizacaoModal: React.FC<ConfirmarPegarLocalizacaoModalProps> = ({ show, onClose, pedido, onStatusUpdated, zIndex }) => {
  const [habilitarSeparacao, setHabilitarSeparacao] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [separadores, setSeparadores] = React.useState<Separador[]>([]);
  const [separadorSelecionado, setSeparadorSelecionado] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (show) {
      setHabilitarSeparacao(false);
      setSeparadorSelecionado(null);
      listarSeparadores().then(r => setSeparadores(r.rows || [])).catch(() => setSeparadores([]));
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
              <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Confirmar</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.8rem' }}>
              <div><strong>Pedido:</strong> {pedido.pedido}</div>
              <div><strong>Cliente:</strong> {pedido.cliente}</div>
              <div className="mt-2">
                {habilitarSeparacao ? 'Confirmar envio para separação?' : 'Deseja alterar o status para Pegar Localização?'}
              </div>
              <div className="mt-2 form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="switch-habilitar-separacao"
                  checked={habilitarSeparacao}
                  onChange={(e) => setHabilitarSeparacao(!!e.target.checked)}
                />
                <label className="form-check-label" htmlFor="switch-habilitar-separacao">
                  {habilitarSeparacao ? 'Pegar Localização e Separar' : 'Separar'}
                </label>
              </div>

              {habilitarSeparacao && (
                <div className="mt-3 p-2 bg-light border rounded">
                   <div className="mb-2"><strong>Enviar para separação:</strong></div>
                   <label htmlFor="select-separador-localizacao" className="form-label" style={{ fontSize: '0.8rem' }}>Selecione o separador</label>
                    <select
                      id="select-separador-localizacao"
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
              )}
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
                disabled={habilitarSeparacao && !Number.isFinite(separadorSelecionado)}
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
                    if (habilitarSeparacao) {
                        // Lógica de Separação
                        if (!Number.isFinite(separadorSelecionado as number)) return;
                        await definirSeparador({ numped: Number(pedido.pedido), codigoSeparador: Number(separadorSelecionado) });
                        await atualizarStatusEspecial({
                          numped: Number(pedido.pedido),
                          status: 2, // Separando
                          usuario: usuarioInfo.nome,
                          codFuncEmissaoMapa: usuarioInfo.codigo ?? undefined,
                          novaLocalizacao: 'Separando',
                          novoUsuario: usuarioInfo.nome
                        });
                    } else {
                        // Lógica de Pegar Localização (Status 14)
                        await atualizarStatusEspecial({ 
                          numped: Number(pedido.pedido), 
                          status: 14, 
                          usuario: usuarioInfo.nome,
                          novaLocalizacao: 'Pegar Localização',
                          novoUsuario: usuarioInfo.nome
                        });
                    }
                    
                    // Fecha o modal primeiro para resposta visual imediata
                    onClose();
                    
                    // Aguarda um breve momento para garantir que o modal fechou antes de disparar o refresh pesado
                    setTimeout(() => {
                      onStatusUpdated?.();
                    }, 50);

                  } catch (error) {
                    console.error('Erro ao confirmar:', error);
                    // Opcional: Mostrar erro para o usuário
                  } finally {
                    // Só desativa o loading se o modal ainda estiver "aberto" (show=true logicamente), 
                    // mas aqui o onClose já foi chamado. 
                    // Como o componente não desmonta (só retorna null), é seguro, 
                    // mas para evitar flash se o usuário reabrir rápido, garantimos false.
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

export default ConfirmarPegarLocalizacaoModal;
