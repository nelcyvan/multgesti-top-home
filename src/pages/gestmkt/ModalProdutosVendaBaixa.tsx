import React, { useEffect, useMemo, useState } from "react";
import { buscarProdutosVendaBaixa, type ProdutoVendaBaixaRow } from "../../services/gestmkt/ProdutosVendaBaixa";
import ModalResumoProdutoVendaBaixa from "./ModalResumoProdutoVendaBaixa";

interface ModalProdutosVendaBaixaProps {
  isOpen: boolean;
  onClose: () => void;
  codFilial?: string;
}

const ModalProdutosVendaBaixa: React.FC<ModalProdutosVendaBaixaProps> = ({ isOpen, onClose, codFilial }) => {
  const [dataInicio, setDataInicio] = useState<string>(""); // YYYY-MM-DD
  const [dataFim, setDataFim] = useState<string>(""); // YYYY-MM-DD
  const [mesAno, setMesAno] = useState<string>(""); // YYYY-MM
  const [filialSel, setFilialSel] = useState<string>(codFilial ?? "");
  const [estoqueMinimo, setEstoqueMinimo] = useState<string>("");
  const [vendasMax, setVendasMax] = useState<string>("");
  const [categoria, setCategoria] = useState<string>(""); // 1 Geral, 2 Mix, 3 Pisos e Revestimentos
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rows, setRows] = useState<ProdutoVendaBaixaRow[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [sucesso, setSucesso] = useState<string>("");
  const [salvando, setSalvando] = useState<boolean>(false);
  const [modalResumoAberto, setModalResumoAberto] = useState<boolean>(false);
  const [linhaSelecionada, setLinhaSelecionada] = useState<ProdutoVendaBaixaRow | null>(null);
  const [mostrarFiltroAvancado, setMostrarFiltroAvancado] = useState<boolean>(false);
  const [filtroCampanha, setFiltroCampanha] = useState<string>(""); // '', 'PE','PQ','PA','PP'
  const [somenteVendidosZero, setSomenteVendidosZero] = useState<boolean>(false);
  const [pesquisaAvancada, setPesquisaAvancada] = useState<string>("");

  const filteredRows = useMemo(() => {
    const q = pesquisaAvancada.trim().toLowerCase();
    return rows.filter((r) => {
      const tipoRaw = (r as any)?.TIPO_CAMPANHA ?? (r as any)?.TIPOCAMPANHA ?? '';
      const tipo = String(tipoRaw || '').trim().toUpperCase();
      if (filtroCampanha && tipo !== filtroCampanha) return false;
      if (somenteVendidosZero && Number(r.VENDA_TOTAL ?? 0) !== 0) return false;
      if (q) {
        const haystacks = [
          String(r.CODPROD ?? ''),
          String(r.CODAUXILIAR ?? ''),
          String(r.DESCRICAO ?? ''),
          String(r.MARCA ?? ''),
        ].map((s) => s.toLowerCase());
        if (!haystacks.some((h) => h.includes(q))) return false;
      }
      return true;
    });
  }, [rows, filtroCampanha, somenteVendidosZero, pesquisaAvancada]);

  useEffect(() => {
    if (!isOpen) return;
    setErro(null);
    setSucesso("");
    setRows([]);
    setBuscou(false);
    // Mantém campos em branco ao abrir o modal
    try {
      setDataInicio("");
      setDataFim("");
      setMesAno("");
      setEstoqueMinimo("");
      setVendasMax("");
      setCategoria("");
    } catch {}
  }, [isOpen]);

  const resetCampos = () => {
    try {
      setDataInicio("");
      setDataFim("");
      setMesAno("");
      setFilialSel("");
      setEstoqueMinimo("");
      setVendasMax("");
      setCategoria("");
      setErro(null);
      setSucesso("");
      setRows([]);
      setBuscou(false);
      setLoading(false);
      setSalvando(false);
      setModalResumoAberto(false);
      setLinhaSelecionada(null);
      setMostrarFiltroAvancado(false);
      setFiltroCampanha("");
      setSomenteVendidosZero(false);
      setPesquisaAvancada("");
    } catch {}
  };

  const handleClose = () => {
    resetCampos();
    onClose();
  };

  const executarBusca = async () => {
    if (!['1','2','3','4'].includes(String(filialSel))) {
      setErro("Selecione uma Filial");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
      setErro("Datas devem estar no formato YYYY-MM-DD");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(mesAno)) {
      setErro("Selecione Mês/Ano no formato YYYY-MM");
      return;
    }
    if (vendasMax.trim() === '' || isNaN(parseFloat(vendasMax))) {
      setErro("Informe 'Vendas máx.' como número");
      return;
    }
    if (estoqueMinimo.trim() === '' || isNaN(parseFloat(estoqueMinimo))) {
      setErro("Informe 'Estoque mínimo' como número");
      return;
    }
    if (!['1','2','3'].includes(categoria)) {
      setErro("Selecione uma Categoria");
      return;
    }
    setErro(null);
    setSucesso("");
    setLoading(true);
    try {
      const mesData = `${mesAno}-01`; // YYYY-MM-01
      const data = await buscarProdutosVendaBaixa({
        dataInicio,
        dataFim,
        codFilial: String(filialSel),
        estoqueMinimo,
        vendasMax,
        categoria,
        mesData,
      });
      setRows(data.rows || []);
      setBuscou(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar produtos com venda baixa';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    try {
      setErro(null);
      setSucesso("");
      setSalvando(true);
      // Simula ação de salvar preferências/filtros; substituir conforme necessidade
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSucesso("Preferências salvas com sucesso.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao salvar';
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  };

  const totalItens = rows.length;
  const vendidosZero = useMemo(() => rows.filter(r => Number(r.VENDA_TOTAL || 0) === 0).length, [rows]);

  const adicionar = (row: ProdutoVendaBaixaRow) => {
    try {
      setErro(null);
      setSucesso("");
      setLinhaSelecionada(row);
      setModalResumoAberto(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao abrir resumo';
      setErro(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2995, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3000 }}>
        <div className="modal-dialog modal-dialog-centered modal-xl" role="document" style={{ ["--bs-modal-width" as any]: "80vw" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem", minHeight: "70vh" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Produtos com venda Baixa</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={handleClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ["--input-font-size" as any]: "0.7rem" }}>
              <div className="row g-2 mb-0 align-items-end">
              <div className="col-12 col-md-1">
                <label htmlFor="pvb-filial" className="form-label mb-1">Filial</label>
                <select
                  id="pvb-filial"
                  className="form-select form-select-sm"
                  value={filialSel}
                  onChange={(e) => setFilialSel(e.target.value)}
                  style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                  required
                >
                  <option value="">Selecione</option>
                  <option value="1">Messejana</option>
                  <option value="2">Horizonte</option>
                  <option value="3">CD</option>
                  <option value="4">Santa Maria</option>
                </select>
              </div>
              <div className="col-12 col-md-1">
                <label htmlFor="pvb-inicio" className="form-label mb-1">Data início</label>
                <input
                  id="pvb-inicio"
                  type="date"
                  className="form-control form-control-sm"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                  required
                />
              </div>
              <div className="col-12 col-md-1">
                <label htmlFor="pvb-fim" className="form-label mb-1">Data fim</label>
                <input
                  id="pvb-fim"
                  type="date"
                  className="form-control form-control-sm"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                  required
                />
              </div>
              <div className="col-12 col-md-1">
                <label htmlFor="pvb-estoque" className="form-label mb-1">Estoque mínimo</label>
                <input
                  id="pvb-estoque"
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="Obrigatório"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(e.target.value)}
                  style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                  required
                />
              </div>
              <div className="col-12 col-md-1">
                <label htmlFor="pvb-vendas" className="form-label mb-1">Vendas máx.</label>
                <input
                  id="pvb-vendas"
                  type="number"
                  className="form-control form-control-sm"
                  value={vendasMax}
                  onChange={(e) => setVendasMax(e.target.value)}
                  style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                  placeholder="Obrigatório"
                  required
                />
              </div>
              <div className="col-12 col-md-1-5">
                <label htmlFor="pvb-categoria" className="form-label mb-1">Categoria</label>
                <select
                  id="pvb-categoria"
                  className="form-select form-select-sm"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                  required
                >
                  <option value="">Selecione</option>
                  <option value="1">Geral</option>
                  <option value="2">Mix</option>
                  <option value="3">Pisos e Revestimentos</option>
                </select>
              </div>
              <div className="col-12 col-md-1-5">
                <label htmlFor="pvb-mesano" className="form-label mb-1">Mês/Ano Campanha</label>
                <input
                  id="pvb-mesano"
                  type="month"
                  className="form-control form-control-sm"
                  value={mesAno}
                  onChange={(e) => setMesAno(e.target.value)}
                  style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                  required
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
                    {loading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                <div className="col-auto ms-auto d-flex align-items-end gap-2 position-relative">
                  <input
                    id="pvb-pesquisa-avancada"
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Pesquisa avançada"
                    value={pesquisaAvancada}
                    onChange={(e) => setPesquisaAvancada(e.target.value)}
                    style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                  />
                  <div>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-1 px-2"
                      style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                      onClick={() => setMostrarFiltroAvancado(v => !v)}
                    >
                      Filtrar
                    </button>
                    {mostrarFiltroAvancado && (
                      <div className="card shadow-sm position-absolute" style={{ right: 0, top: '110%', minWidth: 220, zIndex: 3010 }}>
                        <div className="card-body p-2" style={{ fontSize: '0.7rem' }}>
                          <div className="mb-2">
                            <label className="form-label mb-1">Campanha</label>
                            <select
                              className="form-select form-select-sm"
                              value={filtroCampanha}
                              onChange={(e) => setFiltroCampanha(e.target.value)}
                              style={{ height: '28px' }}
                            >
                              <option value="">Todas</option>
                              <option value="PE">PE</option>
                              <option value="PQ">PQ</option>
                              <option value="PA">PA</option>
                              <option value="PP">PP</option>
                            </select>
                          </div>
                          <div className="form-check mb-2">
                            <input
                              id="filtro-vendidos-zero"
                              className="form-check-input"
                              type="checkbox"
                              checked={somenteVendidosZero}
                              onChange={(e) => setSomenteVendidosZero(e.target.checked)}
                            />
                            <label htmlFor="filtro-vendidos-zero" className="form-check-label">Somente vendidos = 0</label>
                          </div>
                          <div className="d-flex justify-content-end gap-2">
                            <button type="button" className="btn btn-sm btn-light" onClick={() => { setFiltroCampanha(''); setSomenteVendidosZero(false); }}>Limpar</button>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMostrarFiltroAvancado(false)}>Fechar</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-12">
                  {erro && (
                    <div className="alert alert-danger py-2 mb-2" role="alert" style={{ fontSize: "0.75rem" }}>
                      {erro}
                    </div>
                  )}
                  {sucesso && (
                    <div className="alert alert-success py-2 mb-0" role="alert" style={{ fontSize: "0.75rem" }}>
                      {sucesso}
                    </div>
                  )}
                </div>
              </div>

              <div className="row g-3">
                <div className="col-12">
                  <div className="card border-0">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted d-flex align-items-center gap-2">
                          <span>Legenda campanha:</span>
                          <span className="badge" style={{ backgroundColor: '#FFA500' }}>PE</span>
                          <span className="badge bg-success">PQ</span>
                          <span className="badge" style={{ backgroundColor: '#800080' }}>PA</span>
                          <span className="badge" style={{ backgroundColor: '#FFD700', color: '#000' }}>PP</span>
                        </small>
                      </div>
                      {/* Resumo movido para o rodapé do modal */}
                      <div className="table-responsive" style={{ maxHeight: 420, overflowY: "auto" }}>
                        <table className="table table-sm mb-0 table-sticky" style={{ fontSize: "0.7rem" }}>
                          <thead>
                            <tr>
                              <th>Filial</th>
                              <th>Código</th>
                              <th>Cód.Barras</th>
                              <th>Descrição</th>
                              <th>Marca</th>
                              <th>Disp.</th>
                              <th>Bloq.</th>
                              <th>Avar.</th>
                              <th>Geral</th>
                              <th>Últ.Saída</th>
                              <th>Custo</th>
                              <th>PVenda</th>
                              <th>Qt.Saída</th>
                              <th>Campanha</th>
                              <th>Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {loading && (
                              <tr><td colSpan={14}>Carregando...</td></tr>
                            )}
                            {erro && !loading && (
                              <tr><td colSpan={14} className="text-danger">{erro}</td></tr>
                            )}
                            {!loading && !erro && buscou && rows.length === 0 && (
                              <tr><td colSpan={14} className="text-muted">Nenhum produto encontrado</td></tr>
                            )}
                            {!loading && !erro && filteredRows.map((r, idx) => {
                                const tipoRaw = (r as any)?.TIPO_CAMPANHA ?? (r as any)?.TIPOCAMPANHA ?? '';
                                const tipo = String(tipoRaw || '').trim().toUpperCase();
                              let rowStyle: React.CSSProperties | undefined = undefined;
                              let borderColor: string | undefined = undefined;
                              if (tipo === 'PE') { rowStyle = { backgroundColor: '#FFE5B4' }; borderColor = '#FFA500'; }
                              else if (tipo === 'PQ') { rowStyle = { backgroundColor: '#CFF7CF' }; borderColor = '#28a745'; }
                              else if (tipo === 'PA') { rowStyle = { backgroundColor: '#E6D8F5' }; borderColor = '#800080'; }
                              else if (tipo === 'PP') { rowStyle = { backgroundColor: '#FFF2A8' }; borderColor = '#FFD700'; }
                              if (rowStyle && borderColor) {
                                rowStyle = { ...rowStyle, borderLeft: `4px solid ${borderColor}` };
                              }
                              return (
                                <tr key={`pvb-${r.CODPROD}-${idx}`} style={rowStyle}>
                                  <td>{String(r.CODFILIAL ?? '')}</td>
                                  <td>{String(r.CODPROD ?? '')}</td>
                                  <td>{String(r.CODAUXILIAR ?? '')}</td>
                                  <td className="text-truncate" title={String(r.DESCRICAO ?? '')}>{String(r.DESCRICAO ?? '')}</td>
                                  <td>{String(r.MARCA ?? '')}</td>
                                  <td>{Number(r.DISPONIVEL ?? 0)}</td>
                                  <td>{Number(r.BLOQUEADO ?? 0)}</td>
                                  <td>{Number(r.AVARIA ?? 0)}</td>
                                  <td>{Number(r.ESTOQUE_GERAL ?? 0)}</td>
                                  <td>{(String(r.NOVA_DTULTSAIDA ?? '').trim() || 'N/A')}</td>
                                  <td>{Number(r.CUSTOULTENT ?? 0).toFixed(2)}</td>
                                  <td>{Number(r.PVENDA ?? 0).toFixed(2)}</td>
                                  <td>{Number(r.VENDA_TOTAL ?? 0)}</td>
                                  <td>
                                    {tipo ? (
                                      <span className="badge" style={{ backgroundColor: tipo === 'PE' ? '#FFA500' : tipo === 'PQ' ? '#28a745' : tipo === 'PA' ? '#800080' : tipo === 'PP' ? '#FFD700' : '#6c757d', color: tipo === 'PP' ? '#000' : '#fff' }}>{tipo}</span>
                                    ) : (
                                      <span className="text-muted">—</span>
                                    )}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm py-0 px-2"
                                      style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                                      onClick={() => adicionar(r)}
                                    >
                                      Adicionar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <div className="d-flex w-100 justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-secondary">Itens: {totalItens}</span>
                  <span className="badge bg-warning text-dark">Vendidos = 0: {vendidosZero}</span>
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={handleClose}
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    disabled={salvando}
                    onClick={salvar}
                  >
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {modalResumoAberto && linhaSelecionada && (
        <ModalResumoProdutoVendaBaixa
          isOpen={modalResumoAberto}
          onClose={() => setModalResumoAberto(false)}
          onSuccess={() => {
            // Recarrega a lista ao fechar com sucesso
            try {
              executarBusca();
            } catch {}
          }}
          row={linhaSelecionada}
        />
      )}
    </>
  );
};

export default ModalProdutosVendaBaixa;