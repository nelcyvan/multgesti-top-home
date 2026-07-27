import React from "react";
import type { ComissaoPorLiquidezRow } from "../../services/gestpro/ComissaoPorLiquidez";

type LiquidezModalProps = {
  rows: ComissaoPorLiquidezRow[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  title?: string;
};

const currency = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

const calcCommission = (value: number | null | undefined): number | null => {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return null;
  if (n < 70000) return null; // sem comissão para < 70k
  if (n >= 120000) return n * 0.01; // 1% para >= 120k
  return n * 0.005; // 0,5% para 70k–<120k
};

const formatCommission = (value: number | null | undefined): string => {
  const c = calcCommission(value);
  return c == null ? "—" : currency(c);
};

const LiquidezModal: React.FC<LiquidezModalProps> = ({ rows, loading, error, onClose, title }) => {
  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2995 }}></div>
      <div className="modal fade show" style={{ display: "block", zIndex: 3000 }} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "720px" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>{title || 'Comissões por Liquidez (Mês Atual)'}</h5>
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
                      <th>Duplicatas</th>
                      <th>RCA</th>
                      <th>Vendedor(a)</th>
                      <th>Tipo Venda</th>
                      <th className="text-end">Valor</th>
                      <th className="text-end">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6}>Carregando...</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan={6}>Sem registros.</td></tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr key={`${row.CODUSUR}-${idx}`}>
                          <td>{row.QTTITULOS}</td>
                          <td>{row.CODUSUR}</td>
                          <td>{row.RCA}</td>
                          <td>{row.TIPOVEND === 'I' ? 'Interna' : row.TIPOVEND === 'E' ? 'Externa' : row.TIPOVEND}</td>
                          <td className="text-end">{currency(row.VALOR)}</td>
                          <td className="text-end">{formatCommission(row.VALOR)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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

export default LiquidezModal;