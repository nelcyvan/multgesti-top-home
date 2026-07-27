import React from "react";
import type { EmAbertoRow } from "../../services/gestpro/EmAbertoMesAtual";

type EmAbertoModalProps = {
  rows: EmAbertoRow[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  title?: string;
  mesAnterior?: boolean;
  filtroCobrancaInicial?: string[];
};

const currency = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

import EmAbeto from "./EmAbeto";

const EmAbertoModal: React.FC<EmAbertoModalProps> = ({ rows, loading, error, onClose, title, mesAnterior, filtroCobrancaInicial }) => {
  const [showDetalhe, setShowDetalhe] = React.useState<boolean>(false);
  const [detalheCODUSUR, setDetalheCODUSUR] = React.useState<number | undefined>(undefined);
  const [detalheRCA, setDetalheRCA] = React.useState<string | undefined>(undefined);

  const abrirDetalhe = (row: EmAbertoRow) => {
    const cod = Number((row as any).CODUSUR ?? undefined);
    const rca = String((row as any).RCA ?? '').trim() || undefined;
    setDetalheCODUSUR(isFinite(cod) ? cod : undefined);
    setDetalheRCA(rca);
    setShowDetalhe(true);
  };

  const fecharDetalhe = () => {
    setShowDetalhe(false);
    setDetalheCODUSUR(undefined);
    setDetalheRCA(undefined);
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2995 }}></div>
      <div className="modal fade show" style={{ display: "block", zIndex: 3000 }} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "720px" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>{title || (mesAnterior ? 'Em Aberto (Mês Anterior)' : 'Em Aberto (Mês Atual)')}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ['--input-font-size' as any]: "0.7rem" }}>
            {error && (
              <div className="alert alert-danger mb-2">{error}</div>
            )}
            {!error && (
              <div className="table-responsive">
                <table className="table table-sm table-striped">
                  <thead>
                    <tr>
                      <th>CODUSUR</th>
                      <th>RCA</th>
                      <th className="text-end">Valor</th>
                      <th className="text-end">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4}>Carregando...</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan={4}>Sem registros.</td></tr>
                    ) : (
                      rows.map((row: EmAbertoRow, idx: number) => (
                        <tr key={`${String((row as any).CODUSUR ?? idx)}-${idx}`}>
                          <td>{String((row as any).CODUSUR ?? '—')}</td>
                          <td>{String((row as any).RCA ?? '—')}</td>
                          <td className="text-end">{currency(Number((row as any).VALOR ?? 0))}</td>
                          <td className="text-end">
                            <button className="btn btn-outline-dark btn-gestpro" type="button" onClick={() => abrirDetalhe(row)}>Detalhar</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {showDetalhe && (
              <EmAbeto
                codusur={detalheCODUSUR}
                rca={detalheRCA}
                mesAnterior={mesAnterior}
                onClose={fecharDetalhe}
                filtroCobrancaInicial={filtroCobrancaInicial}
              />
            )}
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-gestpro" onClick={onClose}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EmAbertoModal;
