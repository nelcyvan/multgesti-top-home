import React from 'react';
import { X } from 'react-bootstrap-icons';

export type EditarMotoristaModalMsg = { type: 'success' | 'error'; text: string } | null;

export type MotoristaEdicao = {
  id: number;
  nome: string;
  cpf: string | null;
  cnh: string | null;
  telefone: string | null;
};

export interface EditarMotoristaModalProps {
  show: boolean;
  onClose: () => void;
  motorista: MotoristaEdicao | null;
  onSaved?: (m: MotoristaEdicao) => void;
}

const EditarMotoristaModal: React.FC<EditarMotoristaModalProps> = ({ show, onClose, motorista, onSaved }) => {
  const [nome, setNome] = React.useState('');
  const [cpf, setCpf] = React.useState('');
  const [cnh, setCnh] = React.useState('');
  const [telefone, setTelefone] = React.useState('');
  const [msg, setMsg] = React.useState<EditarMotoristaModalMsg>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!show) return;
    setMsg(null);
    setNome(String(motorista?.nome ?? ''));
    setCpf(String(motorista?.cpf ?? ''));
    setCnh(String(motorista?.cnh ?? ''));
    setTelefone(String(motorista?.telefone ?? ''));
  }, [show, motorista]);

  const onSubmit = async () => {
    setMsg(null);

    const id = Number(motorista?.id);
    if (!Number.isFinite(id)) {
      setMsg({ type: 'error', text: 'ID do motorista inválido.' });
      return;
    }

    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setMsg({ type: 'error', text: 'Informe o nome do motorista.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/gestlog/motoristas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomeTrim,
          cpf: cpf.trim() || null,
          cnh: cnh.trim() || null,
          telefone: telefone.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const t = typeof data?.message === 'string' ? data.message : 'Falha ao editar motorista';
        setMsg({ type: 'error', text: t });
        return;
      }

      const updated: MotoristaEdicao = {
        id,
        nome: nomeTrim,
        cpf: cpf.trim() || null,
        cnh: cnh.trim() || null,
        telefone: telefone.trim() || null,
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
              <h5 className="modal-title" style={{ fontSize: '0.95rem' }}>Editar Motorista</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} disabled={submitting} />
            </div>
            <div className="modal-body" style={{ fontSize: '0.8rem' }}>
              {msg && (
                <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'} py-2`} role="alert" style={{ fontSize: '0.8rem' }}>
                  {msg.text}
                </div>
              )}

              <div className="mb-2">
                <label className="form-label mb-1">Nome</label>
                <input className="form-control form-control-sm" value={nome} onChange={e => setNome(e.target.value)} disabled={submitting} />
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label mb-1">CPF</label>
                  <input className="form-control form-control-sm" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="Opcional" disabled={submitting} />
                </div>
                <div className="col-6">
                  <label className="form-label mb-1">CNH</label>
                  <input className="form-control form-control-sm" value={cnh} onChange={e => setCnh(e.target.value)} placeholder="Opcional" disabled={submitting} />
                </div>
              </div>
              <div className="mt-2">
                <label className="form-label mb-1">Telefone</label>
                <input className="form-control form-control-sm" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Opcional" disabled={submitting} />
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

export default EditarMotoristaModal;

