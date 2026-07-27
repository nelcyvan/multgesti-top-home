import React, { useEffect, useState } from "react";
import { buscarHistoricoProduto, type HistoricoProdutoRow } from "../../services/gestmkt/HistoricoProduto";

interface ModalHistoricoProdutoProps {
  isOpen: boolean;
  onClose: () => void;
  codFilial?: string; // filial do produto
  produto?: {
    CODPROD?: number;
    CODAUXILIAR?: string;
    DESCRICAO?: string;
  } | null;
}

const formatBR = (n: unknown): string => {
  const v = typeof n === 'number' ? n : Number(String(n ?? '').replace(/,/g, '.'));
  if (isNaN(v)) return '-';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toISODate = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
};

const toBRDate = (iso: string): string => {
  const [yyyy, mm, dd] = String(iso).split('-');
  if (!yyyy || !mm || !dd) return String(iso);
  return `${dd}/${mm}/${yyyy}`;
};

const ModalHistoricoProduto: React.FC<ModalHistoricoProdutoProps> = ({ isOpen, onClose, codFilial, produto }) => {
  const [dataInicio, setDataInicio] = useState<string>(""); // DD/MM/YYYY
  const [dataFinal, setDataFinal] = useState<string>(""); // DD/MM/YYYY
  const [erro, setErro] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<HistoricoProdutoRow[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setErro("");
    setRows([]);
    setLoading(false);
    // datas padrão: últimos 30 dias (ISO para inputs type=date)
    const hoje = new Date();
    const fimISO = toISODate(hoje);
    const iniDate = new Date(hoje);
    iniDate.setDate(iniDate.getDate() - 30);
    const iniISO = toISODate(iniDate);
    setDataInicio(iniISO);
    setDataFinal(fimISO);
  }, [isOpen]);

  const executarBusca = async () => {
    setErro("");
    if (!produto?.CODPROD) {
      setErro("Produto inválido para histórico");
      return;
    }
    if (!codFilial) {
      setErro("Filial não informada");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFinal)) {
      setErro("Informe datas válidas");
      return;
    }
    setLoading(true);
    try {
      const inicioBR = toBRDate(dataInicio);
      const finalBR = toBRDate(dataFinal);
      const resp = await buscarHistoricoProduto({
        codigoDoProduto: Number(produto.CODPROD),
        filialDoPrduto: String(codFilial),
        dataInicio: inicioBR,
        dataFinal: finalBR,
      });
      setRows(resp || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao buscar histórico';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 3195, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3200 }}>
        <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "720px" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Histórico do Produto</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
              <div className="row g-3">
                {/* Campos bloqueados do produto */}
                <div className="col-12">
                  <div className="card border-0 bg-light">
                    <div className="card-body">
                      <div className="row g-3">
                        <div className="col-12 col-md-3">
                          <label className="form-label mb-1">Código</label>
                          <input className="form-control form-control-sm" readOnly value={String(produto?.CODPROD ?? '')} />
                        </div>
                        <div className="col-12 col-md-4">
                          <label className="form-label mb-1">Código de Barras</label>
                          <input className="form-control form-control-sm" readOnly value={String(produto?.CODAUXILIAR ?? '')} />
                        </div>
                        <div className="col-12 col-md-5">
                          <label className="form-label mb-1">Descrição</label>
                          <input className="form-control form-control-sm" readOnly value={String(produto?.DESCRICAO ?? '')} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filtro de datas */}
                <div className="col-12">
                  <div className="row g-3 align-items-end">
                    <div className="col-12 col-md-3">
                      <label className="form-label mb-1">Data Início</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        style={{ height: "28px" }}
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label mb-1">Data Final</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={dataFinal}
                        onChange={(e) => setDataFinal(e.target.value)}
                        style={{ height: "28px" }}
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={executarBusca}
                        disabled={loading}
                      >
                        {loading ? 'Buscando...' : 'Buscar Histórico'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Erro */}
                {erro && (
                  <div className="col-12">
                    <div className="alert alert-danger py-2" role="alert">{erro}</div>
                  </div>
                )}

                {/* Resultado */}
                <div className="col-12">
                  {rows.length === 0 ? (
                    <div className="alert alert-light border py-2">Sem dados para o período.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-striped align-middle">
                        <thead>
                          <tr>
                            <th>Filial</th>
                            <th>Qtd Mov.</th>
                            <th>Qt saída Total</th>
                            <th>Preço Médio</th>
                            <th>Valor Total</th>
                            <th>Primeira Saída</th>
                            <th>Última Saída</th>
                            <th>Estoque Atual</th>
                            <th>Disponível</th>
                            <th>Estoque Geral</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, idx) => (
                            <tr key={idx}>
                              <td>{String(r.CODFILIAL ?? '')}</td>
                              <td>{Number(r.QTD_MOVIMENTACOES ?? 0)}</td>
                              <td>{formatBR(r.QUANTIDADE_TOTAL)}</td>
                              <td>{formatBR(r.PRECO_MEDIO)}</td>
                              <td>{formatBR(r.VALOR_TOTAL)}</td>
                              <td>{String(r.PRIMEIRA_SAIDA ?? '')}</td>
                              <td>{String(r.ULTIMA_SAIDA ?? '')}</td>
                              <td>{formatBR(r.ESTOQUE_ATUAL)}</td>
                              <td>{formatBR(r.DISPONIVEL)}</td>
                              <td>{formatBR(r.ESTOQUE_GERAL)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={onClose}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalHistoricoProduto;