import React from 'react';
import { PencilSquare, X } from 'react-bootstrap-icons';
import EditarMotoristaModal from './EditarMotoristaModal';

type Motorista = {
  ID: number;
  NOME: string | null;
  CPF?: string | null;
  CNH?: string | null;
  TELEFONE?: string | null;
  DATA_CRIACAO?: string | null;
  CODUSUR_CRIACAO?: number | null;
};

type MotoristaSelect = { id: number; nome: string; cpf?: string | null };

type SelecionarMotoristaModalBaseProps = {
  show: boolean;
  onClose: () => void;
};

type SelecionarMotoristaModalSelectProps = SelecionarMotoristaModalBaseProps & {
  variant?: 'select';
  onSelect: (m: MotoristaSelect) => void;
};

type SelecionarMotoristaModalManageProps = SelecionarMotoristaModalBaseProps & {
  variant: 'manage';
};

export type SelecionarMotoristaModalProps = SelecionarMotoristaModalSelectProps | SelecionarMotoristaModalManageProps;

const SelecionarMotoristaModal: React.FC<SelecionarMotoristaModalProps> = (props) => {
  const { show, onClose } = props;
  const isSelect = props.variant !== 'manage';
  const onSelect = isSelect ? props.onSelect : null;

  const [q, setQ] = React.useState('');
  const [rows, setRows] = React.useState<Motorista[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState<'buscar' | 'novo'>('buscar');
  const [editOpen, setEditOpen] = React.useState(false);
  const [editMotorista, setEditMotorista] = React.useState<{ id: number; nome: string; cpf: string | null; cnh: string | null; telefone: string | null } | null>(null);
  const [nome, setNome] = React.useState('');
  const [cpf, setCpf] = React.useState('');
  const [cnh, setCnh] = React.useState('');
  const [telefone, setTelefone] = React.useState('');
  const [msg, setMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const debounceRef = React.useRef<number | null>(null);

  const fetchRows = React.useCallback(async (term: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (term && term.trim().length) qs.set('q', term.trim());
      const res = await fetch(`/api/gestlog/motoristas?${qs.toString()}`);
      if (!res.ok) {
        setRows([]);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const r = Array.isArray(data?.rows) ? data.rows : [];
      const list = r as Motorista[];
      setRows(!isSelect ? [...list].sort((a, b) => a.ID - b.ID) : list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isSelect]);

  React.useEffect(() => {
    if (!show) return;
    setTab('buscar');
    setEditOpen(false);
    setEditMotorista(null);
    void fetchRows('');
  }, [show, fetchRows]);

  const handleSearchChange = (v: string) => {
    setQ(v);
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void fetchRows(v);
    }, 300);
  };

  const getMatricula = (): number | null => {
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
  };

  const onSubmitNovo = async () => {
    if (!isSelect) return;
    setMsg(null);
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setMsg({ type: 'error', text: 'Informe o nome do motorista.' });
      return;
    }
    const cod = getMatricula();
    if (!cod) {
      setMsg({ type: 'error', text: 'Não foi possível obter a matrícula do usuário.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/gestlog/motoristas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nomeTrim,
          cpf: cpf.trim() || null,
          cnh: cnh.trim() || null,
          telefone: telefone.trim() || null,
          codUsurCriacao: cod
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const t = typeof data?.message === 'string' ? data.message : 'Falha ao cadastrar motorista';
        setMsg({ type: 'error', text: t });
        return;
      }
      const id = Number(data?.id);
      if (Number.isFinite(id)) {
        onSelect?.({ id, nome: nomeTrim, cpf: cpf.trim() || null });
        onClose();
        return;
      }
      setMsg({ type: 'error', text: 'Retorno inválido do servidor.' });
    } catch {
      setMsg({ type: 'error', text: 'Erro ao comunicar com o servidor.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 3000 }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 3010 }}>
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: '0.95rem' }}>{isSelect ? 'Selecionar Motorista' : 'Motoristas'}</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: '0.8rem' }}>
              {isSelect && (
                <div className="d-flex mb-2" style={{ gap: '8px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${tab === 'buscar' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setTab('buscar')}
                  >
                    Buscar
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${tab === 'novo' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setTab('novo')}
                  >
                    Novo
                  </button>
                </div>
              )}

              {tab === 'buscar' && (
                <div>
                  <div className="mb-2">
                    <input
                      className="form-control form-control-sm"
                      placeholder="Pesquisar por nome, CPF ou telefone"
                      value={q}
                      onChange={e => handleSearchChange(e.target.value)}
                    />
                  </div>
                  <div className="border rounded" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {loading ? (
                      <div className="p-2 text-muted">Carregando...</div>
                    ) : rows.length === 0 ? (
                      <div className="p-2 text-muted">Nenhum motorista encontrado.</div>
                    ) : (
                      <table className="table table-sm mb-0" style={{ fontSize: '0.75rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '12%' }}>ID</th>
                            <th style={{ width: isSelect ? '48%' : '43%' }}>Nome</th>
                            <th style={{ width: '20%' }}>CPF</th>
                            {!isSelect && <th style={{ width: '15%' }}>Telefone</th>}
                            <th style={{ width: isSelect ? '10%' : '10%' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={`mot-${r.ID}`}>
                              <td>{r.ID}</td>
                              <td className="text-truncate">{r.NOME || '-'}</td>
                              <td>{r.CPF || '-'}</td>
                              {!isSelect && <td>{r.TELEFONE || '-'}</td>}
                              <td>
                                {isSelect ? (
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm py-0 px-1"
                                    onClick={() => {
                                      onSelect?.({ id: r.ID, nome: r.NOME || '', cpf: r.CPF || '' });
                                      onClose();
                                    }}
                                  >
                                    Selecionar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm py-0 px-2 d-inline-flex align-items-center text-nowrap"
                                    onClick={() => {
                                      setEditMotorista({
                                        id: r.ID,
                                        nome: r.NOME || '',
                                        cpf: r.CPF || null,
                                        cnh: r.CNH || null,
                                        telefone: r.TELEFONE || null,
                                      });
                                      setEditOpen(true);
                                    }}
                                    title="Editar motorista"
                                  >
                                    <PencilSquare size={12} className="me-1" /> Editar
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {isSelect && tab === 'novo' && (
                <div>
                  {msg && (
                    <div className={`alert ${msg.type === 'success' ? 'alert-success' : 'alert-danger'} py-2`} role="alert" style={{ fontSize: '0.8rem' }}>
                      {msg.text}
                    </div>
                  )}
                  <div className="mb-2">
                    <label className="form-label mb-1">Nome</label>
                    <input className="form-control form-control-sm" value={nome} onChange={e => setNome(e.target.value)} />
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label mb-1">CPF</label>
                      <input className="form-control form-control-sm" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div className="col-6">
                      <label className="form-label mb-1">CNH</label>
                      <input className="form-control form-control-sm" value={cnh} onChange={e => setCnh(e.target.value)} placeholder="Opcional" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="form-label mb-1">Telefone</label>
                    <input className="form-control form-control-sm" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Opcional" />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer py-2">
              {isSelect && tab === 'novo' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onSubmitNovo}
                  disabled={submitting}
                >
                  Cadastrar
                </button>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm d-inline-flex align-items-center px-3" onClick={onClose}>
                  <X size={12} className="me-1" /> Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <EditarMotoristaModal
        show={editOpen}
        motorista={editMotorista}
        onClose={() => setEditOpen(false)}
        onSaved={() => void fetchRows(q)}
      />
    </div>
  );
};

export default SelecionarMotoristaModal;
