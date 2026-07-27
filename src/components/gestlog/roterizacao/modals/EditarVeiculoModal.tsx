import React from 'react';
import { X } from 'react-bootstrap-icons';

export type EditarVeiculoModalMsg = { type: 'success' | 'error'; text: string } | null;

export type VeiculoEdicao = {
  id: number;
  descricaoVeiculo: string;
  placaVeiculo: string | null;
  capacidadeCimento: number;
};

export interface EditarVeiculoModalProps {
  show: boolean;
  onClose: () => void;
  veiculo: VeiculoEdicao | null;
  onSaved?: (v: VeiculoEdicao) => void;
}

const EditarVeiculoModal: React.FC<EditarVeiculoModalProps> = ({ show, onClose, veiculo, onSaved }) => {
  const [descricao, setDescricao] = React.useState('');
  const [placa, setPlaca] = React.useState('');
  const [capacidadeCimento, setCapacidadeCimento] = React.useState<string>('0');
  const [msg, setMsg] = React.useState<EditarVeiculoModalMsg>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!show) return;
    setMsg(null);
    setDescricao(String(veiculo?.descricaoVeiculo ?? ''));
    setPlaca(String(veiculo?.placaVeiculo ?? ''));
    setCapacidadeCimento(String(typeof veiculo?.capacidadeCimento === 'number' ? veiculo.capacidadeCimento : 0));
  }, [show, veiculo]);

  const onSubmit = async () => {
    setMsg(null);

    const id = Number(veiculo?.id);
    if (!Number.isFinite(id)) {
      setMsg({ type: 'error', text: 'ID do veículo inválido.' });
      return;
    }

    const descricaoTrim = descricao.trim();
    if (!descricaoTrim) {
      setMsg({ type: 'error', text: 'Informe a descrição do veículo.' });
      return;
    }

    const capNum = Number(capacidadeCimento);
    if (!Number.isFinite(capNum) || capNum < 0) {
      setMsg({ type: 'error', text: 'Capacidade de cimento inválida.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/gestlog/veiculos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricaoVeiculo: descricaoTrim,
          placaVeiculo: placa.trim() || null,
          capacidadeCimento: capNum,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const t = typeof data?.message === 'string' ? data.message : 'Falha ao editar veículo';
        setMsg({ type: 'error', text: t });
        return;
      }

      const updated: VeiculoEdicao = {
        id,
        descricaoVeiculo: descricaoTrim,
        placaVeiculo: placa.trim() || null,
        capacidadeCimento: capNum,
      };

      onSaved?.(updated);
      onClose();
    } catch {
      setMsg({ type: 'error', text: 'Erro ao comunicar com o servidor.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 3100 }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 3110 }}>
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: '0.95rem' }}>Editar Veículo</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} disabled={submitting} />
            </div>
            <div className="modal-body" style={{ fontSize: '0.8rem' }}>
              {msg && (
                <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'} py-2`} role="alert" style={{ fontSize: '0.8rem' }}>
                  {msg.text}
                </div>
              )}

              <div className="mb-2">
                <label className="form-label mb-1">Descrição do Veículo</label>
                <input
                  className="form-control form-control-sm"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="mb-2">
                <label className="form-label mb-1">Placa</label>
                <input
                  className="form-control form-control-sm"
                  value={placa}
                  onChange={e => setPlaca(e.target.value)}
                  placeholder="Opcional"
                  disabled={submitting}
                />
              </div>
              <div className="mb-2">
                <label className="form-label mb-1">Capacidade de Cimento</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={capacidadeCimento}
                  onChange={e => setCapacidadeCimento(e.target.value)}
                  min={0}
                  step={1}
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="modal-footer py-2">
              <button type="button" className="btn btn-secondary btn-sm d-inline-flex align-items-center px-3" onClick={onClose} disabled={submitting}>
                <X size={12} className="me-1" /> Fechar
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={onSubmit} disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditarVeiculoModal;
