import React, { useEffect, useMemo, useState } from "react";
import { buscarDuplicatasEmAbertoMesAtual } from "../../services/gestpro/DuplicatasEmAbertoMesAtual";
import { buscarDuplicatasEmAbertoMesAnterior } from "../../services/gestpro/DuplicatasEmAbertoMesAnterior";
import type { DuplicataAbertaRow } from "../../services/gestpro/DuplicatasEmAbertoMesAtual";
import EnviarComprovanteModal from "./EnviarComprovanteModal";

export type EmAbetoProps = {
  codusur?: number;
  rca?: string;
  mesAnterior?: boolean;
  onClose: () => void;
  /**
   * Se definido, o modal já abre filtrando apenas por essas cobranças
   * e não exibe os botões de filtro (ou força um filtro específico).
   * Para este caso específico do usuário, vamos permitir passar "ESPECIAIS"
   * ou um array de strings.
   */
  filtroCobrancaInicial?: string[];
};

const currencyBRL = (n: number | null | undefined): string => {
  const v = Number(n ?? 0);
  return isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
};

const cobrancaOpcoes = ["CTB", "CTC", "CTD", "CTDI", "CTDP", "CTP", "CART"] as const;

const EmAbeto: React.FC<EmAbetoProps> = ({ codusur, rca, mesAnterior, onClose, filtroCobrancaInicial }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DuplicataAbertaRow[]>([]);
  const [showEnviar, setShowEnviar] = useState<boolean>(false);
  const [duplicataSelecionada, setDuplicataSelecionada] = useState<DuplicataAbertaRow | null>(null);
  const [filtroCobranca, setFiltroCobranca] = useState<string>("TODAS");

  // Se filtroCobrancaInicial for passado, aplicamos na lógica de filtro.
  // Mas como o filtroCobranca é string única ("TODAS" ou "CTB"...),
  // precisamos adaptar a lógica do filteredRows para suportar array de códigos.


  useEffect(() => {
    const fetchDuplicatas = async () => {
      setError(null);
      setLoading(true);
      try {
        if (mesAnterior) {
          const respAnt = await buscarDuplicatasEmAbertoMesAnterior();
          setRows(respAnt.rows || []);
        } else {
          const resp = await buscarDuplicatasEmAbertoMesAtual();
          setRows(resp.rows || []);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erro ao buscar duplicatas em aberto');
      } finally {
        setLoading(false);
      }
    };
    fetchDuplicatas();
  }, [mesAnterior]);

  const filteredRows: DuplicataAbertaRow[] = useMemo(() => {
    const base = rows ?? [];
    let filtered = base;
    if (rca && rca.trim()) {
      const q = rca.trim().toLowerCase();
      filtered = filtered.filter((r) => String(r.NOME || '').toLowerCase().includes(q));
    }
    if (typeof codusur === 'number' && isFinite(codusur)) {
      filtered = filtered.filter((r) => Number(r.CODUSUR) === Number(codusur));
    }
    
    // Se foi passado um filtro inicial (array de cobranças), usamos ele prioritariamente
    if (filtroCobrancaInicial && filtroCobrancaInicial.length > 0) {
      const setCobrancas = new Set(filtroCobrancaInicial);
      filtered = filtered.filter((r) => setCobrancas.has(String(r.CODCOB || "").trim().toUpperCase()));
    } else {
      // Caso contrário, usamos o filtro selecionado pelos botões
      if (filtroCobranca !== "TODAS") {
        filtered = filtered.filter((r) => String(r.CODCOB || "").trim().toUpperCase() === filtroCobranca);
      }
    }
    
    return filtered;
  }, [rows, rca, codusur, filtroCobranca, filtroCobrancaInicial]);

  const abrirEnviar = (row: DuplicataAbertaRow) => {
    setDuplicataSelecionada(row);
    setShowEnviar(true);
  };

  const fecharEnviar = () => {
    setShowEnviar(false);
    setDuplicataSelecionada(null);
  };

  return (
    <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} aria-modal="true" role="dialog">
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Duplicatas em Aberto {rca ? `• ${rca}` : ''}</h5>
            <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && (<div className="alert alert-danger mb-2">{error}</div>)}
            {!error && (
              <>
                {/* Se não houver filtro inicial forçado, exibe os botões de filtro */}
                {(!filtroCobrancaInicial || filtroCobrancaInicial.length === 0) && (
                  <div className="mb-2 d-flex flex-wrap align-items-center gap-2">
                    <span className="small text-muted me-2">Cobrança:</span>
                    <button
                      type="button"
                      className={`btn btn-sm btn-outline-secondary btn-gestpro ${filtroCobranca === "TODAS" ? "active" : ""}`}
                      onClick={() => setFiltroCobranca("TODAS")}
                    >
                      Todas
                    </button>
                    {cobrancaOpcoes.map((cod) => (
                      <button
                        key={cod}
                        type="button"
                        className={`btn btn-sm btn-outline-secondary btn-gestpro ${filtroCobranca === cod ? "active" : ""}`}
                        onClick={() => setFiltroCobranca(cod)}
                      >
                        {cod}
                      </button>
                    ))}
                  </div>
                )}
                <div className="table-responsive">
                  <table className="table table-sm table-striped">
                    <thead>
                      <tr>
                        <th>Emissão</th>
                        <th>Codigo</th>
                        <th>Cliente</th>
                        <th>Pedido</th>
                        <th className="text-end">Valor</th>
                        <th>Cobrança</th>
                        <th>Usuário</th>
                        <th>RCA</th>
                        <th className="text-end">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={9}>Carregando...</td></tr>
                      ) : filteredRows.length === 0 ? (
                        <tr><td colSpan={9}>Sem duplicatas em aberto.</td></tr>
                      ) : (
                        filteredRows.map((r, idx) => (
                          <tr key={`${r.NUMPED}-${idx}`}>
                            <td>{r.DTEMISSAO}</td>
                            <td>{r.CODCLI}</td>
                            <td>{r.CLIENTE}</td>
                            <td>{r.NUMPED}</td>
                            <td className="text-end">{currencyBRL(r.VALOR)}</td>
                            <td>{r.CODCOB}</td>
                            <td>{r.CODUSUR}</td>
                            <td>{r.NOME}</td>
                            <td className="text-end">
                              <button className="btn btn-outline-primary btn-gestpro" type="button" onClick={() => abrirEnviar(r)}>
                                Comprovante
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {showEnviar && duplicataSelecionada && (
              <EnviarComprovanteModal duplicata={duplicataSelecionada} onClose={fecharEnviar} />
            )}
          </div>
          <div className="modal-footer">
            <small className="text-muted me-auto">Total de duplicatas: {filteredRows.length}</small>
            <button type="button" className="btn btn-secondary btn-gestpro" onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmAbeto;
