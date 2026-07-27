import React, { useEffect, useState } from 'react';
import { Check2, Save, Search, XLg } from 'react-bootstrap-icons';

export type AtualizarCadastroItem = {
  codProd?: number;
  descricao: string;
  multiplo?: number;
  embalagem?: string; // Embalagem Master
};

interface AtualizarCadastroProps {
  show: boolean;
  item: AtualizarCadastroItem;
  onClose: () => void;
  onUpdate?: (updated: { codProd?: number; descricao: string; multiplo?: number; embalagem?: string }) => Promise<void> | void;
}

// Lista de embalagens disponíveis
const EMBALAGENS: { code: string; label: string }[] = [
  { code: 'UN', label: 'UNIDADE' },
  { code: 'CX', label: 'CAIXA' },
  { code: 'KG', label: 'QUILO' },
  { code: 'DZ', label: 'DUZIA' },
  { code: 'GL', label: 'GALAO' },
  { code: 'BD', label: 'BALDE' },
  { code: 'SC', label: 'SACO' },
  { code: 'DP', label: 'DISPLAY' },
  { code: 'FD', label: 'FARDO' },
  { code: 'LT', label: 'LITRO' },
  { code: 'ML', label: 'MILILITRO' },
  { code: 'PC', label: 'PECA' },
  { code: 'PT', label: 'PACOTE' },
  { code: 'VD', label: 'VIDRO' },
  { code: 'MT', label: 'METRO' },
  { code: 'KT', label: 'KIT' },
  { code: 'GF', label: 'GARRAFA' },
  { code: 'CT', label: 'CENTO' },
  { code: 'SH', label: 'SACHE' },
  { code: 'BR', label: 'BARRIL' },
  { code: 'CR', label: 'CARTELA' },
  { code: 'M2', label: 'METRO QUADRADO' },
  { code: 'QT', label: 'QUARTO' },
  { code: 'TT', label: 'TIRA TEIMA' },
];

const AtualizarCadastro: React.FC<AtualizarCadastroProps> = ({ show, item, onClose, onUpdate }) => {
  const [descricao, setDescricao] = useState<string>(item?.descricao ?? '');
  const [multiplo, setMultiplo] = useState<string>(item?.multiplo != null ? String(item.multiplo) : '');
  const [embalagem, setEmbalagem] = useState<string>(item?.embalagem ?? '');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [erro, setErro] = useState<string | null>(null);

  const [showEmbalagemPicker, setShowEmbalagemPicker] = useState<boolean>(false);
  const [embalagemFiltro, setEmbalagemFiltro] = useState<string>('');

  useEffect(() => {
    // sempre que item mudar, sincroniza os estados
    setDescricao(item?.descricao ?? '');
    setMultiplo(item?.multiplo != null ? String(item.multiplo) : '');
    setEmbalagem(item?.embalagem ?? '');
  }, [item]);

  if (!show) return null;

  const handleCancelar = () => {
    if (submitting) return;
    onClose();
  };

  const validar = (): boolean => {
    // DESCRICAO VARCHAR2(40) - não editável, mas validamos comprimento
    if ((descricao ?? '').length > 40) {
      setErro('Descrição excede 40 caracteres');
      return false;
    }

    // EMBALAGEMMASTER VARCHAR2(12)
    if ((embalagem ?? '').length > 12) {
      setErro('Embalagem Master excede 12 caracteres');
      return false;
    }

    // MULTIPLO NUMBER(18,6) - aceita até 6 casas decimais
    if (multiplo) {
      const re = /^-?\d{1,18}(?:[.,]\d{1,6})?$/; // até 18 dígitos inteiros e 6 decimais
      if (!re.test(multiplo.trim())) {
        setErro('Múltiplo inválido. Use até 6 casas decimais.');
        return false;
      }
    }

    setErro(null);
    return true;
  };

  const normalizarMultiplo = (v: string): number | undefined => {
    const s = v.replace(',', '.').trim();
    if (!s) return undefined;
    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    // limita a 6 casas decimais
    return Number(n.toFixed(6));
  };

  const handleAtualizar = async () => {
    if (submitting) return;
    if (!validar()) return;
    try {
      setSubmitting(true);
      const payload = {
        codProd: item?.codProd,
        descricao: descricao,
        multiplo: normalizarMultiplo(multiplo),
        embalagem: embalagem || undefined,
      };
      if (onUpdate) await onUpdate(payload);
      onClose();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectEmbalagem = (code: string) => {
    setEmbalagem(code);
    setShowEmbalagemPicker(false);
  };

  const filteredEmbalagens = EMBALAGENS.filter(({ code, label }) => {
    const q = embalagemFiltro.trim().toLowerCase();
    if (!q) return true;
    return code.toLowerCase().includes(q) || label.toLowerCase().includes(q);
  });

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 1040 }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1050, position: 'relative' }}>
        {submitting && (
          <div className="position-absolute w-100 h-100" style={{ inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-center">
              <div className="spinner-border text-danger" role="status" style={{ width: '2rem', height: '2rem' }}>
                <span className="visually-hidden">Carregando...</span>
              </div>
              <div className="mt-2" style={{ fontSize: '0.8rem', color: '#dc3545' }}>Processando...</div>
            </div>
          </div>
        )}
        <div className="modal-dialog modal-md modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Atualizar Cadastro do Produto</h5>
              <button type="button" className="btn-close" onClick={handleCancelar} aria-label="Fechar"></button>
            </div>
            <div className="modal-body">
              {erro && <div className="alert alert-danger py-1 mb-2">{erro}</div>}

              <div className="mb-2" style={{ fontSize: '0.68rem' }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Código do Produto</label>
                <input
                  className="form-control form-control-sm"
                  style={{ fontSize: '0.62rem', height: '28px' }}
                  value={item?.codProd ?? ''}
                  readOnly
                />
              </div>

              <div className="mb-2" style={{ fontSize: '0.68rem' }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Descrição do Produto</label>
                <input
                  className="form-control form-control-sm"
                  style={{ fontSize: '0.62rem', height: '28px' }}
                  value={descricao}
                  readOnly
                  maxLength={40}
                />
              </div>

              <div className="mb-2" style={{ fontSize: '0.68rem' }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Múltiplo</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-control form-control-sm"
                  style={{ fontSize: '0.62rem', height: '28px' }}
                  value={multiplo}
                  placeholder="Ex.: 1,000000"
                  onChange={(e) => setMultiplo(e.target.value)}
                />
              </div>

              <div className="mb-2" style={{ fontSize: '0.68rem' }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Embalagem Master do Produto</label>
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ fontSize: '0.62rem', height: '28px' }}
                    value={embalagem}
                    placeholder="Selecione (não editável)"
                    maxLength={12}
                    readOnly
                    onClick={() => setShowEmbalagemPicker(true)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setShowEmbalagemPicker(true)}
                  >
                    <Search size={14} />
                    <span>Buscar</span>
                  </button>
                </div>
                {(() => {
                  const embalagemLabel = EMBALAGENS.find(({ code }) => code === embalagem)?.label;
                  return (
                    <small
                      className="text-muted d-block mt-1 text-truncate"
                      title={embalagemLabel ? `${embalagem}: ${embalagemLabel}` : 'Nenhuma embalagem selecionada'}
                    >
                      {embalagemLabel ? `${embalagemLabel}` : 'Selecione uma embalagem'}
                    </small>
                  );
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2"
                style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={handleCancelar}
                disabled={submitting}
              >
                <XLg size={12} />
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2"
                style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={handleAtualizar}
                disabled={submitting}
              >
                <Save size={14} />
                <span>{submitting ? 'Salvando...' : 'Salvar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEmbalagemPicker && (
        <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h6 className="modal-title">Selecionar Embalagem</h6>
                <button type="button" className="btn-close" onClick={() => setShowEmbalagemPicker(false)} aria-label="Fechar" title="Fechar"></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  style={{ fontSize: '0.62rem', height: '28px' }}
                  placeholder="Buscar por código ou nome"
                  value={embalagemFiltro}
                  onChange={(e) => setEmbalagemFiltro(e.target.value)}
                />
                <div className="list-group" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {filteredEmbalagens.map(({ code, label }) => (
                    <button
                      type="button"
                      key={code}
                      className="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
                      onClick={() => handleSelectEmbalagem(code)}
                    >
                      <span>
                        <strong>{code}</strong> — {label}
                      </span>
                      <span className="badge bg-primary d-inline-flex align-items-center" style={{ gap: '6px' }}>
                        <Check2 size={12} />
                        <span>Selecionar</span>
                      </span>
                    </button>
                  ))}
                  {filteredEmbalagens.length === 0 && (
                    <div className="text-muted">Nenhuma embalagem encontrada.</div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2"
                style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setShowEmbalagemPicker(false)}
              >
                <XLg size={12} />
                <span>Fechar</span>
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtualizarCadastro;
