import React, { useEffect, useState } from "react";
import { buscarProdutosPromocaoAgregado, type ProdutoPromocaoRow } from "../../services/gestmkt/ProdutosPromocao";
import ModalDetalheListaCampanha from "./ModalDetalheListaCampanha";
import { Calendar3, ChevronLeft, ChevronRight, Fire, FlagFill, LightningFill, ListUl, PinAngleFill, Search, TagFill, XLg } from "react-bootstrap-icons";

interface ModalCampanhasAtivasProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModalCampanhasAtivas: React.FC<ModalCampanhasAtivasProps> = ({ isOpen, onClose }) => {
  const [mes, setMes] = useState<string>(''); // formato YYYY-MM
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rowsPQ, setRowsPQ] = useState<ProdutoPromocaoRow[]>([]);
  const [rowsPE, setRowsPE] = useState<ProdutoPromocaoRow[]>([]);
  const [rowsPP, setRowsPP] = useState<ProdutoPromocaoRow[]>([]);
  const [rowsAC, setRowsAC] = useState<ProdutoPromocaoRow[]>([]);
  const [detalheListaAberto, setDetalheListaAberto] = useState<boolean>(false);
  const [detalheListaRows, setDetalheListaRows] = useState<ProdutoPromocaoRow[]>([]);
  const [detalheListaTitulo, setDetalheListaTitulo] = useState<string>("");
  const [descricaoBusca, setDescricaoBusca] = useState<string>("");
  const [descricaoMatches, setDescricaoMatches] = useState<
    Array<{
      listaKey: "PE" | "PQ" | "PP" | "AC";
      listaLabel: string;
      idx: number;
      row: ProdutoPromocaoRow;
    }>
  >([]);
  const [descricaoMatchIndex, setDescricaoMatchIndex] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    // limpa quando abre
    setErro(null);
    setRowsPQ([]); setRowsPE([]); setRowsPP([]); setRowsAC([]);
    setDescricaoBusca("");
    setDescricaoMatches([]);
    setDescricaoMatchIndex(0);
  }, [isOpen]);

  const executarBusca = async () => {
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      setErro("Informe o mês no formato YYYY-MM");
      return;
    }
    setErro(null);
    setLoading(true);
    setDescricaoMatches([]);
    setDescricaoMatchIndex(0);
    try {
      const data = await buscarProdutosPromocaoAgregado(mes);
      setRowsPQ(data.PQ?.rows || []);
      setRowsPE(data.PE?.rows || []);
      setRowsPP(data.PP?.rows || []);
      setRowsAC(data.PA?.rows || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar campanhas (agregado)';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalheLista = (rows: ProdutoPromocaoRow[], titulo: string) => {
    setDetalheListaRows(rows);
    setDetalheListaTitulo(titulo);
    setDetalheListaAberto(true);
  };

  const normalizar = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const renderTextoDestacado = (texto: string, termo: string) => {
    const term = termo.trim();
    if (!term) return texto;
    const partes = texto.split(new RegExp(`(${escapeRegExp(term)})`, "ig"));
    if (partes.length === 1) return texto;
    return (
      <>
        {partes.map((p, i) => {
          if (p.toLowerCase() !== term.toLowerCase()) return <React.Fragment key={i}>{p}</React.Fragment>;
          return (
            <mark key={i} style={{ padding: "0 2px", borderRadius: 3, backgroundColor: "#fd7e14", color: "#111" }}>
              {p}
            </mark>
          );
        })}
      </>
    );
  };

  const buscarPorDescricao = () => {
    const termo = descricaoBusca.trim();
    setDescricaoMatchIndex(0);
    if (!termo) {
      setDescricaoMatches([]);
      return;
    }

    const termoNorm = normalizar(termo);
    const fontes: Array<{ key: "PE" | "PQ" | "PP" | "AC"; label: string; rows: ProdutoPromocaoRow[] }> = [
      { key: "PE", label: "Produtos Encarte", rows: rowsPE },
      { key: "PQ", label: "Produtos Queima", rows: rowsPQ },
      { key: "PP", label: "Produtos Ponta", rows: rowsPP },
      { key: "AC", label: "Produtos Ação", rows: rowsAC },
    ];

    const matches: Array<{ listaKey: "PE" | "PQ" | "PP" | "AC"; listaLabel: string; idx: number; row: ProdutoPromocaoRow }> = [];
    for (const fonte of fontes) {
      for (let i = 0; i < fonte.rows.length; i++) {
        const r = fonte.rows[i];
        const desc = String(r.DESCRICAO ?? "");
        if (!desc) continue;
        if (normalizar(desc).includes(termoNorm)) {
          matches.push({ listaKey: fonte.key, listaLabel: fonte.label, idx: i, row: r });
        }
      }
    }

    setDescricaoMatches(matches);
  };

  const descricaoMatchAtual = descricaoMatches.length > 0 ? descricaoMatches[Math.min(descricaoMatchIndex, descricaoMatches.length - 1)] : null;

  useEffect(() => {
    if (!descricaoMatchAtual) return;
    const id = `${descricaoMatchAtual.listaKey.toLowerCase()}-row-${descricaoMatchAtual.idx}`;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, [descricaoMatchAtual?.listaKey, descricaoMatchAtual?.idx]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop fade show" style={{ zIndex: 2995, backgroundColor: "rgba(0,0,0,0.5)" }} />

      {/* Modal */}
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3000 }}>
        <div className="modal-dialog modal-fullscreen modal-dialog-scrollable" role="document">
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2 d-flex justify-content-between align-items-center">
              <h5 className="modal-title d-flex align-items-center gap-2 mb-0" style={{ fontSize: "0.9rem" }}>
                <FlagFill size={18} className="text-primary" />
                Campanhas Ativas
              </h5>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-circle d-inline-flex align-items-center justify-content-center"
                aria-label="Fechar"
                onClick={onClose}
                style={{ width: 32, height: 32, padding: 0 }}
              >
                <XLg size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ["--input-font-size" as any]: "0.7rem" }}>
              {/* Filtro por mês */}
              <div className="row g-3 mb-3 align-items-end">
                <div className="col-12 col-md-3 col-lg-2">
                  <label htmlFor="mes-campanha" className="form-label mb-1 d-flex align-items-center gap-2">
                    <Calendar3 size={14} className="text-primary" />
                    Mês da promoção
                  </label>
                  <input
                    id="mes-campanha"
                    type="month"
                    className="form-control form-control-sm"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                  />
                </div>
                <div className="col-auto">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={executarBusca}
                    disabled={loading}
                  >
                    <span className="d-inline-flex align-items-center gap-2">
                      <Search size={14} />
                      {loading ? 'Buscando...' : 'Buscar'}
                    </span>
                  </button>
                </div>
                <div className="col-12 col-md-4 col-lg-3 ms-auto" style={{ maxWidth: 420 }}>
                  <label htmlFor="busca-descricao" className="form-label mb-1 d-flex align-items-center gap-2 justify-content-md-end">
                    <Search size={14} className="text-primary" />
                    Busca avançada (descrição)
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      id="busca-descricao"
                      type="text"
                      className="form-control"
                      value={descricaoBusca}
                      onChange={(e) => setDescricaoBusca(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") buscarPorDescricao();
                      }}
                      placeholder="Digite parte da descrição do produto"
                      style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={buscarPorDescricao}
                      disabled={loading}
                      style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    >
                      <span className="d-inline-flex align-items-center gap-2">
                        <Search size={14} />
                        Pesquisar
                      </span>
                    </button>
                  </div>
                </div>
                <div className="col-12">
                  {erro && (
                    <div className="alert alert-danger py-2 mb-0" role="alert" style={{ fontSize: "0.75rem" }}>
                      {erro}
                    </div>
                  )}
                </div>
                {descricaoBusca.trim() && !loading && (
                  <div className="col-12">
                    {rowsPE.length + rowsPQ.length + rowsPP.length + rowsAC.length === 0 ? (
                      <div
                        className="card border-0"
                        style={{ backgroundColor: "#ffedd5", borderLeft: "4px solid #fd7e14" }}
                      >
                        <div className="card-body py-2">
                          <div className="fw-semibold">Busca avançada</div>
                          <div className="text-muted">Carregue o mês e clique em Buscar para pesquisar por descrição.</div>
                        </div>
                      </div>
                    ) : descricaoMatches.length === 0 ? (
                      <div
                        className="card border-0"
                        style={{ backgroundColor: "#ffedd5", borderLeft: "4px solid #fd7e14" }}
                      >
                        <div className="card-body py-2">
                          <div className="fw-semibold">Não encontrado</div>
                          <div className="text-muted">
                            Nenhum item contém: <span className="fw-semibold">{descricaoBusca.trim()}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="card border-0"
                        style={{ backgroundColor: "#ffedd5", borderLeft: "4px solid #fd7e14" }}
                      >
                        <div className="card-body py-2 d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                          <div className="lh-sm">
                            <div className="fw-semibold">
                              Encontrado em {descricaoMatchAtual?.listaLabel} ({descricaoMatchIndex + 1}/{descricaoMatches.length})
                            </div>
                          </div>
                          <div className="d-flex gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary py-1 px-2"
                              onClick={() => setDescricaoMatchIndex((i) => Math.max(0, i - 1))}
                              disabled={descricaoMatchIndex <= 0}
                              style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                            >
                              <span className="d-inline-flex align-items-center gap-2">
                                <ChevronLeft size={14} />
                                Anterior
                              </span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary py-1 px-2"
                              onClick={() => setDescricaoMatchIndex((i) => Math.min(descricaoMatches.length - 1, i + 1))}
                              disabled={descricaoMatchIndex >= descricaoMatches.length - 1}
                              style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                            >
                              <span className="d-inline-flex align-items-center gap-2">
                                Próximo
                                <ChevronRight size={14} />
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="row g-3">
                {/* Produtos Encarte */}
                <div className="col-12 col-md-6">
                  <div className="card border-0 bg-light h-100">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2">
                            <span
                              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-dark-subtle text-dark flex-shrink-0"
                              style={{ width: 28, height: 28 }}
                            >
                              <TagFill size={14} />
                            </span>
                            <div className="lh-sm">
                              <div className="fw-semibold">Produtos Encarte</div>
                              <small className="text-muted">{rowsPE.length} itens</small>
                            </div>
                        </div>
                        <div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary py-1 px-2"
                            style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                            onClick={() => abrirDetalheLista(rowsPE, "Produtos Encarte")}
                            disabled={loading || rowsPE.length === 0}
                          >
                              <span className="d-inline-flex align-items-center gap-2">
                                <ListUl size={14} />
                                Detalhar
                              </span>
                          </button>
                        </div>
                      </div>
                      <div className="table-responsive" style={{ flex: 1, maxHeight: 210, overflowY: "auto" }}>
                        <table className="table table-sm" style={{ fontSize: "0.7rem" }}>
                          <thead>
                            <tr>
                              <th style={{ width: 70 }}>Filial</th>
                              <th style={{ width: 90 }}>Produto</th>
                              <th style={{ width: 100 }}>Auxiliar</th>
                              <th style={{ width: 220 }}>Descrição</th>
                              <th style={{ width: 140 }}>Marca</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loading && (
                              <tr><td colSpan={5}>Carregando...</td></tr>
                            )}
                            {erro && !loading && (
                              <tr><td colSpan={5} className="text-danger">{erro}</td></tr>
                            )}
                            {!loading && !erro && rowsPE.length === 0 && (
                              <tr><td colSpan={5} className="text-muted">Nenhum produto</td></tr>
                            )}
                            {!loading && !erro && rowsPE.map((r, idx) => (
                              <tr
                                key={`pe-${r.CODPROD}-${idx}`}
                                id={`pe-row-${idx}`}
                                className={
                                  descricaoMatchAtual?.listaKey === "PE" && descricaoMatchAtual.idx === idx ? "table-warning" : undefined
                                }
                              >
                                <td>{String(r.CODFILIAL ?? '')}</td>
                                <td>{String(r.CODPROD ?? '')}</td>
                                <td>{String(r.CODAUXILIAR ?? '')}</td>
                                <td className="text-truncate" title={String(r.DESCRICAO ?? '')}>
                                  {descricaoMatchAtual?.listaKey === "PE" && descricaoMatchAtual.idx === idx
                                    ? renderTextoDestacado(String(r.DESCRICAO ?? ''), descricaoBusca)
                                    : String(r.DESCRICAO ?? '')}
                                </td>
                                <td>{String(r.MARCA ?? '')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Produtos Queima */}
                <div className="col-12 col-md-6">
                  <div className="card border-0 bg-light h-100">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2">
                            <span
                              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger flex-shrink-0"
                              style={{ width: 28, height: 28 }}
                            >
                              <Fire size={14} />
                            </span>
                            <div className="lh-sm">
                              <div className="fw-semibold">Produtos Queima</div>
                              <small className="text-muted">{rowsPQ.length} itens</small>
                            </div>
                        </div>
                        <div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary py-1 px-2"
                            style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                            onClick={() => abrirDetalheLista(rowsPQ, "Produtos Queima")}
                            disabled={loading || rowsPQ.length === 0}
                          >
                              <span className="d-inline-flex align-items-center gap-2">
                                <ListUl size={14} />
                                Detalhar
                              </span>
                          </button>
                        </div>
                      </div>
                      <div className="table-responsive" style={{ flex: 1, maxHeight: 210, overflowY: "auto" }}>
                        <table className="table table-sm" style={{ fontSize: "0.7rem" }}>
                          <thead>
                            <tr>
                              <th style={{ width: 70 }}>Filial</th>
                              <th style={{ width: 90 }}>Produto</th>
                              <th style={{ width: 100 }}>Auxiliar</th>
                              <th style={{ width: 220 }}>Descrição</th>
                              <th style={{ width: 140 }}>Marca</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loading && (
                              <tr><td colSpan={5}>Carregando...</td></tr>
                            )}
                            {erro && !loading && (
                              <tr><td colSpan={5} className="text-danger">{erro}</td></tr>
                            )}
                            {!loading && !erro && rowsPQ.length === 0 && (
                              <tr><td colSpan={5} className="text-muted">Nenhum produto</td></tr>
                            )}
                            {!loading && !erro && rowsPQ.map((r, idx) => (
                              <tr
                                key={`pq-${r.CODPROD}-${idx}`}
                                id={`pq-row-${idx}`}
                                className={
                                  descricaoMatchAtual?.listaKey === "PQ" && descricaoMatchAtual.idx === idx ? "table-warning" : undefined
                                }
                              >
                                <td>{String(r.CODFILIAL ?? '')}</td>
                                <td>{String(r.CODPROD ?? '')}</td>
                                <td>{String(r.CODAUXILIAR ?? '')}</td>
                                <td className="text-truncate" title={String(r.DESCRICAO ?? '')}>
                                  {descricaoMatchAtual?.listaKey === "PQ" && descricaoMatchAtual.idx === idx
                                    ? renderTextoDestacado(String(r.DESCRICAO ?? ''), descricaoBusca)
                                    : String(r.DESCRICAO ?? '')}
                                </td>
                                <td>{String(r.MARCA ?? '')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Produtos Ponta */}
                <div className="col-12 col-md-6">
                  <div className="card border-0 bg-light h-100">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2">
                            <span
                              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning-subtle text-warning flex-shrink-0"
                              style={{ width: 28, height: 28 }}
                            >
                              <PinAngleFill size={14} />
                            </span>
                            <div className="lh-sm">
                              <div className="fw-semibold">Produtos Ponta</div>
                              <small className="text-muted">{rowsPP.length} itens</small>
                            </div>
                        </div>
                        <div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary py-1 px-2"
                            style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                            onClick={() => abrirDetalheLista(rowsPP, "Produtos Ponta")}
                            disabled={loading || rowsPP.length === 0}
                          >
                              <span className="d-inline-flex align-items-center gap-2">
                                <ListUl size={14} />
                                Detalhar
                              </span>
                          </button>
                        </div>
                      </div>
                      <div className="table-responsive" style={{ flex: 1, maxHeight: 210, overflowY: "auto" }}>
                        <table className="table table-sm" style={{ fontSize: "0.7rem" }}>
                          <thead>
                            <tr>
                              <th style={{ width: 70 }}>Filial</th>
                              <th style={{ width: 90 }}>Produto</th>
                              <th style={{ width: 100 }}>Auxiliar</th>
                              <th style={{ width: 220 }}>Descrição</th>
                              <th style={{ width: 140 }}>Marca</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loading && (
                              <tr><td colSpan={5}>Carregando...</td></tr>
                            )}
                            {erro && !loading && (
                              <tr><td colSpan={5} className="text-danger">{erro}</td></tr>
                            )}
                            {!loading && !erro && rowsPP.length === 0 && (
                              <tr><td colSpan={5} className="text-muted">Nenhum produto</td></tr>
                            )}
                            {!loading && !erro && rowsPP.map((r, idx) => (
                              <tr
                                key={`pp-${r.CODPROD}-${idx}`}
                                id={`pp-row-${idx}`}
                                className={
                                  descricaoMatchAtual?.listaKey === "PP" && descricaoMatchAtual.idx === idx ? "table-warning" : undefined
                                }
                              >
                                <td>{String(r.CODFILIAL ?? '')}</td>
                                <td>{String(r.CODPROD ?? '')}</td>
                                <td>{String(r.CODAUXILIAR ?? '')}</td>
                                <td className="text-truncate" title={String(r.DESCRICAO ?? '')}>
                                  {descricaoMatchAtual?.listaKey === "PP" && descricaoMatchAtual.idx === idx
                                    ? renderTextoDestacado(String(r.DESCRICAO ?? ''), descricaoBusca)
                                    : String(r.DESCRICAO ?? '')}
                                </td>
                                <td>{String(r.MARCA ?? '')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Produtos Ação */}
                <div className="col-12 col-md-6">
                  <div className="card border-0 bg-light h-100">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2">
                            <span
                              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success flex-shrink-0"
                              style={{ width: 28, height: 28 }}
                            >
                              <LightningFill size={14} />
                            </span>
                            <div className="lh-sm">
                              <div className="fw-semibold">Produtos Ação</div>
                              <small className="text-muted">{rowsAC.length} itens</small>
                            </div>
                        </div>
                        <div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary py-1 px-2"
                            style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                            onClick={() => abrirDetalheLista(rowsAC, "Produtos Ação")}
                            disabled={loading || rowsAC.length === 0}
                          >
                              <span className="d-inline-flex align-items-center gap-2">
                                <ListUl size={14} />
                                Detalhar
                              </span>
                          </button>
                        </div>
                      </div>
                      <div className="table-responsive" style={{ flex: 1, maxHeight: 210, overflowY: "auto" }}>
                        <table className="table table-sm" style={{ fontSize: "0.7rem" }}>
                          <thead>
                            <tr>
                              <th style={{ width: 70 }}>Filial</th>
                              <th style={{ width: 90 }}>Produto</th>
                              <th style={{ width: 100 }}>Auxiliar</th>
                              <th style={{ width: 220 }}>Descrição</th>
                              <th style={{ width: 140 }}>Marca</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loading && (
                              <tr><td colSpan={5}>Carregando...</td></tr>
                            )}
                            {erro && !loading && (
                              <tr><td colSpan={5} className="text-danger">{erro}</td></tr>
                            )}
                            {!loading && !erro && rowsAC.length === 0 && (
                              <tr><td colSpan={5} className="text-muted">Nenhum produto</td></tr>
                            )}
                            {!loading && !erro && rowsAC.map((r, idx) => (
                              <tr
                                key={`ac-${r.CODPROD}-${idx}`}
                                id={`ac-row-${idx}`}
                                className={
                                  descricaoMatchAtual?.listaKey === "AC" && descricaoMatchAtual.idx === idx ? "table-warning" : undefined
                                }
                              >
                                <td>{String(r.CODFILIAL ?? '')}</td>
                                <td>{String(r.CODPROD ?? '')}</td>
                                <td>{String(r.CODAUXILIAR ?? '')}</td>
                                <td className="text-truncate" title={String(r.DESCRICAO ?? '')}>
                                  {descricaoMatchAtual?.listaKey === "AC" && descricaoMatchAtual.idx === idx
                                    ? renderTextoDestacado(String(r.DESCRICAO ?? ''), descricaoBusca)
                                    : String(r.DESCRICAO ?? '')}
                                </td>
                                <td>{String(r.MARCA ?? '')}</td>
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
        </div>
      </div>
      {detalheListaAberto && (
        <ModalDetalheListaCampanha
          isOpen={detalheListaAberto}
          onClose={async () => {
            // Fecha o modal de detalhe
            setDetalheListaAberto(false);
            // Recarrega os dados agregados do mês selecionado
            try {
              const agg = await buscarProdutosPromocaoAgregado(mes);
              setRowsPE(agg.PE?.rows ?? []);
              setRowsPQ(agg.PQ?.rows ?? []);
              setRowsPP(agg.PP?.rows ?? []);
              setRowsAC(agg.PA?.rows ?? []);
            } catch (err) {
              console.error('Falha ao recarregar campanhas ao fechar detalhe:', err);
            }
          }}
          rows={detalheListaRows}
          titulo={detalheListaTitulo}
        />
      )}
    </>
  );
};

export default ModalCampanhasAtivas;
