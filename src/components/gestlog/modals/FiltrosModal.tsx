import React from 'react';
import { Search, XLg } from 'react-bootstrap-icons';

export const FILIAIS = [
  { label: 'Messejana', value: '1' },
  { label: 'Horizonte', value: '2' },
  { label: 'CD', value: '3' },
  { label: 'Santa Maria', value: '4' },
];

export const TIPOS_ENTREGA = [
  { label: 'Entrega', value: 'EN' },
  { label: 'Encomenda', value: 'EF' },
  { label: 'Retira', value: 'RP' },
];

export const POSICOES = [
  { label: 'Liberado', value: 'L' },
  { label: 'Pendente', value: 'P' },
  { label: 'Montado', value: 'M' },
];

interface FiltrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataInicio: string;
  dataFim: string;
  filiais: string[];
  setFiliais: (v: string[]) => void;
  filiaisRetira: string[];
  setFiliaisRetira: (v: string[]) => void;
  handleBuscar: () => void;
  loading: boolean;
  erro: string | null;
}

const FiltrosModal: React.FC<FiltrosModalProps> = ({
  isOpen,
  onClose,
  dataInicio,
  dataFim,
  filiais,
  setFiliais,
  filiaisRetira,
  setFiliaisRetira,
  handleBuscar,
  loading,
  erro,
}) => {
  if (!isOpen) return null;

  const toggleSelection = (list: string[], value: string, setter: (v: string[]) => void) => {
    if (list.includes(value)) setter(list.filter(v => v !== value));
    else setter([...list, value]);
  };

  return (
    <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(5px)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header py-1">
            <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Filtros</h6>
            <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ fontSize: '0.74rem' }}>
            <div className="d-flex align-items-end gap-2 flex-wrap mb-2">
              <div>
                <label className="form-label">Data Início</label>
                <input type="date" className="form-control form-control-sm bg-light" style={{ fontSize: '0.62rem', height: '28px' }} value={dataInicio} readOnly />
              </div>
              <div>
                <label className="form-label">Data Fim</label>
                <input type="date" className="form-control form-control-sm bg-light" style={{ fontSize: '0.62rem', height: '28px' }} value={dataFim} readOnly />
              </div>
              <div className="mb-1 text-muted fst-italic ms-2" style={{ fontSize: '0.7rem' }}>
                * Período fixo (desde 01/01/2025)
              </div>
            </div>

            <div className="d-flex flex-wrap gap-3">
              <div className="card shadow-sm" style={{ minWidth: 280, flex: '1 1 280px' }}>
                <div className="card-header py-2">Filiais</div>
                <div className="card-body py-2 d-flex flex-wrap gap-3">
                  {FILIAIS.map((f) => (
                    <div className="form-check form-switch me-3" key={f.value}>
                      <input className="form-check-input" type="checkbox" id={`fil-${f.value}`} checked={filiais.includes(f.value)} onChange={() => toggleSelection(filiais, f.value, setFiliais)} />
                      <label className="form-check-label" htmlFor={`fil-${f.value}`}>{f.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card shadow-sm" style={{ minWidth: 280, flex: '1 1 280px' }}>
                <div className="card-header py-2">Filiais Retira (opcional)</div>
                <div className="card-body py-2 d-flex flex-wrap gap-3">
                  {FILIAIS.map((f) => (
                    <div className="form-check form-switch me-3" key={`ret-${f.value}`}>
                      <input className="form-check-input" type="checkbox" id={`ret-${f.value}`} checked={filiaisRetira.includes(f.value)} onChange={() => toggleSelection(filiaisRetira, f.value, setFiliaisRetira)} />
                      <label className="form-check-label" htmlFor={`ret-${f.value}`}>{f.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {erro && <div className="alert alert-danger mt-2 mb-0">{erro}</div>}
          </div>
          <div className="modal-footer py-1" style={{ fontSize: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm py-1 px-2"
              style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={onClose}
            >
              <XLg size={12} />
              <span>Fechar</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm py-1 px-2"
              style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={handleBuscar}
              disabled={loading}
            >
              {loading && <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>}
              <Search size={14} />
              <span>{loading ? 'Buscando...' : 'Buscar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiltrosModal;
