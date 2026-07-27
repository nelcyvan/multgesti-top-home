import React from 'react';
import { Plus, X } from 'react-bootstrap-icons';

export type NovaRotaModalMsg = { type: 'success' | 'error'; text: string } | null;

export interface NovaRotaCompactModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  submitting: boolean;
  msg: NovaRotaModalMsg;
  setMsg: React.Dispatch<React.SetStateAction<NovaRotaModalMsg>>;

  descricao: string;
  setDescricao: React.Dispatch<React.SetStateAction<string>>;

  bairro1: string;
  setBairro1: React.Dispatch<React.SetStateAction<string>>;
  bairro2: string;
  setBairro2: React.Dispatch<React.SetStateAction<string>>;
  bairro3: string;
  setBairro3: React.Dispatch<React.SetStateAction<string>>;
  bairro4: string;
  setBairro4: React.Dispatch<React.SetStateAction<string>>;
  bairro5: string;
  setBairro5: React.Dispatch<React.SetStateAction<string>>;

  codMotorista: string;
  motoristaLabel: string;
  setMotoristaModalOpen: React.Dispatch<React.SetStateAction<boolean>>;

  codVeiculo: string;
  veiculoLabel: string;
  setVeiculoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;

  dataRota: string;
  setDataRota: React.Dispatch<React.SetStateAction<string>>;

  turnoSeparacao: string;
  setTurnoSeparacao: React.Dispatch<React.SetStateAction<string>>;

  codUsurCriacao: string;
  setCodUsurCriacao: React.Dispatch<React.SetStateAction<string>>;

  onSubmit: () => void;
}

const NovaRotaCompactModal: React.FC<NovaRotaCompactModalProps> = ({
  open,
  setOpen,
  submitting,
  msg,
  setMsg,
  descricao,
  setDescricao,
  bairro1,
  setBairro1,
  bairro2,
  setBairro2,
  bairro3,
  setBairro3,
  bairro4,
  setBairro4,
  bairro5,
  setBairro5,
  codMotorista,
  motoristaLabel,
  setMotoristaModalOpen,
  codVeiculo,
  veiculoLabel,
  setVeiculoModalOpen,
  dataRota,
  setDataRota,
  turnoSeparacao,
  setTurnoSeparacao,
  codUsurCriacao,
  setCodUsurCriacao,
  onSubmit,
}) => {
  React.useEffect(() => {
    if (!open && msg) {
      setMsg(null);
    }
  }, [open, msg, setMsg]);

  React.useEffect(() => {
    if (!open) return;
    if (codUsurCriacao.trim()) return;
    try {
      const raw = localStorage.getItem('usuarioLogado') || '';
      if (!raw) return;
      const u = JSON.parse(raw);
      const codeStr = String(u?.codusur ?? u?.CODUSUR ?? u?.matricula ?? u?.MATRICULA ?? '').trim();
      const code = Number(codeStr);
      if (Number.isFinite(code)) {
        setCodUsurCriacao(String(code));
      }
    } catch {
      void 0;
    }
  }, [open, codUsurCriacao, setCodUsurCriacao]);

  const weekdayLabel = React.useMemo(() => {
    const raw = (dataRota || '').trim();
    if (!raw) return '';
    const parts = raw.split('-').map(p => p.trim());
    if (parts.length !== 3) return '';
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
    const dt = new Date(y, m - 1, d);
    if (!Number.isFinite(dt.getTime())) return '';
    const wd = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
    return wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : '';
  }, [dataRota]);

  const handleCreate = async () => {
    if (submitting) return;
    setMsg(null);

    const desc = (descricao || '').trim();
    if (!desc) {
      setMsg({ type: 'error', text: 'Informe a descrição da rota.' });
      return;
    }

    const codMotoristaRaw = codMotorista.trim();
    if (!codMotoristaRaw) {
      setMsg({ type: 'error', text: 'Informe o código do motorista.' });
      return;
    }
    const codVeiculoRaw = codVeiculo.trim();
    if (!codVeiculoRaw) {
      setMsg({ type: 'error', text: 'Informe o código do veículo.' });
      return;
    }

    const data = (dataRota || '').trim();
    if (!data) {
      setMsg({ type: 'error', text: 'Informe a data da rota.' });
      return;
    }

    const turno = (turnoSeparacao || '').trim().toUpperCase();
    if (turno !== 'M' && turno !== 'T') {
      setMsg({ type: 'error', text: 'Informe o turno (M ou T).' });
      return;
    }

    const codUsur = Number((codUsurCriacao || '').trim());
    if (!Number.isFinite(codUsur)) {
      setMsg({ type: 'error', text: 'Não foi possível obter o usuário logado (codUsurCriacao).' });
      return;
    }

    const codMotoristaNum = Number(codMotorista);
    const codVeiculoNum = Number(codVeiculo);

    if (!Number.isFinite(codMotoristaNum)) {
      setMsg({ type: 'error', text: 'Código do motorista inválido.' });
      return;
    }
    if (!Number.isFinite(codVeiculoNum)) {
      setMsg({ type: 'error', text: 'Código do veículo inválido.' });
      return;
    }

    try {
      const qs = new URLSearchParams({ dataRota: data });
      const res = await fetch(`/api/gestlog/rotas?${qs.toString()}`);
      if (!res.ok) {
        const r = await res.json().catch(() => ({}));
        const t = typeof r?.message === 'string' ? r.message : 'Falha ao validar rotas';
        setMsg({ type: 'error', text: t });
        return;
      }
      const r = await res.json().catch(() => ({}));
      const fullRows = Array.isArray(r?.rows) ? (r.rows as Array<Record<string, unknown>>) : [];
      const rotasMap = new Map<number, { idRota: number; turno: string; codMotorista: number | null; codVeiculo: number | null }>();

      for (const row of fullRows) {
        const idRota = Number(row?.id_rota);
        if (!Number.isFinite(idRota)) continue;
        if (rotasMap.has(idRota)) continue;
        const turnoRota = String(row?.turno_separacao ?? '').trim().toUpperCase() || '-';
        const cm = Number(row?.cod_motorista);
        const cv = Number(row?.cod_veiculo);
        rotasMap.set(idRota, {
          idRota,
          turno: turnoRota,
          codMotorista: Number.isFinite(cm) ? cm : null,
          codVeiculo: Number.isFinite(cv) ? cv : null,
        });
      }

      const rotasList = Array.from(rotasMap.values());

      const conflitoVeiculo = rotasList.find((it) => {
        if (it.codVeiculo !== codVeiculoNum) return false;
        if (it.codMotorista == null) return true;
        return it.codMotorista !== codMotoristaNum;
      });
      if (conflitoVeiculo) {
        setMsg({ type: 'error', text: `Veículo já está em uma rota desse dia com outro motorista (ID ${conflitoVeiculo.idRota}).` });
        return;
      }
    } catch {
      setMsg({ type: 'error', text: 'Erro ao comunicar com o servidor (validação).' });
      return;
    }

    onSubmit();
  };

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.12)', zIndex: 20 }} />
      <div className="modal d-block" tabIndex={-1} style={{ position: 'absolute', inset: 0, zIndex: 21 }}>
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document" style={{ maxWidth: 620 }}>
          <div className="modal-content" style={{ overflow: 'hidden' }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: '0.95rem' }}>Nova Rota</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Fechar"
                onClick={() => {
                  setMsg(null);
                  setOpen(false);
                }}
                disabled={submitting}
                title="Fechar"
              />
            </div>

            <div className="modal-body" style={{ overflowY: 'auto' }}>
            {msg && (
              <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'} py-2`} role="alert" style={{ fontSize: '0.75rem' }}>
                {msg.text}
              </div>
            )}
            <div className="mb-2">
              <label className="form-label mb-1">Descrição da Rota</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                required
              />
            </div>

            <div className="row g-2 mt-2">
              <div className="col-12">
                <label className="form-label mb-1">Cod. Motorista</label>
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control"
                    value={motoristaLabel || (codMotorista ? `Motorista ${codMotorista}` : '')}
                    placeholder={codMotorista ? `Motorista ${codMotorista}` : 'Selecione um motorista'}
                    readOnly
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => setMotoristaModalOpen(true)}
                  >
                    Selecionar
                  </button>
                </div>
              </div>
              <div className="col-12">
                <label className="form-label mb-1">Cod. Veículo</label>
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control"
                    value={veiculoLabel || (codVeiculo ? `Veículo ${codVeiculo}` : '')}
                    placeholder={codVeiculo ? `Veículo ${codVeiculo}` : 'Selecione um veículo'}
                    readOnly
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => setVeiculoModalOpen(true)}
                  >
                    Selecionar
                  </button>
                </div>
              </div>
            </div>

            <div className="row g-2 mt-2">
              <div className="col-6">
                <label className="form-label mb-1">Data da Rota</label>
                <div className="d-flex align-items-end gap-2">
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dataRota}
                    onChange={e => setDataRota(e.target.value)}
                    style={{ flex: 1 }}
                    required
                  />
                  {!!weekdayLabel && (
                    <div
                      className="border border-warning rounded bg-warning text-dark px-2 d-flex align-items-center justify-content-center text-nowrap"
                      style={{ height: '30px', fontSize: '0.72rem' }}
                      title={weekdayLabel}
                    >
                      <div className="d-flex align-items-center justify-content-center w-100">{weekdayLabel}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-6">
                <label className="form-label mb-1">Turno</label>
                <select
                  className="form-select form-select-sm"
                  value={(turnoSeparacao || '').trim().toUpperCase()}
                  onChange={(e) => setTurnoSeparacao(e.target.value)}
                  required
                >
                  <option value="" disabled>Selecione</option>
                  <option value="M">Manhã (M)</option>
                  <option value="T">Tarde (T)</option>
                </select>
              </div>
            </div>

            <div className="row g-2 mt-2">
              <div className="col-12">
                <label className="form-label mb-1">Bairros (até 5)</label>
              </div>
              <div className="col-12">
                <input className="form-control form-control-sm mb-1" value={bairro1} onChange={e => setBairro1(e.target.value)} placeholder="Bairro 1" />
                <input className="form-control form-control-sm mb-1" value={bairro2} onChange={e => setBairro2(e.target.value)} placeholder="Bairro 2" />
                <input className="form-control form-control-sm mb-1" value={bairro3} onChange={e => setBairro3(e.target.value)} placeholder="Bairro 3" />
                <input className="form-control form-control-sm mb-1" value={bairro4} onChange={e => setBairro4(e.target.value)} placeholder="Bairro 4" />
                <input className="form-control form-control-sm" value={bairro5} onChange={e => setBairro5(e.target.value)} placeholder="Bairro 5" />
              </div>
            </div>
            </div>

            <div className="modal-footer py-2 d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm py-0 px-1 d-inline-flex align-items-center"
                onClick={() => {
                  setMsg(null);
                  setOpen(false);
                }}
                disabled={submitting}
                title="Cancelar"
                aria-label="Cancelar"
              >
                <X size={12} className="me-1" /> Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-0 px-1 d-inline-flex align-items-center"
                onClick={() => void handleCreate()}
                disabled={submitting}
                title={submitting ? 'Criando...' : 'Criar Rota'}
                aria-label={submitting ? 'Criando' : 'Criar Rota'}
              >
                <Plus size={12} className="me-1" /> {submitting ? 'Criando...' : 'Criar Rota'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NovaRotaCompactModal;
