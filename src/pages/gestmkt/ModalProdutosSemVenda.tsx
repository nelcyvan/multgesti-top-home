import React, { useEffect, useState } from "react";
import { buscarProdutosSemVenda, type ProdutoSemVendaRow } from "../../services/gestmkt/ProdutosSemVenda";
import ModalResumoProdutoSemVenda from "./ModalResumoProdutoSemVenda";

interface ModalProdutosSemVendaProps {
  isOpen: boolean;
  onClose: () => void;
  codFilial?: string;
}

const ModalProdutosSemVenda: React.FC<ModalProdutosSemVendaProps> = ({ isOpen, onClose, codFilial }) => {
  const [filialSel, setFilialSel] = useState<string>(codFilial ?? "");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rows, setRows] = useState<ProdutoSemVendaRow[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [categoria, setCategoria] = useState<string>(""); // 1 Geral, 2 Mix, 3 Pisos/Revestimentos
  const [mesCampanha, setMesCampanha] = useState<string>(""); // YYYY-MM
  const [estoqueMinimo, setEstoqueMinimo] = useState<string>("");
  const [modalResumoAberto, setModalResumoAberto] = useState<boolean>(false);
  const [linhaSelecionada, setLinhaSelecionada] = useState<ProdutoSemVendaRow | null>(null);

  const estoqueMinimoValido = estoqueMinimo.trim() !== "" && !Number.isNaN(Number(estoqueMinimo));
  const mesCampanhaValido = mesCampanha.trim() !== "" && /^\d{4}-\d{2}$/.test(mesCampanha);
  const formularioInvalido = !filialSel || !categoria || !estoqueMinimoValido || !mesCampanhaValido;

  useEffect(() => {
    if (!isOpen) return;
    setErro(null);
    setRows([]);
    setBuscou(false);
    try {
      setFilialSel(codFilial ?? "");
    } catch {}
  }, [isOpen, codFilial]);

  const resetCampos = () => {
    try {
      setFilialSel("");
      setCategoria("");
      setMesCampanha("");
      setEstoqueMinimo("");
      setErro(null);
      setRows([]);
      setBuscou(false);
      setLoading(false);
      setModalResumoAberto(false);
      setLinhaSelecionada(null);
    } catch {}
  };

  const handleClose = () => {
    resetCampos();
    onClose();
  };

  const executarBusca = async () => {
    setErro(null);
    setLoading(true);
    setBuscou(false);
    try {
      if (!filialSel) throw new Error("Selecione a Filial");
      if (!categoria) throw new Error("Selecione a Categoria");
      if (!estoqueMinimoValido) throw new Error("Informe um estoque mínimo válido");
      if (!mesCampanhaValido) throw new Error("Informe Mês/Ano válido");
      const [yy, mm] = mesCampanha.split('-');
      const mesData = `01/${mm}/${yy}`; // DD/MM/YYYY
      const res = await buscarProdutosSemVenda({
        codFilial: filialSel,
        tipoProduto: categoria,
        estoqueMinimo,
        mesData,
      });
      setRows(res.rows || []);
      setBuscou(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao buscar produtos";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  const adicionar = (row: ProdutoSemVendaRow) => {
    try {
      setErro(null);
      setLinhaSelecionada(row);
      setModalResumoAberto(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao abrir resumo';
      setErro(msg);
    }
  };

  // Sem pesquisa local: exibe diretamente os resultados da API

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2995, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3000 }}>
        <div className="modal-dialog modal-dialog-centered modal-xl" role="document" style={{ ["--bs-modal-width" as any]: "80vw" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem", minHeight: "70vh" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Produtos sem Venda</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={handleClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ["--input-font-size" as any]: "0.7rem" }}>
              <div className="row g-2 mb-0 align-items-end">
                <div className="col-12 col-md-2">
                  <label htmlFor="psv-filial" className="form-label mb-1">Filial</label>
                  <select
                    id="psv-filial"
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
                {/* Campo de pesquisa removido conforme solicitado */}
                <div className="col-12 col-md-2">
                  <label htmlFor="psv-categoria" className="form-label mb-1">Categoria</label>
                  <select
                    id="psv-categoria"
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
                <div className="col-12 col-md-2">
                  <label htmlFor="psv-mes" className="form-label mb-1">Mês/Ano</label>
                  <input
                    id="psv-mes"
                    type="month"
                    className="form-control form-control-sm"
                    value={mesCampanha}
                    onChange={(e) => setMesCampanha(e.target.value)}
                    style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                    required
                  />
                </div>
                <div className="col-12 col-md-2">
                  <label htmlFor="psv-estoque" className="form-label mb-1">Estoque mín.</label>
                  <input
                    id="psv-estoque"
                    type="number"
                    className="form-control form-control-sm"
                    value={estoqueMinimo}
                    onChange={(e) => setEstoqueMinimo(e.target.value)}
                    style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                    placeholder="Obrigatório"
                    required
                  />
                </div>
                <div className="col-12 col-md-auto">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mt-3 mt-md-0 py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    disabled={loading || formularioInvalido}
                    onClick={executarBusca}
                  >
                    {loading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="text-muted d-flex align-items-center gap-2">
                    <span>Legenda campanha:</span>
                    <span className="badge" style={{ backgroundColor: '#FFA500' }}>PE</span>
                    <span className="badge bg-success">PQ</span>
                    <span className="badge" style={{ backgroundColor: '#800080' }}>PA</span>
                    <span className="badge" style={{ backgroundColor: '#FFD700', color: '#000' }}>PP</span>
                  </small>
                </div>
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
                        <th>Promos</th>
                        <th>Tipo</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr><td colSpan={15}>Carregando...</td></tr>
                      )}
                      {erro && !loading && (
                        <tr><td colSpan={15} className="text-danger">{erro}</td></tr>
                      )}
                      {!loading && !erro && buscou && rows.length === 0 && (
                        <tr><td colSpan={15} className="text-muted">Nenhum produto encontrado</td></tr>
                      )}
                      {!loading && !erro && rows.map((r, idx) => {
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
                        <tr key={`${String(r.CODPROD ?? '')}-${idx}`} style={rowStyle}>
                          <td>{String(r.CODFILIAL ?? '')}</td>
                          <td>{String(r.CODPROD ?? '')}</td>
                          <td>{String(r.CODAUXILIAR ?? '')}</td>
                          <td className="text-truncate" title={String(r.DESCRICAO ?? '')}>{String(r.DESCRICAO ?? '')}</td>
                          <td>{String(r.MARCA ?? '')}</td>
                          <td>{Number(r.DISPONIVEL ?? 0)}</td>
                          <td>{Number(r.BLOQUEADO ?? 0)}</td>
                          <td>{Number(r.AVARIA ?? 0)}</td>
                          <td>{Number(r.ESTOQUE_GERAL ?? 0)}</td>
                          <td>{String(r.DTULTSAIDA ?? '') || 'N/A'}</td>
                          <td>{Number(r.CUSTOULTENT ?? 0).toFixed(2)}</td>
                          <td>{Number(r.PRECO_VENDA ?? 0).toFixed(2)}</td>
                          <td>{Number(r.QTD_PROMOCOES ?? 0)}</td>
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
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={handleClose}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
      {modalResumoAberto && linhaSelecionada && (
        <ModalResumoProdutoSemVenda
          isOpen={modalResumoAberto}
          onClose={() => setModalResumoAberto(false)}
          onSuccess={() => {
            try { executarBusca(); } catch {}
          }}
          row={linhaSelecionada}
        />
      )}
    </>
  );
};

export default ModalProdutosSemVenda;