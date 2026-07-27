import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { type LancamentosApagarRow } from "../../services/gestfin/BucarLancamentosApagar";
import { buscarDuplicatas, type DuplicataRow } from "../../services/gestfin/BuscarDuplicatas";
import { excluirDuplicata } from "../../services/gestfin/ExcluirDuplicata";
import ModalNovoLancamento from "./ModalNovoLancamento";

interface BucarDuplicatasProps {
  aberto: boolean;
  onClose: () => void;
  resumo?: LancamentosApagarRow | null;
  onBuscar?: (params: { dataInicio: string; dataFinal: string; filial: string }) => void;
  onSelecionar?: (duplicata: DuplicataRow) => void;
  initialBusca?: { dataInicio: string; dataFinal: string; filial: string } | null;
  autoBuscarOnOpen?: boolean;
  successMessage?: string | null;
}

// Util: formata datas ISO para pt-BR dd/mm/aaaa
const formatISODateToBR = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

// Util: conversão robusta para número
const toNumber = (val: unknown): number => {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "string") {
    const clean = val.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : 0;
  }
  return Number(val) || 0;
};

// Util: formata moeda BRL
const formatarValor = (val: unknown) => {
  const n = toNumber(val);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};


// Util: histórico OFX em uma única linha (sem quebras internas)
const renderHistoricoOFX = (value?: string | null) => {
  if (!value) return "-";
  return value
    .replace(/\s*-\s*/g, " ") // remove separadores " - "
    .replace(/,/g, " ")        // troca vírgulas por espaço
    .replace(/\s+/g, " ")     // normaliza múltiplos espaços
    .trim();
};

// Util: limita texto a N caracteres (padrão: 30)
const limitText = (value?: unknown, max = 30) => {
  const s = String(value ?? "");
  if (!s) return "-";
  return s.length > max ? s.slice(0, max) + "…" : s;
};

const BucarDuplicatas: React.FC<BucarDuplicatasProps> = ({ aberto, onClose, resumo, onBuscar, onSelecionar, initialBusca, autoBuscarOnOpen, successMessage }) => {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [filial, setFilial] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [duplicatas, setDuplicatas] = useState<DuplicataRow[]>([]);
  const [showSuccessMsg, setShowSuccessMsg] = useState<boolean>(false);
  const [advancedTermInput, setAdvancedTermInput] = useState<string>("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showModalNovoLancamento, setShowModalNovoLancamento] = useState<boolean>(false);
  const [duplicataParaAtualizar, setDuplicataParaAtualizar] = useState<DuplicataRow | null>(null);
  const [showExcluirModal, setShowExcluirModal] = useState<boolean>(false);
  const [excluirTarget, setExcluirTarget] = useState<DuplicataRow | null>(null);
  const [excluirLoading, setExcluirLoading] = useState<boolean>(false);
  const [excluirErro, setExcluirErro] = useState<string | null>(null);
  const [excluirSucesso, setExcluirSucesso] = useState<boolean>(false);

  const listaDuplicatas = useMemo(() => {
    const term = advancedTermInput.trim().toLowerCase();
    if (!term) return duplicatas;
    return duplicatas.filter((d) => {
      const campos = [d.HISTORICO, d.FORNECEDOR, d.CONTA, d.CODCONTA, d.NUMNOTA, d.DUPLIC];
      return campos.some((v) => String(v ?? "").toLowerCase().includes(term));
    });
  }, [duplicatas, advancedTermInput]);

  const r: any = resumo ?? {};

  const resumoItens = useMemo(() => {
    const valTransNum = toNumber(r?.VALOR_TRANSACAO ?? r?.VALOR_TRANS);
    const valTransStr = formatarValor(r?.VALOR_TRANSACAO ?? r?.VALOR_TRANS);
    return [
      { label: "Dt. Trans.", value: formatISODateToBR(r?.DT_TRANSACAO ?? r?.DATA_TRANSACAO ?? r?.DATA) },
      { label: "Histórico OFX", value: renderHistoricoOFX(r?.HISTORICO_OFX ?? r?.HISTORICO) },
      { label: "Valor Transação", value: valTransStr, className: valTransNum < 0 ? "text-danger" : undefined },
    ];
  }, [r]);

  const toDDMMYYYY = (iso?: string) => {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  };

  React.useEffect(() => {
    if (!aberto) return;
    if (!initialBusca) return;
    const ini = initialBusca.dataInicio || "";
    const fim = initialBusca.dataFinal || "";
    const fil = initialBusca.filial || "";
    setDataInicio(ini);
    setDataFinal(fim);
    setFilial(fil);
    if (autoBuscarOnOpen) {
      const codFilial = Number(String(fil).replace(/[^0-9]/g, ""));
      const inicioBR = toDDMMYYYY(ini);
      const fimBR = toDDMMYYYY(fim);
      if (codFilial && inicioBR && fimBR) {
        setErro(null);
        setCarregando(true);
        (async () => {
          try {
            onBuscar?.({ dataInicio: ini, dataFinal: fim, filial: fil });
            const rows = await buscarDuplicatas({ codFilial, dataInicio: inicioBR, dataFim: fimBR });
            setDuplicatas(rows);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Falha ao buscar duplicatas";
            setErro(msg);
            setDuplicatas([]);
          } finally {
            setCarregando(false);
          }
        })();
      }
    }
  }, [aberto, initialBusca, autoBuscarOnOpen]);

  // Controla visibilidade do alerta de sucesso sem fechar o modal
  React.useEffect(() => {
    if (aberto) {
      setShowSuccessMsg(!!successMessage);
    } else {
      setShowSuccessMsg(false);
    }
  }, [aberto, successMessage]);

  const handleBuscar = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // Mantém compatibilidade com callback externo, se fornecido
    if (onBuscar) {
      onBuscar({ dataInicio, dataFinal, filial });
    }

    // Persiste parâmetros para reabrir com pré-set
    try {
      localStorage.setItem("buscaDuplicatasParametros", JSON.stringify({ dataInicio, dataFinal, filial }));
    } catch {}

    const codFilial = Number(String(filial).replace(/[^0-9]/g, ""));
    const inicioBR = toDDMMYYYY(dataInicio);
    const fimBR = toDDMMYYYY(dataFinal);

    if (!codFilial || !inicioBR || !fimBR) {
      setErro("Preencha filial e datas válidas.");
      return;
    }

    setErro(null);
    setCarregando(true);
    try {
      const rows = await buscarDuplicatas({ codFilial, dataInicio: inicioBR, dataFim: fimBR });
      setDuplicatas(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao buscar duplicatas";
      setErro(msg);
      setDuplicatas([]);
    } finally {
      setCarregando(false);
    }
  };

  const handleSelecionar = (d: DuplicataRow) => {
    try {
      onSelecionar?.(d);
    } catch (err) {
      console.warn("Falha ao selecionar duplicata:", err);
    }
  };

  const refreshDuplicatas = async () => {
    try {
      const codFilial = Number(String(filial).replace(/[^0-9]/g, ""));
      const inicioBR = toDDMMYYYY(dataInicio);
      const fimBR = toDDMMYYYY(dataFinal);
      if (!codFilial || !inicioBR || !fimBR) return;
      setCarregando(true);
      const rows = await buscarDuplicatas({ codFilial, dataInicio: inicioBR, dataFim: fimBR });
      setDuplicatas(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao recarregar duplicatas";
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  };

  const handleConfirmarExcluir = async () => {
    if (!excluirTarget) return;
    setExcluirErro(null);
    setExcluirSucesso(false);
    setExcluirLoading(true);
    try {
      const resp = await excluirDuplicata({ recnum: Number(excluirTarget.RECNUM), duplic: String(excluirTarget.DUPLIC || "") });
      if (!resp.ok || resp.rowsAffected <= 0) {
        throw new Error("Exclusão não aplicada.");
      }
      setDuplicatas((prev) => prev.filter((x) => !(x.RECNUM === excluirTarget.RECNUM && String(x.DUPLIC || "") === String(excluirTarget.DUPLIC || ""))));
      // Fecha o modal e recarrega a lista de duplicatas
      fecharExcluirModal();
      await refreshDuplicatas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao excluir duplicata";
      setExcluirErro(msg);
    } finally {
      setExcluirLoading(false);
    }
  };

  const fecharExcluirModal = () => {
    if (excluirLoading) return;
    setShowExcluirModal(false);
    setExcluirTarget(null);
    setExcluirErro(null);
    setExcluirSucesso(false);
  };

  const content = (
    <>
      {aberto && (
        <div
          className="modal-backdrop fade show"
          style={{ zIndex: 1995, position: "fixed", inset: 0 }}
          onClick={onClose}
        />
      )}
      <div
        className={`modal fade ${aberto ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!aberto}
        style={{ display: aberto ? "block" : "none", zIndex: 2000, position: "fixed", inset: 0, pointerEvents: aberto ? "auto" : "none" }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document" style={{ maxWidth: "80vw" }}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Buscar Duplicata</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
            {showSuccessMsg && successMessage && (
              <div className="alert alert-success d-flex justify-content-between align-items-center py-2" role="alert">
                <div className="fw-semibold">{successMessage}</div>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowSuccessMsg(false)} />
              </div>
            )}
            <div className="mb-2">
              <span className="badge bg-secondary">Resumo do lançamento</span>
            </div>

            <div className="mb-2" style={{ whiteSpace: "pre-wrap" }}>
              {resumoItens.map((item, idx) => (
                <div key={idx} className="py-1">
                  <strong>{item.label}:</strong> <span className={("ms-1 " + (item as any)?.className).trim()}>{item.value || "-"}</span>
                </div>
              ))}
            </div>

            <form>
              <div className="row g-2 align-items-end">
                <div className="col-1">
                  <label htmlFor="dataInicio" className="form-label" style={{ fontSize: "0.75rem" }}>Data Início</label>
                  <input
                    id="dataInicio"
                    type="date"
                    className="form-control form-control-sm form-compact"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="col-1">
                  <label htmlFor="dataFinal" className="form-label" style={{ fontSize: "0.75rem" }}>Data Final</label>
                  <input
                    id="dataFinal"
                    type="date"
                    className="form-control form-control-sm form-compact"
                    value={dataFinal}
                    onChange={(e) => setDataFinal(e.target.value)}
                  />
                </div>
                <div className="col-1">
                  <label htmlFor="filial" className="form-label" style={{ fontSize: "0.75rem" }}>Filial</label>
                  <select
                    id="filial"
                    className="form-select form-select-sm form-compact"
                    value={filial}
                    onChange={(e) => setFilial(e.target.value)}
                  >
                    <option value="" disabled>Selecione a filial</option>
                    <option value="1">Messejana</option>
                    <option value="2">Horizonte</option>
                    <option value="3">CD</option>
                    <option value="4">Santa Maria</option>
                  </select>
                </div>
                <div className="col-12 col-md-2">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm d-inline-flex align-items-center btn-compact"
                    onClick={handleBuscar}
                    disabled={carregando}
                  >
                    {carregando ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Buscando...
                      </>
                    ) : (
                      "Buscar"
                    )}
                  </button>
                </div>
                <div className="col-12 col-md-2 ms-md-auto">
                  <label htmlFor="advancedTerm" className="form-label" style={{ fontSize: "0.75rem" }}>Pesquisa Avançada</label>
                  <input
                    id="advancedTerm"
                    type="text"
                    className="form-control form-control-sm form-compact"
                    placeholder="Digite para filtrar"
                    value={advancedTermInput}
                    onChange={(e) => setAdvancedTermInput(e.target.value)}
                  />
                </div>
              </div>
            </form>

            {erro && (
              <div className="alert alert-danger mt-3 py-2" role="alert">
                {erro}
              </div>
            )}

            <div className="mt-3">
              <div className="d-flex align-items-center mb-2">
                <span className="badge bg-info me-2">Duplicatas encontradas</span>
                <span className="text-muted small">{listaDuplicatas.length} itens</span>
                {carregando && <span className="ms-2 text-primary small">Carregando...</span>}
              </div>

              {listaDuplicatas.length > 0 && (
                <div className="table-responsive" style={{ maxHeight: 300 }}>
                  <table className="table table-sm table-striped table-hover table-hover-green" style={{ fontSize: "0.7rem" }}>
                    <thead className="table-light" style={{ position: "sticky", top: 0 }}>
                      <tr>
                        <th>Dt. Lanc.</th>
                        <th>Dt. Emiss.</th>
                        <th>Dt. Venc.</th>
                        <th>Duplic</th>
                        <th>Recnum</th>
                        <th>Fornecedor</th>
                        <th>Conta</th>
                        <th>Histórico</th>
                        <th>Nº Nota</th>
                        <th>Valor</th>
                        <th>Juros</th>
                        <th>Desc.</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaDuplicatas.map((d, i) => {
                        const key = `${d.RECNUM}-${i}`;
                        const isSelected = selectedKey === key;
                        return (
                        <tr
                          key={key}
                          className={("row-selectable " + (isSelected ? "row-selected-green" : "")).trim()}
                          onClick={() => setSelectedKey(isSelected ? null : key)}
                        >
                          <td>{d.DTLANC}</td>
                          <td>{d.DTEMISSAO}</td>
                          <td>{d.DTVENC}</td>
                          <td>{d.DUPLIC || "-"}</td>
                          <td>{d.RECNUM}</td>
                          <td title={d.FORNECEDOR || "-"}>{limitText(d.FORNECEDOR, 30)}</td>
                          <td title={(d.CONTA || d.CODCONTA) ? String(d.CONTA || d.CODCONTA) : "-"}>{limitText(d.CONTA || d.CODCONTA, 30)}</td>
                          <td style={{ whiteSpace: "pre-wrap" }} title={d.HISTORICO || "-"}>{limitText(d.HISTORICO, 30)}</td>
                          <td>{d.NUMNOTA ?? "-"}</td>
                          <td className="text-success">{d.VALOR}</td>
                          <td className="text-danger">{d.JUROS}</td>
                          <td className="text-primary">{d.DESCONTOFIN}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm py-0 px-1"
                              style={{ fontSize: "0.7rem", lineHeight: 1 }}
                              onClick={() => handleSelecionar(d)}
                            >
                              Selecionar
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm py-0 px-1 ms-1"
                              style={{ fontSize: "0.7rem", lineHeight: 1 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDuplicataParaAtualizar(d);
                                setShowModalNovoLancamento(true);
                              }}
                            >
                              Atualizar
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm py-0 px-1 ms-1"
                              style={{ fontSize: "0.7rem", lineHeight: 1 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExcluirTarget(d);
                                setExcluirErro(null);
                                setExcluirSucesso(false);
                                setShowExcluirModal(true);
                              }}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
            <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onClose}>Cancelar</button>
            <button 
              className="btn btn-primary btn-sm py-1 px-2 ms-2" 
              style={{ fontSize: "0.7rem", lineHeight: 1.1 }} 
              onClick={() => setShowModalNovoLancamento(true)}
            >
              Novo Lançamento
            </button>
          </div>
          </div>
        </div>
      </div>
      
      {/* Modal Novo Lançamento */}
      <ModalNovoLancamento
        isOpen={showModalNovoLancamento}
        onClose={() => { setShowModalNovoLancamento(false); setDuplicataParaAtualizar(null); }}
        mode={duplicataParaAtualizar ? "update" : "create"}
        prefillFromDuplicata={duplicataParaAtualizar}
        defaultCodFilial={Number(String(filial).replace(/[^0-9]/g, "")) || 0}
        onSuccess={() => {
          setShowModalNovoLancamento(false);
          setDuplicataParaAtualizar(null);
          const codFilial = Number(String(filial).replace(/[^0-9]/g, ""));
          const inicioBR = toDDMMYYYY(dataInicio);
          const fimBR = toDDMMYYYY(dataFinal);
          if (codFilial && inicioBR && fimBR) {
            setErro(null);
            setCarregando(true);
            (async () => {
              try {
                onBuscar?.({ dataInicio, dataFinal, filial });
                const rows = await buscarDuplicatas({ codFilial, dataInicio: inicioBR, dataFim: fimBR });
                setDuplicatas(rows);
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Falha ao buscar duplicatas";
                setErro(msg);
                setDuplicatas([]);
              } finally {
                setCarregando(false);
              }
            })();
          }
        }}
      />

      {/* Modal de Confirmação - Exclusão de Duplicata com resumo */}
      {showExcluirModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 2095, position: "fixed", inset: 0 }}
            onClick={fecharExcluirModal}
          />
          <div
            className={`modal fade show`}
            role="dialog"
            aria-modal="true"
            style={{ display: "block", zIndex: 2100, position: "fixed", inset: 0 }}
          >
            <div className="modal-dialog modal-sm modal-dialog-centered" role="document" style={{ maxWidth: "28vw" }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Confirmar Exclusão</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={fecharExcluirModal} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
                  <p className="mb-2">Deseja realmente excluir esta duplicata?</p>
                  {excluirTarget && (
                    <div className="small text-muted">
                      <div><strong>RECNUM:</strong> {excluirTarget.RECNUM}</div>
                      <div><strong>DUPLIC:</strong> {excluirTarget.DUPLIC || "-"}</div>
                      <div><strong>Dt. Lanc.:</strong> {excluirTarget.DTLANC}</div>
                      <div><strong>Dt. Venc.:</strong> {excluirTarget.DTVENC}</div>
                      <div><strong>Fornecedor:</strong> {limitText(excluirTarget.FORNECEDOR, 40)}</div>
                      <div><strong>Conta:</strong> {limitText(excluirTarget.CONTA || excluirTarget.CODCONTA, 30)}</div>
                      <div><strong>Nº Nota:</strong> {excluirTarget.NUMNOTA ?? "-"}</div>
                      <div><strong>Valor:</strong> {excluirTarget.VALOR}</div>
                    </div>
                  )}
                  {excluirErro && (
                    <div className="alert alert-danger mt-2 py-2" role="alert">{excluirErro}</div>
                  )}
                  {excluirSucesso && !excluirErro && (
                    <div className="alert alert-success mt-2 py-2" role="alert">Duplicata excluída com sucesso.</div>
                  )}
                </div>
                <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={fecharExcluirModal} disabled={excluirLoading}>
                    Cancelar
                  </button>
                  <button className="btn btn-danger btn-sm py-1 px-2 ms-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={handleConfirmarExcluir} disabled={excluirLoading || excluirSucesso}>
                    {excluirLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Excluindo...
                      </>
                    ) : excluirSucesso ? (
                      "Excluída"
                    ) : (
                      "Excluir"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );

  return createPortal(content, document.body);
};

export default BucarDuplicatas;