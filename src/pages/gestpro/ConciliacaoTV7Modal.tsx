import React, { useState, useEffect } from "react";
import ConciliarModal from "./components/modals/ConciliarModal";

interface ConciliacaoTV7ModalProps {
  onClose: () => void;
}

export interface NotaTV7Item {
  CODPROD: number;
  DESCRICAO: string;
  CODAUXILIAR: number;
  QT: number;
  PUNIT: number;
  NUMPED: number;
  POSICAO: string;
  CONDVENDA: string;
  DATA_PEDIDO_TV7: string;
  NUMTRANSVENDA: number;
  DTMOV: string;
}

export interface NotaTV7 {
  NUMNOTA: number;
  DTEMISSAO: string;
  DTENT: string;
  CODCLI: number;
  CLIENTE: string;
  VLTOTAL: number;
  CODFILIAL: string;
  NUMTRANSENT: number;
  CODUSURDEVOL: number;
  items: NotaTV7Item[];
}

interface NotaTV7Row {
  NUMNOTA: number;
  DTEMISSAO: string;
  CODUSURDEVOL: number;
  DTENT: string;
  CODCLI: number;
  CLIENTE: string;
  VLTOTAL: number;
  CODFILIAL: string;
  NUMTRANSENT: number;
  DTMOV: string;
  CODPROD: number;
  DESCRICAO: string;
  CODAUXILIAR: number;
  QT: number;
  PUNIT: number;
  NUMPED: number;
  POSICAO: string;
  CONDVENDA: string;
  DATA_PEDIDO_TV7: string;
  NUMTRANSVENDA: number;
}

const resolveBaseApi = () => {
  const envRaw = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
  if (envRaw && typeof envRaw === "string") {
    const trimmed = envRaw.replace(/\/+$/, "");
    if (isHttps && /^http:\/\//i.test(trimmed)) return "/api";
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  return "/api";
};

const currency = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

const ConciliacaoTV7Modal: React.FC<ConciliacaoTV7ModalProps> = ({ onClose }) => {
  const [dataInicio, setDataInicio] = useState<string>("2026-01-27");
  const [dataFim, setDataFim] = useState<string>("2026-01-27");
  const [notas, setNotas] = useState<NotaTV7[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notaSelecionada, setNotaSelecionada] = useState<NotaTV7 | null>(null);

  const buscarNotas = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseApi = resolveBaseApi();
      const response = await fetch(`${baseApi}/gestpro/conciliacao-tv7/buscar-notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataInicio, dataFim }),
      });

      if (!response.ok) throw new Error("Falha ao buscar notas");
      const data = await response.json();
      const rows: NotaTV7Row[] = data.rows || [];
      
      // Agrupar por NUMTRANSENT (Transação de Entrada única)
      const groupedMap = new Map<number, NotaTV7>();

      rows.forEach(row => {
        if (!groupedMap.has(row.NUMTRANSENT)) {
          groupedMap.set(row.NUMTRANSENT, {
            NUMNOTA: row.NUMNOTA,
            DTEMISSAO: row.DTEMISSAO,
            DTENT: row.DTENT,
            CODCLI: row.CODCLI,
            CLIENTE: row.CLIENTE,
            VLTOTAL: row.VLTOTAL,
            CODFILIAL: row.CODFILIAL,
            NUMTRANSENT: row.NUMTRANSENT,
            CODUSURDEVOL: row.CODUSURDEVOL,
            items: []
          });
        }
        
        const nota = groupedMap.get(row.NUMTRANSENT)!;
        nota.items.push({
          CODPROD: row.CODPROD,
          DESCRICAO: row.DESCRICAO,
          CODAUXILIAR: row.CODAUXILIAR,
          QT: row.QT,
          PUNIT: row.PUNIT,
          NUMPED: row.NUMPED,
          POSICAO: row.POSICAO,
          CONDVENDA: row.CONDVENDA,
          DATA_PEDIDO_TV7: row.DATA_PEDIDO_TV7,
          NUMTRANSVENDA: row.NUMTRANSVENDA,
          DTMOV: row.DTMOV
        });
      });

      setNotas(Array.from(groupedMap.values()));
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarNotas();
  }, []);

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-fullscreen">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Conciliação TV7</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
            </div>
            <div className="modal-body bg-light">
              <div className="d-flex gap-3 align-items-end mb-3 p-3 bg-white rounded shadow-sm">
                <div>
                  <label className="form-label mb-1 small text-muted">Data Início</label>
                  <input 
                    type="date" 
                    className="form-control form-control-sm" 
                    value={dataInicio} 
                    onChange={(e) => setDataInicio(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="form-label mb-1 small text-muted">Data Fim</label>
                  <input 
                    type="date" 
                    className="form-control form-control-sm" 
                    value={dataFim} 
                    onChange={(e) => setDataFim(e.target.value)} 
                  />
                </div>
                <button 
                  className="btn btn-primary btn-sm px-4" 
                  onClick={buscarNotas}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Buscando...
                    </>
                  ) : "Filtrar"}
                </button>
              </div>

              {error && <div className="alert alert-danger">{error}</div>}

              <div className="card shadow-sm border-0">
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-striped table-hover mb-0" style={{ fontSize: "0.85rem" }}>
                      <thead className="table-light sticky-top">
                        <tr>
                          <th>Num. Nota</th>
                          <th>Transação</th>
                          <th>Dt. Emissão</th>
                          <th>Dt. Entrada</th>
                          <th>Cod. Fornec</th>
                          <th>Fornecedor/Cliente</th>
                          <th>Filial</th>
                          <th className="text-end">Valor Total</th>
                          <th className="text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && (
                          <tr>
                            <td colSpan={9} className="text-center py-5">
                              <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Carregando...</span>
                              </div>
                            </td>
                          </tr>
                        )}
                        
                        {!loading && notas.length === 0 && (
                          <tr>
                            <td colSpan={9} className="text-center py-5 text-muted">
                              Nenhuma nota encontrada para o período selecionado.
                            </td>
                          </tr>
                        )}

                        {!loading && notas.map((nota) => (
                          <tr key={`${nota.NUMTRANSENT}-${nota.NUMNOTA}`}>
                            <td>{nota.NUMNOTA}</td>
                            <td>{nota.NUMTRANSENT}</td>
                            <td>{nota.DTEMISSAO}</td>
                            <td>{nota.DTENT}</td>
                            <td>{nota.CODCLI}</td>
                            <td>{nota.CLIENTE}</td>
                            <td>{nota.CODFILIAL}</td>
                            <td className="text-end fw-bold">{currency(nota.VLTOTAL)}</td>
                            <td className="text-center">
                              <button 
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => setNotaSelecionada(nota)}
                              >
                                Conciliar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {notaSelecionada && (
        <ConciliarModal 
          nota={notaSelecionada} 
          onClose={() => setNotaSelecionada(null)} 
        />
      )}
    </>
  );
};

export default ConciliacaoTV7Modal;
