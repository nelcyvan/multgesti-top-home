import React, { useEffect, useState } from "react";
import ModalHistoricoProduto from "./ModalHistoricoProduto";
import ModalBuscaAvancadaDescricao from "./ModalBuscaAvancadaDescricao";
import type { ProdutoVendaBaixaRow } from "../../services/gestmkt/ProdutosVendaBaixa";
import { registrarPromocao } from "../../services/gestmkt/RegistrarPromocao";
import { buscarProdutoPorQuery } from "../../services/gestmkt/BuscarProduto";

interface ModalAdicionarProdutoManualProps {
  isOpen: boolean;
  onClose: () => void;
  codFilial?: string;
  onSuccess?: (novoId?: number, produto?: ProdutoVendaBaixaRow) => void;
  initialTipoCampanha?: string;
  prefillRow?: ProdutoVendaBaixaRow | null;
  resumoAnterior?: {
    precoFixo: string | null;
    dataInicio: string | null;
    dataFim: string | null;
  };
}

// Utilitários de formatação iguais ao ModalPrecificar
const toNumber = (val: unknown): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const s = String(val).trim();
  if (!s) return null;
  const normalized = s.replace(/,/g, '.');
  const n = Number(normalized);
  return isNaN(n) ? null : n;
};

const formatEstoque = (val: unknown): string => {
  const n = toNumber(val);
  if (n === null) {
    const s = String(val ?? '').trim();
    return s || '-';
  }
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const estoqueClass = (val: unknown): string => {
  const n = toNumber(val);
  if (n === null) return 'text-muted';
  return n <= 0 ? 'text-danger' : 'text-success';
};

const formatDisponivel = (val: unknown): string => {
  const n = toNumber(val);
  const v = n === null ? 0 : n;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const estoqueClassDisponivel = (val: unknown): string => {
  const n = toNumber(val);
  const v = n === null ? 0 : n;
  return v <= 0 ? 'text-danger' : 'text-success';
};

const nomeFilial = (cod: string | number | undefined): string => {
  const c = String(cod ?? '').trim();
  switch (c) {
    case '1': return 'Messejana';
    case '2': return 'Horizonte';
    case '4': return 'Santa Maria';
    case '3': return 'CD';
    default: return '';
  }
};

const ModalAdicionarProdutoManual: React.FC<ModalAdicionarProdutoManualProps> = ({ isOpen, onClose, codFilial, onSuccess, initialTipoCampanha, prefillRow, resumoAnterior }) => {
  const [mesDataPromocao, setMesDataPromocao] = useState<string>(""); // YYYY-MM
  const [dtAdd, setDtAdd] = useState<string>(""); // DD/MM/YYYY
  const [tipoCampanha, setTipoCampanha] = useState<string>("Selecione");
  const [codFilialSel, setCodFilialSel] = useState<string>(String(codFilial || ""));
  const [erro, setErro] = useState<string>("");

  const [query, setQuery] = useState<string>("");
  const [loadingBusca, setLoadingBusca] = useState<boolean>(false);
  const [row, setRow] = useState<ProdutoVendaBaixaRow | null>(null);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState<boolean>(false);
  const [modalBuscaAvancadaAberto, setModalBuscaAvancadaAberto] = useState<boolean>(false);

  const resetState = () => {
    try {
      setMesDataPromocao("");
      setDtAdd("");
      setTipoCampanha("Selecione");
      setCodFilialSel("");
      setErro("");
      setQuery("");
      setLoadingBusca(false);
      setRow(null);
    } catch {}
  };

  useEffect(() => {
    if (!isOpen) return;
    try {
      const hoje = new Date();
      const dd = String(hoje.getDate()).padStart(2, '0');
      const mm = String(hoje.getMonth() + 1).padStart(2, '0');
      const yyyy = String(hoje.getFullYear());
      setDtAdd(`${dd}/${mm}/${yyyy}`);
      setErro("");
      setRow(prefillRow ?? null);
      setQuery(prefillRow ? String(prefillRow.DESCRICAO ?? "") : "");
      setTipoCampanha(initialTipoCampanha ? String(initialTipoCampanha) : "Selecione");
      setCodFilialSel(String((prefillRow?.CODFILIAL ?? codFilial) || ""));
    } catch {}
  }, [isOpen, codFilial]);

  // Quando fechar (isOpen false), reseta tudo
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetState();
    try { onClose(); } catch {}
  };

  if (!isOpen) return null;

  const executarBusca = async () => {
    const q = query.trim();
    if (!q) {
      setErro("Informe um código/auxiliar/descrição para buscar o produto");
      return;
    }
    if (!['1','2','4'].includes(String(codFilialSel || ''))) {
      setErro("Selecione a Filial para a busca");
      return;
    }
    setErro("");
    setLoadingBusca(true);
    try {
      const found = await buscarProdutoPorQuery({ q, codFilial: codFilialSel });
      if (!found) {
        setRow(null);
        setErro("Produto não encontrado");
      } else {
        setRow(found);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha na busca do produto';
      setErro(msg);
    } finally {
      setLoadingBusca(false);
    }
  };

  const confirmar = () => {
    setErro("");
    if (!mesDataPromocao || !/^\d{4}-\d{2}$/.test(mesDataPromocao)) {
      setErro("Informe o Mês/Ano da Campanha");
      return;
    }
    if (!dtAdd || !/^\d{2}\/\d{2}\/\d{4}$/.test(dtAdd)) {
      setErro("Data de add inválida");
      return;
    }
    if (!tipoCampanha || tipoCampanha === "Selecione") {
      setErro("Selecione o Tipo de Campanha");
      return;
    }
    if (!codFilialSel) {
      setErro("Selecione a Filial");
      return;
    }
    if (!row || !row.CODPROD) {
      setErro("Busque e selecione um produto válido");
      return;
    }

    const [y, m] = mesDataPromocao.split('-');
    const mesDataPromocaoFinal = `01/${m}/${y}`; // dia/mes/yyyy
    const usuarioLogadoRaw = localStorage.getItem("usuarioLogado");
    let matricula = 0;
    try {
      if (usuarioLogadoRaw) {
        const u = JSON.parse(usuarioLogadoRaw || '{}');
        const mStr = String(u?.matricula ?? '').trim();
        if (mStr && !isNaN(Number(mStr))) {
          matricula = Number(mStr);
        }
      }
    } catch {}
    if (!matricula) {
      setErro("Não foi possível obter a matrícula do usuário (CODUSUR_ADD)");
      return;
    }

    const payload = {
      codFilial: String(codFilialSel),
      codProd: Number(row.CODPROD || 0),
      tipoCampanha: String(tipoCampanha),
      mesDataPromocao: mesDataPromocaoFinal, // DD/MM/YYYY (01/MM/YYYY)
      codUsurAdd: matricula,
    };

    registrarPromocao(payload)
      .then((resp) => {
        if (resp.exists) {
          setErro("Registro já existe para este mês e campanha");
          return;
        }
        onClose();
        try { onSuccess?.(resp.id, row || undefined); } catch {}
      })
      .catch((err) => {
        setErro(String(err?.message || 'Falha ao registrar promoção'));
      });
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 3200, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3210 }}>
        <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "640px" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Adicionar Produto Manualmente</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={handleClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, ["--input-font-size" as any]: "0.7rem" }}>
              <div className="row g-3">
                <div className="col-12">
                  <div className="row g-2 align-items-end">
                    <div className="col-12 col-md-10">
                      <label htmlFor="busca-produto" className="form-label mb-1">Produto</label>
                      <input
                        id="busca-produto"
                        type="text"
                        className="form-control form-control-sm"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            executarBusca();
                          }
                        }}
                        placeholder="Código, auxiliar ou descrição"
                        style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                        disabled={Boolean(prefillRow)}
                      />
                    </div>
                    <div className="col-12 col-md-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary w-100"
                        style={{ height: "28px", fontSize: "0.7rem", lineHeight: 1.1 }}
                        disabled={loadingBusca}
                        onClick={executarBusca}
                      >
                        {loadingBusca ? 'Buscando...' : 'Buscar'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-12">
                  {erro && (
                    <div className="alert alert-danger py-2 mb-2 d-flex justify-content-between align-items-center" role="alert" style={{ fontSize: "0.75rem" }}>
                      <span>{erro}</span>
                      {erro === "Produto não encontrado" && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                          onClick={() => setModalBuscaAvancadaAberto(true)}
                        >
                          Avançado por Descrição
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {row ? (
                  <div className="col-12">
                    <div className="card border-0 bg-light">
                      <div className="card-body">
                        <div style={{ fontSize: "0.8rem" }}>
                          <div className="mb-2"><strong>Filial:</strong> {String(row.CODFILIAL ?? '')}</div>
                          <div className="mb-2"><strong>Produto:</strong> {String(row.CODPROD ?? '')}</div>
                          <div className="mb-2"><strong>Auxiliar:</strong> {String(row.CODAUXILIAR ?? '')}</div>
                          <div className="mb-2"><strong>Descrição:</strong> {String(row.DESCRICAO ?? '')}</div>
                          <div className="mb-2"><strong>Marca:</strong> {String(row.MARCA ?? '')}</div>
                          <div className="mb-2"><strong>Últ. Saída:</strong> {String((row as any).NOVA_DTULTSAIDA ?? (row as any).DTULTSAIDA ?? '')}</div>
                          <div className="mb-2"><strong>Custo:</strong> {Number(row.CUSTOULTENT ?? 0).toFixed(2)}</div>
                          <div className="mb-2"><strong>Venda:</strong> {Number(((row as any).PVENDA ?? (row as any).PRECO_VENDA ?? 0)).toFixed(2)}</div>
                        </div>

                        {resumoAnterior && (
                          <div className="card bg-white border mt-2 mb-2">
                            <div className="card-body py-2">
                              <div className="small text-muted mb-2">Resumo da configuração anterior:</div>
                              <div className="d-flex justify-content-between mb-1" style={{ fontSize: "0.8rem" }}>
                                <span>Preço Fixo:</span>
                                <span>{resumoAnterior.precoFixo ? Number(resumoAnterior.precoFixo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</span>
                              </div>
                              <div className="d-flex justify-content-between mb-1" style={{ fontSize: "0.8rem" }}>
                                <span>Início Vigência:</span>
                                <span>{resumoAnterior.dataInicio || '-'}</span>
                              </div>
                              <div className="d-flex justify-content-between" style={{ fontSize: "0.8rem" }}>
                                <span>Fim Vigência:</span>
                                <span>{resumoAnterior.dataFim || '-'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-2 d-flex justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setModalHistoricoAberto(true)}
                          >
                            Histórico
                          </button>
                        </div>
                        {/* Estoques por Filial (replicado do ModalPrecificar) */}
                        <div className="card border-0 bg-light mt-3">
                          <div className="card-body">
                            <h6 className="text-muted mb-2">Estoques por Filial</h6>
                            <div className="row g-3">
                              <div className="col-12 col-md-6">
                                <div className="fw-semibold mb-1">Estoque Filial {String(codFilialSel || row.CODFILIAL || '')} - {nomeFilial(codFilialSel || row.CODFILIAL)}</div>
                                <div className="small">
                                  <div className="d-flex justify-content-between"><span className="text-muted">Avaria:</span><span className={estoqueClass(row.AVARIA)}>{formatEstoque(row.AVARIA)}</span></div>
                                  <div className="d-flex justify-content-between"><span className="text-muted">Bloqueado:</span><span className={estoqueClass(row.BLOQUEADO)}>{formatEstoque(row.BLOQUEADO)}</span></div>
                                  <div className="d-flex justify-content-between"><span className="text-muted">Disponível:</span><span className={estoqueClassDisponivel(row.DISPONIVEL)}>{formatDisponivel(row.DISPONIVEL)}</span></div>
                                </div>
                              </div>
                              <div className="col-12 col-md-6">
                                <div className="fw-semibold mb-1">Estoque Filial 03 - CD</div>
                                <div className="small">
                                  <div className="d-flex justify-content-between"><span className="text-muted">Avaria:</span><span className={estoqueClass((row as any)?.AVARIA_FILIAL_03 ?? 0)}>{formatEstoque((row as any)?.AVARIA_FILIAL_03 ?? 0)}</span></div>
                                  <div className="d-flex justify-content-between"><span className="text-muted">Bloqueado:</span><span className={estoqueClass((row as any)?.BLOQUEADO_FILIAL_03 ?? 0)}>{formatEstoque((row as any)?.BLOQUEADO_FILIAL_03 ?? 0)}</span></div>
                                  <div className="d-flex justify-content-between"><span className="text-muted">Disponível:</span><span className={estoqueClassDisponivel((row as any)?.DISPONIVEL_FILIAL_03 ?? 0)}>{formatDisponivel((row as any)?.DISPONIVEL_FILIAL_03 ?? 0)}</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="col-12">
                    <div className="alert alert-light border py-2" style={{ fontSize: "0.75rem" }}>
                      Nenhum produto selecionado. Faça a busca para exibir o resumo.
                    </div>
                  </div>
                )}

                <div className="col-12">
                  <small className="text-muted">Preencha os campos obrigatórios</small>
                </div>
                <div className="col-12">
                  <div className="row g-3 align-items-end">
                    <div className="col-12 col-md-3">
                      <label htmlFor="mes-promocao" className="form-label mb-1">Mês/Ano</label>
                      <input
                        id="mes-promocao"
                        type="month"
                        className="form-control form-control-sm"
                        value={mesDataPromocao}
                        onChange={(e) => setMesDataPromocao(e.target.value)}
                        style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label htmlFor="dt-add" className="form-label mb-1">Dt. Add</label>
                      <input
                        id="dt-add"
                        type="text"
                        className="form-control form-control-sm"
                        value={dtAdd}
                        readOnly
                        style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label htmlFor="tipo-campanha" className="form-label mb-1">Tipo Campanha</label>
                      <select
                        id="tipo-campanha"
                        className="form-select form-select-sm"
                        value={tipoCampanha}
                        onChange={(e) => setTipoCampanha(e.target.value)}
                        style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                        required
                      >
                        <option value="Selecione">Selecione</option>
                        <option value="PE">PE</option>
                        <option value="PQ">PQ</option>
                        <option value="PP">PP</option>
                        <option value="PA">PA</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-3">
                      <label htmlFor="cod-filial" className="form-label mb-1">Filial</label>
                      <select
                        id="cod-filial"
                        className="form-select form-select-sm"
                        value={codFilialSel}
                        onChange={(e) => setCodFilialSel(e.target.value)}
                        style={{ height: "28px", fontSize: "var(--input-font-size, 0.7rem)" }}
                        required
                      >
                        <option value="">Selecione</option>
                        <option value="1">Messejana</option>
                        <option value="2">Horizonte</option>
                        <option value="4">Santa Maria</option>
                      </select>
                    </div>
                  </div>
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
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={confirmar}
                disabled={!row}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Modal: Histórico do Produto */}
      <ModalHistoricoProduto
        isOpen={modalHistoricoAberto}
        onClose={() => setModalHistoricoAberto(false)}
        codFilial={String(codFilialSel || row?.CODFILIAL || "")}
        produto={{
          CODPROD: row?.CODPROD ? Number(row.CODPROD) : undefined,
          CODAUXILIAR: String(row?.CODAUXILIAR ?? ""),
          DESCRICAO: String(row?.DESCRICAO ?? ""),
        }}
      />

      {/* Modal: Busca avançada por descrição */}
      {modalBuscaAvancadaAberto && (
        <div>
          <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103 }}>
            <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
              <div className="modal-content" style={{ fontSize: "0.75rem", maxHeight: "85vh" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Busca Avançada por Descrição</h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setModalBuscaAvancadaAberto(false)} />
                </div>
                <ModalBuscaAvancadaDescricao
                  codFilialSel={String(codFilialSel || "")}
                  descricaoInicial={query}
                  onSelecionar={(produto) => {
                    setRow(produto);
                    setErro("");
                    setQuery(String(produto?.DESCRICAO ?? ""));
                    setModalBuscaAvancadaAberto(false);
                  }}
                  onCancelar={() => setModalBuscaAvancadaAberto(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModalAdicionarProdutoManual;