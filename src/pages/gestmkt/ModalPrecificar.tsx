import React, { useEffect, useMemo, useState } from "react";
import type { ProdutoPromocaoRow } from "../../services/gestmkt/ProdutosPromocao";
import { atualizarPromocao, type AtualizarPromocaoPayload } from "../../services/gestmkt/AtualizarPromocao";
import { excluirPromocao, type HistoricoCampanha } from "../../services/gestmkt/ExcluirPromocao";
import { calcularMargemPrecoFixo } from "../../services/gestmkt/CalcularMargemPrecoFixo";
import ModalAdicionarProdutoManual from "./ModalAdicionarProdutoManual";
import ModalHistoricoExclusao from "./ModalHistoricoExclusao";
import type { ProdutoVendaBaixaRow } from "../../services/gestmkt/ProdutosVendaBaixa";
import { ArrowLeftRight, Check2Circle, ClockFill, PencilSquare, TrashFill, XLg } from "react-bootstrap-icons";

interface ModalPrecificarProps {
  isOpen: boolean;
  onClose: () => void;
  row: ProdutoPromocaoRow;
  onSuccess?: () => void;
}

// Converte YYYY-MM-DD para DD/MM/YYYY
const toDMYFromISO = (iso: string | undefined): string => {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-([01]?\d)-([0-3]?\d)$/);
  if (!m) return "";
  const yyyy = m[1];
  const mm = m[2].padStart(2, '0');
  const dd = m[3].padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
};

// Normaliza vários formatos para input date (YYYY-MM-DD)
const toInputDate = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    const yyyy = String(val.getFullYear());
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(val).trim();
  let m = s.match(/^(\d{4})-([01]?\d)-([0-3]?\d)/);
  if (m) {
    const yyyy = m[1];
    const mm = m[2].padStart(2, '0');
    const dd = m[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const base = s.split(' ')[0];
  m = base.match(/^([0-3]?\d)\/([01]?\d)\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
};

const toNumber = (val: unknown): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const s = String(val).trim();
  if (!s) return null;
  const normalized = s.replace(/,/g, '.');
  const n = Number(normalized);
  return isNaN(n) ? null : n;
};

// Formata quantidade/valor retornado como string com vírgula ou número para pt-BR
const formatEstoque = (val: unknown): string => {
  const n = toNumber(val);
  if (n === null) {
    const s = String(val ?? '').trim();
    return s || '-';
  }
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Define classe de cor para estoque: vermelho se <= 0, verde se > 0, neutro se inválido
const estoqueClass = (val: unknown): string => {
  const n = toNumber(val);
  if (n === null) return 'text-muted';
  return n <= 0 ? 'text-danger' : 'text-success';
};

// Versões específicas para Disponível: se inválido/null, mostra 0,00 e cor conforme regra
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

// Formata mês de promoção como MM-YYYY a partir de ISO, DMY ou já MM-YYYY
const formatMesPromocao = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (!s) return "";
  // Já no formato MM-YYYY
  let m = s.match(/^([01]?\d)-(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, '0');
    const yyyy = m[2];
    return `${mm}-${yyyy}`;
  }
  // ISO (YYYY-MM-DD) possivelmente com horário
  const baseISO = s.split('T')[0];
  m = baseISO.match(/^(\d{4})-([01]?\d)-([0-3]?\d)$/);
  if (m) {
    const yyyy = m[1];
    const mm = m[2].padStart(2, '0');
    return `${mm}-${yyyy}`;
  }
  // DMY possivelmente com horário
  const baseDMY = s.split(' ')[0];
  m = baseDMY.match(/^([0-3]?\d)\/([01]?\d)\/(\d{4})$/);
  if (m) {
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${mm}-${yyyy}`;
  }
  return s; // fallback
};

const ModalPrecificar: React.FC<ModalPrecificarProps> = ({ isOpen, onClose, row: rowProp, onSuccess }) => {
  const [row, setRow] = useState<ProdutoPromocaoRow | null>(rowProp);

  useEffect(() => {
    setRow(rowProp);
  }, [rowProp]);

  const [precoFicticio, setPrecoFicticio] = useState<string>("");
  const [precoFixo, setPrecoFixo] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>(""); // YYYY-MM-DD
  const [dataFim, setDataFim] = useState<string>(""); // YYYY-MM-DD

  const [loadingAction, setLoadingAction] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);
  const [showMoverSelector, setShowMoverSelector] = useState<boolean>(false);
  const [moverTipoCampanha, setMoverTipoCampanha] = useState<string>("Selecione");
  const [showMoverConfirm, setShowMoverConfirm] = useState<boolean>(false);
  const [showMoverAddManual, setShowMoverAddManual] = useState<boolean>(false);
  const [showHistorico, setShowHistorico] = useState<boolean>(false);
  const [calcLoading, setCalcLoading] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string>("");
  const [margemCalc, setMargemCalc] = useState<null | {
    ok: boolean;
    precoFixo: number;
    pcomint1: number;
    custoBase: number;
    comissaoValor: number;
    cmvCalculado: number;
    margemPercent: number;
  }>(null);

  const [historicoMover, setHistoricoMover] = useState<HistoricoCampanha | null>(null);

  useEffect(() => {
    // Inicializa com valores da linha
    setPrecoFicticio(
      (() => {
        const n = toNumber(row?.PRECOFICTICIO);
        return n === null ? "" : String(n);
      })()
    );
    setPrecoFixo(
      (() => {
        const n = toNumber(row?.PRECOFIXO);
        return n === null ? "" : String(n);
      })()
    );
    setDataInicio(toInputDate(row?.DT_INICIO_CAMPANHA ?? row?.DTINICIOVIGENCIA));
    setDataFim(toInputDate(row?.DT_FIM_CAMPANHA ?? row?.DTFIMVIGENCIA));
    setSuccessMsg("");
    setErrorMsg("");
    setLoadingAction(false);
  }, [row]);

  // Atualiza cálculo de margem quando preço fixo muda
  useEffect(() => {
    const pf = toNumber(precoFixo);
    if (pf === null) {
      setMargemCalc(null);
      setCalcError("");
      setCalcLoading(false);
      return;
    }
    const payload = {
      precoFixo: pf,
      pcomint1: toNumber(row?.PCOMINT1) ?? undefined,
      custoBase: toNumber(row?.CUSTO_BASE) ?? undefined,
      custoReal: toNumber(row?.CUSTOREAL) ?? undefined,
      custoUltEntLiq: toNumber(row?.CUSTOULTENTLIQ) ?? undefined,
      custoUltEnt: toNumber(row?.CUSTOULTENT) ?? undefined,
    };
    setCalcLoading(true);
    setCalcError("");
    calcularMargemPrecoFixo(payload)
      .then((res) => {
        setMargemCalc(res);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err || 'Falha ao calcular margem');
        setCalcError(msg);
        setMargemCalc(null);
      })
      .finally(() => setCalcLoading(false));
  }, [precoFixo, row]);

  const codigoUsuarioSalvou = useMemo(() => {
    try {
      const raw = localStorage.getItem('usuarioLogado');
      if (!raw) return null;
      const u = JSON.parse(raw || '{}');
      const mStr = String(u?.matricula ?? '').trim();
      if (mStr && !isNaN(Number(mStr))) return Number(mStr);
    } catch {}
    return null;
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {!showMoverAddManual && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 3100, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3110 }}>
        <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(560px, 96vw)" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                <PencilSquare size={14} className="me-2 text-primary" />
                Precificar
              </h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem" }}>
              {successMsg && (
                <div className="alert alert-success py-2 mb-2" role="alert" style={{ fontSize: "0.75rem" }}>
                  {successMsg}
                </div>
              )}
              {errorMsg && (
                <div className="alert alert-danger py-2 mb-2" role="alert" style={{ fontSize: "0.75rem" }}>
                  {errorMsg}
                </div>
              )}
              {/* Dados do Produto */}
              <div className="mb-2 small text-muted">{String(row?.TIPOCAMPANHA ?? '')} · Filial {String(row?.CODFILIAL ?? '')}</div>
              <div className="mb-2"><strong>Produto:</strong> {String(row?.CODPROD ?? '')} — <span title={String(row?.DESCRICAO ?? '')}>{String(row?.DESCRICAO ?? '')}</span></div>
              <div className="mb-2"><strong>Cód. Barras:</strong> {String(row?.CODAUXILIAR ?? '')} · <strong>Marca:</strong> {String(row?.MARCA ?? '')}</div>
              <div className="mb-3"><strong>Cod Preço Promocional:</strong> {String(row?.CODPRECOPROM ?? '')}</div>

              <div className="row g-3 align-items-end">
                <div className="col-12 col-md-3">
                  <label className="form-label mb-1">Preço Fictício</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    value={precoFicticio}
                    onChange={(e) => setPrecoFicticio(e.target.value)}
                    disabled={loadingAction}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label mb-1">Preço Fixo</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    value={precoFixo}
                    onChange={(e) => setPrecoFixo(e.target.value)}
                    disabled={loadingAction}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label mb-1">Início Vigência</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    disabled={loadingAction}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label mb-1">Fim Vigência</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    disabled={loadingAction}
                  />
                </div>
              </div>

              {/* Datas e Registro */}
              <div className="row mt-3">
                <div className="col-12 col-md-6">
                  <small className="text-muted">Mês Promoção</small>
                  <div>{formatMesPromocao(row?.MES_DATA_PROMOCAO ?? row?.DT_INICIO_CAMPANHA ?? row?.DTINICIOVIGENCIA ?? '')}</div>
                </div>
                <div className="col-12 col-md-3">
                  <small className="text-muted">Adicionado</small>
                  <div>{String(row?.DT_ADD ?? '')}</div>
                </div>
                <div className="col-12 col-md-3">
                  <small className="text-muted">Usuário</small>
                  <div>{String(row?.CODUSUR_ADD ?? '')}</div>
                </div>
              </div>

              {/* Estoques por Filial */}
              <div className="card border-0 bg-light mt-3">
                <div className="card-body">
                  <h6 className="text-muted mb-2">Estoques por Filial</h6>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <div className="fw-semibold mb-1">Estoque Filial 01 - Messejana</div>
                      <div className="small">
                        <div className="d-flex justify-content-between"><span className="text-muted">Avaria:</span><span className={estoqueClass((row as any)?.QT_ESTOQUE_AVARIA_FILIAL_01)}>{formatEstoque((row as any)?.QT_ESTOQUE_AVARIA_FILIAL_01)}</span></div>
                        <div className="d-flex justify-content-between"><span className="text-muted">Bloqueado:</span><span className={estoqueClass((row as any)?.QT_ESTOQUE_BLOQUEADO_FILIAL_01)}>{formatEstoque((row as any)?.QT_ESTOQUE_BLOQUEADO_FILIAL_01)}</span></div>
                        <div className="d-flex justify-content-between"><span className="text-muted">Disponível:</span><span className={estoqueClassDisponivel((row as any)?.QT_ESTOQUE_DISPONIVEL_FILIAL_01)}>{formatDisponivel((row as any)?.QT_ESTOQUE_DISPONIVEL_FILIAL_01)}</span></div>
                      </div>
                    </div>
                    {Boolean((row as any)?.QT_ESTOQUE_AVARIA_FILIAL_03 || (row as any)?.QT_ESTOQUE_BLOQUEADO_FILIAL_03 || (row as any)?.QT_ESTOQUE_DISPONIVEL_FILIAL_03) && (
                      <div className="col-12 col-md-6">
                        <div className="fw-semibold mb-1">Estoque Filial 03 - CD</div>
                        <div className="small">
                          <div className="d-flex justify-content-between"><span className="text-muted">Avaria:</span><span className={estoqueClass((row as any)?.QT_ESTOQUE_AVARIA_FILIAL_03)}>{formatEstoque((row as any)?.QT_ESTOQUE_AVARIA_FILIAL_03)}</span></div>
                          <div className="d-flex justify-content-between"><span className="text-muted">Bloqueado:</span><span className={estoqueClass((row as any)?.QT_ESTOQUE_BLOQUEADO_FILIAL_03)}>{formatEstoque((row as any)?.QT_ESTOQUE_BLOQUEADO_FILIAL_03)}</span></div>
                          <div className="d-flex justify-content-between"><span className="text-muted">Disponível:</span><span className={estoqueClassDisponivel((row as any)?.QT_ESTOQUE_DISPONIVEL_FILIAL_03)}>{formatDisponivel((row as any)?.QT_ESTOQUE_DISPONIVEL_FILIAL_03)}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Custos e Margens Atuais */}
              <div className="card border-0 bg-light mt-3">
                <div className="card-body">
                  <h6 className="text-muted mb-2">Custos e Margens (atuais)</h6>
                  <div className="row g-3">
                    <div className="col-6 col-md-3">
                      <small className="text-muted">Venda</small>
                      <div>{(toNumber(row?.PVENDA) ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <small className="text-muted">Custo Base</small>
                      <div>{(toNumber(row?.CUSTO_BASE) ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <small className="text-muted">Comissão %</small>
                      <div>{(toNumber(row?.PCOMINT1) ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <small className="text-muted">Comissão Valor</small>
                      <div>{(toNumber(row?.COMISSAO_VALOR) ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <small className="text-muted">CMV Calculado</small>
                      <div>{(toNumber(row?.CMV_CALCULADO) ?? 0).toFixed(2)}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <small className="text-muted">Margem Atual %</small>
                      <div className="text-primary">{(toNumber(row?.MARGEM_PRECIFICACAO) ?? 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cálculo de Margem para Preço Fixo */}
              <div className="card border-0 bg-light mt-3">
                <div className="card-body">
                  <h6 className="text-muted mb-2">Margem com Preço Fixo</h6>
                  {calcLoading && (
                    <div className="text-muted">Calculando...</div>
                  )}
                  {calcError && (
                    <div className="text-danger" style={{ fontSize: "0.75rem" }}>{calcError}</div>
                  )}
                  {!calcLoading && !calcError && margemCalc && (
                    <div className="row g-3">
                      <div className="col-6 col-md-3">
                        <small className="text-muted">Preço Fixo</small>
                        <div>{(toNumber(margemCalc?.precoFixo) ?? 0).toFixed(2)}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <small className="text-muted">Comissão %</small>
                        <div>{(toNumber(margemCalc?.pcomint1) ?? 0).toFixed(2)}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <small className="text-muted">Custo Base</small>
                        <div>{(toNumber(margemCalc?.custoBase) ?? 0).toFixed(2)}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <small className="text-muted">Comissão Valor</small>
                        <div>{(toNumber(margemCalc?.comissaoValor) ?? 0).toFixed(2)}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <small className="text-muted">CMV Calculado</small>
                        <div>{(toNumber(margemCalc?.cmvCalculado) ?? 0).toFixed(2)}</div>
                      </div>
                      <div className="col-6 col-md-3">
                        <small className="text-muted">Margem %</small>
                        <div className="text-danger">{(toNumber(margemCalc?.margemPercent) ?? 0).toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  {!calcLoading && !calcError && !margemCalc && (
                    <div className="text-muted">Informe o Preço Fixo para calcular a margem.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-warning btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                disabled={loadingAction}
                onClick={() => {
                  const snapshot: HistoricoCampanha = {
                    CODFILIAL: row?.CODFILIAL ?? 0,
                    CODPROD: Number(row?.CODPROD ?? 0),
                    MES_DATA_PROMOCAO: formatMesPromocao(row?.MES_DATA_PROMOCAO),
                    DT_ADD: row?.DT_ADD,
                    CODUSUR_ADD: row?.CODUSUR_ADD,
                    TIPO_CAMPANHA: row?.TIPOCAMPANHA ?? '',
                    PRECOFICTICIO: row?.PRECOFICTICIO,
                    ID_ORIGEM: Number(row?.ID ?? 0),
                    DT_INICIO_CAMPANHA: toInputDate(dataInicio), // Ensure format
                    DT_FIM_CAMPANHA: toInputDate(dataFim),       // Ensure format
                    PRECOFIXO: precoFixo ? Number(precoFixo) : undefined,
                    CODUSUR_SALVOU: codigoUsuarioSalvou ?? undefined,
                    CODIGO_PROMOCAO: row?.CODPRECOPROM,
                    STATUS_ENCARTE: row?.STATUS_ENCARTE
                  };
                  setHistoricoMover(snapshot);
                  setMoverTipoCampanha("Selecione");
                  setShowMoverSelector(true);
                }}
              >
                <ArrowLeftRight size={12} className="me-1" />
                Mover
              </button>
              <button
                type="button"
                className="btn btn-info btn-sm py-1 px-2 text-white"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={() => setShowHistorico(true)}
              >
                <ClockFill size={12} className="me-1" />
                Históricos de Exclusão
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                disabled={loadingAction}
                onClick={() => setShowConfirmDelete(true)}
              >
                <TrashFill size={12} className="me-1" />
                Excluir
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                disabled={loadingAction}
                onClick={async () => {
                  try {
                    setErrorMsg("");
                    setSuccessMsg("");
                    setLoadingAction(true);
                    const payload: AtualizarPromocaoPayload = {
                      id: Number(row?.ID ?? 0),
                      precoFicticio: precoFicticio === '' ? null : Number(precoFicticio),
                      precoFixo: precoFixo === '' ? null : Number(precoFixo),
                      dataInicioCampanha: toDMYFromISO(dataInicio) || null,
                      dataFimCampanha: toDMYFromISO(dataFim) || null,
                      dataSalvou: null,
                      codigoUsuarioSalvou: codigoUsuarioSalvou,
                    };
                    if (!payload.id) throw new Error('ID inválido');
                    const resp = await atualizarPromocao(payload);
                    if (!resp.ok) throw new Error(resp.message || 'Falha ao salvar');
                    setSuccessMsg('Informações salvas com sucesso');
                    // Fecha modal e dispara callback de sucesso para recarregar lista no detalhe
                    try { onSuccess && onSuccess(); } catch {}
                    onClose();
                    setTimeout(() => setSuccessMsg(""), 1000);
                  } catch (err) {
                    console.error('Falha ao salvar:', err);
                    const msg = err instanceof Error ? err.message : 'Falha ao salvar informações';
                    setErrorMsg(String(msg));
                    setTimeout(() => setErrorMsg(""), 3500);
                  } finally {
                    setLoadingAction(false);
                  }
                }}
              >
                <Check2Circle size={12} className="me-1" />
                Salvar
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={onClose}
              >
                <XLg size={12} className="me-1" />
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )}
      {showConfirmDelete && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 3120, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3130 }}>
            <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(420px, 90vw)" }}>
              <div className="modal-content" style={{ fontSize: "0.75rem" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                    <TrashFill size={14} className="me-2 text-danger" />
                    Confirmar exclusão
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowConfirmDelete(false)} />
                </div>
                <div className="modal-body">
                  <p className="mb-2">Deseja excluir esta promoção?</p>
                  <p className="text-muted mb-0">A ação também removerá o preço promocional associado (PCPRECOPROM).</p>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={() => setShowConfirmDelete(false)}
                  >
                    <XLg size={12} className="me-1" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    disabled={loadingAction}
                    onClick={async () => {
                      try {
                        setErrorMsg("");
                        setSuccessMsg("");
                        setLoadingAction(true);
                        const id = Number(row?.ID ?? 0);
                        if (!id) throw new Error('ID inválido para exclusão');
                        const codProm = toNumber(row?.CODPRECOPROM);
                        const resp = await excluirPromocao(id, codProm ?? undefined);
                        if (!resp.ok) throw new Error(resp.message || 'Falha ao excluir');
                        setShowConfirmDelete(false);
                        try { onSuccess && onSuccess(); } catch {}
                        onClose();
                      } catch (err) {
                        console.error('Falha ao excluir item:', err);
                        const msg = err instanceof Error ? err.message : 'Falha ao excluir item';
                        setErrorMsg(String(msg));
                        setTimeout(() => setErrorMsg(""), 3500);
                        setShowConfirmDelete(false);
                      } finally {
                        setLoadingAction(false);
                      }
                    }}
                  >
                    <TrashFill size={12} className="me-1" />
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showMoverSelector && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 3120, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3130 }}>
            <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(460px, 92vw)" }}>
              <div className="modal-content" style={{ fontSize: "0.75rem" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                    <ArrowLeftRight size={14} className="me-2 text-warning" />
                    Mover para outra campanha
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowMoverSelector(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.75rem" }}>
                  <div className="mb-2 small text-muted">Produto {String(row?.CODPROD ?? "")} · Filial {String(row?.CODFILIAL ?? "")}</div>
                  <label className="form-label mb-1">Tipo de Campanha</label>
                  <select
                    className="form-select form-select-sm"
                    value={moverTipoCampanha}
                    onChange={(e) => setMoverTipoCampanha(e.target.value)}
                    style={{ fontSize: "0.7rem", height: "28px" }}
                  >
                    <option value="Selecione">Selecione</option>
                    <option value="PE">PE</option>
                    <option value="PQ">PQ</option>
                    <option value="PP">PP</option>
                    <option value="PA">PA</option>
                  </select>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={() => setShowMoverSelector(false)}
                  >
                    <XLg size={12} className="me-1" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning btn-sm py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    disabled={loadingAction || !moverTipoCampanha || moverTipoCampanha === "Selecione"}
                    onClick={() => setShowMoverConfirm(true)}
                  >
                    <ArrowLeftRight size={12} className="me-1" />
                    Mover
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showMoverConfirm && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 3140, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3150 }}>
            <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(420px, 90vw)" }}>
              <div className="modal-content" style={{ fontSize: "0.75rem" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                    <ArrowLeftRight size={14} className="me-2 text-warning" />
                    Confirmar mover
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowMoverConfirm(false)} />
                </div>
                <div className="modal-body">
                  <p className="mb-2">Deseja remover a campanha atual e mover para {String(moverTipoCampanha)}?</p>
                  
                  <div className="card bg-light border-0 mt-3">
                    <div className="card-body py-2">
                      <div className="small text-muted mb-2">Resumo da configuração atual:</div>
                      <div className="d-flex justify-content-between mb-1" style={{ fontSize: "0.8rem" }}>
                        <span>Preço Fixo:</span>
                        <span>{precoFixo ? Number(precoFixo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1" style={{ fontSize: "0.8rem" }}>
                        <span>Início Vigência:</span>
                        <span>{toDMYFromISO(dataInicio) || '-'}</span>
                      </div>
                      <div className="d-flex justify-content-between" style={{ fontSize: "0.8rem" }}>
                        <span>Fim Vigência:</span>
                        <span>{toDMYFromISO(dataFim) || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={() => setShowMoverConfirm(false)}
                  >
                    <XLg size={12} className="me-1" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm py-1 px-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    disabled={loadingAction}
                    onClick={async () => {
                      try {
                        setErrorMsg("");
                        setSuccessMsg("");
                        setLoadingAction(true);
                        const id = Number(row?.ID ?? 0);
                        if (!id) throw new Error("ID inválido para mover");
                        const codProm = toNumber(row?.CODPRECOPROM);
                        const resp = await excluirPromocao(id, codProm ?? undefined, historicoMover ?? undefined);
                        if (!resp.ok) throw new Error(resp.message || "Falha ao remover a campanha");
                        setShowMoverConfirm(false);
                        setShowMoverAddManual(true);
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : "Falha ao mover";
                        setErrorMsg(String(msg));
                        setTimeout(() => setErrorMsg(""), 3500);
                        setShowMoverConfirm(false);
                      } finally {
                        setLoadingAction(false);
                      }
                    }}
                  >
                    <TrashFill size={12} className="me-1" />
                    Remover e continuar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showMoverAddManual && (
        <ModalAdicionarProdutoManual
          isOpen={showMoverAddManual}
          onClose={() => setShowMoverAddManual(false)}
          codFilial={String(row?.CODFILIAL ?? "")}
          initialTipoCampanha={moverTipoCampanha}
          prefillRow={{
            CODFILIAL: Number(row?.CODFILIAL ?? 0),
            CODPROD: Number(row?.CODPROD ?? 0),
            DESCRICAO: String(row?.DESCRICAO ?? ""),
            CODAUXILIAR: String(row?.CODAUXILIAR ?? ""),
            MARCA: String(row?.MARCA ?? ""),
            PVENDA: toNumber(row?.PVENDA) ?? undefined,
          } as ProdutoVendaBaixaRow}
          resumoAnterior={{
            precoFixo: precoFixo || null,
            dataInicio: toDMYFromISO(dataInicio) || null,
            dataFim: toDMYFromISO(dataFim) || null,
          }}
          onSuccess={(novoId, produto) => {
            if (novoId && produto) {
              // Constrói objeto para edição imediata no ModalPrecificar
              const novoRow: ProdutoPromocaoRow = {
                ID: novoId,
                CODFILIAL: Number(produto.CODFILIAL || 0),
                CODPROD: Number(produto.CODPROD || 0),
                DESCRICAO: String(produto.DESCRICAO || ""),
                CODAUXILIAR: String(produto.CODAUXILIAR || ""),
                MARCA: String(produto.MARCA || ""),
                PVENDA: toNumber(produto.PVENDA || (produto as any).PRECO_VENDA) ?? undefined,
                CUSTOULTENT: toNumber(produto.CUSTOULTENT) ?? undefined,
                // Passa os valores que estavam sendo usados
                PRECOFIXO: precoFixo ? Number(precoFixo) : undefined,
                // Passa as datas atuais (formato YYYY-MM-DD do state) para que o useEffect preencha os inputs corretamente
                DT_INICIO_CAMPANHA: dataInicio || undefined,
                DT_FIM_CAMPANHA: dataFim || undefined,
                TIPOCAMPANHA: moverTipoCampanha,
                // Campos de custo/margem se disponíveis
                CUSTO_BASE: toNumber(produto.CUSTOULTENT) ?? undefined, // Estimativa
                PCOMINT1: 0, 
              };

              // Troca o produto em edição mantendo o modal aberto
              setRow(novoRow);
              
              // Fecha os modais de fluxo de mover
              setShowMoverAddManual(false);
              setShowMoverSelector(false);
              setShowMoverConfirm(false);
              
              // Opcional: Feedback
              setSuccessMsg("Produto movido. Confirme os dados e salve.");
            } else {
              // Fallback: Salva e fecha se não tiver detalhes do produto
              try { onSuccess && onSuccess(); } catch {}
              setShowMoverAddManual(false);
              setShowMoverSelector(false);
              onClose();
            }
          }}
        />
      )}
      <ModalHistoricoExclusao
        isOpen={showHistorico}
        onClose={() => setShowHistorico(false)}
        codProd={Number(row?.CODPROD || 0)}
      />
    </>
  );
};
export default ModalPrecificar;
