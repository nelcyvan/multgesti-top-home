import React, { useEffect, useMemo, useState } from "react";
import { conciliarAreceber } from "../../../services/gestfin/areceber/ConciliarAreceber";
import { buscarLancamentosAreceber, type LancamentosAreceberRow } from "../../../services/gestfin/areceber/BuscarLancamentosAreceber";

interface BuscarLancamentosAreceberProps {
  isOpen: boolean;
  onClose: () => void;
}

const BuscarLancamentosAreceber: React.FC<BuscarLancamentosAreceberProps> = ({ isOpen, onClose }) => {
  function formatCurrency(n: number): string {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  }

  function toNumber(val: unknown): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return val;
    const str = String(val).replace(/\s*\n\s*/g, " ").trim();
    // Captura primeiro número em pt-BR (ex.: 1.234,56)
    const m = str.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}/);
    if (m && m[0]) {
      const numStr = m[0].replace(/\./g, "").replace(/,/g, ".");
      const n = parseFloat(numStr);
      return Number.isNaN(n) ? 0 : n;
    }
    // Fallback: remove símbolos e tenta no formato americano
    const cleaned = str.replace(/[^\d.,-]/g, "");
    if (cleaned.includes(",")) {
      const br = cleaned.replace(/\./g, "").replace(/,/g, ".");
      const n = parseFloat(br);
      return Number.isNaN(n) ? 0 : n;
    }
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? 0 : n;
  }

  function formatISODateToBR(iso?: string): string | null {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
  }

  function normalizeStr(s: unknown): string {
    const str = String(s ?? "").toLowerCase();
    try {
      return str.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    } catch {
      return str;
    }
  }

  const [dataInicio, setDataInicio] = useState<string>(() => {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const yyyy = inicioMes.getFullYear();
    const mm = String(inicioMes.getMonth() + 1).padStart(2, "0");
    const dd = String(inicioMes.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [dataFinal, setDataFinal] = useState<string>(() => {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const dd = String(hoje.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [carregando, setCarregando] = useState<boolean>(false);
  const [erro, setErro] = useState<string>("");
  const [resultados, setResultados] = useState<LancamentosAreceberRow[]>([]);
  const [pesquisaAvancada, setPesquisaAvancada] = useState<string>("");
  const [mostrarConciliar, setMostrarConciliar] = useState<boolean>(false);
  const [conciliando, setConciliando] = useState<boolean>(false);
  const [conciliarMsg, setConciliarMsg] = useState<string>("");

  // Estado e funções para análise manual do Histórico OFX por prefixo
  const [analiseLoading, setAnaliseLoading] = useState<boolean>(false);

  function extrairPrefixoHistorico(h: unknown): string {
    const s = String(h ?? "").trim();
    if (!s) return "Sem Histórico";
    // Captura texto até o primeiro traço (suporta -, – e —) com ou sem espaços
    const m = s.match(/^\s*([^\-–—]+?)\s*[\-–—]/);
    const prefix = m ? m[1].trim() : s;
    return prefix || "Outros";
  }

  // Abrevia descrições longas das situações para rótulos mais compactos
  function resumirSituacao(categoria: string): string {
    let s = String(categoria || "").trim();
    if (!s) return "Outros";
    const reps: Array<[RegExp, string]> = [
      [/transfer[êe]ncia/gi, "Transf."],
      [/recebid[oa]/gi, "rec."],
      [/pagamento/gi, "pag."],
      [/devolu[cç][aã]o/gi, "Devol."],
      [/qr\s*code\s*pix/gi, "QR Pix"],
      [/pix/gi, "Pix"],
      [/enviad[oa]/gi, "env."],
      [/estorno/gi, "Est."],
      [/conta/gi, "cont."],
      [/vendas?/gi, "Vendas"],
    ];
    for (const [re, sub] of reps) s = s.replace(re, sub);
    s = s.replace(/\s+/g, " ").trim();
    // Limita tamanho para manter compacto, preservando início
    const maxLen = 22;
    if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + "…";
    return s;
  }

  function analisarHistoricoPorPrefixo(rows: LancamentosAreceberRow[]): { categoria: string; total: number; qtd: number }[] {
    const mapa = new Map<string, { total: number; qtd: number }>();
    for (const r of rows) {
      const cat = extrairPrefixoHistorico(r.HISTORICO);
      const valor = Math.abs(toNumber(r.VALOR_TRANSACAO));
      const cur = mapa.get(cat) ?? { total: 0, qtd: 0 };
      cur.total += valor;
      cur.qtd += 1;
      mapa.set(cat, cur);
    }
    return Array.from(mapa.entries())
      .map(([categoria, { total, qtd }]) => ({ categoria, total, qtd }))
      .sort((a, b) => b.total - a.total);
  }

  // Modal de exportação
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv" | "xlsx">("csv");
  const handleExport = async () => {
    try {
      if (exportFormat === "csv") {
        const { exportAreceberCSV } = await import("../../../services/gestfin/areceber/ExportAreceber");
        exportAreceberCSV(resultadosExibidos);
      } else if (exportFormat === "xlsx") {
        const { exportAreceberExcelHtml } = await import("../../../services/gestfin/areceber/ExportAreceber");
        exportAreceberExcelHtml(resultadosExibidos);
      } else if (exportFormat === "pdf") {
        const { exportAreceberPDFWindowPrint } = await import("../../../services/gestfin/areceber/ExportAreceber");
        exportAreceberPDFWindowPrint(resultadosExibidos, { title: "Relatório Lançamentos à Receber", pageNote: "Totalizadores por situação constam na última página." });
      }
    } finally {
      setExportModalOpen(false);
    }
  };

  // Switches de filtro por situação (prefixos do histórico)
  // Usa "resultados" para evitar referência antes da declaração e garantir disponibilidade
  const analiseSituacoesAuto = useMemo(() => analisarHistoricoPorPrefixo(resultados), [resultados]);
  const [filtrosSituacoes, setFiltrosSituacoes] = useState<string[]>([]);
  const toggleSituacao = (cat: string) => {
    setFiltrosSituacoes((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const toBR = (iso: string) => {
    const [yyyy, mm, dd] = iso.split("-");
    if (!yyyy || !mm || !dd) return iso;
    return `${dd}/${mm}/${yyyy}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function buscar() {
    setCarregando(true);
    setErro("");
    try {
      const dados = await buscarLancamentosAreceber({ dataInicio, dataFinal });
      setResultados(dados);
    } catch (e: any) {
      setErro(e?.message || "Falha ao buscar lançamentos à receber");
    } finally {
      setCarregando(false);
    }
  }

  // Removido Total Transações conforme solicitação

  const parseDateFlex = (val?: string | null) => {
    if (!val) return Number.POSITIVE_INFINITY;
    const str = String(val).trim();
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
    }
    const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
      const [, dd, mm, yyyy] = brMatch;
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
    }
    return Number.POSITIVE_INFINITY;
  };

  const resultadosOrdenados = useMemo(() => {
    return [...resultados].sort((a, b) => {
      // 1) ID_IMPORTACAO_OFX (asc)
      const ida = Number(a.ID_IMPORTACAO_OFX);
      const idb = Number(b.ID_IMPORTACAO_OFX);
      if (!Number.isNaN(ida) && !Number.isNaN(idb) && ida !== idb) return ida - idb;
      if (String(a.ID_IMPORTACAO_OFX) !== String(b.ID_IMPORTACAO_OFX)) {
        return String(a.ID_IMPORTACAO_OFX).localeCompare(String(b.ID_IMPORTACAO_OFX));
      }

      // 2) VALOR_TRANSACAO (asc)
      const va = toNumber(a.VALOR_TRANSACAO);
      const vb = toNumber(b.VALOR_TRANSACAO);
      if (va !== vb) return va - vb;

      // 3) DATA_TRANSACAO (asc)
      const ta = parseDateFlex(a.DATA_TRANSACAO || a.DTEMISSAO || null);
      const tb = parseDateFlex(b.DATA_TRANSACAO || b.DTEMISSAO || null);
      if (ta !== tb) return ta - tb;

      return 0;
    });
  }, [resultados]);

  const resultadosExibidos = useMemo(() => {
    let base = resultadosOrdenados;
    const q = pesquisaAvancada.trim();
    if (q.length > 0) {
      const nq = normalizeStr(q);
      base = base.filter((row) => {
        const hay = [
          row.ID_IMPORTACAO_OFX,
          row.HISTORICO,
          row.NOME_BANCO_FILIAL,
          row.DUPLIC,
          row.PREST,
          row.CLIENTE,
          row.DTEMISSAO,
          row.DTPAG,
          row.VPAGO,
        ].map((v) => normalizeStr(v));
        return hay.some((h) => h.includes(nq));
      });
    }

    if (filtrosSituacoes.length > 0) {
      base = base.filter((row) => filtrosSituacoes.includes(extrairPrefixoHistorico(row.HISTORICO)));
    }

    return base;
  }, [resultadosOrdenados, pesquisaAvancada, filtrosSituacoes]);

  // Totalizadores com base nos registros exibidos (após filtros e pesquisa)
  const analiseSituacoesExibidas = useMemo(() => analisarHistoricoPorPrefixo(resultadosExibidos), [resultadosExibidos]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .compact-table th, .compact-table td { padding: 0.35rem 0.6rem; vertical-align: middle; }
        .compact-table tbody tr { transition: background-color 0.15s ease-in-out; }
        .compact-table tbody tr:hover > * { background-color: #e9f7ef !important; }
        .compact-table tbody tr:hover { cursor: pointer; }
      `}</style>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
      <div className="modal fade show" role="dialog" aria-modal="true" aria-labelledby="modalAreceberTitulo" style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1050, minHeight: "100vh" }}>
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document" style={{ maxWidth: "95vw", minHeight: "70vh", maxHeight: "85vh" }}>
          <div className="modal-content" style={{ display: "flex", flexDirection: "column", minHeight: "70vh", maxHeight: "85vh", height: "auto" }}>
            <div className="modal-header">
              <h5 className="modal-title" id="modalAreceberTitulo" style={{ fontSize: "0.9rem" }}>Lançamentos à Receber (OFX)</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, flex: "1 1 auto", overflowY: "auto" }}>
              <div className="d-flex align-items-end gap-2 flex-nowrap mb-2" style={{ fontSize: "0.75rem", lineHeight: "1.1" }}>
                <div className="d-flex align-items-center me-2">
                  <label htmlFor="dataInicioReceber" className="form-label mb-0 me-1" style={{ fontSize: "0.75rem" }}>Data Início</label>
                  <input id="dataInicioReceber" type="date" className="form-control form-control-sm" style={{ width: "9rem" }} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div className="d-flex align-items-center me-2">
                  <label htmlFor="dataFinalReceber" className="form-label mb-0 me-1" style={{ fontSize: "0.75rem" }}>Data Final</label>
                  <input id="dataFinalReceber" type="date" className="form-control form-control-sm" style={{ width: "9rem" }} value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={buscar} disabled={carregando}>{carregando ? "Buscando..." : "Buscar"}</button>
                {/* Removido Total Transações e reposicionado a pesquisa avançada abaixo dos switches */}
                {/* Switches de filtro por situação */}
                {analiseSituacoesAuto.length > 0 && (
                  <div className="d-flex flex-wrap gap-3 mt-2" style={{ fontSize: "0.75rem" }}>
                    {analiseSituacoesAuto.map((it) => {
                      const checked = filtrosSituacoes.includes(it.categoria);
                      const id = `switch-situacao-${it.categoria.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
                      return (
                        <div key={it.categoria} className="form-check form-switch d-flex align-items-center" style={{ gap: "8px" }}>
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={id}
                            checked={checked}
                            onChange={() => toggleSituacao(it.categoria)}
                            style={{ cursor: "pointer" }}
                          />
                          <label className="form-check-label" htmlFor={id} style={{ cursor: "pointer" }} title={it.categoria}>
                            {resumirSituacao(it.categoria)} <span className="text-muted">({it.qtd})</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Pesquisa avançada posicionada logo abaixo dos switches */}
                <div className="d-flex align-items-center mt-2">
                  <input
                    id="pesquisaAvancadaReceber"
                    type="text"
                    className="form-control form-control-sm"
                    style={{ width: "15rem" }}
                    placeholder="Pesquisa avançada"
                    aria-label="Pesquisa avançada"
                    maxLength={15}
                    value={pesquisaAvancada}
                    onChange={(e) => setPesquisaAvancada(e.target.value.slice(0, 15))}
                  />
                </div>
              </div>
              {erro && <div className="text-danger mb-2">{erro}</div>}
              <div className="table-responsive" style={{ maxHeight: "50vh", overflowY: "auto" }}>
                <table className="table table-sm table-striped table-hover compact-table" style={{ minWidth: "1450px", fontSize: "0.7rem" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>
                    <tr>
                      <th>ID OFX</th>
                      <th>Dt. Trans.</th>
                      <th>Histórico OFX</th>
                      <th>Valor Trans.</th>
                      <th>Banco/Filial</th>
                      <th>Duplicata</th>
                      <th>Prest.</th>
                      <th>Cliente</th>
                      <th>Dt. Emissão</th>
                      <th>Dt. Pag.</th>
                      <th>Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosExibidos.map((r, idx) => (
                      <tr key={idx}>
                        <td>{r.ID_IMPORTACAO_OFX}</td>
                        <td>{formatISODateToBR(r.DATA_TRANSACAO) || r.DATA_TRANSACAO_BR || ""}</td>
                        <td style={{ maxWidth: 300 }}><span title={r.HISTORICO}>{r.HISTORICO}</span></td>
                        <td>{r.VALOR_TRANSACAO}</td>
                        <td>{r.NOME_BANCO_FILIAL}</td>
                        <td>{r.DUPLIC ?? ""}</td>
                        <td>{r.PREST ?? ""}</td>
                        <td>{r.CLIENTE ?? ""}</td>
                        <td>{r.DTEMISSAO ?? ""}</td>
                        <td>{r.DTPAG ?? ""}</td>
                        <td>{r.VPAGO ?? ""}</td>
                      </tr>
                    ))}
                    {resultadosExibidos.length === 0 && !carregando && (
                      <tr>
                        <td colSpan={11} className="text-center text-muted py-3">Nenhum registro encontrado</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Barra de Situações em uma linha, entre lista e botões, sem impactar o rodapé */}
              {analiseSituacoesExibidas.length > 0 && (
                <div
                  className="d-flex align-items-center gap-2"
                  style={{
                    fontSize: "0.75rem",
                    whiteSpace: "nowrap",
                    overflowX: "auto",
                    paddingTop: "4px",
                    marginTop: "4px",
                  }}
                >
                  <div className="d-inline-flex gap-2" style={{ flex: "0 0 auto" }}>
                    {analiseSituacoesExibidas.map((it, idx) => (
                      <span key={idx} className="badge bg-light text-dark border" style={{ fontSize: "0.75rem" }}>
                        {it.categoria}: {it.qtd} • {formatCurrency(it.total)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {/* Botão Conciliar desativado conforme solicitado */}
              <button
                className="btn btn-success btn-sm me-2"
                title="Desativado conforme solicitado"
                disabled
              >
                Conciliar
              </button>
              {/* Novo botão: Concilar Manual */}
              <button
                className="btn btn-warning btn-sm me-2"
                onClick={async () => {
                  setAnaliseLoading(true);
                  try {
                    // A análise já é exibida dinamicamente via analiseSituacoesExibidas (useMemo)
                  } finally {
                    setAnaliseLoading(false);
                  }
                }}
                disabled={analiseLoading || resultadosExibidos.length === 0}
              >
                {analiseLoading ? "Analisando..." : "Concilar Manual"}
              </button>
              {/* Botão Exportar */}
              <button
                className="btn btn-outline-primary btn-sm me-2"
                onClick={() => setExportModalOpen(true)}
                disabled={resultadosExibidos.length === 0}
              >
                Exportar
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
      {mostrarConciliar && (
        <div style={{ position: "fixed", inset: 0 as any, background: "rgba(0,0,0,0.35)", zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ minWidth: "320px", maxWidth: "90vw" }}>
            <div className="card-header">Conciliar</div>
            <div className="card-body" style={{ fontSize: "0.85rem" }}>
              {conciliarMsg && <div className="alert alert-info py-1" style={{ fontSize: "0.8rem" }}>{conciliarMsg}</div>}
              <p className="mb-3">Ao confirmar, cada linha visível será conciliada usando VPAGO e DTPAG.</p>
              <div className="d-flex justify-content-start gap-2 mb-2">
                <button
                  className="btn btn-success btn-sm"
                  disabled={conciliando || resultadosExibidos.length === 0}
                  onClick={async () => {
                    setConciliarMsg("");
                    setConciliando(true);
                    try {
                      let okCount = 0;
                      let failCount = 0;
                      for (const r of resultadosExibidos) {
                        const idOfx = Number(r.ID_IMPORTACAO_OFX);
                        // Seleciona valor: se VPAGO não for vazio e > 0, usa; senão usa VALOR_TRANSACAO
                        const vpagoNum = toNumber(r.VPAGO);
                        const valor = (vpagoNum > 0 ? r.VPAGO : r.VALOR_TRANSACAO) || r.VALOR_TRANSACAO || "";
                        // Seleciona data: se DTPAG válido, usa; senão dataFinal convertida
                        const dt = (r.DTPAG && r.DTPAG.trim().length === 10) ? r.DTPAG : toBR(dataFinal);
                        const data = dt || toBR(dataFinal);
                        const resp = await conciliarAreceber({ idOfx, valor, data });
                        if (resp?.ok) okCount++; else failCount++;
                      }
                      setConciliarMsg(`Conciliação concluída: ${okCount} ok, ${failCount} falhas`);
                      // Recarrega lista
                      await buscar();
                    } catch (e: any) {
                      setConciliarMsg(`Erro: ${String(e?.message || e)}`);
                    } finally {
                      setConciliando(false);
                    }
                  }}
                >
                  {conciliando ? "Conciliando..." : "Confirmar conciliação"}
                </button>
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => setMostrarConciliar(false)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {exportModalOpen && (
        <div style={{ position: "fixed", inset: 0 as any, background: "rgba(0,0,0,0.35)", zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ minWidth: "380px", maxWidth: "90vw" }}>
            <div className="card-header">Exportar Lançamentos (OFX)</div>
            <div className="card-body" style={{ fontSize: "0.85rem" }}>
              <p className="mb-2">Selecione o formato de exportação:</p>
              <div className="d-flex flex-column gap-2 mb-3">
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="exportFormat" id="exportCSV" checked={exportFormat === "csv"} onChange={() => setExportFormat("csv")} />
                  <label className="form-check-label" htmlFor="exportCSV">CSV</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="exportFormat" id="exportXLSX" checked={exportFormat === "xlsx"} onChange={() => setExportFormat("xlsx")} />
                  <label className="form-check-label" htmlFor="exportXLSX">XLSX</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="exportFormat" id="exportPDF" checked={exportFormat === "pdf"} onChange={() => setExportFormat("pdf")} />
                  <label className="form-check-label" htmlFor="exportPDF">PDF</label>
                </div>
              </div>
              <div className="alert alert-secondary py-2" style={{ fontSize: "0.8rem" }}>
                Registros selecionados para exportação: <strong>{resultadosExibidos.length}</strong>
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setExportModalOpen(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleExport}>Exportar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BuscarLancamentosAreceber;