import React, { useMemo, useState } from "react";
import type { FretePorLiquidezResumoRow } from "../../services/gestpro/ComissoesPorFreteMesAtual";

type ComissoesPorFreteRow = {
  CODUSUR: number;
  VENDEDOR: string;
  QTD_VENDAS_FRETE: number;
  VALOR_FRETE_TOTAL: number;
};

type FreteModalProps = {
  rows: ComissoesPorFreteRow[];
  detailRows?: FretePorLiquidezResumoRow[];
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

// Comissão do frete: 0,5% quando Valor Frete Total >= 2.000,00
// Caso seja < 2.000,00 não gera comissão
const calcFreteCommission = (valorFreteTotal: number | null | undefined): number | null => {
  const n = Number(valorFreteTotal ?? 0);
  if (!isFinite(n)) return null;
  if (n < 2000) return null;
  return n * 0.05;
};

const formatFreteCommission = (valorFreteTotal: number | null | undefined): string => {
  const c = calcFreteCommission(valorFreteTotal);
  return c == null ? "—" : currency(c);
};

const dateBR = (d: unknown): string => {
  if (d == null) return "—";
  try {
    const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d instanceof Date ? d : null;
    if (!dt || isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
};

const FreteModal: React.FC<FreteModalProps> = ({ rows, detailRows, loading, error, onClose, title }) => {
  const [vendedorSelecionado, setVendedorSelecionado] = useState<null | { codusur: number; vendedor: string }>(null);
  const [showDetalheVendedor, setShowDetalheVendedor] = useState<boolean>(false);
  const hasDetalhe = Array.isArray(detailRows) && detailRows.length > 0;

  const pedidosDoVendedor = useMemo(() => {
    if (!hasDetalhe || !vendedorSelecionado || !showDetalheVendedor) return [];

    const filtradas = (detailRows || []).filter((r) => Number(r.CODUSUR || 0) === vendedorSelecionado.codusur);
    const acc: Record<
      string,
      {
        NUMPED: string;
        CLIENTE: string;
        CODFILIAL: string;
        DTSAIDA: unknown;
        NOTAS: Set<string>;
        FRETE: number;
        OUTRAS: number;
        VLTOTGER: number;
        ITENS: number;
      }
    > = {};

    for (const r of filtradas) {
      const pedidoRaw = r.NUMPED == null ? "" : String(r.NUMPED);
      const pedido = pedidoRaw.trim() ? pedidoRaw : "—";
      const cliente = String(r.CLIENTE_PEDIDO ?? "—");
      const codfilial = String(r.CODFILIAL ?? "");
      const nota = r.NUMNOTA == null ? "" : String(r.NUMNOTA);
      const frete = Number(r.FRETE || 0);
      const outras = Number(r.OUTRAS_DESPESAS || 0);
      const vltotger = Number(r.VLTOTGER || 0);
      const key = `${pedido}::${cliente}::${codfilial}`;

      if (!acc[key]) {
        acc[key] = {
          NUMPED: pedido,
          CLIENTE: cliente,
          CODFILIAL: codfilial,
          DTSAIDA: r.DTSAIDA ?? r.DTEMISSAO ?? null,
          NOTAS: new Set<string>(),
          FRETE: 0,
          OUTRAS: 0,
          VLTOTGER: 0,
          ITENS: 0,
        };
      }
      if (nota) acc[key].NOTAS.add(nota);
      acc[key].FRETE += Number.isFinite(frete) ? frete : 0;
      acc[key].OUTRAS += Number.isFinite(outras) ? outras : 0;
      acc[key].VLTOTGER += Number.isFinite(vltotger) ? vltotger : 0;
      acc[key].ITENS += 1;
    }

    return Object.values(acc).sort((a, b) => b.FRETE - a.FRETE);
  }, [detailRows, hasDetalhe, vendedorSelecionado]);

  const totaisDoVendedor = useMemo(() => {
    if (!hasDetalhe || !vendedorSelecionado || !showDetalheVendedor) return null;
    const filtradas = (detailRows || []).filter((r) => Number(r.CODUSUR || 0) === vendedorSelecionado.codusur);
    const totalFrete = filtradas.reduce((acc, r) => acc + Number(r.FRETE || 0), 0);
    const totalOutras = filtradas.reduce((acc, r) => acc + Number(r.OUTRAS_DESPESAS || 0), 0);
    const totalVltotger = filtradas.reduce((acc, r) => acc + Number(r.VLTOTGER || 0), 0);
    const pedidos = new Set<string>();
    const notas = new Set<string>();
    for (const r of filtradas) {
      const p = r.NUMPED == null ? "" : String(r.NUMPED);
      if (p) pedidos.add(p);
      const n = r.NUMNOTA == null ? "" : String(r.NUMNOTA);
      if (n) notas.add(n);
    }
    return {
      totalFrete: Number.isFinite(totalFrete) ? totalFrete : 0,
      totalOutras: Number.isFinite(totalOutras) ? totalOutras : 0,
      totalVltotger: Number.isFinite(totalVltotger) ? totalVltotger : 0,
      pedidos: pedidos.size,
      notas: notas.size,
      itens: filtradas.length,
    };
  }, [detailRows, hasDetalhe, vendedorSelecionado]);

  const closeAll = () => {
    setShowDetalheVendedor(false);
    setVendedorSelecionado(null);
    onClose();
  };

  const openDetalheDoVendedor = (codusur: number, vendedor: string) => {
    setVendedorSelecionado({ codusur, vendedor });
    setShowDetalheVendedor(true);
  };

  const closeDetalheDoVendedor = () => {
    setShowDetalheVendedor(false);
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2995 }}></div>
      <div className="modal fade show" style={{ display: "block", zIndex: 3000 }} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: "720px" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>{title || 'Comissões por Frete (Mês Atual)'}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={closeAll}></button>
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ['--input-font-size' as any]: "0.7rem", maxHeight: '70vh', overflowY: 'auto' }}>
            {error && (
              <div className="alert alert-danger mb-2">{error}</div>
            )}
            {!error && (
              <>
                <div className="table-responsive">
                  <table className="table table-sm table-striped">
                    <thead>
                      <tr>
                        <th>Cod.</th>
                        <th>Vendedor(a)</th>
                        <th className="text-end">Qtd Vendas Frete</th>
                        <th className="text-end">Valor Frete Total</th>
                        <th className="text-end">Comissão</th>
                        {hasDetalhe && <th className="text-end">Detalhar</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={hasDetalhe ? 6 : 5}>Carregando...</td></tr>
                      ) : rows.length === 0 ? (
                        <tr><td colSpan={hasDetalhe ? 6 : 5}>Sem registros.</td></tr>
                      ) : (
                        rows.map((row, idx) => (
                          <tr key={`${row.CODUSUR}-${idx}`}>
                            <td>{row.CODUSUR}</td>
                            <td>{row.VENDEDOR}</td>
                            <td className="text-end">{Number(row.QTD_VENDAS_FRETE || 0)}</td>
                            <td className="text-end">{currency(row.VALOR_FRETE_TOTAL)}</td>
                            <td className="text-end">{formatFreteCommission(row.VALOR_FRETE_TOTAL)}</td>
                            {hasDetalhe && (
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => openDetalheDoVendedor(row.CODUSUR, row.VENDEDOR)}
                                >
                                  Detalhar
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-gestpro" onClick={closeAll}>Fechar</button>
            </div>
          </div>
        </div>
      </div>

      {hasDetalhe && showDetalheVendedor && vendedorSelecionado && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 3095 }}></div>
          <div className="modal fade show" style={{ display: "block", zIndex: 3100 }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: "920px" }}>
              <div className="modal-content" style={{ fontSize: "0.75rem" }}>
                <div className="modal-header">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                    Detalhes por Vendedor(a)
                  </h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={closeDetalheDoVendedor}></button>
                </div>
                <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ['--input-font-size' as any]: "0.7rem", maxHeight: '70vh', overflowY: 'auto' }}>
                  <div className="fw-bold">{vendedorSelecionado.vendedor}</div>
                  <div className="text-muted mb-2">CODUSUR {vendedorSelecionado.codusur}</div>

                  {totaisDoVendedor && (
                    <div className="d-flex flex-wrap gap-3 mb-2">
                      <div><span className="text-muted">Frete:</span> <span className="fw-bold">{currency(totaisDoVendedor.totalFrete)}</span></div>
                      <div><span className="text-muted">Outras:</span> <span className="fw-bold">{currency(totaisDoVendedor.totalOutras)}</span></div>
                      <div><span className="text-muted">Total:</span> <span className="fw-bold">{currency(totaisDoVendedor.totalVltotger)}</span></div>
                      <div className="text-muted">({totaisDoVendedor.pedidos} pedidos, {totaisDoVendedor.notas} notas)</div>
                    </div>
                  )}

                  <div className="table-responsive">
                    <table className="table table-sm table-striped mb-0">
                      <thead>
                        <tr>
                          <th>Pedido</th>
                          <th>Cliente</th>
                          <th>Filial</th>
                          <th>Data</th>
                          <th className="text-end">Notas</th>
                          <th className="text-end">Frete</th>
                          <th className="text-end">Outras</th>
                          <th className="text-end">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={8}>Carregando...</td></tr>
                        ) : pedidosDoVendedor.length === 0 ? (
                          <tr><td colSpan={8}>Sem pedidos.</td></tr>
                        ) : (
                          pedidosDoVendedor.map((p, idx) => (
                            <tr key={`${p.NUMPED}-${idx}`}>
                              <td>{p.NUMPED}</td>
                              <td>{p.CLIENTE}</td>
                              <td>{p.CODFILIAL || "—"}</td>
                              <td>{dateBR(p.DTSAIDA)}</td>
                              <td className="text-end">{p.NOTAS.size}</td>
                              <td className="text-end">{currency(p.FRETE)}</td>
                              <td className="text-end">{currency(p.OUTRAS)}</td>
                              <td className="text-end">{currency(p.VLTOTGER)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
                  <button type="button" className="btn btn-secondary btn-gestpro" onClick={closeDetalheDoVendedor}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default FreteModal;
