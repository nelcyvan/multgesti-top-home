import React, { useEffect, useMemo, useRef, useState } from "react";
import { buscarProdutosPromocaoAgregado, confirmarEncarte, type ProdutoPromocaoRow } from "../../services/gestmkt/ProdutosPromocao";
import { subirCampanha } from "../../services/gestmkt/SubirCampanha";
import ModalPrecificar from "./ModalPrecificar";
import { campanhaExisteLote } from "../../services/gestmkt/CampanhaExisteLote";
import type { CampanhaExisteItem } from "../../services/gestmkt/CampanhaExisteLote";
import { excluirPcprecoProm } from "../../services/gestmkt/ExcluirPromocao";
import { ArrowClockwise, ArrowUpCircleFill, Check2Circle, CheckCircleFill, ClipboardCheck, ClockFill, ExclamationTriangleFill, FlagFill, GearFill, InfoCircleFill, ListUl, PencilSquare, PlusCircle, QuestionCircleFill, Search, TrashFill, XCircleFill, XLg } from "react-bootstrap-icons";

interface ModalDetalheListaCampanhaProps {
  isOpen: boolean;
  onClose: () => void;
  rows: ProdutoPromocaoRow[];
  titulo: string;
}

type ExcluirPromocaoTarget = {
  id: number | null;
  codProm: number;
  codFilial: string;
  codProd: number;
  descricao?: string;
};

// Removido helper antigo não utilizado (toISOFromDMY)

const toDMYFromISO = (iso: string | undefined): string => {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-([01]?\d)-([0-3]?\d)$/);
  if (!m) return "";
  const yyyy = m[1];
  const mm = m[2].padStart(2, '0');
  const dd = m[3].padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
};

// Converte vários formatos (Date, ISO, DMY com horário) para valor de input date (YYYY-MM-DD)
const toInputDate = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  // Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    const yyyy = String(val.getFullYear());
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(val).trim();
  // Try ISO with time
  let m = s.match(/^(\d{4})-([01]?\d)-([0-3]?\d)/);
  if (m) {
    const yyyy = m[1];
    const mm = m[2].padStart(2, '0');
    const dd = m[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  // DMY, possibly with time
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

const ModalDetalheListaCampanha: React.FC<ModalDetalheListaCampanhaProps> = ({ isOpen, onClose, rows, titulo }) => {
  if (!isOpen) return null;

  const [editRows, setEditRows] = useState<ProdutoPromocaoRow[]>(rows);
  const [precificarIndex, setPrecificarIndex] = useState<number | null>(null);
  const [fPendentes, setFPendentes] = useState<boolean>(false);
  const [fEmCampanha, setFEmCampanha] = useState<boolean>(false);
  const [advQuery, setAdvQuery] = useState<string>("");
  const [validarAoSubir, setValidarAoSubir] = useState<boolean>(false);
  const [validarCampos, setValidarCampos] = useState<boolean>(false);
  const [validaContagem, setValidaContagem] = useState<{ ok: number; erro: number } | null>(null);
  const [subindoCampanha, setSubindoCampanha] = useState<boolean>(false);
  const [processedKeys, setProcessedKeys] = useState<Set<string>>(new Set());
  const [conflictKeys, setConflictKeys] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ type: 'success'|'danger'|'warning'|'info'; message: string } | null>(null);
  const [validandoCampanha, setValidandoCampanha] = useState<boolean>(false);
  const [validacaoResumo, setValidacaoResumo] = useState<{ ativos: number; pendentes: number } | null>(null);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [showCampanhaModal, setShowCampanhaModal] = useState<boolean>(false);
  const [campanhaItems, setCampanhaItems] = useState<CampanhaExisteItem[]>([]);
  const [excluindoCampanhaKey, setExcluindoCampanhaKey] = useState<string | null>(null);
  const [showConfirmIncluir, setShowConfirmIncluir] = useState<boolean>(false);
  const [incluirAlvo, setIncluirAlvo] = useState<ProdutoPromocaoRow[]>([]);
  const [showExcluirPromocaoConfirm, setShowExcluirPromocaoConfirm] = useState<boolean>(false);
  const [excluirPromocaoTarget, setExcluirPromocaoTarget] = useState<ExcluirPromocaoTarget | null>(null);
  
  // Estado para controle da coluna Encarte
  const [showEncarteConfirm, setShowEncarteConfirm] = useState<boolean>(false);
  const [encarteTargetRow, setEncarteTargetRow] = useState<ProdutoPromocaoRow | null>(null);
  
  // Estado para controle de Precificar (Status 'S' -> 'F')
  const [showPrecificarConfirm, setShowPrecificarConfirm] = useState<boolean>(false);
  const [precificarTargetRow, setPrecificarTargetRow] = useState<ProdutoPromocaoRow | null>(null);
  const [loadingRefresh, setLoadingRefresh] = useState<boolean>(false);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEditRows(rows);
  }, [rows]);

  useEffect(() => {
    if (!isOpen) return;
    const el = tableContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isOpen, editRows.length]);

  // Visualização: sem edição inline aqui

  const formatMesPromocao = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const s = String(val).trim();
    // ISO completo ou YYYY-MM-DD
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const [, yyyy, mm] = m;
      return `${mm}/${yyyy}`;
    }
    // YYYY-MM
    m = s.match(/^(\d{4})-(\d{2})$/);
    if (m) {
      const [, yyyy, mm] = m;
      return `${mm}/${yyyy}`;
    }
    // DD/MM/YYYY
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const [, , mm, yyyy] = m;
      return `${mm}/${yyyy}`;
    }
    return s;
  };

  // Normaliza números vindos como string com vírgula (ex.: "24,9") para Number
  const toNumber = (val: unknown): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number' && !isNaN(val)) return val;
    const s = String(val).trim();
    if (!s) return null;
    // troca vírgula decimal por ponto
    const normalized = s.replace(/,/g, '.');
    const n = Number(normalized);
    return isNaN(n) ? null : n;
  };

  const confirmarExclusaoPromocao = async (target: ExcluirPromocaoTarget) => {
    const key = `${String(target.codFilial)}-${String(target.codProd)}-${String(target.codProm)}`;
    try {
      setExcluindoCampanhaKey(key);
      const resp = await excluirPcprecoProm(target.codProm);
      if (!resp.ok) throw new Error(resp.message || 'Falha ao excluir PCPRECOPROM');
      setCampanhaItems((prev) => {
        const next = prev.filter(
          (x) =>
            !(
              String(x.CODFILIAL) === String(target.codFilial) &&
              Number(x.CODPROD || 0) === Number(target.codProd || 0) &&
              Number(x.CODPRECOPROM || 0) === Number(target.codProm || 0)
            )
        );
        if (next.length === 0) setShowCampanhaModal(false);
        return next;
      });
      setConflictKeys((prev) => {
        const next = new Set(prev);
        const k = `${String(editRows[0]?.TIPOCAMPANHA ?? 'X')}-${String(target.codProd)}-${String(target.codFilial)}`;
        next.delete(k);
        return next;
      });
      setValidacaoResumo((prev) => {
        if (!prev) return prev;
        return { ...prev, ativos: Math.max(0, Number(prev.ativos || 0) - 1) };
      });
      const ra = Number(resp.rowsAffected || 0);
      if (ra > 0) {
        setToast({ type: 'success', message: `Promoção ${target.codProm} excluída (PCPRECOPROM).` });
      } else {
        setToast({ type: 'warning', message: `Nenhum registro encontrado para excluir (CODPRECOPROM ${target.codProm}).` });
      }
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir PCPRECOPROM';
      setToast({ type: 'danger', message: String(msg) });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setExcluindoCampanhaKey(null);
    }
  };

  // Converte MM-YYYY ou outros formatos em YYYY-MM para API
  const toApiMesYYYYMM = (row: ProdutoPromocaoRow | undefined): string | null => {
    if (!row) return null;
    const v = String(row.MES_DATA_PROMOCAO ?? '').trim();
    if (v) {
      // MM-YYYY
      let m = v.match(/^([01]?\d)-?(\d{4})$/);
      if (m) {
        const mm = m[1].padStart(2, '0');
        const yyyy = m[2];
        return `${yyyy}-${mm}`;
      }
      // DD/MM/YYYY
      m = v.match(/^([0-3]?\d)\/([01]?\d)\/(\d{4})$/);
      if (m) {
        const mm = m[2].padStart(2, '0');
        const yyyy = m[3];
        return `${yyyy}-${mm}`;
      }
      // YYYY-MM or ISO
      m = v.match(/^(\d{4})-([01]?\d)/);
      if (m) {
        const yyyy = m[1];
        const mm = m[2].padStart(2, '0');
        return `${yyyy}-${mm}`;
      }
    }
    // tenta pelas datas de vigência
    const input = toInputDate(row.DT_INICIO_CAMPANHA ?? row.DTINICIOVIGENCIA);
    if (input) {
      return input.substring(0, 7); // YYYY-MM
    }
    return null;
  };

  const tipoFromTitulo = (t: string): 'PE' | 'PQ' | 'PP' | 'PA' | null => {
    const s = t.toLowerCase();
    if (s.includes('encarte')) return 'PE';
    if (s.includes('queima')) return 'PQ';
    if (s.includes('ponta')) return 'PP';
    if (s.includes('ação')) return 'PA';
    return null;
  };

  const refreshListaAtual = async (): Promise<ProdutoPromocaoRow[]> => {
    try {
      const mesParam = toApiMesYYYYMM(editRows[0]);
      const tipo = tipoFromTitulo(titulo) || String(editRows[0]?.TIPOCAMPANHA ?? '').toUpperCase() as any;
      if (!mesParam || !tipo) return [];
      const agg = await buscarProdutosPromocaoAgregado(mesParam);
      let novaLista: ProdutoPromocaoRow[] = [];
      if (tipo === 'PE') novaLista = agg.PE?.rows ?? [];
      else if (tipo === 'PQ') novaLista = agg.PQ?.rows ?? [];
      else if (tipo === 'PP') novaLista = agg.PP?.rows ?? [];
      else if (tipo === 'PA') novaLista = agg.PA?.rows ?? [];
      setEditRows(novaLista);
      return novaLista;
    } catch (err) {
      console.error('Falha ao recarregar lista após salvar:', err);
      return [];
    }
  };

  // Cálculo da margem com Preço Fixo (igual à coluna visual)
  // (removida: função não utilizada) const calcMargemPF

  // Considera valores nulos/vazios como "zero" para filtros solicitados
  // (removida: função não utilizada) const isZeroLike

  // Hoist: valida se a linha possui os campos obrigatórios
  function linhaValida(r: ProdutoPromocaoRow): boolean {
    const precoFixoOk = (toNumber(r.PRECOFIXO) ?? 0) > 0;
    const inicioOk = !!toInputDate(r.DT_INICIO_CAMPANHA ?? r.DTINICIOVIGENCIA);
    const fimOk = !!toInputDate(r.DT_FIM_CAMPANHA ?? r.DTFIMVIGENCIA);
    return precoFixoOk && inicioOk && fimOk;
  }

  const filteredRows = useMemo(() => {
    let out = editRows;
    // Só permite filtrar por switches após validação de campanha
    if (validarCampos) {
      // Filtra pendentes: falta preço fixo ou datas
      if (fPendentes) {
        out = out.filter((r) => !linhaValida(r));
      }
      // Filtra em campanha: usa conflictKeys (resultado da validação)
      if (fEmCampanha) {
        out = out.filter((r) => {
          const keyRow = `${String(r.TIPOCAMPANHA ?? 'X')}-${String(r.CODPROD ?? '0')}-${String(r.CODFILIAL ?? '')}`;
          return conflictKeys.has(keyRow);
        });
      }
    }
    const q = advQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        const campos = [
          String(r.CODPROD ?? '').toLowerCase(),
          String(r.CODAUXILIAR ?? '').toLowerCase(),
          String(r.DESCRICAO ?? '').toLowerCase(),
          String(r.MARCA ?? '').toLowerCase(),
          String(r.TIPOCAMPANHA ?? '').toLowerCase(),
          String(r.CODPRECOPROM ?? '').toLowerCase(),
          String(r.CODFILIAL ?? '').toLowerCase(),
        ];
        return campos.some((c) => c.includes(q));
      });
    }
    return out;
  }, [editRows, fPendentes, fEmCampanha, advQuery, conflictKeys, validarCampos]);

  // Só permite subir campanha quando já houve validação e não há pendências nem conflitos
  const podeSubir = useMemo(() => {
    if (!validarCampos) return false;
    const pend = Number(validacaoResumo?.pendentes ?? 0);
    const conflitos = conflictKeys.size;
    return pend === 0 && conflitos === 0;
  }, [validarCampos, validacaoResumo, conflictKeys]);

  const hasProdutosProntos = useMemo(() => {
    if (!validarCampos) return false;
    return filteredRows.some((r) => {
      const linhaOk = linhaValida(r);
      const ativado = isAtivado(r);
      const keyRow = `${String(r.TIPOCAMPANHA ?? 'X')}-${String(r.CODPROD ?? '0')}-${String(r.CODFILIAL ?? '')}`;
      const processed = processedKeys.has(keyRow);
      const conflict = conflictKeys.has(keyRow);
      return linhaOk && !ativado && !processed && !conflict;
    });
  }, [filteredRows, validarCampos, processedKeys, conflictKeys]);

  // Sinalizador: produto ativado (verde) — baseado em Cód.Promoc.
  function isAtivado(row: ProdutoPromocaoRow): boolean {
    const codProm = Number(row.CODPRECOPROM ?? 0);
    return codProm !== 0;
  }

  // (movido acima) linhaValida

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2995, backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3000 }}>
        <div className="modal-dialog modal-fullscreen" role="document">
          <div className="modal-content" style={{ fontSize: "0.75rem", boxShadow: "0 0.75rem 1.5rem rgba(0,0,0,0.35)", display: "flex", flexDirection: "column" }}>
            <div className="modal-header py-2">
              <div className="d-flex align-items-center justify-content-between w-100">
                <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                  <ListUl size={16} className="me-2 text-primary" />
                  {titulo} — Detalhes ({rows.length})
                </h5>
                <div className="d-flex align-items-center gap-3 flex-wrap" style={{ fontSize: "0.7rem", lineHeight: 1 }}>
                  {/* Switches de filtro novos */}
                  <div className="form-check form-switch m-0 d-flex align-items-center">
                    <input className="form-check-input" type="checkbox" id="fPendentes" checked={fPendentes} disabled={!validarCampos} onChange={(e) => setFPendentes(e.target.checked)} />
                    <label className="form-check-label mb-0 ms-2 d-inline-flex align-items-center" htmlFor="fPendentes">
                      <ExclamationTriangleFill size={12} className="me-1 text-danger" />
                      Produtos pendentes
                    </label>
                  </div>
                  <div className="form-check form-switch m-0 d-flex align-items-center">
                    <input className="form-check-input" type="checkbox" id="fEmCampanha" checked={fEmCampanha} disabled={!validarCampos} onChange={(e) => setFEmCampanha(e.target.checked)} />
                    <label className="form-check-label mb-0 ms-2 d-inline-flex align-items-center" htmlFor="fEmCampanha">
                      <FlagFill size={12} className="me-1" style={{ color: "#6f42c1" }} />
                      Produtos já com campanhas
                    </label>
                  </div>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
                </div>
              </div>
            </div>
            <div className="modal-body d-flex flex-column" style={{ fontSize: "0.75rem", lineHeight: 1.1, ["--input-font-size" as any]: "0.7rem", overflow: "hidden" }}>
              {/* Pesquisa avançada abaixo dos switches e acima da tabela */}
              {validarAoSubir && validaContagem && (
                <div className="alert alert-info py-2 mb-2" role="alert" style={{ fontSize: "0.75rem" }}>
                  <InfoCircleFill size={14} className="me-1" />
                  Subir campanha: {validaContagem.ok} linhas válidas, {validaContagem.erro} linhas com pendências.
                </div>
              )}
              {toast && (
                <div className={`alert alert-${toast.type} alert-dismissible py-2 mb-2`} role="alert" style={{ fontSize: "0.75rem" }}>
                  <span className="me-1">
                    {toast.type === "success" ? (
                      <CheckCircleFill size={14} />
                    ) : toast.type === "danger" ? (
                      <XCircleFill size={14} />
                    ) : toast.type === "warning" ? (
                      <ExclamationTriangleFill size={14} />
                    ) : (
                      <InfoCircleFill size={14} />
                    )}
                  </span>
                  {toast.message}
                  <button type="button" className="btn-close" aria-label="Close" onClick={() => setToast(null)} />
                </div>
              )}
              {/* Legenda de cores */}
              <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: "0.7rem" }}>
                <span className="badge bg-success d-inline-flex align-items-center gap-1"><CheckCircleFill size={12} />Produto ativado</span>
                <span className="badge bg-danger d-inline-flex align-items-center gap-1"><ExclamationTriangleFill size={12} />Produto pendente</span>
                <span className="badge bg-warning text-dark d-inline-flex align-items-center gap-1"><Check2Circle size={12} />Produto pronto</span>
                <span className="badge d-inline-flex align-items-center gap-1" style={{ backgroundColor: '#6f42c1', color: '#fff' }}><FlagFill size={12} />Já possui campanha no mês</span>
              </div>
              <div className="row g-2 align-items-center mb-2">
                <div className="col-12 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center" style={{ minHeight: 26 }}>
                    {validacaoResumo && (
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                        Encontrados {validacaoResumo.ativos} produtos com campanha ativa no mês. — Pendentes: {validacaoResumo.pendentes}
                      </div>
                    )}
                  </div>
                  <div className="d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-1 px-2 d-flex align-items-center gap-1"
                      style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                      onClick={async () => {
                        setLoadingRefresh(true);
                        try {
                          await refreshListaAtual();
                        } finally {
                          setLoadingRefresh(false);
                        }
                      }}
                      disabled={loadingRefresh}
                      title="Recarregar informações"
                    >
                      {loadingRefresh ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <ArrowClockwise size={14} />
                      )}
                      {loadingRefresh ? 'Atualizando...' : 'Atualizar'}
                    </button>
                    <div className="input-group input-group-sm" style={{ width: 200 }}>
                      <span className="input-group-text">
                        <Search size={14} />
                      </span>
                      <input
                        type="text"
                        maxLength={50}
                        className="form-control"
                        placeholder="Pesquisa avançada"
                        value={advQuery}
                        onChange={(e) => setAdvQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Somente visualização nessa lista */}
              <div ref={tableContainerRef} className="table-responsive" style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                <table className="table table-sm align-middle" style={{ fontSize: "0.7rem" }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f8f9fa' }}>
                    <tr>
                      <th style={{ width: 80 }}>ID</th>
                      <th style={{ width: 80 }}>Filial</th>
                      <th style={{ width: 100 }}>Código</th>
                      <th style={{ width: 140 }}>Cód.Barras</th>
                      <th style={{ width: 280 }}>Descrição</th>
                      <th style={{ width: 140 }}>Marca</th>
                      <th style={{ width: 120 }}>Tipo</th>
                      <th style={{ width: 110 }}>Mês Promoção</th>
                      <th style={{ width: 120 }}>Adicionado</th>
                      <th style={{ width: 120 }}>Usuário</th>
                      <th style={{ width: 120 }}>Cód.Promoc.</th>
                      <th style={{ width: 240 }} className="text-end">Preço Fictício</th>
                      <th style={{ width: 240 }} className="text-end">Preço Fixo</th>
                      <th style={{ width: 110 }} className="text-end">Venda</th>
                      <th style={{ width: 110 }} className="text-end">Custo</th>
                      <th style={{ width: 120 }} className="text-end">Margem (atual%)</th>
                      <th style={{ width: 130 }} className="text-end">Margem (P.Fixo%)</th>
                      <th style={{ width: 120 }}>Início Vigência</th>
                      <th style={{ width: 120 }}>Fim Vigência</th>
                      <th style={{ width: 140 }}><ClipboardCheck size={12} className="me-1" />Encarte</th>
                      <th style={{ width: 140 }}><GearFill size={12} className="me-1" />Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={20} className="text-muted">Nenhum item nesta lista</td>
                      </tr>
                    )}
                    {filteredRows.length === 0 && rows.length > 0 && (
                      <tr>
                        <td colSpan={20} className="text-muted">Nenhum item após filtros</td>
                      </tr>
                    )}
                    {filteredRows.map((r, idx) => {
                      const linhaOk = linhaValida(r);
                      const ativado = isAtivado(r);
                      const keyRow = `${String(r.TIPOCAMPANHA ?? 'X')}-${String(r.CODPROD ?? '0')}-${String(r.CODFILIAL ?? '')}`;
                      const processed = processedKeys.has(keyRow);
                      const conflict = conflictKeys.has(keyRow);
                      // Prioridade de cores:
                      // Vermelho: pendente (faltam campos obrigatórios)
                      // Verde: Cód.Promoc. preenchido OU já processado, com campos válidos
                      // Amarelo: pronto (válido) e sem Cód.Promoc.
                      let rowClass: string | undefined;
                      if (!linhaOk) rowClass = 'table-danger';
                      else if (ativado || processed) rowClass = 'table-success';
                      else rowClass = 'table-warning';
                      const rowStyle: React.CSSProperties | undefined = conflict ? { backgroundColor: '#e9d5ff' } : undefined;
                      const cellStyle: React.CSSProperties | undefined = conflict ? { backgroundColor: '#e9d5ff' } : undefined;
                      return (
                      <tr key={`${String(r.TIPOCAMPANHA ?? 'X')}-${String(r.CODPROD ?? '0')}-${idx}`} className={rowClass} style={rowStyle}>
                        <td style={cellStyle}>{String(r.ID ?? '')}</td>
                        <td style={cellStyle}>{String(r.CODFILIAL ?? '')}</td>
                        <td style={cellStyle}>{String(r.CODPROD ?? '')}</td>
                        <td style={cellStyle}>{String(r.CODAUXILIAR ?? '')}</td>
                        <td className="text-truncate" title={String(r.DESCRICAO ?? '')} style={cellStyle}>{String(r.DESCRICAO ?? '')}</td>
                        <td style={cellStyle}>{String(r.MARCA ?? '')}</td>
                        <td style={cellStyle}>{String(r.TIPOCAMPANHA ?? '')}</td>
                        <td style={cellStyle}>{formatMesPromocao(r.MES_DATA_PROMOCAO)}</td>
                        <td style={cellStyle}>{String(r.DT_ADD ?? '')}</td>
                        <td style={cellStyle}>{String(r.CODUSUR_ADD ?? '')}</td>
                        <td style={cellStyle}>{String(r.CODPRECOPROM ?? '')}</td>
                        <td className="text-end" style={cellStyle}>
                          {toNumber(r.PRECOFICTICIO) === null
                            ? "-"
                            : Number(toNumber(r.PRECOFICTICIO) ?? 0).toFixed(2)}
                        </td>
                        <td className="text-end text-danger" style={cellStyle}>
                          {toNumber(r.PRECOFIXO) === null
                            ? "-"
                            : Number(toNumber(r.PRECOFIXO) ?? 0).toFixed(2)}
                        </td>
                        <td className="text-end" style={cellStyle}>{Number(r.PVENDA ?? 0).toFixed(2)}</td>
                        <td className="text-end" style={cellStyle}>{Number(r.CUSTO_BASE ?? r.CUSTOREAL ?? r.CUSTOULTENTLIQ ?? r.CUSTOULTENT ?? 0).toFixed(2)}</td>
                        <td className="text-end text-primary" style={cellStyle}>{Number(r.MARGEM_PRECIFICACAO ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-end text-success" style={cellStyle}>
                          {(() => {
                            const pf = toNumber(r.PRECOFIXO) ?? 0;
                            const pc = toNumber(r.PCOMINT1) ?? 0;
                            const custoBase = (typeof r.CUSTO_BASE === 'number' ? r.CUSTO_BASE
                              : (typeof r.CUSTOREAL === 'number' ? r.CUSTOREAL
                              : (typeof r.CUSTOULTENTLIQ === 'number' ? r.CUSTOULTENTLIQ
                              : (typeof r.CUSTOULTENT === 'number' ? r.CUSTOULTENT : 0))));
                            const comissao = pf * (pc / 100);
                            const cmv = custoBase + comissao;
                            const margemPF = pf > 0 ? (((pf - cmv) / pf) * 100) : 0;
                            return Number(margemPF).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          })()}
                        </td>
                        <td style={cellStyle}>
                          {(() => {
                            const d = toDMYFromISO(toInputDate(r.DT_INICIO_CAMPANHA ?? r.DTINICIOVIGENCIA));
                            return d || "-";
                          })()}
                        </td>
                        <td style={cellStyle}>
                          {(() => {
                            const d = toDMYFromISO(toInputDate(r.DT_FIM_CAMPANHA ?? r.DTFIMVIGENCIA));
                            return d || "-";
                          })()}
                        </td>
                        <td style={cellStyle} className="text-center">
                          {(() => {
                            // STATUS_ENCARTE: 
                            // 'F' -> Feito (Verde)
                            // 'S' -> Precificar (Azul)
                            // null/vazio -> Pendente (Amarelo)

                            const status = r.STATUS_ENCARTE;

                            if (status === 'F') {
                              return <span className="badge bg-success d-inline-flex align-items-center justify-content-center gap-1" style={{ minWidth: 70 }}><CheckCircleFill size={12} />Feito</span>;
                            }
                            
                            if (status === 'S') {
                              return (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm py-0 px-2"
                                  style={{ fontSize: "0.7rem", minWidth: 70 }}
                                  onClick={() => {
                                    setPrecificarTargetRow(r);
                                    setShowPrecificarConfirm(true);
                                  }}
                                >
                                  <Check2Circle size={12} className="me-1" />
                                  Finalizar
                                </button>
                              );
                            }

                            // Pendente
                            return (
                              <button
                                type="button"
                                className="btn btn-warning btn-sm py-0 px-2"
                                style={{ fontSize: "0.7rem", color: "#000", minWidth: 70 }}
                                onClick={() => {
                                  setEncarteTargetRow(r);
                                  setShowEncarteConfirm(true);
                                }}
                              >
                                <ClockFill size={12} className="me-1" />
                                Pendente
                              </button>
                            );
                          })()}
                        </td>
                        <td style={cellStyle}>
                          <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm py-1 px-2"
                            style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                            onClick={() => {
                              const key = `${String(r.TIPOCAMPANHA ?? 'X')}-${String(r.CODPROD ?? '0')}`;
                              const found = editRows.findIndex((x) => `${String(x.TIPOCAMPANHA ?? 'X')}-${String(x.CODPROD ?? '0')}` === key);
                              setPrecificarIndex(found >= 0 ? found : idx);
                            }}
                          >
                            <PencilSquare size={12} className="me-1" />
                            Gerenciar
                          </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-success btn-sm py-1 px-2 me-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                disabled={!validarCampos || !hasProdutosProntos}
                title={validarCampos ? 'Incluir itens com status Produto pronto' : 'Habilita após clicar em Validar'}
                onClick={() => {
                  const alvo = filteredRows.filter((r) => {
                    const linhaOk = linhaValida(r);
                    const ativado = isAtivado(r);
                    const keyRow = `${String(r.TIPOCAMPANHA ?? 'X')}-${String(r.CODPROD ?? '0')}-${String(r.CODFILIAL ?? '')}`;
                    const processed = processedKeys.has(keyRow);
                    const conflict = conflictKeys.has(keyRow);
                    return linhaOk && !ativado && !processed && !conflict;
                  });
                  if (alvo.length === 0) {
                    setToast({ type: 'warning', message: 'Nenhum Produto pronto para incluir.' });
                    setTimeout(() => setToast(null), 3000);
                    return;
                  }
                  setIncluirAlvo(alvo);
                  setShowConfirmIncluir(true);
                }}
              >
                <PlusCircle size={12} className="me-1" />
                Incluir
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                // Só libera subir após validação sem pendências e sem conflitos
                disabled={subindoCampanha || !podeSubir}
                title={podeSubir ? 'Processa todos os itens filtrados' : 'Habilita após validar sem pendências e sem campanhas ativas'}
                onClick={async () => {
                  if (subindoCampanha) return;
                  setSubindoCampanha(true);
                  setValidarAoSubir(true);
                  try {
                    setProgressText('Subindo, aguarde...');
                    setShowProgress(true);
                    // Processa todas as linhas visíveis/filtradas
                    const alvo = filteredRows;
                    const usuarioLogadoRaw = localStorage.getItem("usuarioLogado");
                    let matricula = 0;
                    try {
                      if (usuarioLogadoRaw) {
                        const u = JSON.parse(usuarioLogadoRaw || '{}');
                        const mStr = String(u?.matricula ?? '').trim();
                        if (mStr && !isNaN(Number(mStr))) matricula = Number(mStr);
                      }
                    } catch {}
                    // fallback simples
                    if (!matricula) matricula = Number(String(alvo[0]?.CODUSUR_ADD ?? 0)) || 0;

                    let okCount = 0; let errCount = 0;
                    for (const r of alvo) {
                      // Valida linha: preço fixo e datas
                      const precoFixo = Number((typeof r.PRECOFIXO === 'number' ? r.PRECOFIXO : Number(String(r.PRECOFIXO || '0').replace(',', '.'))) || 0);
                      const dtIni = toInputDate(r.DT_INICIO_CAMPANHA ?? r.DTINICIOVIGENCIA);
                      const dtFim = toInputDate(r.DT_FIM_CAMPANHA ?? r.DTFIMVIGENCIA);
                      const id = Number(r.ID || 0);
                      const codProd = Number(r.CODPROD || 0);
                      const codFilial = String(r.CODFILIAL || '');
                      if (!id || !codProd || !codFilial || !precoFixo || !dtIni || !dtFim) {
                        errCount++;
                        continue;
                      }
                      try {
                        const resp = await subirCampanha({
                          id,
                          produtos: [{ codProd }],
                          codFilial,
                          precoFixo,
                          dtInicio: dtIni,
                          dtFim: dtFim,
                          codFuncUltAlter: matricula,
                        });
                        const sucesso = resp?.resultados?.[0]?.sucesso === true;
                        const codPromRet = resp?.resultados?.[0]?.codPrecoProm ?? null;
                        if (sucesso) {
                          okCount++;
                          // Atualiza visual: seta CODPRECOPROM retornado e marca linha como sucesso
                          setEditRows((prev) => prev.map((x) => {
                            if (String(x.CODPROD) === String(r.CODPROD) && String(x.CODFILIAL) === String(r.CODFILIAL)) {
                              return { ...x, CODPRECOPROM: codPromRet ?? x.CODPRECOPROM };
                            }
                            return x;
                          }));
                          const k = `${String(r.TIPOCAMPANHA ?? 'X')}-${String(r.CODPROD ?? '0')}-${String(r.CODFILIAL ?? '')}`;
                          setProcessedKeys((prev) => {
                            const next = new Set(prev);
                            next.add(k);
                            return next;
                          });
                        } else {
                          const msg = String(resp?.erros?.[0]?.erro || 'Falha ao subir campanha');
                          setToast({ type: 'danger', message: msg });
                          setTimeout(() => setToast(null), 5000);
                          errCount++;
                        }
                      } catch (e) {
                        console.error('Falha ao subir campanha:', e);
                        const msg = (e as any)?.message || 'Falha ao subir campanha';
                        setToast({ type: 'danger', message: msg });
                        setTimeout(() => setToast(null), 5000);
                        errCount++;
                      }
                    }
                    setValidaContagem({ ok: okCount, erro: errCount });
                  } finally {
                    setShowProgress(false);
                    // Exige nova validação para reabilitar o botão Subir
                    setValidarCampos(false);
                    setTimeout(() => setSubindoCampanha(false), 600);
                  }
                }}
              >
                <ArrowUpCircleFill size={12} className="me-1" />
                Subir
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm py-1 px-2 ms-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                disabled={validandoCampanha}
                onClick={async () => {
                  if (validandoCampanha) return;
                  try {
                    setValidandoCampanha(true);
                    // Recarrega a lista antes de validar
                    let baseRows: ProdutoPromocaoRow[] = filteredRows;
                    try {
                      const nova = await refreshListaAtual();
                      if (Array.isArray(nova)) baseRows = nova;
                    } catch {}
                    // Coleta todos códigos e filiais visíveis
                    const cods = baseRows
                      .map((r) => Number(r.CODPROD || 0))
                      .filter((n) => !!n);
                    const codFilial = String(baseRows[0]?.CODFILIAL || '');
                    if (cods.length === 0 || !codFilial) {
                      setToast({ type: 'warning', message: 'Nenhuma linha para validar ou filial ausente.' });
                      return;
                    }

                    const resp = await campanhaExisteLote(cods, codFilial);
                    const emCampanha = new Set<string>();
                    for (const it of (resp.items || [])) {
                      const key = `${String(baseRows[0]?.TIPOCAMPANHA ?? 'X')}-${String(it.CODPROD)}-${String(it.CODFILIAL)}`;
                      emCampanha.add(key);
                    }

                    setConflictKeys(emCampanha);
                    setValidarCampos(true);
                    const pendentes = baseRows.reduce((acc, r) => acc + (linhaValida(r) ? 0 : 1), 0);
                    setValidacaoResumo({ ativos: resp.count ?? 0, pendentes });
                    setCampanhaItems(resp.items || []);
                    if ((resp.items || []).length > 0) setShowCampanhaModal(true);
                  } catch (err: any) {
                    console.error('Falha ao validar campanha:', err);
                    const msg = String(err?.message || 'Falha ao validar campanha');
                    setToast({ type: 'danger', message: msg });
                    setShowCampanhaModal(false);
                    setConflictKeys(new Set());
                    setTimeout(() => setToast(null), 5000);
                  } finally {
                    setValidandoCampanha(false);
                  }
                }}
              >
                {validandoCampanha ? (
                  'Validando...'
                ) : (
                  <>
                    <ClipboardCheck size={12} className="me-1" />
                    Validar
                  </>
                )}
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
    {precificarIndex !== null && (
      <ModalPrecificar
        isOpen={true}
        row={editRows[precificarIndex]}
        onClose={() => setPrecificarIndex(null)}
        onSuccess={async () => {
          // Fecha o modal de precificação e recarrega a lista atual
          try {
            await refreshListaAtual();
          } catch {}
        }}
      />
    )}
    {showConfirmIncluir && (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 3110, backgroundColor: "rgba(0,0,0,0.35)" }} />
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3120 }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(520px, 95vw)" }}>
            <div className="modal-content" style={{ fontSize: "0.75rem" }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                  <QuestionCircleFill size={16} className="me-2 text-primary" />
                  Confirmar Inclusão
                </h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowConfirmIncluir(false)} />
              </div>
              <div className="modal-body">
                <p>Deseja realmente incluir os itens Produtos prontos?</p>
                <p className="text-muted">Quantidade de itens prontos: {incluirAlvo.length}</p>
              </div>
              <div className="modal-footer py-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowConfirmIncluir(false)}>
                  <XCircleFill size={12} className="me-1" />
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    setShowConfirmIncluir(false);
                    if (subindoCampanha) return;
                    setSubindoCampanha(true);
                    setValidarAoSubir(true);
                    try {
                      setProgressText('Incluindo itens prontos...');
                      setShowProgress(true);
                      const alvo = incluirAlvo;
                      const usuarioLogadoRaw = localStorage.getItem("usuarioLogado");
                      let matricula = 0;
                      try {
                        if (usuarioLogadoRaw) {
                          const u = JSON.parse(usuarioLogadoRaw || '{}');
                          const mStr = String(u?.matricula ?? '').trim();
                          if (mStr && !isNaN(Number(mStr))) matricula = Number(mStr);
                        }
                      } catch {}
                      if (!matricula) matricula = Number(String(alvo[0]?.CODUSUR_ADD ?? 0)) || 0;
                      let okCount = 0; let errCount = 0;
                      for (const r of alvo) {
                        const precoFixo = Number((typeof r.PRECOFIXO === 'number' ? r.PRECOFIXO : Number(String(r.PRECOFIXO || '0').replace(',', '.'))) || 0);
                        const dtIni = toInputDate(r.DT_INICIO_CAMPANHA ?? r.DTINICIOVIGENCIA);
                        const dtFim = toInputDate(r.DT_FIM_CAMPANHA ?? r.DTFIMVIGENCIA);
                        const id = Number(r.ID || 0);
                        const codProd = Number(r.CODPROD || 0);
                        const codFilial = String(r.CODFILIAL || '');
                        if (!id || !codProd || !codFilial || !precoFixo || !dtIni || !dtFim) {
                          errCount++;
                          continue;
                        }
                        try {
                          const resp = await subirCampanha({
                            id,
                            produtos: [{ codProd }],
                            codFilial,
                            precoFixo,
                            dtInicio: dtIni,
                            dtFim: dtFim,
                            codFuncUltAlter: matricula,
                          });
                          const sucesso = resp?.resultados?.[0]?.sucesso === true;
                          const codPromRet = resp?.resultados?.[0]?.codPrecoProm ?? null;
                          if (sucesso) {
                            okCount++;
                            setEditRows((prev) => prev.map((x) => {
                              if (String(x.CODPROD) === String(r.CODPROD) && String(x.CODFILIAL) === String(r.CODFILIAL)) {
                                return { ...x, CODPRECOPROM: codPromRet ?? x.CODPRECOPROM };
                              }
                              return x;
                            }));
                            const k = `${String(r.TIPOCAMPANHA ?? 'X')}-${String(r.CODPROD ?? '0')}-${String(r.CODFILIAL ?? '')}`;
                            setProcessedKeys((prev) => {
                              const next = new Set(prev);
                              next.add(k);
                              return next;
                            });
                          } else {
                            const msg = String(resp?.erros?.[0]?.erro || 'Falha ao subir campanha');
                            setToast({ type: 'danger', message: msg });
                            setTimeout(() => setToast(null), 5000);
                            errCount++;
                          }
                        } catch (e) {
                          const msg = (e as any)?.message || 'Falha ao subir campanha';
                          setToast({ type: 'danger', message: msg });
                          setTimeout(() => setToast(null), 5000);
                          errCount++;
                        }
                      }
                      setValidaContagem({ ok: okCount, erro: errCount });
                      if (okCount > 0) {
                        setValidarCampos(false);
                      }
                    } finally {
                      setShowProgress(false);
                      setIncluirAlvo([]);
                      setTimeout(() => setSubindoCampanha(false), 600);
                    }
                  }}
                >
                  <CheckCircleFill size={12} className="me-1" />
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    {showProgress && (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 3110, backgroundColor: "rgba(0,0,0,0.35)" }} />
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3120 }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(420px, 90vw)" }}>
            <div className="modal-content" style={{ fontSize: "0.75rem" }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                  <InfoCircleFill size={16} className="me-2 text-primary" />
                  Status
                </h5>
              </div>
              <div className="modal-body">
                <div className="d-flex align-items-center gap-2">
                  <div className="spinner-border spinner-border-sm text-danger" role="status" aria-hidden="true" />
                  <span>{progressText || 'Subindo, aguarde...'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    {showCampanhaModal && (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 3110, backgroundColor: "rgba(0,0,0,0.35)" }} />
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3120 }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(1100px, 95vw)" }}>
            <div className="modal-content" style={{ fontSize: "0.75rem" }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>
                  <FlagFill size={16} className="me-2" style={{ color: "#6f42c1" }} />
                  Produtos já em campanha no mês
                </h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowCampanhaModal(false)} />
              </div>
              <div className="modal-body">
                <div className="table-responsive" style={{ maxHeight: 420, overflowY: "auto" }}>
                  <table className="table table-sm align-middle" style={{ fontSize: "0.7rem" }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f8f9fa' }}>
                      <tr>
                        <th style={{ width: 90 }}>Filial</th>
                        <th style={{ width: 110 }}>Código</th>
                        <th style={{ width: 320 }}>Descrição</th>
                        <th style={{ width: 140 }}>Cod Preço Prom</th>
                        <th style={{ width: 140 }}>Início Vigência</th>
                        <th style={{ width: 140 }}>Fim Vigência</th>
                        <th style={{ width: 140 }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campanhaItems.filter((it) => {
                        const r = editRows.find(x => String(x.CODFILIAL || '') === String(it.CODFILIAL || '') && Number(x.CODPROD || 0) === Number(it.CODPROD || 0));
                        return !!r && Number(r.CODPRECOPROM ?? 0) === 0;
                      }).length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-muted">Nenhum produto em campanha</td>
                        </tr>
                      )}
                      {campanhaItems.filter((it) => {
                        const r = editRows.find(x => String(x.CODFILIAL || '') === String(it.CODFILIAL || '') && Number(x.CODPROD || 0) === Number(it.CODPROD || 0));
                        return !!r && Number(r.CODPRECOPROM ?? 0) === 0;
                      }).map((it, idx) => {
                        const r = editRows.find(x => String(x.CODFILIAL || '') === String(it.CODFILIAL || '') && Number(x.CODPROD || 0) === Number(it.CODPROD || 0));
                        return (
                          <tr key={`${String(it.CODFILIAL)}-${String(it.CODPROD)}-${idx}`}>
                            <td>{String(it.CODFILIAL || '')}</td>
                            <td>{Number(it.CODPROD || 0)}</td>
                            <td className="text-truncate" title={String(r?.DESCRICAO ?? '')}>{String(r?.DESCRICAO ?? '')}</td>
                            <td>{Number(it.CODPRECOPROM || 0)}</td>
                            <td>{String(it.DTINICIOVIGENCIA || '')}</td>
                            <td>{String(it.DTFIMVIGENCIA || '')}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={excluindoCampanhaKey === `${String(it.CODFILIAL)}-${String(it.CODPROD)}-${String(it.CODPRECOPROM || 0)}`}
                                onClick={async () => {
                                  const codProm = Number(it.CODPRECOPROM || 0);
                                  if (!codProm) {
                                    setToast({ type: 'warning', message: 'Código de preço promocional inválido para exclusão.' });
                                    setTimeout(() => setToast(null), 3500);
                                    return;
                                  }

                                  const id = Number(r?.ID ?? 0) || null;
                                  setExcluirPromocaoTarget({
                                    id,
                                    codProm,
                                    codFilial: String(it.CODFILIAL || ''),
                                    codProd: Number(it.CODPROD || 0),
                                    descricao: String(r?.DESCRICAO ?? ''),
                                  });
                                  setShowExcluirPromocaoConfirm(true);
                                }}
                              >
                                <TrashFill size={12} className="me-1" />
                                Excluir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer py-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCampanhaModal(false)}>
                  <XLg size={12} className="me-1" />
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    {showExcluirPromocaoConfirm && excluirPromocaoTarget && (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 3130, backgroundColor: "rgba(0,0,0,0.35)" }} />
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3140 }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(520px, 95vw)" }}>
            <div className="modal-content" style={{ fontSize: "0.85rem" }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: "1rem" }}>
                  <QuestionCircleFill size={16} className="me-2 text-danger" />
                  Confirmar Exclusão
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Fechar"
                  onClick={() => {
                    setShowExcluirPromocaoConfirm(false);
                    setExcluirPromocaoTarget(null);
                  }}
                />
              </div>
              <div className="modal-body">
                <p className="mb-2">
                  Deseja excluir a promoção <strong>CODPRECOPROM {excluirPromocaoTarget.codProm}</strong>?
                </p>
                <div className="card p-2 bg-light">
                  <div><strong>Filial:</strong> {excluirPromocaoTarget.codFilial}</div>
                  <div><strong>Cód:</strong> {excluirPromocaoTarget.codProd}</div>
                  {!!excluirPromocaoTarget.descricao && (
                    <div className="text-truncate" title={excluirPromocaoTarget.descricao}>
                      <strong>Produto:</strong> {excluirPromocaoTarget.descricao}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowExcluirPromocaoConfirm(false);
                    setExcluirPromocaoTarget(null);
                  }}
                >
                  <XCircleFill size={12} className="me-1" />
                  Não
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={excluindoCampanhaKey === `${String(excluirPromocaoTarget.codFilial)}-${String(excluirPromocaoTarget.codProd)}-${String(excluirPromocaoTarget.codProm)}`}
                  onClick={async () => {
                    const target = excluirPromocaoTarget;
                    setShowExcluirPromocaoConfirm(false);
                    setExcluirPromocaoTarget(null);
                    await confirmarExclusaoPromocao(target);
                  }}
                >
                  <TrashFill size={12} className="me-1" />
                  Sim, excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    {showEncarteConfirm && encarteTargetRow && (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 3130, backgroundColor: "rgba(0,0,0,0.35)" }} />
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3140 }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(500px, 95vw)" }}>
            <div className="modal-content" style={{ fontSize: "0.85rem" }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: "1rem" }}>
                  <ClipboardCheck size={16} className="me-2 text-primary" />
                  Confirmar Encarte
                </h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowEncarteConfirm(false)} />
              </div>
              <div className="modal-body">
                <p className="mb-2">Deseja marcar este produto como <strong>Pendente &rarr; Finalizar</strong>?</p>
                <div className="card p-2 bg-light">
                  <div><strong>Cód:</strong> {encarteTargetRow.CODPROD}</div>
                  <div><strong>Produto:</strong> {encarteTargetRow.DESCRICAO}</div>
                  <div><strong>Filial:</strong> {encarteTargetRow.CODFILIAL}</div>
                  <div><strong>Preço Fixo:</strong> {Number(encarteTargetRow.PRECOFIXO || 0).toFixed(2)}</div>
                </div>
              </div>
              <div className="modal-footer py-2">
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setShowEncarteConfirm(false)}
                >
                  <XCircleFill size={12} className="me-1" />
                  Não
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={async () => {
                    if (!encarteTargetRow?.ID) return;
                    try {
                      // Default is 'S'
                      const res = await confirmarEncarte(encarteTargetRow.ID);
                      if (res.ok) {
                        setEditRows(prev => prev.map(r => {
                          if (r === encarteTargetRow) {
                            return { ...r, STATUS_ENCARTE: 'S' };
                          }
                          return r;
                        }));
                        setToast({ type: 'success', message: 'Encarte confirmado (Finalizar)!' });
                        setTimeout(() => setToast(null), 3000);
                      }
                    } catch (err: any) {
                      console.error('Falha ao confirmar encarte:', err);
                      setToast({ type: 'danger', message: err.message || 'Erro ao confirmar encarte' });
                      setTimeout(() => setToast(null), 5000);
                    } finally {
                      setShowEncarteConfirm(false);
                      setEncarteTargetRow(null);
                    }
                  }}
                >
                  <CheckCircleFill size={12} className="me-1" />
                  Sim
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    {showPrecificarConfirm && precificarTargetRow && (
      <>
        <div className="modal-backdrop fade show" style={{ zIndex: 3130, backgroundColor: "rgba(0,0,0,0.35)" }} />
        <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3140 }}>
          <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "min(500px, 95vw)" }}>
            <div className="modal-content" style={{ fontSize: "0.85rem" }}>
              <div className="modal-header py-2">
                <h5 className="modal-title" style={{ fontSize: "1rem" }}>
                  <Check2Circle size={16} className="me-2 text-success" />
                  Confirmar Finalização
                </h5>
                <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowPrecificarConfirm(false)} />
              </div>
              <div className="modal-body">
                <p className="mb-2">Deseja finalizar o encarte e marcar como <strong>Feito</strong>?</p>
                <div className="card p-2 bg-light">
                  <div><strong>Cód:</strong> {precificarTargetRow.CODPROD}</div>
                  <div><strong>Produto:</strong> {precificarTargetRow.DESCRICAO}</div>
                  <div><strong>Filial:</strong> {precificarTargetRow.CODFILIAL}</div>
                  <div><strong>Preço Fixo:</strong> {Number(precificarTargetRow.PRECOFIXO || 0).toFixed(2)}</div>
                  {Number(precificarTargetRow.PRECOFIXO || 0) <= 0 && (
                    <div className="alert alert-warning mt-2 p-2 mb-0" role="alert">
                      <ExclamationTriangleFill size={14} className="me-1" />
                      O Preço Fixo deve ser maior que zero para finalizar.
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer py-2">
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setShowPrecificarConfirm(false)}
                >
                  <XCircleFill size={12} className="me-1" />
                  Não
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  disabled={Number(precificarTargetRow.PRECOFIXO || 0) <= 0}
                  onClick={async () => {
                    if (!precificarTargetRow?.ID) return;
                    try {
                      // Send 'F' status
                      const res = await confirmarEncarte(precificarTargetRow.ID, 'F');
                      if (res.ok) {
                        setEditRows(prev => prev.map(r => {
                          if (r === precificarTargetRow) {
                            return { ...r, STATUS_ENCARTE: 'F' };
                          }
                          return r;
                        }));
                        setToast({ type: 'success', message: 'Finalização confirmada com sucesso!' });
                        setTimeout(() => setToast(null), 3000);
                      }
                    } catch (err: any) {
                      console.error('Falha ao confirmar precificação:', err);
                      setToast({ type: 'danger', message: err.message || 'Erro ao confirmar precificação' });
                      setTimeout(() => setToast(null), 5000);
                    } finally {
                      setShowPrecificarConfirm(false);
                      setPrecificarTargetRow(null);
                    }
                  }}
                >
                  <CheckCircleFill size={12} className="me-1" />
                  Sim
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
  </>
);
};

export default ModalDetalheListaCampanha;
