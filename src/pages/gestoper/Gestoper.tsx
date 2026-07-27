import React, { useEffect, useMemo, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../gestpro/Gestpro.css";
import TopBar from "../../components/TopBar";
import type { PendenciaGestproRow } from "../gestpro/PedidosPendentesModal";
import { Coleta } from "../gestpro/components/Coleta";
import { Faltando } from "../gestpro/components/Faltando";
import ColetaSeparandoPendenciasCard from "../gestpro/components/cards/ColetaSeparandoPendenciasCard";
import { ArrowDownSquare, ArrowRepeat, BoxSeam, CalendarEvent, CardChecklist, ClipboardCheck, CheckCircleFill, ExclamationTriangleFill, InfoCircleFill, LockFill, UnlockFill, PencilSquare, Trash, Gear, PlusLg, Search, Truck, CashCoin, House, XCircle, Printer } from "react-bootstrap-icons";
import type { PedidoDetalhe } from "../../components/gestlog/VisualizarPedido";
import { atualizarStatusEspecial } from "../../services/gestlog/MarcarVisualizacao";
import AjusteEstoqueModal from "../gestpro/components/modals/AjusteEstoqueModal";
import AuditoriaModal from "../gestpro/components/modals/AuditoriaModal";

const resolveBaseApi = () => {
  const envRaw = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
  const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
  if (envRaw && typeof envRaw === "string") {
    const trimmed = envRaw.replace(/\/+$/, "");
    if (isHttps && /^http:\/\//i.test(trimmed)) return "/api";
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  return "/api";
};

type GestoperSection =
  | "fornecedor"
  | "coleta"
  | "coletaSeparando"
  | "coletaSeparada"
  | "retMessejana"
  | "soFaturar"
  | "analise"
  | null;

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

const fnv1aUpdate = (hash: number, value: string) => {
  let h = hash >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
};

const calcPendenciasSig = (rows: PendenciaGestproRow[]) => {
  let h = FNV_OFFSET_BASIS;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    h = fnv1aUpdate(h, String(r.NUMPED));
    h = fnv1aUpdate(h, "|");
    h = fnv1aUpdate(h, String(r.CODPROD));
    h = fnv1aUpdate(h, "|");
    h = fnv1aUpdate(h, String(r.QT));
    h = fnv1aUpdate(h, "|");
    h = fnv1aUpdate(h, String(r.POSICAO ?? ""));
    h = fnv1aUpdate(h, "|");
    h = fnv1aUpdate(h, String(r.LOG2 ?? ""));
    h = fnv1aUpdate(h, "|");
    h = fnv1aUpdate(h, String((r as unknown as { LOG2_REAL?: string | null }).LOG2_REAL ?? ""));
    h = fnv1aUpdate(h, "|");
    h = fnv1aUpdate(h, String(r.CODCLI ?? ""));
    h = fnv1aUpdate(h, "|");
    h = fnv1aUpdate(h, String(r.CODAUXILIAR ?? ""));
    h = fnv1aUpdate(h, "|");
    h = fnv1aUpdate(h, String(r.NUMVIASMAPASEP ?? ""));
    h = fnv1aUpdate(h, ";");
  }
  return h >>> 0;
};

const currency = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
};

const groupPendencias = (list: PendenciaGestproRow[]) => {
  const groups = new Map<number, PendenciaGestproRow[]>();
  list.forEach(p => {
    const arr = groups.get(p.NUMPED) || [];
    arr.push(p);
    groups.set(p.NUMPED, arr);
  });
  return groups;
};

interface ValidationModalProps {
  show: boolean;
  onClose: () => void;
  pedidos: PendenciaGestproRow[];
  onSuccess?: () => void;
}

interface MessageState {
  show: boolean;
  title: string;
  content: string;
  isError?: boolean;
}

const ValidationModal: React.FC<ValidationModalProps> = ({ show, onClose, pedidos, onSuccess }) => {
  const [barcodes, setBarcodes] = useState<Record<number, string>>({});
  const [confirmedItems, setConfirmedItems] = useState<Record<number, boolean>>({});
  const [loadingFinalizar, setLoadingFinalizar] = useState(false);
  const [separatorInfo, setSeparatorInfo] = useState<Record<number, { code: number, name: string }>>({});
  const [messageModal, setMessageModal] = useState<MessageState>({ show: false, title: '', content: '', isError: false });

  useEffect(() => {
    if (show) {
      setBarcodes({});
      setLoadingFinalizar(false);
      setMessageModal({ show: false, title: '', content: '', isError: false });
      
      const initialConfirmed: Record<number, boolean> = {};
      const initialSepInfo: Record<number, { code: number, name: string }> = {};
      
      pedidos.forEach((p, idx) => {
          if (p.CODFUNCSEP) {
              initialConfirmed[idx] = true;
              initialSepInfo[idx] = { code: p.CODFUNCSEP, name: p.SEPERADOR_ITEM || '' };
          }
      });
      setConfirmedItems(initialConfirmed);
      setSeparatorInfo(initialSepInfo);
    }
  }, [show, pedidos]);

  if (!show || pedidos.length === 0) return null;

  const head = pedidos[0];

  const allValid = pedidos.every((p, idx) => {
    // Se o item já foi confirmado individualmente (via estado local ou banco), conta como válido
    if (confirmedItems[idx] || p.CODFUNCSEP) return true;
    
    const inputCode = String(barcodes[idx] || '').trim();
    const correctCode = String(p.CODAUXILIAR || '').trim();
    return inputCode === correctCode && correctCode.length > 0;
  });

  const getUserCode = (): number | null => {
    try {
      const raw = localStorage.getItem("usuarioLogado") || "";
      if (!raw) return null;
      const u = JSON.parse(raw);
      const codeStr = String(u?.codusur ?? u?.CODUSUR ?? u?.matricula ?? u?.MATRICULA ?? "").trim();
      const code = Number(codeStr);
      return Number.isFinite(code) ? code : null;
    } catch {
      return null;
    }
  };

  const getUserName = (): string => {
    try {
        const raw = localStorage.getItem("usuarioLogado") || "";
        if (!raw) return "";
        const u = JSON.parse(raw);
        return u?.usuario || u?.nome || "";
    } catch {
        return "";
    }
  };

  const handleConfirmItem = async (p: PendenciaGestproRow, idx: number) => {
      const pos = String((p as any)?.POSICAO ?? '').trim().toUpperCase();
      if (pos === 'P') {
          setMessageModal({
              show: true,
              title: 'Atenção',
              content: "Produto encontra-se na posição: 'P' de 'Pendende', solicite à Gerência para desbloqueio/liberação ou com o setor de Compras para ajuste de estoque para ser possível o faturamento da NFe.",
              isError: true
          });
          return;
      }

      const userCode = getUserCode();
      if (!userCode) {
          alert("Usuário não identificado. Por favor, faça login novamente.");
          return;
      }

      try {
          const baseApi = resolveBaseApi();
          const res = await fetch(`${baseApi}/gestpro/confirmar-separacao`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  numped: p.NUMPED,
                  codigo: userCode,
                  codigoProduto: p.CODPROD
              })
          });

          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.message || "Erro ao confirmar item");
          }

          // Sucesso
          setConfirmedItems(prev => ({ ...prev, [idx]: true }));
          
          setSeparatorInfo(prev => ({
              ...prev,
              [idx]: { code: userCode, name: getUserName() }
          }));
          setBarcodes(prev => ({ ...prev, [idx]: String((p as any)?.CODAUXILIAR ?? "") }));
      } catch (err: any) {
          alert(err.message);
      }
  };

  const handleFinalizar = async () => {
    if (!allValid) return;
    
    const userCode = getUserCode();
    const userName = getUserName();
    
    if (!userCode) {
        alert("Usuário não identificado. Por favor, faça login novamente.");
        return;
    }

    setLoadingFinalizar(true);
    try {
        const baseApi = resolveBaseApi();
        // Consome endpoint /api/gestlog/atualizar-status-especial
        // Status 19: Coleta Separada
        const res = await fetch(`${baseApi}/gestlog/atualizar-status-especial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                numped: head.NUMPED,
                status: 19,
                usuario: userName
            })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || "Erro ao finalizar pedido");
        }

        alert("Pedido finalizado com sucesso!");
        if (onSuccess) onSuccess();
        onClose();
    } catch (err: any) {
        alert(err.message);
    } finally {
        setLoadingFinalizar(false);
    }
  };



  return (
    <>
      <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
        <div className="modal-dialog modal-fullscreen modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h5 className="modal-title fs-6">Validações - Pedido {head.NUMPED}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="card mb-2 bg-light shadow-sm" style={{ borderTop: 0, borderRight: 0, borderBottom: 0, borderLeft: '5px solid #198754' }}>
                  <div className="card-body py-1">
                      <div className="row g-0" style={{ fontSize: '0.85rem' }}>
                          <div className="col-12">
                              <strong>Cliente:</strong> {head.CODCLI} - {head.CLIENTE}
                          </div>
                          <div className="col-12">
                              <strong>Data:</strong> {formatDate(head.DATA)}
                          </div>
                          <div className="col-12">
                              <strong>Vendedor:</strong> {head.CODUSUR} - {head.NOME}
                          </div>
                          <div className="col-12">
                              <strong>Total:</strong> {currency(head.VLTOTAL)}
                          </div>
                          <div className="col-12">
                              <strong>Entrega:</strong> {head.TIPOENTREGA || '-'}
                          </div>
                          <div className="col-12">
                              <strong>Separador:</strong> {head.SEPERADOR || '-'}
                          </div>
                          <div className="col-12">
                              <strong>Emissor Mapa:</strong> {head.EMISSOR_MAPA || '-'}
                          </div>
                          <div className="col-12">
                              <strong>Vias Mapa:</strong> {head.NUMVIASMAPASEP || 0}
                          </div>
                          {[head.OBS, head.OBS1, head.OBS2].some(Boolean) && (
                              <div className="col-12">
                                  <strong>Obs:</strong> {[head.OBS, head.OBS1, head.OBS2].filter(Boolean).join(' ')}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
  
               <div className="table-responsive">
                <table className="table table-sm table-striped table-hover mb-0" style={{ fontSize: '0.8rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th>Prod</th>
                      <th>Descrição</th>
                      <th style={{ minWidth: '150px' }}>Cód. Barras</th>
                      <th className="text-center">Emb</th>
                      <th className="text-center">Mult</th>
                      <th className="text-center">Qtd</th>
                      <th className="text-center">Qtd Total</th>
                      <th className="text-center">Posicão</th>
                      <th className="text-center">Separador(a)</th>
                      <th className="text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.CODPROD}</td>
                        <td>{p.DESCRICAO}</td>
                        <td>
                          {confirmedItems[idx] ? (
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              value={String((p as any)?.CODAUXILIAR ?? '').trim()}
                              disabled
                            />
                          ) : (
                          <input
                            type="text"
                            className={`form-control form-control-sm ${
                              barcodes[idx]
                                ? String(barcodes[idx] || '').trim() === String(p.CODAUXILIAR || '').trim()
                                  ? 'is-valid'
                                  : 'is-invalid'
                                : ''
                            }`}
                            value={barcodes[idx] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBarcodes(prev => ({ ...prev, [idx]: val }));
                            }}
                            placeholder=""
                          />
                          )}
                        </td>
                        <td className="text-center">{p.EMBALAGEMMASTER || '-'}</td>
                        <td className="text-center">{p.MULTIPLO || '-'}</td>
                        <td className="text-center">{p.QT}</td>
                        <td className="text-center">{p.QTD_TOTAL || "-"}</td>
                        <td className="text-center">{p.POSICAO}</td>
                        <td className="text-center">
                          {separatorInfo[idx] 
                              ? `${separatorInfo[idx].code} - ${separatorInfo[idx].name}`
                              : (p.CODFUNCSEP ? `${p.CODFUNCSEP} - ${p.SEPERADOR_ITEM || ''}` : '-')
                          }
                        </td>
                        <td className="text-center">
                          <button
                            className={`btn btn-sm ${confirmedItems[idx] ? 'btn-success' : 'btn-primary'}`}
                            disabled={
                              confirmedItems[idx] || 
                              !(String(barcodes[idx] || '').trim() === String(p.CODAUXILIAR || '').trim() && String(p.CODAUXILIAR || '').trim().length > 0)
                            }
                            onClick={() => handleConfirmItem(p, idx)}
                          >
                            {confirmedItems[idx] ? 'Confirmado' : 'Confirmar item'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer py-1">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
              <button 
                type="button" 
                className="btn btn-success btn-sm" 
                disabled={!allValid || loadingFinalizar}
                onClick={handleFinalizar}
              >
                {loadingFinalizar ? 'Finalizando...' : 'Finalizar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {messageModal.show && (
        <>
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 4600 }}></div>
          <div className="modal d-block" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 4610 }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className={`modal-header py-2 ${messageModal.isError ? 'bg-danger text-white' : 'bg-success text-white'}`}>
                  <h5 className="modal-title" style={{ fontSize: '1rem' }}>{messageModal.title}</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setMessageModal(prev => ({ ...prev, show: false }))}
                  ></button>
                </div>
                <div className="modal-body text-center py-4">
                  <p className="mb-0" style={{ fontSize: '0.95rem' }}>{messageModal.content}</p>
                </div>
                <div className="modal-footer py-1 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-3"
                    onClick={() => setMessageModal(prev => ({ ...prev, show: false }))}
                  >
                    Fechar
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

const Gestoper: React.FC = () => {
  const [pendencias, setPendencias] = useState<PendenciaGestproRow[]>([]);
  const [loadingPendencias, setLoadingPendencias] = useState<boolean>(false);
  const [errorPendencias, setErrorPendencias] = useState<string | null>(null);
  const loadPendenciasInFlightRef = useRef(false);
  const pendenciasSigRef = useRef<number | null>(null);
  const sidebarSigRef = useRef<number | null>(null);

  const [validationOrder, setValidationOrder] = useState<PendenciaGestproRow[] | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [activeSection, setActiveSection] = useState<GestoperSection>(null);
  const [pedidoColetaConfirm, setPedidoColetaConfirm] = useState<PedidoDetalhe | null>(null);
  const [sendingStatus21, setSendingStatus21] = useState(false);
  const [coletaSeparada19Count, setColetaSeparada19Count] = useState<number>(0);
  const [retMessejana20Count, setRetMessejana20Count] = useState<number>(0);
  const [soFaturar15Count, setSoFaturar15Count] = useState<number>(0);
  const [pedidosAnaliseCount, setPedidosAnaliseCount] = useState<number>(0);
  const [coletaSeparadaList, setColetaSeparadaList] = useState<Array<{ pedido: number; cliente: string; data?: string }>>([]);
  const [coletaSeparadaGrouped, setColetaSeparadaGrouped] = useState<Map<number, { head: any; items: any[] }>>(new Map());
  const [retMessejanaGrouped, setRetMessejanaGrouped] = useState<Map<number, { head: any; items: any[] }>>(new Map());
  const [soFaturarGrouped, setSoFaturarGrouped] = useState<Map<number, { head: any; items: any[] }>>(new Map());
  const [pedidosAnaliseGrouped, setPedidosAnaliseGrouped] = useState<Map<number, { head: any; items: any[] }>>(new Map());
  const [showAjusteEstoqueModal, setShowAjusteEstoqueModal] = useState(false);
  const [showAuditoriaModal, setShowAuditoriaModal] = useState(false);
  const [showReposicaoModal, setShowReposicaoModal] = useState(false);
  const [reposicaoCodFilial, setReposicaoCodFilial] = useState("1");
  const [reposicaoCodFornec, setReposicaoCodFornec] = useState("");
  const [reposicaoNumTransEnt, setReposicaoNumTransEnt] = useState("");
  const [reposicaoDtIni, setReposicaoDtIni] = useState("");
  const [reposicaoDtFim, setReposicaoDtFim] = useState("");
  const [reposicaoRows, setReposicaoRows] = useState<any[]>([]);
  const [reposicaoLoading, setReposicaoLoading] = useState(false);
  const [reposicaoError, setReposicaoError] = useState<string | null>(null);
  const [reposicaoFornecedorNome, setReposicaoFornecedorNome] = useState<string | null>(null);
  const [reposicaoTransacaoInfo, setReposicaoTransacaoInfo] = useState<{ numNota: unknown; dtEmissao: unknown; dtEnt: unknown } | null>(null);
  const [showAddReposicaoItemModal, setShowAddReposicaoItemModal] = useState(false);
  const [addReposicaoItemRow, setAddReposicaoItemRow] = useState<any | null>(null);
  const [addReposicaoPedidos, setAddReposicaoPedidos] = useState<any[]>([]);
  const [addReposicaoPedidosLoading, setAddReposicaoPedidosLoading] = useState(false);
  const [addReposicaoPedidosError, setAddReposicaoPedidosError] = useState<string | null>(null);
  const [addReposicaoSelectedPedidoId, setAddReposicaoSelectedPedidoId] = useState<number | null>(null);
  const [addReposicaoBuscarOutrosFornecedores, setAddReposicaoBuscarOutrosFornecedores] = useState(false);
  const [addReposicaoPedidoBusca, setAddReposicaoPedidoBusca] = useState("");
  const [addReposicaoQt, setAddReposicaoQt] = useState("");
  const [addReposicaoSaving, setAddReposicaoSaving] = useState(false);
  const [showBuscarProdutoReposicaoModal, setShowBuscarProdutoReposicaoModal] = useState(false);
  const [buscarProdutoReposicaoTermo, setBuscarProdutoReposicaoTermo] = useState("");
  const [buscarProdutoReposicaoRows, setBuscarProdutoReposicaoRows] = useState<any[]>([]);
  const [buscarProdutoReposicaoLoading, setBuscarProdutoReposicaoLoading] = useState(false);
  const [buscarProdutoReposicaoError, setBuscarProdutoReposicaoError] = useState<string | null>(null);
  const [buscarProdutoReposicaoSelectedRow, setBuscarProdutoReposicaoSelectedRow] = useState<any | null>(null);
  const [buscarProdutoReposicaoPedidos, setBuscarProdutoReposicaoPedidos] = useState<any[]>([]);
  const [buscarProdutoReposicaoPedidosLoading, setBuscarProdutoReposicaoPedidosLoading] = useState(false);
  const [buscarProdutoReposicaoSelectedPedidoId, setBuscarProdutoReposicaoSelectedPedidoId] = useState<number | null>(null);
  const [buscarProdutoReposicaoPedidoBusca, setBuscarProdutoReposicaoPedidoBusca] = useState("");
  const [buscarProdutoReposicaoQt, setBuscarProdutoReposicaoQt] = useState("");
  const [buscarProdutoReposicaoSaving, setBuscarProdutoReposicaoSaving] = useState(false);
  const [reposicaoMessageModal, setReposicaoMessageModal] = useState<MessageState>({ show: false, title: "", content: "", isError: false });
  const [showGerirPedidosReposicaoModal, setShowGerirPedidosReposicaoModal] = useState(false);
  const [gerirPedidosReposicaoRows, setGerirPedidosReposicaoRows] = useState<any[]>([]);
  const [gerirPedidosReposicaoLoading, setGerirPedidosReposicaoLoading] = useState(false);
  const [gerirPedidosReposicaoError, setGerirPedidosReposicaoError] = useState<string | null>(null);
  const [showEditarPedidoReposicaoModal, setShowEditarPedidoReposicaoModal] = useState(false);
  const [editarPedidoReposicaoPedido, setEditarPedidoReposicaoPedido] = useState<any | null>(null);
  const [editarPedidoReposicaoItens, setEditarPedidoReposicaoItens] = useState<any[]>([]);
  const [editarPedidoReposicaoLoading, setEditarPedidoReposicaoLoading] = useState(false);
  const [editarPedidoReposicaoError, setEditarPedidoReposicaoError] = useState<string | null>(null);
  const [showImprimirPedidoReposicaoModal, setShowImprimirPedidoReposicaoModal] = useState(false);
  const [imprimirPedidoReposicaoPedido, setImprimirPedidoReposicaoPedido] = useState<any | null>(null);
  const [imprimirPedidoReposicaoItens, setImprimirPedidoReposicaoItens] = useState<any[]>([]);
  const [imprimirPedidoReposicaoLoading, setImprimirPedidoReposicaoLoading] = useState(false);
  const [imprimirPedidoReposicaoError, setImprimirPedidoReposicaoError] = useState<string | null>(null);
  const [showInventarioPedidoReposicaoModal, setShowInventarioPedidoReposicaoModal] = useState(false);
  const [inventarioPedidoReposicaoPedido, setInventarioPedidoReposicaoPedido] = useState<any | null>(null);
  const [inventarioPedidoReposicaoItens, setInventarioPedidoReposicaoItens] = useState<any[]>([]);
  const [inventarioPedidoReposicaoLoading, setInventarioPedidoReposicaoLoading] = useState(false);
  const [inventarioPedidoReposicaoError, setInventarioPedidoReposicaoError] = useState<string | null>(null);
  const [showCriarInventarioPedidoReposicaoModal, setShowCriarInventarioPedidoReposicaoModal] = useState(false);
  const [criarInventarioPedidoNome, setCriarInventarioPedidoNome] = useState("");
  const [criarInventarioPedidoLocal, setCriarInventarioPedidoLocal] = useState("");
  const [criarInventarioPedidoFilial, setCriarInventarioPedidoFilial] = useState("");
  const [criarInventarioPedidoResponsavel, setCriarInventarioPedidoResponsavel] = useState("");
  const [criarInventarioPedidoSaving, setCriarInventarioPedidoSaving] = useState(false);
  const [criarInventarioPedidoError, setCriarInventarioPedidoError] = useState<string | null>(null);
  const [criarInventarioPedidoProgress, setCriarInventarioPedidoProgress] = useState<{ current: number; total: number } | null>(null);
  const [showEditarItemReposicaoQtModal, setShowEditarItemReposicaoQtModal] = useState(false);
  const [editarItemReposicaoRow, setEditarItemReposicaoRow] = useState<any | null>(null);
  const [editarItemReposicaoQt, setEditarItemReposicaoQt] = useState("");
  const [editarItemReposicaoSaving, setEditarItemReposicaoSaving] = useState(false);
  const [editarItemReposicaoError, setEditarItemReposicaoError] = useState<string | null>(null);
  const [excluirItemReposicaoConfirm, setExcluirItemReposicaoConfirm] = useState<any | null>(null);
  const [excluindoItemReposicao, setExcluindoItemReposicao] = useState(false);
  const [encerrarPedidoReposicaoConfirm, setEncerrarPedidoReposicaoConfirm] = useState<any | null>(null);
  const [encerrandoPedidoReposicao, setEncerrandoPedidoReposicao] = useState(false);
  const [reabrirPedidoReposicaoConfirm, setReabrirPedidoReposicaoConfirm] = useState<any | null>(null);
  const [reabrindoPedidoReposicao, setReabrindoPedidoReposicao] = useState(false);
  const [showCriarPedidoReposicaoModal, setShowCriarPedidoReposicaoModal] = useState(false);
  const [criacaoReposicaoCodFornec, setCriacaoReposicaoCodFornec] = useState("");
  const [criacaoReposicaoFornecedorNome, setCriacaoReposicaoFornecedorNome] = useState<string | null>(null);
  const [criacaoReposicaoObs, setCriacaoReposicaoObs] = useState("");
  const [criacaoReposicaoBuscando, setCriacaoReposicaoBuscando] = useState(false);
  const [criacaoReposicaoSalvando, setCriacaoReposicaoSalvando] = useState(false);
  const [criacaoReposicaoErro, setCriacaoReposicaoErro] = useState<string | null>(null);
  const [showBuscarFornecedorDescricaoModal, setShowBuscarFornecedorDescricaoModal] = useState(false);
  const [buscarFornecedorDescricaoDestino, setBuscarFornecedorDescricaoDestino] = useState<"criacao" | "reposicao">("criacao");
  const [buscarFornecedorDescricaoTermo, setBuscarFornecedorDescricaoTermo] = useState("");
  const [buscarFornecedorDescricaoRows, setBuscarFornecedorDescricaoRows] = useState<any[]>([]);
  const [buscarFornecedorDescricaoLoading, setBuscarFornecedorDescricaoLoading] = useState(false);
  const [buscarFornecedorDescricaoError, setBuscarFornecedorDescricaoError] = useState<string | null>(null);
  const reposicaoFetchControllerRef = useRef<AbortController | null>(null);
  const codUsuarioLogado = useMemo(() => {
    try {
      const raw = localStorage.getItem("usuarioLogado") || "";
      if (!raw) return null;
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const val =
        (obj?.matricula as string | number | undefined) ??
        (obj?.MATRICULA as string | number | undefined) ??
        (obj?.codusur as string | number | undefined) ??
        (obj?.CODUSUR as string | number | undefined);
      const s = String(val ?? "").trim();
      return s ? s : null;
    } catch {
      return null;
    }
  }, []);
  const nomeUsuarioLogado = useMemo(() => {
    try {
      const raw = localStorage.getItem("usuarioLogado") || "";
      if (!raw) return codUsuarioLogado || "APP";
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const nome =
        String(obj?.usuario ?? "").trim() ||
        String(obj?.nome ?? "").trim() ||
        String(obj?.NOME ?? "").trim() ||
        String(obj?.login ?? "").trim();
      return nome || codUsuarioLogado || "APP";
    } catch {
      return codUsuarioLogado || "APP";
    }
  }, [codUsuarioLogado]);
  const handleOpenValidations = (items: PendenciaGestproRow[]) => {
    setValidationOrder(items);
    setShowValidationModal(true);
  };

  const loadPendencias = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (loadPendenciasInFlightRef.current) return;
    loadPendenciasInFlightRef.current = true;
    if (!silent) setLoadingPendencias(true);
    try {
      const resp = await fetch(`/api/gestpro/pendenciasGestpro`);
      if (!resp.ok) throw new Error("Erro ao buscar pendências");
      const data = await resp.json();
      const rows: PendenciaGestproRow[] = Array.isArray(data?.rows) ? data.rows : [];
      const nextSig = calcPendenciasSig(rows);
      if (pendenciasSigRef.current !== nextSig) {
        pendenciasSigRef.current = nextSig;
        React.startTransition(() => {
          setPendencias(rows);
        });
      }
      setErrorPendencias(prev => (prev === null ? prev : null));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar pendências";
      setErrorPendencias(prev => (prev === msg ? prev : msg));
    } finally {
      if (!silent) setLoadingPendencias(false);
      loadPendenciasInFlightRef.current = false;
    }
  };

  // handlePrintLabels removido (não utilizado)

  const handleEnviarParaColetaSeparando = async (pd: PedidoDetalhe) => {
    try {
      const usuario = (() => {
        try {
          const raw = localStorage.getItem("usuarioLogado") || "";
          if (!raw) return "APP";
          const obj = JSON.parse(raw);
          const nome = String(obj?.usuario || obj?.nome || "").trim();
          return nome || "APP";
        } catch {
          return "APP";
        }
      })();
      const codFuncEmissaoMapa = (() => {
        try {
          const raw = localStorage.getItem("usuarioLogado") || "";
          if (!raw) return undefined;
          const obj = JSON.parse(raw) as Record<string, unknown>;
          const val =
            (obj?.matricula as string | number | undefined) ??
            (obj?.MATRICULA as string | number | undefined) ??
            (obj?.codusur as string | number | undefined) ??
            (obj?.CODUSUR as string | number | undefined);
          const n = Number(String(val || "").trim());
          return Number.isFinite(n) ? n : undefined;
        } catch {
          return undefined;
        }
      })();
      await atualizarStatusEspecial({
        numped: Number(pd.pedido),
        status: 21,
        usuario,
        codFuncEmissaoMapa
      });
      setActiveSection("coletaSeparando");
      await loadPendencias();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao enviar para Coleta Separando");
    }
  };

  const handlePrintMapa = (pd: PedidoDetalhe) => {
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;
    const formatDateBR = (d: string | Date | null | undefined) => {
      if (!d) return "-";
      try {
        const dt = typeof d === "string" ? new Date(d) : d;
        if (!dt || isNaN(dt.getTime())) return String(d);
        return dt.toLocaleDateString("pt-BR");
      } catch {
        return String(d);
      }
    };
    const n = (v: unknown) => {
      const num = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
      return Number.isFinite(num) ? num : 0;
    };
    const qRows = (pd.items || []).map((it, idx) => {
      const qtd = n(it.quantidade);
      const mult = n((it as unknown as { multiplo?: number }).multiplo);
      const totalQtd = mult ? qtd * mult : qtd;
      return {
        i: idx + 1,
        cod: it.codProd ?? "",
        desc: it.descricao ?? "",
        emb: (it as unknown as { embalagemMaster?: number | string }).embalagemMaster ?? "-",
        mult: mult || "-",
        qtd: qtd || "-",
        qtdTot: totalQtd || "-",
        pos: it.posicao ?? "",
        barras: "" // campo de código de barras deve ficar em branco para preenchimento manual
      };
    });
    const sumQtd = qRows.reduce((acc, r) => acc + (typeof r.qtd === "number" ? r.qtd : 0), 0);
    const sumQtdTot = qRows.reduce((acc, r) => acc + (typeof r.qtdTot === "number" ? r.qtdTot : 0), 0);
    const now = new Date().toLocaleString("pt-BR");
    const usr = (() => {
      try {
        const raw = localStorage.getItem("usuarioLogado") || "";
        if (!raw) return { nome: "", matricula: "" };
        const obj = JSON.parse(raw) as Record<string, unknown>;
        const nome = String((obj?.usuario as string) || (obj?.nome as string) || "").trim();
        const matricula = String(
          (obj?.matricula as string) ??
          (obj?.MATRICULA as string) ??
          (obj?.codusur as number | string) ??
          (obj?.CODUSUR as number | string) ??
          ""
        ).trim();
        return { nome, matricula };
      } catch {
        return { nome: "", matricula: "" };
      }
    })();
    const itemsRows = qRows
      .map(
        r =>
          `<tr>
            <td class="cell text-center col-num">${r.i}</td>
            <td class="cell col-cod">${r.cod}</td>
            <td class="cell desc col-desc">${r.desc}</td>
            <td class="cell text-center col-mult">${r.mult}</td>
            <td class="cell text-center col-qtd">${r.qtd}</td>
            <td class="cell text-center col-qtdtot">${typeof r.qtdTot === "number" ? r.qtdTot.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : r.qtdTot} ${String(r.emb ?? "").toUpperCase()}</td>
            <td class="cell text-center col-pos">${r.pos}</td>
            <td class="cell col-bar"><div class="bar-box"></div></td>
          </tr>`
      ).join("");
    const html = `
      <html>
        <head>
          <title>Mapa de Separação - Pedido ${pd.pedido}</title>
          <style>
            :root {
              --c-text: #111;
              --c-muted: #555;
              --c-border: #000;
              --c-bg: #fff;
              --c-head: #efefef;
              --c-row: #fafafa;
              --radius: 10px;
            }
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--c-text); margin: 16px; background: var(--c-bg); }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid var(--c-border); }
            .title { font-size: 18px; font-weight: 800; letter-spacing: .3px; }
            .badge { font-weight: 800; border: 2px solid var(--c-border); padding: 4px 10px; border-radius: 8px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; margin-bottom: 12px; }
            .box { padding: 12px; border: 1px solid var(--c-border); border-radius: var(--radius); background: var(--c-bg); }
            .section-title { font-weight: 800; text-transform: uppercase; font-size: 12px; margin: 0 0 8px 0; }
            .row { display: grid; grid-template-columns: 140px 1fr; gap: 8px; padding: 3px 0; }
            .label { color: var(--c-text); font-weight: 700; }
            .value { color: var(--c-text); }
            .table-card { border: 1px solid var(--c-border); border-radius: var(--radius); overflow: hidden; background: var(--c-bg); }
            table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
            thead { display: table-header-group; background: var(--c-head); }
            th { border-bottom: 1px solid var(--c-border); padding: 8px; vertical-align: middle; text-transform: uppercase; font-weight: 800; color: var(--c-text); }
            td { border-top: 1px solid var(--c-border); padding: 8px; vertical-align: middle; background: var(--c-bg); }
            tbody tr:nth-child(even) td { background: var(--c-row); }
            .desc { word-break: break-word; }
            th.col-cod, th.col-desc { text-align: left; }
            td.col-cod, td.col-desc { text-align: left; }
            .text-center { text-align: center; }
            .col-num { width: 42px; }
            .col-cod { width: 80px; }
            .col-desc { width: auto; }
            .col-mult { width: 58px; }
            .col-qtd { width: 64px; }
            .col-qtdtot { width: 110px; }
            .col-pos { width: 70px; }
            .col-bar { width: 170px; }
            .footer { margin-top: 12px; font-size: 11px; display: flex; justify-content: space-between; }
            .summary { margin-top: 10px; display: flex; gap: 16px; font-size: 12px; font-weight: 700; }
            .muted { color: var(--c-muted); }
            .sign { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 12px; }
            .sign .line { border-top: 1px solid var(--c-border); margin-top: 34px; padding-top: 6px; text-align: center; }
            .bar-box { height: 20px; border: 1px dashed var(--c-border); border-radius: 8px; }
            @media print {
              body { margin: 6mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Mapa de Separação para Coleta</div>
            <div class="badge">Pedido TV8 Nº: ${pd.pedido}</div>
          </div>
          <div class="grid">
            <div class="box">
              <div class="section-title">Pedido: </div>
              <div class="row"><div class="label">Número</div><div class="value">${pd.pedido}</div></div>
              <div class="row"><div class="label">Data</div><div class="value">${formatDateBR(pd.data)}</div></div>
              <div class="row"><div class="label">Status</div><div class="value">${pd.log2Real ?? pd.statusPedido ?? "-"}</div></div>
              <div class="row"><div class="label">Entrega</div><div class="value">${pd.tipoEntrega ?? "-"}</div></div>
              <div class="row"><div class="label">Vendedor</div><div class="value">${pd.vendedor ?? ""}</div></div>
              <div class="row"><div class="label">Separador</div><div class="value">${pd.separador ?? "-"}</div></div>
              <div class="row"><div class="label">Emissor Mapa</div><div class="value">${pd.emissorMapa ?? "-"}</div></div>
              <div class="row"><div class="label">Vias Mapa</div><div class="value">${pd.viasMapa ?? "-"}</div></div>
              <div class="row"><div class="label">Usuário</div><div class="value">${usr.nome || "-"}</div></div>
              <div class="row"><div class="label">Matrícula</div><div class="value">${usr.matricula || "-"}</div></div>
            </div>
            <div class="box">
              <div class="section-title">Cliente</div>
              <div class="row"><div class="label">Código</div><div class="value">${pd.codCli ?? ""}</div></div>
              <div class="row"><div class="label">Nome</div><div class="value">${pd.cliente ?? ""}</div></div>
              <div class="row"><div class="label">Endereço</div><div class="value">${pd.enderEnt ?? ""}, ${pd.numeroEnt ?? ""}</div></div>
              <div class="row"><div class="label">Bairro/Município</div><div class="value">${pd.bairroEnt ?? ""} - ${pd.municEnt ?? ""}</div></div>
              <div class="row"><div class="label">CEP</div><div class="value">${pd.cep ?? ""}</div></div>
              <div class="row"><div class="label">Filial</div><div class="value">${pd.codFilial ?? ""}</div></div>
              <div class="row"><div class="label">Retira</div><div class="value">${pd.codFilialRetira ?? "-"}</div></div>
              <div class="row"><div class="label">Valor</div><div class="value">${typeof pd.vlTotal === "number" ? pd.vlTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}</div></div>
            </div>
          </div>
          <div class="table-card">
            <table>
              <thead>
                <tr>
                  <th class="text-center col-num">#</th>
                  <th class="col-cod">Código</th>
                  <th class="col-desc">Descrição</th>
                  <th class="text-center col-mult">Mult</th>
                  <th class="text-center col-qtd">Qtd</th>
                  <th class="text-center col-qtdtot">Qtd Total</th>
                  <th class="text-center col-pos">Posição</th>
                  <th class="text-center col-bar">Escreva o Cód. Barras</th>
                </tr>
              </thead>
              <tbody>${itemsRows}</tbody>
            </table>
          </div>
          <div class="summary">
            <div><strong>Itens:</strong> ${qRows.length}</div>
            <div><strong>Qt Total:</strong> ${sumQtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</div>
            <div><strong>Qtd Total Emb:</strong> ${sumQtdTot.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</div>
          </div>
          <div class="footer">
            <div class="muted">Emitido em: ${now} • ${usr.nome || "-"}${usr.matricula ? " (" + usr.matricula + ")" : ""}</div>
            <div class="muted">GestOPER</div>
          </div>
          <div class="sign">
            <div>
              <div class="line">Separador</div>
            </div>
            <div>
              <div class="line">Conferente</div>
            </div>
          </div>
          <script>
            window.onload = function () { window.print(); };
          </script>
        </body>
      </html>`;
    win.document.write(html);
    win.document.close();
  };

  const loadSidebarCounts = async () => {
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const dataFim = `${yyyy}-${mm}-${dd}`;
      const dataInicio = "2025-01-01";
      const baseApi = resolveBaseApi();
      const response = await fetch(`${baseApi}/gestlog/buscar-pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filiais: [1],
          tiposEntrega: ["EF", "EN", "RP"],
          filiaisRetira: [1],
          posicoesPedido: ["P", "L", "M"],
          dataInicio,
          dataFim
        })
      });
      if (!response.ok) return;
      const data = await response.json();
      const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];
      let sig = FNV_OFFSET_BASIS;
      const set15 = new Set<number>();
      const set19 = new Set<number>();
      const set20 = new Set<number>();
      const setAnalise = new Set<number>();
      const list19: Array<{ pedido: number; cliente: string; data?: string }> = [];
      const grp19 = new Map<number, { head: any; items: any[] }>();
      const grp15 = new Map<number, { head: any; items: any[] }>();
      const grp20 = new Map<number, { head: any; items: any[] }>();
      const grpAnalise = new Map<number, { head: any; items: any[] }>();
      rows.forEach(r => {
        const parsed = r?.ULTIMASITUACAOCFAT ? parseInt(String(r.ULTIMASITUACAOCFAT).split("__")[0], 10) : -1;
        const statusCode = Number.isFinite(parsed) ? parsed : -1;
        const statusPedido = r?.STATUS_PEDIDO != null ? String(r.STATUS_PEDIDO) : "";
        const pedido = Number(r?.NUMERO_DO_PEDIDO_TV8 ?? r?.NUMPED ?? r?.pedido);
        if (!Number.isFinite(pedido)) return;
        sig = fnv1aUpdate(sig, String(pedido));
        sig = fnv1aUpdate(sig, "|");
        sig = fnv1aUpdate(sig, String(statusCode));
        sig = fnv1aUpdate(sig, "|");
        sig = fnv1aUpdate(sig, statusPedido);
        sig = fnv1aUpdate(sig, ";");

        const is15 = statusCode === 15 || statusPedido === "15";
        const is19 = statusCode === 19 || statusPedido === "19";
        const is20 = statusCode === 20 || statusPedido === "20";
        const isAnalise = statusCode === 0 || statusCode === 1 || statusPedido === "0" || statusPedido === "1";

        const cliente = String(r?.CLIENTE ?? r?.NOMECLIENTE ?? r?.cliente ?? "");
        const headBase = {
          NUMPED: pedido,
          CODCLI: r?.CODCLI,
          CLIENTE: cliente,
          DATA: r?.DATA,
          CODUSUR: r?.VENDEDOR,
          NOME: r?.VENDEDOR,
          VLTOTAL: r?.VLTOTAL,
          TIPOENTREGA: r?.TIPOENTREGA,
          CODFILIALRETIRA: r?.CODFILIALRETIRA,
          OBS: r?.OBS,
          OBS1: r?.OBS1,
          OBS2: r?.OBS2,
          OBSENTREGA1: r?.OBSENTREGA1,
          OBSENTREGA2: r?.OBSENTREGA2,
          OBSENTREGA3: r?.OBSENTREGA3,
          EMISSOR_MAPA: r?.EMITENTE_MAPA ?? r?.NOME_EMITENTE,
          NUMVIASMAPASEP: r?.NUMVIASMAPASEP,
          DTINICIALSEP: r?.DTINICIALSEP,
          STATUS_ESPECIAL_COLETA: r?.STATUS_ESPECIAL_COLETA,
          STATUS_ESPECIAL_SEPARADO: r?.STATUS_ESPECIAL_SEPARADO,
        };

        const itemBase = {
          NUMPED: pedido,
          CODPROD: r?.CODPROD,
          DESCRICAO: r?.DESCRICAO,
          QT: r?.QUANTIDADE_ITEM_PEDIDO ?? r?.QT,
          POSICAO: r?.POSICAO,
          IMPRIME: r?.CODIGO_DE_BARRAS ?? "-",
        };

        if (is15) {
          set15.add(pedido);
          sig = fnv1aUpdate(sig, "15|");
          sig = fnv1aUpdate(sig, cliente);
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.CODPROD ?? ""));
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.QT ?? ""));
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.POSICAO ?? ""));
          sig = fnv1aUpdate(sig, ";");
          const existing = grp15.get(pedido);
          if (existing) existing.items.push(itemBase);
          else grp15.set(pedido, { head: headBase, items: [itemBase] });
        }

        if (is20) {
          set20.add(pedido);
          sig = fnv1aUpdate(sig, "20|");
          sig = fnv1aUpdate(sig, cliente);
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.CODPROD ?? ""));
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.QT ?? ""));
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.POSICAO ?? ""));
          sig = fnv1aUpdate(sig, ";");
          const existing = grp20.get(pedido);
          if (existing) existing.items.push(itemBase);
          else grp20.set(pedido, { head: headBase, items: [itemBase] });
        }

        if (isAnalise) {
          setAnalise.add(pedido);
          sig = fnv1aUpdate(sig, "A|");
          sig = fnv1aUpdate(sig, cliente);
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.CODPROD ?? ""));
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.QT ?? ""));
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.POSICAO ?? ""));
          sig = fnv1aUpdate(sig, ";");
          const existing = grpAnalise.get(pedido);
          if (existing) existing.items.push(itemBase);
          else grpAnalise.set(pedido, { head: headBase, items: [itemBase] });
        }

        if (is19) {
          set19.add(pedido);
          const data = r?.DATA ?? r?.DTEMISSAO ?? r?.DT_CAD;
          list19.push({ pedido, cliente, data });
          sig = fnv1aUpdate(sig, "19|");
          sig = fnv1aUpdate(sig, cliente);
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.CODPROD ?? ""));
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.QT ?? ""));
          sig = fnv1aUpdate(sig, "|");
          sig = fnv1aUpdate(sig, String(itemBase.POSICAO ?? ""));
          sig = fnv1aUpdate(sig, ";");
          const existing = grp19.get(pedido);
          if (existing) {
            existing.items.push(itemBase);
          } else {
            grp19.set(pedido, { head: headBase, items: [itemBase] });
          }
        }
      });
      sig = fnv1aUpdate(sig, `|c15:${set15.size}|c19:${set19.size}|c20:${set20.size}|ca:${setAnalise.size}`);
      // normaliza, remove duplicados mantendo primeiro
      const seen = new Set<number>();
      const norm19 = list19.filter(it => {
        if (seen.has(it.pedido)) return false;
        seen.add(it.pedido);
        return true;
      });
      if (sidebarSigRef.current !== sig) {
        sidebarSigRef.current = sig;
        React.startTransition(() => {
          setSoFaturar15Count(set15.size);
          setColetaSeparada19Count(set19.size);
          setRetMessejana20Count(set20.size);
          setPedidosAnaliseCount(setAnalise.size);
          setColetaSeparadaList(norm19);
          setColetaSeparadaGrouped(grp19);
          setSoFaturarGrouped(grp15);
          setRetMessejanaGrouped(grp20);
          setPedidosAnaliseGrouped(grpAnalise);
        });
      }
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    void loadPendencias();
    const id = window.setInterval(() => {
      void loadPendencias({ silent: true });
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    loadSidebarCounts();
    const id = setInterval(loadSidebarCounts, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showReposicaoModal) return;
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const toISODateLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 4);
    setReposicaoDtFim(toISODateLocal(end));
    setReposicaoDtIni(toISODateLocal(start));
    setReposicaoRows([]);
    setReposicaoError(null);
    setReposicaoFornecedorNome(null);
    setReposicaoTransacaoInfo(null);
  }, [showReposicaoModal]);

  useEffect(() => {
    if (showReposicaoModal) return;
    if (reposicaoFetchControllerRef.current) {
      try {
        reposicaoFetchControllerRef.current.abort();
      } catch { }
    }
    reposicaoFetchControllerRef.current = null;
    setReposicaoLoading(false);
    setReposicaoFornecedorNome(null);
    setReposicaoTransacaoInfo(null);
  }, [showReposicaoModal]);

  const fornecedorCount = useMemo(() => pendencias.filter(p => String(p.LOG2) === "10").length, [pendencias]);
  const coletaCount = useMemo(() => pendencias.filter(p => String(p.LOG2) === "17").length, [pendencias]);
  const coletaSeparandoCount = useMemo(() => {
    return pendencias.filter(p => String((p as unknown as { LOG2_REAL?: string | null }).LOG2_REAL ?? p.LOG2) === "21").length;
  }, [pendencias]);
  const topBarBadgeStyle: React.CSSProperties = {
    position: "absolute",
    top: "-7px",
    right: "-11px",
    fontSize: "0.55rem",
    lineHeight: 1,
    padding: "2px 5px",
    borderRadius: "999px",
    minWidth: "16px",
    textAlign: "center",
    pointerEvents: "none",
  };
  const topBarLabelStyle: React.CSSProperties = { fontSize: "0.60rem", lineHeight: 1, marginTop: "2px", textAlign: "center" };
  const formatDateValue = (v: unknown) => {
    if (!v) return "-";
    if (v instanceof Date) return v.toLocaleDateString("pt-BR");
    const s = String(v);
    return formatDate(s);
  };
  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const resetCriacaoPedidoReposicao = () => {
    setCriacaoReposicaoCodFornec("");
    setCriacaoReposicaoFornecedorNome(null);
    setCriacaoReposicaoObs("");
    setCriacaoReposicaoBuscando(false);
    setCriacaoReposicaoSalvando(false);
    setCriacaoReposicaoErro(null);
  };
  const handleAbrirCriacaoPedidoReposicao = (codFornecPrefill?: string | null, fornecedorNomePrefill?: string | null) => {
    resetCriacaoPedidoReposicao();
    if (codFornecPrefill) setCriacaoReposicaoCodFornec(String(codFornecPrefill).trim());
    if (fornecedorNomePrefill) setCriacaoReposicaoFornecedorNome(String(fornecedorNomePrefill).trim() || null);
    setShowCriarPedidoReposicaoModal(true);
  };
  const handleAbrirGerirPedidosReposicao = async () => {
    setShowGerirPedidosReposicaoModal(true);
    setGerirPedidosReposicaoRows([]);
    setGerirPedidosReposicaoError(null);
    setGerirPedidosReposicaoLoading(true);
    try {
      const resp = await fetch(`/api/gestpro/reposicao/pedidos`);
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(String(data?.message || "Erro ao listar pedidos de reposição"));
      }
      setGerirPedidosReposicaoRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      setGerirPedidosReposicaoError(err instanceof Error ? err.message : "Erro ao listar pedidos de reposição");
    } finally {
      setGerirPedidosReposicaoLoading(false);
    }
  };
  const fetchItensPedidoReposicao = async (idPedido: number) => {
    const resp = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/itens`);
    const data = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error(String(data?.message || "Erro ao listar itens do pedido"));
    return Array.isArray(data?.rows) ? data.rows : [];
  };
  const handleAbrirEditarPedidoReposicao = async (pedido: any) => {
    const idPedido = Number(pedido?.ID);
    if (!Number.isFinite(idPedido)) return;
    setEditarPedidoReposicaoPedido(pedido);
    setEditarPedidoReposicaoItens([]);
    setEditarPedidoReposicaoError(null);
    setShowEditarPedidoReposicaoModal(true);
    setEditarPedidoReposicaoLoading(true);
    try {
      const rows = await fetchItensPedidoReposicao(idPedido);
      setEditarPedidoReposicaoItens(rows);
    } catch (err) {
      setEditarPedidoReposicaoError(err instanceof Error ? err.message : "Erro ao listar itens do pedido");
    } finally {
      setEditarPedidoReposicaoLoading(false);
    }
  };
  const handleAbrirImprimirPedidoReposicao = async (pedido: any) => {
    const idPedido = Number(pedido?.ID);
    if (!Number.isFinite(idPedido)) return;
    setImprimirPedidoReposicaoPedido(pedido);
    setImprimirPedidoReposicaoItens([]);
    setImprimirPedidoReposicaoError(null);
    setShowImprimirPedidoReposicaoModal(true);
    setImprimirPedidoReposicaoLoading(true);
    try {
      const rows = await fetchItensPedidoReposicao(idPedido);
      setImprimirPedidoReposicaoItens(rows);
    } catch (err) {
      setImprimirPedidoReposicaoError(err instanceof Error ? err.message : "Erro ao listar itens do pedido");
    } finally {
      setImprimirPedidoReposicaoLoading(false);
    }
  };
  const handleImprimirPedidoReposicao = () => {
    const pedido = imprimirPedidoReposicaoPedido;
    const itens = Array.isArray(imprimirPedidoReposicaoItens) ? imprimirPedidoReposicaoItens : [];
    if (!pedido) return;

    const qtdTotal = itens.reduce((acc, it) => acc + Number(it?.QTREPOSICAO ?? 0), 0);
    const emitidoEm = new Date().toLocaleString("pt-BR");
    const itensRows = itens.length
      ? itens.map((it, idx) => `
          <tr>
            <td class="center">${idx + 1}</td>
            <td>${escapeHtml(it?.CODPROD ?? "-")}</td>
            <td>${escapeHtml(it?.DESCRICAO ?? "-")}</td>
            <td>${escapeHtml(it?.CODAUXILIAR ?? "-")}</td>
            <td class="center">${escapeHtml(it?.CODFORNEC ?? "-")}</td>
            <td class="center">${escapeHtml(it?.QTREPOSICAO ?? 0)}</td>
            <td>${escapeHtml(it?.DATACRIACAO ?? "-")}</td>
            <td>${escapeHtml(it?.USUARIOCRIACAO ?? "-")}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="8" class="center muted">Nenhum item.</td></tr>`;

    const html = `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Pedido de Reposição ${escapeHtml(pedido?.NUMPEDREPOSICAO ?? "-")}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          .muted { color: #666; }
          .header, .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; margin: 16px 0; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
          .row { margin-bottom: 4px; }
          .label { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; vertical-align: top; }
          th { background: #f5f5f5; text-align: left; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <h1>Pedido de Reposição ${escapeHtml(pedido?.NUMPEDREPOSICAO ?? "-")}</h1>
        <div class="muted">Emitido em ${escapeHtml(emitidoEm)}</div>
        <div class="header">
          <div class="card">
            <div class="row"><span class="label">Status:</span> ${escapeHtml(pedido?.STATUSPEDIDO ?? "-")}</div>
            <div class="row"><span class="label">Fornecedor:</span> ${escapeHtml(pedido?.CODFORNEC ?? "-")} - ${escapeHtml(pedido?.FORNECEDOR ?? "-")}</div>
            <div class="row"><span class="label">Criação:</span> ${escapeHtml(pedido?.DATACRIACAO ?? "-")}</div>
            <div class="row"><span class="label">Usuário:</span> ${escapeHtml(pedido?.USUARIOCRIACAO ?? "-")}</div>
          </div>
          <div class="card">
            <div class="row"><span class="label">Itens:</span> ${escapeHtml(itens.length)}</div>
            <div class="row"><span class="label">Quantidade total:</span> ${escapeHtml(qtdTotal.toLocaleString("pt-BR", { maximumFractionDigits: 2 }))}</div>
            <div class="row"><span class="label">Qtd listagem:</span> ${escapeHtml(pedido?.QTTOTAL ?? 0)}</div>
            <div class="row"><span class="label">Observação:</span> ${escapeHtml(pedido?.OBSERVACAO ?? "-")}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="center">#</th>
              <th>Produto</th>
              <th>Descrição</th>
              <th>Auxiliar</th>
              <th class="center">Cod Fornec</th>
              <th class="center">Qtd</th>
              <th>Criação</th>
              <th>Usuário</th>
            </tr>
          </thead>
          <tbody>${itensRows}</tbody>
        </table>
        <script>window.onload = function () { window.print(); };</script>
      </body>
      </html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "width=1024,height=768");
    if (!win) {
      URL.revokeObjectURL(url);
      setReposicaoMessageModal({ show: true, title: "Erro", content: "Não foi possível abrir a janela de impressão.", isError: true });
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const handleAbrirInventarioPedidoReposicao = async (pedido: any) => {
    const idPedido = Number(pedido?.ID);
    if (!Number.isFinite(idPedido)) return;
    setInventarioPedidoReposicaoPedido(pedido);
    setInventarioPedidoReposicaoItens([]);
    setInventarioPedidoReposicaoError(null);
    setShowInventarioPedidoReposicaoModal(true);
    setInventarioPedidoReposicaoLoading(true);
    try {
      const resp = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/itens`);
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(String(data?.message || "Erro ao listar itens do pedido"));
      setInventarioPedidoReposicaoItens(Array.isArray(data?.rows) ? data.rows : []);
    } catch (err) {
      setInventarioPedidoReposicaoError(err instanceof Error ? err.message : "Erro ao listar itens do pedido");
    } finally {
      setInventarioPedidoReposicaoLoading(false);
    }
  };
  const handleAbrirCriarInventarioDoPedidoReposicao = () => {
    const pedido = inventarioPedidoReposicaoPedido;
    const numPed = String(pedido?.NUMPEDREPOSICAO ?? "").trim();
    setCriarInventarioPedidoNome(numPed ? `Reposição ${numPed}` : "Reposição");
    setCriarInventarioPedidoLocal("Reposição");
    setCriarInventarioPedidoFilial(String(reposicaoCodFilial || "1").trim() || "1");
    setCriarInventarioPedidoResponsavel(String(nomeUsuarioLogado || "APP").trim() || "APP");
    setCriarInventarioPedidoError(null);
    setCriarInventarioPedidoProgress(null);
    setShowCriarInventarioPedidoReposicaoModal(true);
  };
  const handleCriarInventarioEAdicionarItensDoPedidoReposicao = async () => {
    const nomeInventario = String(criarInventarioPedidoNome || "").trim();
    const localContagem = String(criarInventarioPedidoLocal || "").trim();
    const filial = String(criarInventarioPedidoFilial || "").trim();
    const responsavel = String(criarInventarioPedidoResponsavel || "").trim();
    const codusur = Number(codUsuarioLogado);
    const nomeUsuario = String(nomeUsuarioLogado || "").trim();

    if (!nomeInventario || !localContagem || !filial || !responsavel) {
      setCriarInventarioPedidoError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!Number.isFinite(codusur)) {
      setCriarInventarioPedidoError("Usuário sem CODUSUR válido para criar inventário.");
      return;
    }

    setCriarInventarioPedidoSaving(true);
    setCriarInventarioPedidoError(null);
    setCriarInventarioPedidoProgress(null);
    try {
      const resp = await fetch(`/api/gestpro/inventario/avulso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeInventario, localContagem, codusur, nomeUsuario, filial, responsavel }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(String(data?.message || "Erro ao criar inventário"));
      const idInventario = Number(data?.idInventario);
      if (!Number.isFinite(idInventario)) throw new Error("Falha ao obter idInventario");

      const itens = Array.isArray(inventarioPedidoReposicaoItens) ? inventarioPedidoReposicaoItens : [];
      const total = itens.length;
      setCriarInventarioPedidoProgress({ current: 0, total });

      for (let i = 0; i < itens.length; i += 1) {
        const it = itens[i];
        const codProd = Number(it?.CODPROD);
        const descricao = String(it?.DESCRICAO ?? "").trim();
        const codAuxiliar = String(it?.CODAUXILIAR ?? "").trim();
        const novaQuantidadeContada = Number(String(it?.QTREPOSICAO ?? 0).replace(",", "."));

        if (!Number.isFinite(codProd) || !descricao || !codAuxiliar) {
          continue;
        }

        const respAdd = await fetch(`/api/gestpro/inventario/avulso/produto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idInventario,
            codProd,
            descricao,
            codAuxiliar,
            novaQuantidadeContada: Number.isFinite(novaQuantidadeContada) ? novaQuantidadeContada : 0,
          }),
        });
        const dataAdd = await respAdd.json().catch(() => null);
        if (!respAdd.ok) {
          throw new Error(String(dataAdd?.message || `Erro ao adicionar item CODPROD ${codProd}`));
        }
        setCriarInventarioPedidoProgress({ current: i + 1, total });
      }

      setShowCriarInventarioPedidoReposicaoModal(false);
      setReposicaoMessageModal({
        show: true,
        title: "Sucesso",
        content: `Inventário ${idInventario} criado e itens adicionados com sucesso.`,
        isError: false,
      });
    } catch (err) {
      setCriarInventarioPedidoError(err instanceof Error ? err.message : "Erro ao criar inventário");
    } finally {
      setCriarInventarioPedidoSaving(false);
    }
  };
  const handleAbrirEditarItemReposicaoQt = (it: any) => {
    setEditarItemReposicaoRow(it);
    setEditarItemReposicaoQt(String(it?.QTREPOSICAO ?? ""));
    setEditarItemReposicaoError(null);
    setShowEditarItemReposicaoQtModal(true);
  };
  const handleSalvarEditarItemReposicaoQt = async () => {
    const pedido = editarPedidoReposicaoPedido;
    const it = editarItemReposicaoRow;
    const idPedido = Number(pedido?.ID);
    const idItem = Number(it?.ID);
    const qtReposicao = Number(String(editarItemReposicaoQt || "").replace(",", "."));
    if (!Number.isFinite(idPedido) || !Number.isFinite(idItem)) return;
    if (!Number.isFinite(qtReposicao) || qtReposicao <= 0) {
      setEditarItemReposicaoError("Informe uma quantidade válida.");
      return;
    }
    setEditarItemReposicaoSaving(true);
    setEditarItemReposicaoError(null);
    try {
      const resp = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/itens/${encodeURIComponent(String(idItem))}/atualizar-qt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtReposicao, usuarioAlteracao: nomeUsuarioLogado }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(String(data?.message || "Erro ao atualizar quantidade"));
      const respItens = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/itens`);
      const dataItens = await respItens.json().catch(() => null);
      if (!respItens.ok) throw new Error(String(dataItens?.message || "Erro ao recarregar itens do pedido"));
      setEditarPedidoReposicaoItens(Array.isArray(dataItens?.rows) ? dataItens.rows : []);
      setShowEditarItemReposicaoQtModal(false);
      setReposicaoMessageModal({ show: true, title: "Sucesso", content: "Quantidade atualizada com sucesso.", isError: false });
    } catch (err) {
      setEditarItemReposicaoError(err instanceof Error ? err.message : "Erro ao atualizar quantidade");
    } finally {
      setEditarItemReposicaoSaving(false);
    }
  };
  const handleExcluirItemReposicao = async (it: any) => {
    const pedido = editarPedidoReposicaoPedido;
    const idPedido = Number(pedido?.ID);
    const idItem = Number(it?.ID);
    if (!Number.isFinite(idPedido) || !Number.isFinite(idItem)) return;

    setExcluindoItemReposicao(true);
    try {
      const resp = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/itens/${encodeURIComponent(String(idItem))}/excluir`, {
        method: "POST",
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(String(data?.message || "Erro ao excluir item"));

      const respItens = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/itens`);
      const dataItens = await respItens.json().catch(() => null);
      if (!respItens.ok) throw new Error(String(dataItens?.message || "Erro ao recarregar itens do pedido"));
      setEditarPedidoReposicaoItens(Array.isArray(dataItens?.rows) ? dataItens.rows : []);
      setExcluirItemReposicaoConfirm(null);
      setReposicaoMessageModal({ show: true, title: "Sucesso", content: "Item excluído com sucesso.", isError: false });
    } catch (err) {
      setReposicaoMessageModal({ show: true, title: "Erro", content: err instanceof Error ? err.message : "Erro ao excluir item", isError: true });
    } finally {
      setExcluindoItemReposicao(false);
    }
  };
  const handleEncerrarPedidoReposicao = async (pedido: any) => {
    const idPedido = Number(pedido?.ID);
    if (!Number.isFinite(idPedido)) return;
    setEncerrandoPedidoReposicao(true);
    try {
      const resp = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/encerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioAlteracao: nomeUsuarioLogado }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(String(data?.message || "Erro ao encerrar pedido"));
      setEncerrarPedidoReposicaoConfirm(null);
      await handleAbrirGerirPedidosReposicao();
      setReposicaoMessageModal({ show: true, title: "Sucesso", content: "Pedido encerrado com sucesso.", isError: false });
    } catch (err) {
      setReposicaoMessageModal({ show: true, title: "Erro", content: err instanceof Error ? err.message : "Erro ao encerrar pedido", isError: true });
    } finally {
      setEncerrandoPedidoReposicao(false);
    }
  };
  const handleReabrirPedidoReposicao = async (pedido: any) => {
    const idPedido = Number(pedido?.ID);
    if (!Number.isFinite(idPedido)) return;
    setReabrindoPedidoReposicao(true);
    try {
      const resp = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/reabrir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioAlteracao: nomeUsuarioLogado }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(String(data?.message || "Erro ao reabrir pedido"));
      setReabrirPedidoReposicaoConfirm(null);
      await handleAbrirGerirPedidosReposicao();
      setReposicaoMessageModal({ show: true, title: "Sucesso", content: "Pedido reaberto com sucesso.", isError: false });
    } catch (err) {
      setReposicaoMessageModal({ show: true, title: "Erro", content: err instanceof Error ? err.message : "Erro ao reabrir pedido", isError: true });
    } finally {
      setReabrindoPedidoReposicao(false);
    }
  };
  const handleBuscarFornecedorCriacao = async () => {
    const codFornec = Number(String(criacaoReposicaoCodFornec || "").trim());
    if (!Number.isFinite(codFornec)) {
      setCriacaoReposicaoErro("Informe um fornecedor valido.");
      return;
    }

    setCriacaoReposicaoBuscando(true);
    setCriacaoReposicaoErro(null);
    setCriacaoReposicaoFornecedorNome(null);
    try {
      const respFornecedor = await fetch(`/api/gestpro/reposicao/fornecedor?codFornec=${encodeURIComponent(String(codFornec))}`);

      const dataFornecedor = await respFornecedor.json().catch(() => null);
      if (!respFornecedor.ok) {
        throw new Error(String(dataFornecedor?.message || "Erro ao buscar fornecedor"));
      }

      setCriacaoReposicaoFornecedorNome(String(dataFornecedor?.fornecedor?.FORNECEDOR ?? dataFornecedor?.fornecedor?.fornecedor ?? "").trim() || null);
    } catch (err) {
      setCriacaoReposicaoErro(err instanceof Error ? err.message : "Erro ao buscar fornecedor");
    } finally {
      setCriacaoReposicaoBuscando(false);
    }
  };
  const handleAbrirBuscarFornecedorDescricao = (destino: "criacao" | "reposicao" = "criacao") => {
    setBuscarFornecedorDescricaoDestino(destino);
    setShowBuscarFornecedorDescricaoModal(true);
    setBuscarFornecedorDescricaoTermo("");
    setBuscarFornecedorDescricaoRows([]);
    setBuscarFornecedorDescricaoLoading(false);
    setBuscarFornecedorDescricaoError(null);
  };
  const handleBuscarFornecedorPorDescricao = async () => {
    const q = String(buscarFornecedorDescricaoTermo || "").trim();
    if (!q) {
      setBuscarFornecedorDescricaoError("Informe uma descrição para pesquisar.");
      setBuscarFornecedorDescricaoRows([]);
      return;
    }

    setBuscarFornecedorDescricaoLoading(true);
    setBuscarFornecedorDescricaoError(null);
    try {
      const url = new URL("/api/gestpro/reposicao/fornecedores", window.location.origin);
      url.searchParams.set("q", q);
      const resp = await fetch(url.pathname + url.search);
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(String(data?.detalhe || data?.message || "Erro ao buscar fornecedores"));
      }
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      setBuscarFornecedorDescricaoRows(rows);
    } catch (err) {
      setBuscarFornecedorDescricaoError(err instanceof Error ? err.message : "Erro ao buscar fornecedores");
      setBuscarFornecedorDescricaoRows([]);
    } finally {
      setBuscarFornecedorDescricaoLoading(false);
    }
  };
  const normalizarStatusPedidoReposicao = (status: unknown) => String(status ?? "").trim().toUpperCase();
  const fetchPedidosReposicao = async (params?: { codFornec?: number | null; somenteAbertos?: boolean }) => {
    const url = new URL("/api/gestpro/reposicao/pedidos", window.location.origin);
    if (Number.isFinite(params?.codFornec)) {
      url.searchParams.set("codFornec", String(params?.codFornec));
    }
    if (params?.somenteAbertos) {
      url.searchParams.set("status", "ABERTO");
    }

    const resp = await fetch(url.pathname + url.search);
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      throw new Error(String(data?.message || "Erro ao listar pedidos de reposição"));
    }
    return Array.isArray(data?.rows) ? data.rows : [];
  };
  const carregarPedidosAddReposicao = async (opts?: { incluirOutrosFornecedores?: boolean; codFornecBase?: number | null }) => {
    const incluirOutrosFornecedores = opts?.incluirOutrosFornecedores ?? addReposicaoBuscarOutrosFornecedores;
    const codFornecBase = opts?.codFornecBase ?? Number(addReposicaoItemRow?.CODFORNEC ?? addReposicaoItemRow?.codfornec ?? addReposicaoItemRow?.codFornec ?? NaN);

    setAddReposicaoPedidosLoading(true);
    setAddReposicaoPedidosError(null);
    setAddReposicaoSelectedPedidoId(null);
    try {
      const rows = await fetchPedidosReposicao({
        codFornec: incluirOutrosFornecedores ? null : codFornecBase,
        somenteAbertos: true,
      });
      setAddReposicaoPedidos(rows);
    } catch (err) {
      setAddReposicaoPedidosError(err instanceof Error ? err.message : "Erro ao listar pedidos de reposição");
      setAddReposicaoPedidos([]);
    } finally {
      setAddReposicaoPedidosLoading(false);
    }
  };
  const handleAbrirAddReposicaoItem = async (row: any) => {
    const codFornec = Number(row?.CODFORNEC ?? row?.codfornec ?? row?.codFornec ?? NaN);
    if (!Number.isFinite(codFornec)) {
      alert("Fornecedor inválido no item selecionado.");
      return;
    }
    setAddReposicaoItemRow(row);
    setAddReposicaoSelectedPedidoId(null);
    setAddReposicaoBuscarOutrosFornecedores(false);
    setAddReposicaoPedidoBusca("");
    setAddReposicaoQt("");
    setAddReposicaoPedidos([]);
    setAddReposicaoPedidosError(null);
    setShowAddReposicaoItemModal(true);
    await carregarPedidosAddReposicao({ incluirOutrosFornecedores: false, codFornecBase: codFornec });
  };
  const handleAbrirBuscarProdutoReposicao = async () => {
    setShowBuscarProdutoReposicaoModal(true);
    setBuscarProdutoReposicaoTermo("");
    setBuscarProdutoReposicaoRows([]);
    setBuscarProdutoReposicaoError(null);
    setBuscarProdutoReposicaoSelectedRow(null);
    setBuscarProdutoReposicaoSelectedPedidoId(null);
    setBuscarProdutoReposicaoPedidoBusca("");
    setBuscarProdutoReposicaoQt("");
    setBuscarProdutoReposicaoLoading(false);
    setBuscarProdutoReposicaoSaving(false);
    setBuscarProdutoReposicaoPedidos([]);
    setBuscarProdutoReposicaoPedidosLoading(true);
    try {
      const rows = await fetchPedidosReposicao({ somenteAbertos: true });
      setBuscarProdutoReposicaoPedidos(rows);
    } catch (err) {
      setBuscarProdutoReposicaoError(err instanceof Error ? err.message : "Erro ao listar pedidos abertos");
    } finally {
      setBuscarProdutoReposicaoPedidosLoading(false);
    }
  };
  const handleBuscarProdutoReposicao = async () => {
    const q = String(buscarProdutoReposicaoTermo || "").trim();
    const codFilial = String(reposicaoCodFilial || "").trim();
    if (!q) {
      setBuscarProdutoReposicaoError("Informe um produto para pesquisar.");
      setBuscarProdutoReposicaoRows([]);
      setBuscarProdutoReposicaoSelectedRow(null);
      return;
    }
    if (!["1", "2", "3", "4"].includes(codFilial)) {
      setBuscarProdutoReposicaoError("Informe uma filial válida para pesquisar o produto.");
      setBuscarProdutoReposicaoRows([]);
      setBuscarProdutoReposicaoSelectedRow(null);
      return;
    }

    setBuscarProdutoReposicaoLoading(true);
    setBuscarProdutoReposicaoError(null);
    setBuscarProdutoReposicaoSelectedRow(null);
    try {
      const url = new URL("/api/gestmkt/buscar-produto", window.location.origin);
      url.searchParams.set("q", q);
      url.searchParams.set("codFilial", codFilial);
      const resp = await fetch(url.pathname + url.search);
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(String(data?.message || "Erro ao buscar produto"));
      }
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      setBuscarProdutoReposicaoRows(rows);
      if (rows.length === 1) {
        setBuscarProdutoReposicaoSelectedRow(rows[0]);
      }
    } catch (err) {
      setBuscarProdutoReposicaoError(err instanceof Error ? err.message : "Erro ao buscar produto");
      setBuscarProdutoReposicaoRows([]);
      setBuscarProdutoReposicaoSelectedRow(null);
    } finally {
      setBuscarProdutoReposicaoLoading(false);
    }
  };
  const handleAdicionarItemNoPedidoReposicao = async () => {
    const row = addReposicaoItemRow;
    const idPedido = addReposicaoSelectedPedidoId;
    const codProd = Number(row?.CODPROD ?? NaN);
    const pedidoSelecionado = addReposicaoPedidos.find((p) => Number(p?.ID) === Number(idPedido)) ?? null;
    const codFornec = Number(pedidoSelecionado?.CODFORNEC ?? NaN);
    const qtReposicao = Number(String(addReposicaoQt || "").replace(",", "."));
    if (!Number.isFinite(idPedido)) {
      setAddReposicaoPedidosError("Selecione um pedido.");
      return;
    }
    if (!Number.isFinite(codProd)) {
      setAddReposicaoPedidosError("Produto inválido.");
      return;
    }
    if (!Number.isFinite(codFornec)) {
      setAddReposicaoPedidosError("Fornecedor do pedido selecionado inválido.");
      return;
    }
    if (!Number.isFinite(qtReposicao) || qtReposicao <= 0) {
      setAddReposicaoPedidosError("Informe uma quantidade válida.");
      return;
    }

    setAddReposicaoSaving(true);
    setAddReposicaoPedidosError(null);
    try {
      const resp = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codProd,
          codAuxiliar: row?.CODAUXILIAR ?? null,
          codFornec,
          qtReposicao,
          usuarioCriacao: nomeUsuarioLogado,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(String(data?.message || "Erro ao adicionar item no pedido"));
      }
      const updated = await fetchPedidosReposicao({
        codFornec: addReposicaoBuscarOutrosFornecedores ? null : codFornec,
        somenteAbertos: true,
      });
      setAddReposicaoPedidos(updated);
      setAddReposicaoQt("");
      setShowAddReposicaoItemModal(false);
      setReposicaoMessageModal({ show: true, title: "Sucesso", content: "Item adicionado com sucesso.", isError: false });
      void handleBuscarReposicao();
    } catch (err) {
      setAddReposicaoPedidosError(err instanceof Error ? err.message : "Erro ao adicionar item no pedido");
    } finally {
      setAddReposicaoSaving(false);
    }
  };
  const handleAdicionarProdutoPesquisadoNoPedidoReposicao = async () => {
    const row = buscarProdutoReposicaoSelectedRow;
    const idPedido = buscarProdutoReposicaoSelectedPedidoId;
    const codProd = Number(row?.CODPROD ?? NaN);
    const pedidoSelecionado = buscarProdutoReposicaoPedidos.find((p) => Number(p?.ID) === Number(idPedido)) ?? null;
    const codFornec = Number(pedidoSelecionado?.CODFORNEC ?? NaN);
    const qtReposicao = Number(String(buscarProdutoReposicaoQt || "").replace(",", "."));

    if (!Number.isFinite(idPedido)) {
      setBuscarProdutoReposicaoError("Selecione um pedido aberto.");
      return;
    }
    if (!Number.isFinite(codProd)) {
      setBuscarProdutoReposicaoError("Selecione um produto válido.");
      return;
    }
    if (!Number.isFinite(codFornec)) {
      setBuscarProdutoReposicaoError("Fornecedor do pedido selecionado inválido.");
      return;
    }
    if (!Number.isFinite(qtReposicao) || qtReposicao <= 0) {
      setBuscarProdutoReposicaoError("Informe uma quantidade válida.");
      return;
    }

    setBuscarProdutoReposicaoSaving(true);
    setBuscarProdutoReposicaoError(null);
    try {
      const resp = await fetch(`/api/gestpro/reposicao/pedidos/${encodeURIComponent(String(idPedido))}/itens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codProd,
          codAuxiliar: row?.CODAUXILIAR ?? null,
          codFornec,
          qtReposicao,
          usuarioCriacao: nomeUsuarioLogado,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(String(data?.message || "Erro ao adicionar item no pedido"));
      }
      const updated = await fetchPedidosReposicao({ somenteAbertos: true });
      setBuscarProdutoReposicaoPedidos(updated);
      setBuscarProdutoReposicaoQt("");
      setShowBuscarProdutoReposicaoModal(false);
      setReposicaoMessageModal({ show: true, title: "Sucesso", content: "Produto adicionado com sucesso.", isError: false });
      void handleBuscarReposicao();
    } catch (err) {
      setBuscarProdutoReposicaoError(err instanceof Error ? err.message : "Erro ao adicionar item no pedido");
    } finally {
      setBuscarProdutoReposicaoSaving(false);
    }
  };
  const handleBuscarReposicao = async () => {
    const codFilialStr = String(reposicaoCodFilial || "").trim();
    const codFornecStr = String(reposicaoCodFornec || "").trim();
    const numTransEntStr = String(reposicaoNumTransEnt || "").trim();
    const dtIniISO = String(reposicaoDtIni || "").trim();
    const dtFimISO = String(reposicaoDtFim || "").trim();

    const codFilial = Number(codFilialStr);
    const codFornec = codFornecStr ? Number(codFornecStr) : null;
    const numTransEnt = numTransEntStr ? Number(numTransEntStr) : null;
    const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    const hasDateRange = isISODate(dtIniISO) && isISODate(dtFimISO);

    const canSearch =
      Number.isFinite(codFilial) &&
      ((Number.isFinite(codFornec) && codFornecStr !== "") || (Number.isFinite(numTransEnt) && numTransEntStr !== "" && hasDateRange));

    if (!canSearch) {
      setReposicaoError("Preencha Filial e Fornecedor, ou Filial + Transação + período.");
      setReposicaoRows([]);
      setReposicaoFornecedorNome(null);
      setReposicaoTransacaoInfo(null);
      setReposicaoLoading(false);
      return;
    }

    if (reposicaoFetchControllerRef.current) {
      try {
        reposicaoFetchControllerRef.current.abort();
      } catch { }
    }
    const controller = new AbortController();
    reposicaoFetchControllerRef.current = controller;

    setReposicaoLoading(true);
    setReposicaoError(null);
    try {
      const url = new URL("/api/gestpro/reposicao/produtos", window.location.origin);
      url.searchParams.set("codFilial", String(codFilial));
      if (Number.isFinite(codFornec) && codFornecStr !== "") url.searchParams.set("codFornec", String(codFornec));
      if (Number.isFinite(numTransEnt) && numTransEntStr !== "") {
        url.searchParams.set("numTransEnt", String(numTransEnt));
        url.searchParams.set("dtIni", dtIniISO);
        url.searchParams.set("dtFim", dtFimISO);
      }

      const resp = await fetch(url.pathname + url.search, { signal: controller.signal });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(String(data?.message || "Erro ao buscar reposição"));
      }
      const data = await resp.json();
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      setReposicaoRows(rows);
      setReposicaoFornecedorNome(String(data?.fornecedor?.fornecedor ?? "").trim() || null);
      setReposicaoTransacaoInfo(data?.transacaoInfo ?? null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setReposicaoError(err instanceof Error ? err.message : "Erro ao buscar reposição");
      setReposicaoRows([]);
      setReposicaoFornecedorNome(null);
      setReposicaoTransacaoInfo(null);
    } finally {
      if (reposicaoFetchControllerRef.current === controller) reposicaoFetchControllerRef.current = null;
      setReposicaoLoading(false);
    }
  };
  const addReposicaoPedidosFiltrados = useMemo(() => {
    const termo = String(addReposicaoPedidoBusca || "").trim().toLowerCase();
    const rowsAbertos = addReposicaoPedidos.filter((p) => normalizarStatusPedidoReposicao(p?.STATUSPEDIDO) === "ABERTO");
    if (!termo) return rowsAbertos;

    return rowsAbertos.filter((p) =>
      [
        p?.NUMPEDREPOSICAO,
        p?.CODFORNEC,
        p?.FORNECEDOR,
        p?.OBSERVACAO,
        p?.USUARIOCRIACAO,
      ].some((value) => String(value ?? "").toLowerCase().includes(termo))
    );
  }, [addReposicaoPedidoBusca, addReposicaoPedidos]);
  const addReposicaoPedidoSelecionado = useMemo(
    () => addReposicaoPedidos.find((p) => Number(p?.ID) === Number(addReposicaoSelectedPedidoId)) ?? null,
    [addReposicaoPedidos, addReposicaoSelectedPedidoId]
  );
  const buscarProdutoReposicaoPedidosFiltrados = useMemo(() => {
    const termo = String(buscarProdutoReposicaoPedidoBusca || "").trim().toLowerCase();
    const rowsAbertos = buscarProdutoReposicaoPedidos.filter((p) => normalizarStatusPedidoReposicao(p?.STATUSPEDIDO) === "ABERTO");
    if (!termo) return rowsAbertos;

    return rowsAbertos.filter((p) =>
      [
        p?.NUMPEDREPOSICAO,
        p?.CODFORNEC,
        p?.FORNECEDOR,
        p?.OBSERVACAO,
        p?.USUARIOCRIACAO,
      ].some((value) => String(value ?? "").toLowerCase().includes(termo))
    );
  }, [buscarProdutoReposicaoPedidoBusca, buscarProdutoReposicaoPedidos]);
  const buscarProdutoReposicaoPedidoSelecionado = useMemo(
    () => buscarProdutoReposicaoPedidos.find((p) => Number(p?.ID) === Number(buscarProdutoReposicaoSelectedPedidoId)) ?? null,
    [buscarProdutoReposicaoPedidos, buscarProdutoReposicaoSelectedPedidoId]
  );
  const handleSalvarPedidoReposicao = async () => {
    const codFornec = Number(String(criacaoReposicaoCodFornec || "").trim());

    if (!Number.isFinite(codFornec)) {
      setCriacaoReposicaoErro("Fornecedor invalido.");
      return;
    }
    if (!criacaoReposicaoFornecedorNome) {
      setCriacaoReposicaoErro("Pesquise e confirme um fornecedor valido.");
      return;
    }

    setCriacaoReposicaoSalvando(true);
    setCriacaoReposicaoErro(null);
    try {
      const resp = await fetch("/api/gestpro/reposicao/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codFornec,
          usuarioCriacao: nomeUsuarioLogado,
          observacao: String(criacaoReposicaoObs || "").trim() || null,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(String(data?.message || "Erro ao criar pedido de reposicao"));
      }
      alert(`Pedido de reposicao ${data?.numPedReposicao} criado com sucesso.`);
      setShowCriarPedidoReposicaoModal(false);
    } catch (err) {
      setCriacaoReposicaoErro(err instanceof Error ? err.message : "Erro ao criar pedido de reposicao");
    } finally {
      setCriacaoReposicaoSalvando(false);
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100" style={{ fontFamily: "'Poppins', sans-serif", backgroundColor: "#f8f9fa" }}>
      <TopBar
        title=""
        titleClassName="d-none"
        showBack={true}
        backLink="/dashboard"
        actions={
          <button
            className="btn btn-primary d-flex align-items-center justify-content-center"
            type="button"
            onClick={() => void loadPendencias()}
            title="Sincronizar"
            style={{ width: "38px", height: "38px", padding: 0 }}
          >
            <ArrowRepeat size={20} />
          </button>
        }
      >
        <div className="d-flex flex-wrap align-items-center ms-0" style={{ columnGap: "1.15rem", rowGap: "0.75rem" }}>
          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setActiveSection("fornecedor")} title="Aguardando Fornecedor">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Truck size={28} className={activeSection === "fornecedor" || fornecedorCount > 0 ? "text-warning" : "text-secondary"} />
              {fornecedorCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {fornecedorCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Aguard.</div>
              <div>Fornecedor</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setActiveSection("coleta")} title="Coleta Pendências">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <BoxSeam size={28} className={activeSection === "coleta" || coletaCount > 0 ? "text-info" : "text-secondary"} />
              {coletaCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {coletaCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Coleta</div>
              <div>Pendências</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setActiveSection("coletaSeparando")} title="Coleta Separando">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <ClipboardCheck size={28} className={activeSection === "coletaSeparando" || coletaSeparandoCount > 0 ? "text-warning" : "text-secondary"} />
              {coletaSeparandoCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {coletaSeparandoCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Coleta</div>
              <div>Separando</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setActiveSection("coletaSeparada")} title="Coleta Separada">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <BoxSeam size={28} className={activeSection === "coletaSeparada" || coletaSeparada19Count > 0 ? "text-success" : "text-secondary"} />
              {coletaSeparada19Count > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {coletaSeparada19Count}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Coleta</div>
              <div>Separada</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setActiveSection("retMessejana")} title="Pedidos Ret. Messejana">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <House size={28} className={activeSection === "retMessejana" || retMessejana20Count > 0 ? "text-primary" : "text-secondary"} />
              {retMessejana20Count > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {retMessejana20Count}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Ret.</div>
              <div>Messejana</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setActiveSection("soFaturar")} title="Pedidos Só Faturar">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <CashCoin size={28} className={activeSection === "soFaturar" || soFaturar15Count > 0 ? "text-success" : "text-secondary"} />
              {soFaturar15Count > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {soFaturar15Count}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Só</div>
              <div>Faturar</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setActiveSection("analise")} title="Pedidos para Análise">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <ClipboardCheck size={28} className={activeSection === "analise" || pedidosAnaliseCount > 0 ? "text-primary" : "text-secondary"} />
              {pedidosAnaliseCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {pedidosAnaliseCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Pedidos</div>
              <div>Análise</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowAjusteEstoqueModal(true)} title="Ajuste de Estoque">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <BoxSeam size={28} className={showAjusteEstoqueModal ? "text-success" : "text-secondary"} />
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Ajuste</div>
              <div>Estoque</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowReposicaoModal(true)} title="Reposição">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <ArrowDownSquare size={28} className={showReposicaoModal ? "text-success" : "text-secondary"} />
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Repo</div>
              <div>sição</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowAuditoriaModal(true)} title="Auditoria">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <ClipboardCheck size={28} className={showAuditoriaModal ? "text-success" : "text-secondary"} />
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Audi</div>
              <div>toria</div>
            </div>
          </div>
        </div>
      </TopBar>

      <div className="container-fluid p-0 flex-grow-1 d-flex flex-column" style={{ position: "relative" }}>
        <div className="d-flex flex-row align-items-stretch flex-grow-1" style={{ minHeight: 0 }}>
          <div className="flex-grow-1" style={{ minHeight: 0 }}>
            <div className="card h-100 rounded-0 border-0 shadow-none">
              <div className="card-body p-0 d-flex flex-column h-100">

                <div className="mt-0 d-flex flex-column flex-grow-1 h-100">
                  {loadingPendencias && (
                    <div className="d-flex align-items-center mb-2" style={{ fontSize: "0.9rem" }}>
                      <span className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                      <span>Carregando pendências de pedidos...</span>
                    </div>
                  )}

                  {errorPendencias && (
                    <div className="alert alert-danger py-2" style={{ fontSize: "0.85rem" }}>
                      {errorPendencias}
                    </div>
                  )}

                  {!loadingPendencias && !errorPendencias && (
                    <div className="flex-grow-1 d-flex flex-column" style={{ overflowY: "auto", overflowX: "hidden" }}>
                        {activeSection === "fornecedor" && (
                          <div className="card border-0 bg-light shadow-lg h-100 d-flex flex-column" style={{ borderLeft: "4px solid #fd7e14", minHeight: 0 }}>
                            <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
                              <h6 className="mb-0 fw-bold text-warning" style={{ fontSize: "0.9rem" }}>Aguardando Fornecedor</h6>
                              <span className="badge bg-warning text-dark rounded-pill px-2" style={{ fontSize: "0.75rem" }}>
                                {pendencias.filter(p => p.LOG2 === "10").length}
                              </span>
                            </div>
                            <div className="card-body p-0" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                              <div className="table-responsive">
                                {pendencias.filter(p => p.LOG2 === "10").length === 0 ? (
                                  <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum item.</div>
                                ) : (
                                  Array.from(groupPendencias(pendencias.filter(p => p.LOG2 === "10"))).map(([numped, items]) => {
                                    const head = items[0];
                                    return (
                                      <div key={numped} className="card mb-3 mx-2 border-0 shadow-sm rounded-3 overflow-hidden">
                                        <div className="card-header bg-white border-bottom px-3 py-2">
                                          <div className="row g-1">
                                            <div className="col-12 border-bottom pb-1 mb-1">
                                              <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center text-truncate" style={{ fontSize: "0.85rem" }}>
                                                  <strong className="me-1">Pedido:</strong> <span className="text-dark fw-bold me-3">{numped}</span>
                                                  <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate" style={{ maxWidth: "400px" }}>{head.CODCLI} - {head.CLIENTE}</span>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="col-12 pe-3" style={{ fontSize: "0.8rem" }}>
                                              <div className="mb-0 d-flex"><strong className="me-1">Data:</strong> <span className="text-muted text-truncate">{formatDate(head.DATA)}</span></div>
                                              <div className="mb-0 d-flex"><strong className="me-1">Vendedor(a):</strong> <span className="text-muted text-truncate">{head.CODUSUR} - {head.NOME}</span></div>
                                              <div className="mb-0 d-flex"><strong className="me-1">Total:</strong> <span className="text-danger fw-bold">{currency(head.VLTOTAL)}</span></div>
                                              <div className="mb-0 d-flex"><strong className="me-1">Entrega:</strong> <span className="text-muted text-truncate">{head.TIPOENTREGA || "-"}</span></div>
                                              {head.CODFILIALRETIRA && <div className="mb-0 d-flex"><strong className="me-1">Retira:</strong> <span className="text-muted text-truncate">{head.CODFILIALRETIRA}</span></div>}
                                            </div>
                                            <div className="col-12 ps-3" style={{ fontSize: "0.8rem" }}>
                                              {[head.OBS, head.OBS1, head.OBS2].some(Boolean) && (
                                                <div className="mb-0 text-break">
                                                  <strong className="me-1">Obs:</strong>
                                                  <span className="text-muted">{[head.OBS, head.OBS1, head.OBS2].filter(Boolean).join(" ")}</span>
                                                </div>
                                              )}
                                              {[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].some(Boolean) && (
                                                <div className="mb-0 text-break">
                                                  <strong className="me-1">Obs Entrega:</strong>
                                                  <span className="text-muted">{[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].filter(Boolean).join(" ")}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="card-body p-0">
                                          <div className="table-responsive" style={{ maxHeight: "45vh", overflowY: "auto", overscrollBehavior: "contain" }}>
                                            <table className="table table-hover table-sm mb-0" style={{ fontSize: "0.75rem" }}>
                                              <thead>
                                                <tr>
                                                  <th className="py-1 ps-3" style={{ width: "12%" }}>Produto</th>
                                                  <th className="py-1" style={{ width: "58%" }}>Descrição</th>
                                                  <th className="py-1" style={{ width: "15%" }}>Qtd</th>
                                                  <th className="py-1" style={{ width: "15%" }}>Posição</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {items.map((p, idx) => (
                                                  <tr key={`faltaprod-${p.NUMPED}-${p.CODPROD}-${idx}`} className="align-middle">
                                                    <td className="py-2 ps-3">{p.CODPROD}</td>
                                                    <td className="py-2">{p.DESCRICAO}</td>
                                                    <td className="py-2">{p.QT}</td>
                                                    <td className="py-2">{p.POSICAO}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeSection === "coleta" && (
                          <div className="card border-0 bg-light shadow-lg h-100 d-flex flex-column" style={{ borderLeft: "4px solid #0dcaf0", minHeight: 0 }}>
                            <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
                              <h6 className="mb-0 fw-bold text-info" style={{ fontSize: "0.9rem" }}>Coletas</h6>
                              <span className="badge bg-info text-white rounded-pill px-2" style={{ fontSize: "0.75rem" }}>{pendencias.filter(p => p.LOG2 === "17").length}</span>
                            </div>
                            <div className="card-body p-0" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                              <div className="table-responsive">
                                {pendencias.filter(p => p.LOG2 === "17").length === 0 ? (
                                  <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum item de Coleta.</div>
                                ) : (
                                  Array.from(groupPendencias(pendencias.filter(p => p.LOG2 === "17"))).map(([numped, items]) => {
                                    const head = items[0];
                                    const hasVias = (head.NUMVIASMAPASEP || 0) > 0;
                                    return (
                                      <div key={numped} className="card mb-3 mx-2 border-0 shadow-sm rounded-3 overflow-hidden" style={hasVias ? { borderLeft: "5px solid #198754" } : undefined}>
                                        <div className={`card-header px-3 py-2 ${hasVias ? "bg-success-subtle" : "bg-white border-bottom"}`}>
                                          <div className="row g-1">
                                            <div className="col-12 border-bottom pb-1 mb-1">
                                              <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center text-truncate" style={{ fontSize: "0.85rem" }}>
                                                  <strong className="me-1">Pedido:</strong> <span className="text-dark fw-bold me-3">{numped}</span>
                                                  <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate" style={{ maxWidth: "400px" }}>{head.CODCLI} - {head.CLIENTE}</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                  <Coleta
                                                    items={items}
                                                    head={head}
                                                    label="Separar Coleta"
                                                    onPrint={(pd) => setPedidoColetaConfirm(pd)}
                                                  />
                                                  <Faltando numped={numped} cliente={head.CLIENTE} onRefresh={() => loadPendencias()} />
                                                </div>
                                              </div>
                                            </div>
                                            <div className="col-12 pe-3" style={{ fontSize: "0.8rem" }}>
                                              <div className="mb-0 d-flex"><strong className="me-1">Data:</strong> <span className="text-muted text-truncate">{formatDate(head.DATA)}</span></div>
                                              <div className="mb-0 d-flex"><strong className="me-1">Vendedor(a):</strong> <span className="text-muted text-truncate">{head.CODUSUR} - {head.NOME}</span></div>
                                              <div className="mb-0 d-flex"><strong className="me-1">Total:</strong> <span className="text-danger fw-bold">{currency(head.VLTOTAL)}</span></div>
                                              <div className="mb-0 d-flex"><strong className="me-1">Entrega:</strong> <span className="text-muted text-truncate">{head.TIPOENTREGA || "-"}</span></div>
                                              {head.CODFILIALRETIRA && <div className="mb-0 d-flex"><strong className="me-1">Retira:</strong> <span className="text-muted text-truncate">{head.CODFILIALRETIRA}</span></div>}
                                              {head.SEPERADOR && <div className="mb-0 d-flex"><strong className="me-1">Separador:</strong> <span className="text-muted text-truncate">{head.SEPERADOR}</span></div>}
                                              {head.EMISSOR_MAPA && <div className="mb-0 d-flex"><strong className="me-1">Emissor mapa:</strong> <span className="text-muted text-truncate">{head.EMISSOR_MAPA}</span></div>}
                                              {typeof head.NUMVIASMAPASEP === "number" && <div className="mb-0 d-flex"><strong className="me-1">Vias mapa:</strong> <span className="text-muted text-truncate">{head.NUMVIASMAPASEP}</span></div>}
                                            </div>
                                            <div className="col-12 ps-3" style={{ fontSize: "0.8rem" }}>
                                              {[head.OBS, head.OBS1, head.OBS2].some(Boolean) && (
                                                <div className="mb-0 text-break">
                                                  <strong className="me-1">Obs:</strong>
                                                  <span className="text-muted">{[head.OBS, head.OBS1, head.OBS2].filter(Boolean).join(" ")}</span>
                                                </div>
                                              )}
                                              {[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].some(Boolean) && (
                                                <div className="mb-0 text-break">
                                                  <strong className="me-1">Obs Entrega:</strong>
                                                  <span className="text-muted">{[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].filter(Boolean).join(" ")}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="card-body p-0">
                                          <table className="table table-hover table-sm mb-0" style={{ fontSize: "0.75rem" }}>
                                            <thead>
                                              <tr>
                                                <th className="py-1 ps-3" style={{ width: "10%" }}>Produto</th>
                                                <th className="py-1" style={{ width: "60%" }}>Descrição</th>
                                                <th className="py-1" style={{ width: "15%" }}>Qtd</th>
                                                <th className="py-1" style={{ width: "15%" }}>Posição</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {items.map((p, idx) => (
                                                <tr key={`coleta-${p.NUMPED}-${p.CODPROD}-${idx}`}>
                                                  <td className="py-1 ps-3">{p.CODPROD}</td>
                                                  <td className="py-1">{p.DESCRICAO}</td>
                                                  <td className="py-1">{p.QT}</td>
                                                  <td className="py-1">{p.POSICAO}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeSection === "coletaSeparando" && (
                          <div className="d-flex flex-column h-100" style={{ minHeight: 0, overflow: "hidden" }}>
                            <ColetaSeparandoPendenciasCard
                              pendencias={pendencias}
                              bodyHeight="calc(100% - 42px)"
                              onRefresh={() => loadPendencias()}
                              onPrint={handlePrintMapa}
                              onValidate={handleOpenValidations}
                            />
                          </div>
                        )}
                        
                        {activeSection === "coletaSeparada" && (
                          <div className="card border-0 bg-light shadow-lg h-100 d-flex flex-column" style={{ borderLeft: "4px solid #198754", minHeight: 0 }}>
                            <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
                              <h6 className="mb-0 fw-bold text-success" style={{ fontSize: "0.9rem" }}>Coleta Separada</h6>
                              <span className="badge bg-success text-white rounded-pill px-2" style={{ fontSize: "0.75rem" }}>
                                {coletaSeparadaList.length}
                              </span>
                            </div>
                            <div className="card-body p-0" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                              <div className="table-responsive">
                                {coletaSeparadaGrouped.size === 0 ? (
                                  <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum pedido com Coleta Separada.</div>
                                ) : (
                                  [...coletaSeparadaGrouped.entries()].map(([numped, group]) => {
                                    const head = group.head;
                                    const items = group.items as any[];
                                    return (
                                      <div key={numped} className="card mb-3 mx-2 border-0 shadow-sm rounded-3 overflow-hidden">
                                        <div className="card-header bg-white border-bottom px-3 py-2">
                                          <div className="d-flex align-items-center justify-content-between">
                                            <div className="d-flex align-items-center text-truncate" style={{ fontSize: "0.85rem" }}>
                                              <strong className="me-1">Pedido:</strong> <span className="text-dark fw-bold me-3">{numped}</span>
                                              <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate" style={{ maxWidth: "420px" }}>{head.CODCLI} - {head.CLIENTE}</span>
                                            </div>
                                          </div>
                                          <div className="mt-1" style={{ fontSize: "0.8rem" }}>
                                            <div className="mb-0 d-flex"><strong className="me-1">Data:</strong> <span className="text-muted text-truncate">{formatDate(String(head.DATA || ""))}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Vendedor(a):</strong> <span className="text-muted text-truncate">{head.CODUSUR} - {head.NOME}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Total:</strong> <span className="text-success fw-bold">{currency(head.VLTOTAL)}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Entrega:</strong> <span className="text-muted text-truncate">{head.TIPOENTREGA || "-"}</span></div>
                                            {head.CODFILIALRETIRA && <div className="mb-0 d-flex"><strong className="me-1">Retira:</strong> <span className="text-muted text-truncate">{head.CODFILIALRETIRA}</span></div>}
                                            {head.EMISSOR_MAPA && <div className="mb-0 d-flex"><strong className="me-1">Emissor mapa:</strong> <span className="text-muted text-truncate">{head.EMISSOR_MAPA}</span></div>}
                                            {typeof head.NUMVIASMAPASEP === "number" && <div className="mb-0 d-flex"><strong className="me-1">Vias mapa:</strong> <span className="text-muted text-truncate">{head.NUMVIASMAPASEP}</span></div>}
                                            {head.DTINICIALSEP && <div className="mb-0 d-flex"><strong className="me-1">Início separação:</strong> <span className="text-muted text-truncate">{formatDate(String(head.DTINICIALSEP))}</span></div>}
                                            {(head.STATUS_ESPECIAL_COLETA || head.STATUS_ESPECIAL_SEPARADO) && (
                                              <div className="mb-0 d-flex"><strong className="me-1">Sit. especial:</strong> <span className="text-muted text-truncate">
                                                {[head.STATUS_ESPECIAL_COLETA, head.STATUS_ESPECIAL_SEPARADO].filter(Boolean).join(" | ")}
                                              </span></div>
                                            )}
                                            {[head.OBS, head.OBS1, head.OBS2].some(Boolean) && (
                                              <div className="mb-0 text-break">
                                                <strong className="me-1">Obs:</strong>
                                                <span className="text-muted">{[head.OBS, head.OBS1, head.OBS2].filter(Boolean).join(" ")}</span>
                                              </div>
                                            )}
                                            {[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].some(Boolean) && (
                                              <div className="mb-0 text-break">
                                                <strong className="me-1">Obs Entrega:</strong>
                                                <span className="text-muted">{[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].filter(Boolean).join(" ")}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="card-body p-0">
                                          <table className="table table-hover table-sm mb-0" style={{ fontSize: "0.75rem" }}>
                                            <thead>
                                              <tr>
                                                <th className="py-1 ps-3" style={{ width: "12%" }}>Produto</th>
                                                <th className="py-1" style={{ width: "58%" }}>Descrição</th>
                                                <th className="py-1" style={{ width: "15%" }}>Qtd</th>
                                                <th className="py-1" style={{ width: "15%" }}>Posição</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {items.map((p, idx) => (
                                                <tr key={`coleta-separada-${p.NUMPED}-${p.CODPROD}-${idx}`} className="align-middle">
                                                  <td className="py-2 ps-3">{p.CODPROD}</td>
                                                  <td className="py-2">{p.DESCRICAO}</td>
                                                  <td className="py-2">{p.QT}</td>
                                                  <td className="py-2">{p.POSICAO}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeSection === "retMessejana" && (
                          <div className="card border-0 bg-light shadow-lg h-100 d-flex flex-column" style={{ borderLeft: "4px solid #6f42c1", minHeight: 0 }}>
                            <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
                              <h6 className="mb-0 fw-bold" style={{ fontSize: "0.9rem", color: "#6f42c1" }}>Pedidos Ret. Messejana</h6>
                              <span className="badge text-white rounded-pill px-2" style={{ fontSize: "0.75rem", backgroundColor: "#6f42c1" }}>
                                {retMessejana20Count}
                              </span>
                            </div>
                            <div className="card-body p-0" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                              <div className="py-2">
                                {retMessejanaGrouped.size === 0 ? (
                                  <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum pedido de Ret. Messejana.</div>
                                ) : (
                                  [...retMessejanaGrouped.entries()].sort((a, b) => a[0] - b[0]).map(([numped, group]) => {
                                    const head = group.head;
                                    const items = group.items as any[];
                                    return (
                                      <div key={numped} className="card mb-3 mx-2 border-0 shadow-sm rounded-3 overflow-hidden">
                                        <div className="card-header bg-success-subtle border-bottom px-3 py-2">
                                          <div className="d-flex align-items-center justify-content-between">
                                            <div className="d-flex align-items-center text-truncate" style={{ fontSize: "0.85rem" }}>
                                              <strong className="me-1">Pedido:</strong> <span className="text-dark fw-bold me-3">{numped}</span>
                                              <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate" style={{ maxWidth: "420px" }}>{head.CODCLI} - {head.CLIENTE}</span>
                                            </div>
                                          </div>
                                          <div className="mt-1" style={{ fontSize: "0.8rem" }}>
                                            <div className="mb-0 d-flex"><strong className="me-1">Data:</strong> <span className="text-muted text-truncate">{formatDate(String(head.DATA || ""))}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Vendedor(a):</strong> <span className="text-muted text-truncate">{head.CODUSUR} - {head.NOME}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Total:</strong> <span className="text-primary fw-bold">{currency(head.VLTOTAL)}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Entrega:</strong> <span className="text-muted text-truncate">{head.TIPOENTREGA || "-"}</span></div>
                                            {head.CODFILIALRETIRA && <div className="mb-0 d-flex"><strong className="me-1">Retira:</strong> <span className="text-muted text-truncate">{head.CODFILIALRETIRA}</span></div>}
                                            {[head.OBS, head.OBS1, head.OBS2].some(Boolean) && (
                                              <div className="mb-0 text-break">
                                                <strong className="me-1">Obs:</strong>
                                                <span className="text-muted">{[head.OBS, head.OBS1, head.OBS2].filter(Boolean).join(" ")}</span>
                                              </div>
                                            )}
                                            {[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].some(Boolean) && (
                                              <div className="mb-0 text-break">
                                                <strong className="me-1">Obs Entrega:</strong>
                                                <span className="text-muted">{[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].filter(Boolean).join(" ")}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="card-body p-0">
                                          <table className="table table-hover table-sm mb-0" style={{ fontSize: "0.75rem" }}>
                                            <thead>
                                              <tr>
                                                <th className="py-1 ps-3" style={{ width: "12%" }}>Produto</th>
                                                <th className="py-1" style={{ width: "58%" }}>Descrição</th>
                                                <th className="py-1" style={{ width: "15%" }}>Qtd</th>
                                                <th className="py-1" style={{ width: "15%" }}>Posição</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {items.map((p, idx) => (
                                                <tr key={`ret-messejana-${p.NUMPED}-${p.CODPROD}-${idx}`} className="align-middle">
                                                  <td className="py-2 ps-3">{p.CODPROD}</td>
                                                  <td className="py-2">{p.DESCRICAO}</td>
                                                  <td className="py-2">{p.QT}</td>
                                                  <td className="py-2">{p.POSICAO}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeSection === "soFaturar" && (
                          <div className="card border-0 bg-light shadow-lg h-100 d-flex flex-column" style={{ borderLeft: "4px solid #dc3545", minHeight: 0 }}>
                            <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
                              <h6 className="mb-0 fw-bold text-danger" style={{ fontSize: "0.9rem" }}>Pedidos Só Faturar</h6>
                              <span className="badge bg-danger text-white rounded-pill px-2" style={{ fontSize: "0.75rem" }}>
                                {soFaturar15Count}
                              </span>
                            </div>
                            <div className="card-body p-0" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                              <div className="table-responsive">
                                {soFaturarGrouped.size === 0 ? (
                                  <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum pedido Só Faturar.</div>
                                ) : (
                                  [...soFaturarGrouped.entries()].sort((a, b) => a[0] - b[0]).map(([numped, group]) => {
                                    const head = group.head;
                                    const items = group.items as any[];
                                    return (
                                      <div key={numped} className="card mb-3 mx-2 border-0 shadow-sm rounded-3 overflow-hidden">
                                        <div className="card-header bg-success-subtle border-bottom px-3 py-2" style={{ backgroundColor: "#d1e7dd" }}>
                                          <div className="d-flex align-items-center justify-content-between">
                                            <div className="d-flex align-items-center text-truncate" style={{ fontSize: "0.85rem" }}>
                                              <strong className="me-1">Pedido:</strong> <span className="text-dark fw-bold me-3">{numped}</span>
                                              <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate" style={{ maxWidth: "420px" }}>{head.CODCLI} - {head.CLIENTE}</span>
                                            </div>
                                          </div>
                                          <div className="mt-1" style={{ fontSize: "0.8rem" }}>
                                            <div className="mb-0 d-flex"><strong className="me-1">Data:</strong> <span className="text-muted text-truncate">{formatDate(String(head.DATA || ""))}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Vendedor(a):</strong> <span className="text-muted text-truncate">{head.CODUSUR} - {head.NOME}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Total:</strong> <span className="text-danger fw-bold">{currency(head.VLTOTAL)}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Entrega:</strong> <span className="text-muted text-truncate">{head.TIPOENTREGA || "-"}</span></div>
                                            {head.CODFILIALRETIRA && <div className="mb-0 d-flex"><strong className="me-1">Retira:</strong> <span className="text-muted text-truncate">{head.CODFILIALRETIRA}</span></div>}
                                            {[head.OBS, head.OBS1, head.OBS2].some(Boolean) && (
                                              <div className="mb-0 text-break">
                                                <strong className="me-1">Obs:</strong>
                                                <span className="text-muted">{[head.OBS, head.OBS1, head.OBS2].filter(Boolean).join(" ")}</span>
                                              </div>
                                            )}
                                            {[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].some(Boolean) && (
                                              <div className="mb-0 text-break">
                                                <strong className="me-1">Obs Entrega:</strong>
                                                <span className="text-muted">{[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].filter(Boolean).join(" ")}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="card-body p-0">
                                          <table className="table table-hover table-sm mb-0" style={{ fontSize: "0.75rem" }}>
                                            <thead>
                                              <tr>
                                                <th className="py-1 ps-3" style={{ width: "12%" }}>Produto</th>
                                                <th className="py-1" style={{ width: "58%" }}>Descrição</th>
                                                <th className="py-1" style={{ width: "15%" }}>Qtd</th>
                                                <th className="py-1" style={{ width: "15%" }}>Posição</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {items.map((p, idx) => (
                                                <tr key={`so-faturar-${p.NUMPED}-${p.CODPROD}-${idx}`} className="align-middle">
                                                  <td className="py-2 ps-3">{p.CODPROD}</td>
                                                  <td className="py-2">{p.DESCRICAO}</td>
                                                  <td className="py-2">{p.QT}</td>
                                                  <td className="py-2">{p.POSICAO}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeSection === "analise" && (
                          <div className="card border-0 bg-light shadow-lg h-100 d-flex flex-column" style={{ borderLeft: "4px solid #6c757d", minHeight: 0 }}>
                            <div className="card-header border-0 bg-transparent py-1 d-flex justify-content-between align-items-center">
                              <h6 className="mb-0 fw-bold text-secondary" style={{ fontSize: "0.9rem" }}>Pedidos para Analise</h6>
                              <span className="badge bg-secondary text-white rounded-pill px-2" style={{ fontSize: "0.75rem" }}>
                                {pedidosAnaliseCount}
                              </span>
                            </div>
                            <div className="card-body p-0" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                              <div className="table-responsive">
                                {pedidosAnaliseGrouped.size === 0 ? (
                                  <div className="text-center py-2 text-muted" style={{ fontSize: "0.85rem" }}>Nenhum pedido para Analise.</div>
                                ) : (
                                  [...pedidosAnaliseGrouped.entries()].sort((a, b) => a[0] - b[0]).map(([numped, group]) => {
                                    const head = group.head;
                                    const items = group.items as any[];
                                    return (
                                      <div key={numped} className="card mb-3 mx-2 border-0 shadow-sm rounded-3 overflow-hidden">
                                        <div className="card-header bg-success-subtle border-bottom px-3 py-2" style={{ backgroundColor: "#d1e7dd" }}>
                                          <div className="d-flex align-items-center justify-content-between">
                                            <div className="d-flex align-items-center text-truncate" style={{ fontSize: "0.85rem" }}>
                                              <strong className="me-1">Pedido:</strong> <span className="text-dark fw-bold me-3">{numped}</span>
                                              <strong className="me-1">Cliente:</strong> <span className="text-muted text-truncate" style={{ maxWidth: "420px" }}>{head.CODCLI} - {head.CLIENTE}</span>
                                            </div>
                                          </div>
                                          <div className="mt-1" style={{ fontSize: "0.8rem" }}>
                                            <div className="mb-0 d-flex"><strong className="me-1">Data:</strong> <span className="text-muted text-truncate">{formatDate(String(head.DATA || ""))}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Vendedor(a):</strong> <span className="text-muted text-truncate">{head.CODUSUR} - {head.NOME}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Total:</strong> <span className="text-secondary fw-bold">{currency(head.VLTOTAL)}</span></div>
                                            <div className="mb-0 d-flex"><strong className="me-1">Entrega:</strong> <span className="text-muted text-truncate">{head.TIPOENTREGA || "-"}</span></div>
                                            {head.CODFILIALRETIRA && <div className="mb-0 d-flex"><strong className="me-1">Retira:</strong> <span className="text-muted text-truncate">{head.CODFILIALRETIRA}</span></div>}
                                            {[head.OBS, head.OBS1, head.OBS2].some(Boolean) && (
                                              <div className="mb-0 text-break">
                                                <strong className="me-1">Obs:</strong>
                                                <span className="text-muted">{[head.OBS, head.OBS1, head.OBS2].filter(Boolean).join(" ")}</span>
                                              </div>
                                            )}
                                            {[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].some(Boolean) && (
                                              <div className="mb-0 text-break">
                                                <strong className="me-1">Obs Entrega:</strong>
                                                <span className="text-muted">{[head.OBSENTREGA1, head.OBSENTREGA2, head.OBSENTREGA3].filter(Boolean).join(" ")}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="card-body p-0">
                                          <table className="table table-hover table-sm mb-0" style={{ fontSize: "0.75rem" }}>
                                            <thead>
                                              <tr>
                                                <th className="py-1 ps-3" style={{ width: "12%" }}>Produto</th>
                                                <th className="py-1" style={{ width: "58%" }}>Descrição</th>
                                                <th className="py-1" style={{ width: "15%" }}>Qtd</th>
                                                <th className="py-1" style={{ width: "15%" }}>Posição</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {items.map((p, idx) => (
                                                <tr key={`analise-${p.NUMPED}-${p.CODPROD}-${idx}`} className="align-middle">
                                                  <td className="py-2 ps-3">{p.CODPROD}</td>
                                                  <td className="py-2">{p.DESCRICAO}</td>
                                                  <td className="py-2">{p.QT}</td>
                                                  <td className="py-2">{p.POSICAO}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showAjusteEstoqueModal && (
        <AjusteEstoqueModal onClose={() => setShowAjusteEstoqueModal(false)} codUsuario={codUsuarioLogado} nomeUsuario={nomeUsuarioLogado} />
      )}
      {showAuditoriaModal && (
        <AuditoriaModal onClose={() => setShowAuditoriaModal(false)} />
      )}
      {showReposicaoModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4500, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4510 }}>
            <div className="modal-dialog modal-fullscreen">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <h5 className="modal-title mb-0 d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <ArrowRepeat className="me-2" />
                    Reposição
                  </h5>
                  <div className="d-flex align-items-center gap-2 ms-auto">
                    <button type="button" className="btn btn-outline-success btn-sm" onClick={() => void handleAbrirBuscarProdutoReposicao()}>
                      <Search className="me-1" />
                      Buscar Produto
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void handleAbrirGerirPedidosReposicao()}>
                      <Gear className="me-1" />
                      Gerir Pedidos
                    </button>
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => handleAbrirCriacaoPedidoReposicao()}>
                      <PlusLg className="me-1" />
                      Novo Pedido
                    </button>
                    <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowReposicaoModal(false)} />
                  </div>
                </div>
                <div className="modal-body" style={{ fontSize: "0.95rem" }}>
                  <div className="d-flex flex-wrap align-items-end justify-content-start gap-2">
                    <div style={{ width: 90 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1" style={{ fontSize: "0.8rem" }}>
                        <House />
                        Filial
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={reposicaoCodFilial}
                        inputMode="numeric"
                        onChange={(e) => setReposicaoCodFilial(e.target.value)}
                        placeholder="Ex: 1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleBuscarReposicao();
                          }
                        }}
                      />
                    </div>
                    <div style={{ width: 180 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1" style={{ fontSize: "0.8rem" }}>
                        <Truck />
                        Fornecedor
                      </label>
                      <div className="input-group input-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => handleAbrirBuscarFornecedorDescricao("reposicao")}
                          title="Pesquisar fornecedor por descrição"
                        >
                          <Search />
                        </button>
                        <input
                          className="form-control"
                          value={reposicaoCodFornec}
                          inputMode="numeric"
                          onChange={(e) => setReposicaoCodFornec(e.target.value)}
                          placeholder="Ex: 567"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleBuscarReposicao();
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ width: 150 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1" style={{ fontSize: "0.8rem" }}>
                        <ArrowDownSquare />
                        Transação
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={reposicaoNumTransEnt}
                        inputMode="numeric"
                        onChange={(e) => setReposicaoNumTransEnt(e.target.value)}
                        placeholder="NUMTRANSENT"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleBuscarReposicao();
                          }
                        }}
                      />
                    </div>
                    <div style={{ width: 145 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1" style={{ fontSize: "0.8rem" }}>
                        <CalendarEvent />
                        Dt. Início
                      </label>
                      <input
                        className="form-control form-control-sm"
                        type="date"
                        value={reposicaoDtIni}
                        onChange={(e) => setReposicaoDtIni(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleBuscarReposicao();
                          }
                        }}
                      />
                    </div>
                    <div style={{ width: 145 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1" style={{ fontSize: "0.8rem" }}>
                        <CalendarEvent />
                        Dt. Fim
                      </label>
                      <input
                        className="form-control form-control-sm"
                        type="date"
                        value={reposicaoDtFim}
                        onChange={(e) => setReposicaoDtFim(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleBuscarReposicao();
                          }
                        }}
                      />
                    </div>
                    <div style={{ width: 120 }}>
                      <button
                        className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center"
                        type="button"
                        onClick={() => void handleBuscarReposicao()}
                        disabled={reposicaoLoading}
                        title="Pesquisar"
                      >
                        <Search className="me-1" />
                        Pesquisar
                      </button>
                    </div>
                    {(reposicaoLoading || reposicaoFornecedorNome !== null) && (
                      <div style={{ minWidth: 360, marginLeft: "auto", textAlign: "right" }}>
                        <div style={{ fontSize: "0.85rem" }}>
                          <Truck className="me-1" />
                          <span className="fw-semibold">Fornecedor:</span>{" "}
                          <span className="text-muted">{reposicaoFornecedorNome ?? "-"}</span>
                        </div>
                        <div style={{ fontSize: "0.85rem" }} className="text-muted">
                          <ClipboardCheck className="me-1 text-dark" />
                          <span className="fw-semibold text-dark">Resultados:</span>{" "}
                          {reposicaoLoading ? "Pesquisando..." : reposicaoError ? reposicaoError : reposicaoRows.length}
                        </div>
                        {String(reposicaoNumTransEnt || "").trim() !== "" && (
                          <div style={{ fontSize: "0.85rem" }} className="text-muted">
                            <InfoCircleFill className="me-1 text-dark" />
                            <span className="fw-semibold text-dark">Emissão:</span>{" "}
                            {formatDateValue(reposicaoTransacaoInfo?.dtEmissao)}{" "}
                            <ArrowDownSquare className="ms-2 me-1 text-dark" />
                            <span className="fw-semibold text-dark">Entrada:</span>{" "}
                            {formatDateValue(reposicaoTransacaoInfo?.dtEnt)}{" "}
                            <BoxSeam className="ms-2 me-1 text-dark" />
                            <span className="fw-semibold text-dark">NF:</span>{" "}
                            {String(reposicaoTransacaoInfo?.numNota ?? "-")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 table-responsive" style={{ maxHeight: "72vh", overflowY: "auto" }}>
                    <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "0.8rem" }}>
                      <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: "7rem" }}>Produto</th>
                          <th>Descrição</th>
                          <th style={{ width: "9rem" }}>Auxiliar</th>
                          <th style={{ width: "7rem" }} className="text-center">Disp.</th>
                          <th style={{ width: "7rem" }} className="text-center">Bloq.</th>
                          <th style={{ width: "7rem" }} className="text-center">Avaria</th>
                          <th style={{ width: "6rem" }} className="text-center">Min</th>
                          <th style={{ width: "6rem" }} className="text-center">Max</th>
                          <th style={{ width: "8rem" }} className="text-center">Vendas</th>
                          <th style={{ width: "8rem" }} className="text-center">QT (NF)</th>
                          <th style={{ width: "9rem" }}>Ult. Ent</th>
                          <th style={{ width: "9rem" }}>Ult. Saída</th>
                          <th style={{ width: "8rem" }} className="text-center">Reposição</th>
                          <th style={{ width: "8rem" }} className="text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reposicaoRows.length === 0 ? (
                          <tr>
                            <td colSpan={14} className="text-center text-muted py-4">
                              Use os filtros e clique em Pesquisar.
                            </td>
                          </tr>
                        ) : (
                          reposicaoRows.map((r, idx) => (
                            <tr
                              key={`${r?.CODPROD ?? "p"}-${r?.CODAUXILIAR ?? "a"}-${idx}`}
                              className={r?.NUMPEDREPOSICAO_ABERTO != null ? "table-success" : ""}
                            >
                              <td className="fw-bold">{r?.CODPROD ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 520 }}>{r?.DESCRICAO ?? "-"}</td>
                              <td>{r?.CODAUXILIAR ?? "-"}</td>
                              <td className="text-center">{r?.ESTOQUE_DISPONIVEL ?? 0}</td>
                              <td className="text-center">{r?.ESTOQUE_BLOQUEADO ?? 0}</td>
                              <td className="text-center">{r?.ESTOQUE_AVARIA ?? 0}</td>
                              <td className="text-center">{r?.ESTMIN ?? 0}</td>
                              <td className="text-center">{r?.ESTMAX ?? 0}</td>
                              <td className="text-center">{r?.VENDAS_ULTS_MESES ?? 0}</td>
                              <td className="text-center">{r?.QT ?? "-"}</td>
                              <td>{formatDateValue(r?.DTULTENT)}</td>
                              <td>{formatDateValue(r?.DTULTSAIDA)}</td>
                              <td className="fw-semibold text-center">{r?.NUMPEDREPOSICAO_ABERTO ?? "-"}</td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn btn-outline-success btn-sm"
                                  onClick={() => void handleAbrirAddReposicaoItem(r)}
                                  title={r?.NUMPEDREPOSICAO_ABERTO != null ? "Adicionar em outro pedido de reposição" : "Adicionar reposição"}
                                >
                                  <PlusLg className="me-1" />
                                  Add
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showAddReposicaoItemModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4550, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4560 }}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <PlusLg className="me-2" />
                    Adicionar Reposição
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowAddReposicaoItemModal(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <div className="border rounded p-2 mb-3">
                    <div className="fw-semibold mb-1 d-flex align-items-center">
                      <BoxSeam className="me-1" />
                      Item selecionado
                    </div>
                    <div className="d-flex flex-wrap gap-2 justify-content-between">
                      <div>
                        <div><span className="fw-semibold">Produto:</span> {addReposicaoItemRow?.CODPROD ?? "-"}</div>
                        <div className="text-muted">{addReposicaoItemRow?.DESCRICAO ?? "-"}</div>
                        <div className="text-muted">Auxiliar: {addReposicaoItemRow?.CODAUXILIAR ?? "-"}</div>
                      </div>
                      <div className="text-end">
                        <div><span className="fw-semibold">Fornecedor:</span> {addReposicaoItemRow?.FORNECEDOR ?? reposicaoFornecedorNome ?? "-"}</div>
                        <div className="text-muted">Reposição em aberto: {addReposicaoItemRow?.NUMPEDREPOSICAO_ABERTO ?? "-"}</div>
                      </div>
                    </div>
                    <div className="row g-2 mt-1" style={{ fontSize: "0.85rem" }}>
                      <div className="col-md-4">
                        <div className="border rounded p-2 h-100">
                          <div><span className="fw-semibold">Disp.:</span> {addReposicaoItemRow?.ESTOQUE_DISPONIVEL ?? 0}</div>
                          <div><span className="fw-semibold">Bloq.:</span> {addReposicaoItemRow?.ESTOQUE_BLOQUEADO ?? 0}</div>
                          <div><span className="fw-semibold">Avaria:</span> {addReposicaoItemRow?.ESTOQUE_AVARIA ?? 0}</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="border rounded p-2 h-100">
                          <div><span className="fw-semibold">Min:</span> {addReposicaoItemRow?.ESTMIN ?? 0}</div>
                          <div><span className="fw-semibold">Max:</span> {addReposicaoItemRow?.ESTMAX ?? 0}</div>
                          <div><span className="fw-semibold">Vendas:</span> {addReposicaoItemRow?.VENDAS_ULTS_MESES ?? 0}</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="border rounded p-2 h-100">
                          <div><span className="fw-semibold">QT (NF):</span> {addReposicaoItemRow?.QT ?? "-"}</div>
                          <div><span className="fw-semibold">Ult. Ent:</span> {formatDateValue(addReposicaoItemRow?.DTULTENT)}</div>
                          <div><span className="fw-semibold">Ult. Saída:</span> {formatDateValue(addReposicaoItemRow?.DTULTSAIDA)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {addReposicaoPedidosError && <div className="alert alert-danger py-2">{addReposicaoPedidosError}</div>}

                  <div className="d-flex flex-wrap align-items-end gap-2 mb-2">
                    <div style={{ width: 160 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <BoxSeam />
                        Quantidade
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={addReposicaoQt}
                        onChange={(e) => setAddReposicaoQt(e.target.value)}
                        inputMode="decimal"
                        placeholder="Qt reposição"
                      />
                    </div>
                    <div style={{ width: 320 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <ClipboardCheck />
                        Filtrar pedidos
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={addReposicaoPedidoBusca}
                        onChange={(e) => setAddReposicaoPedidoBusca(e.target.value)}
                        placeholder="Pedido, fornecedor, obs..."
                      />
                    </div>
                    <div style={{ width: 220 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <ClipboardCheck />
                        Pedido destino
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={addReposicaoSelectedPedidoId ?? ""}
                        onChange={(e) => setAddReposicaoSelectedPedidoId(e.target.value ? Number(e.target.value) : null)}
                        disabled={addReposicaoPedidosLoading}
                      >
                        <option value="">Selecione...</option>
                        {addReposicaoPedidosFiltrados.map((p) => (
                          <option key={String(p.ID)} value={String(p.ID)}>
                            {String(p.NUMPEDREPOSICAO)} - {String(p.FORNECEDOR ?? p.CODFORNEC ?? "")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: 150 }}>
                      <label className="form-label mb-1" style={{ visibility: "hidden" }}>
                        Novo pedido
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm w-100"
                        onClick={() => handleAbrirCriacaoPedidoReposicao(
                          String(addReposicaoItemRow?.CODFORNEC ?? addReposicaoItemRow?.codfornec ?? addReposicaoItemRow?.codFornec ?? "").trim() || null,
                          String(addReposicaoItemRow?.FORNECEDOR ?? reposicaoFornecedorNome ?? "").trim() || null
                        )}
                      >
                        <PlusLg className="me-1" />
                        Novo Pedido
                      </button>
                    </div>
                    <div className="form-check mb-1">
                      <input
                        id="addReposicaoBuscarOutrosFornecedores"
                        className="form-check-input"
                        type="checkbox"
                        checked={addReposicaoBuscarOutrosFornecedores}
                        disabled={addReposicaoPedidosLoading}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAddReposicaoBuscarOutrosFornecedores(checked);
                          void carregarPedidosAddReposicao({ incluirOutrosFornecedores: checked });
                        }}
                      />
                      <label className="form-check-label" htmlFor="addReposicaoBuscarOutrosFornecedores">
                        Pesquisar pedidos abertos de outros fornecedores
                      </label>
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.85rem", marginLeft: "auto" }}>
                      {addReposicaoPedidosLoading ? "Carregando pedidos..." : `Pedidos abertos: ${addReposicaoPedidosFiltrados.length}`}
                    </div>
                  </div>

                  {addReposicaoPedidoSelecionado && Number(addReposicaoPedidoSelecionado?.CODFORNEC) !== Number(addReposicaoItemRow?.CODFORNEC ?? NaN) && (
                    <div className="alert alert-warning py-2">
                      O item sera adicionado usando o fornecedor do pedido selecionado:{" "}
                      <strong>{String(addReposicaoPedidoSelecionado?.FORNECEDOR ?? addReposicaoPedidoSelecionado?.CODFORNEC ?? "-")}</strong>.
                    </div>
                  )}

                  <div className="border rounded" style={{ maxHeight: "45vh", overflowY: "auto" }}>
                    <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.8rem" }}>
                      <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: "7rem" }}>Pedido</th>
                          <th style={{ width: "7rem" }}>Status</th>
                          <th style={{ width: "7rem" }}>Cod Fornec</th>
                          <th>Fornecedor</th>
                          <th style={{ width: "10rem" }}>Data</th>
                          <th style={{ width: "6rem" }} className="text-end">Itens</th>
                          <th style={{ width: "7rem" }} className="text-end">Qtd</th>
                          <th>Obs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {addReposicaoPedidosLoading ? (
                          <tr>
                            <td colSpan={8} className="text-center text-muted py-3">Carregando...</td>
                          </tr>
                        ) : addReposicaoPedidosFiltrados.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center text-muted py-3">
                              {addReposicaoBuscarOutrosFornecedores
                                ? "Nenhum pedido aberto encontrado com o filtro informado."
                                : "Nenhum pedido aberto encontrado para este fornecedor."}
                            </td>
                          </tr>
                        ) : (
                          addReposicaoPedidosFiltrados.map((p) => {
                            const selected = addReposicaoSelectedPedidoId != null && Number(p.ID) === addReposicaoSelectedPedidoId;
                            return (
                              <tr
                                key={String(p.ID)}
                                className={selected ? "table-primary" : ""}
                                style={{ cursor: "pointer" }}
                                onClick={() => setAddReposicaoSelectedPedidoId(Number(p.ID))}
                              >
                                <td className="fw-semibold">{p.NUMPEDREPOSICAO}</td>
                                <td>{p.STATUSPEDIDO ?? "-"}</td>
                                <td>{p.CODFORNEC ?? "-"}</td>
                                <td className="text-truncate" style={{ maxWidth: 220 }}>{p.FORNECEDOR ?? "-"}</td>
                                <td>{p.DATACRIACAO ?? "-"}</td>
                                <td className="text-end">{p.QTITENS ?? 0}</td>
                                <td className="text-end">{p.QTTOTAL ?? 0}</td>
                                <td className="text-truncate" style={{ maxWidth: 260 }}>{p.OBSERVACAO ?? "-"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => void handleAdicionarItemNoPedidoReposicao()}
                    disabled={addReposicaoSaving}
                  >
                    <PlusLg className="me-1" />
                    {addReposicaoSaving ? "Adicionando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showBuscarProdutoReposicaoModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4570, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4580 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <Search className="me-2" />
                    Pesquisar Produto para Reposição
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowBuscarProdutoReposicaoModal(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  {buscarProdutoReposicaoError && <div className="alert alert-danger py-2">{buscarProdutoReposicaoError}</div>}

                  <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                    <div style={{ width: 110 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <House />
                        Filial
                      </label>
                      <input className="form-control form-control-sm" value={reposicaoCodFilial} disabled />
                    </div>
                    <div style={{ minWidth: 320, flex: "1 1 320px" }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <Search />
                        Produto
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={buscarProdutoReposicaoTermo}
                        onChange={(e) => setBuscarProdutoReposicaoTermo(e.target.value)}
                        placeholder="Codigo, auxiliar ou descricao"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleBuscarProdutoReposicao();
                          }
                        }}
                      />
                    </div>
                    <div style={{ width: 150 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <BoxSeam />
                        Quantidade
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={buscarProdutoReposicaoQt}
                        onChange={(e) => setBuscarProdutoReposicaoQt(e.target.value)}
                        inputMode="decimal"
                        placeholder="Qt reposicao"
                      />
                    </div>
                    <div style={{ width: 220 }}>
                      <button
                        className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center"
                        type="button"
                        onClick={() => void handleBuscarProdutoReposicao()}
                        disabled={buscarProdutoReposicaoLoading}
                      >
                        <Search className="me-1" />
                        {buscarProdutoReposicaoLoading ? "Buscando..." : "Pesquisar"}
                      </button>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-lg-6">
                      <div className="border rounded p-2 h-100 d-flex flex-column">
                        <div className="fw-semibold mb-2 d-flex align-items-center justify-content-between">
                          <span className="d-flex align-items-center gap-1">
                            <BoxSeam />
                            Produtos encontrados
                          </span>
                          <span className="text-muted" style={{ fontSize: "0.8rem" }}>
                            {buscarProdutoReposicaoLoading ? "Buscando..." : `Resultados: ${buscarProdutoReposicaoRows.length}`}
                          </span>
                        </div>
                        <div className="table-responsive" style={{ maxHeight: "48vh", overflowY: "auto" }}>
                          <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.8rem" }}>
                            <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                              <tr>
                                <th style={{ width: "7rem" }}>Produto</th>
                                <th>Descricao</th>
                                <th style={{ width: "9rem" }}>Auxiliar</th>
                                <th style={{ width: "7rem" }} className="text-end">Disp.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {buscarProdutoReposicaoLoading ? (
                                <tr>
                                  <td colSpan={4} className="text-center text-muted py-3">Carregando...</td>
                                </tr>
                              ) : buscarProdutoReposicaoRows.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="text-center text-muted py-3">Pesquise um produto para continuar.</td>
                                </tr>
                              ) : (
                                buscarProdutoReposicaoRows.map((row, idx) => {
                                  const selected = Number(buscarProdutoReposicaoSelectedRow?.CODPROD) === Number(row?.CODPROD)
                                    && String(buscarProdutoReposicaoSelectedRow?.CODAUXILIAR ?? "") === String(row?.CODAUXILIAR ?? "");
                                  return (
                                    <tr
                                      key={`${row?.CODPROD ?? "p"}-${row?.CODAUXILIAR ?? "a"}-${idx}`}
                                      className={selected ? "table-primary" : ""}
                                      style={{ cursor: "pointer" }}
                                      onClick={() => setBuscarProdutoReposicaoSelectedRow(row)}
                                    >
                                      <td className="fw-semibold">{row?.CODPROD ?? "-"}</td>
                                      <td className="text-truncate" style={{ maxWidth: 320 }}>{row?.DESCRICAO ?? "-"}</td>
                                      <td>{row?.CODAUXILIAR ?? "-"}</td>
                                      <td className="text-end">{row?.DISPONIVEL ?? row?.ESTOQUE_GERAL ?? 0}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                        {buscarProdutoReposicaoSelectedRow && (
                          <div className="mt-2 border rounded p-2" style={{ fontSize: "0.85rem" }}>
                            <div className="fw-semibold mb-1 d-flex align-items-center">
                              <BoxSeam className="me-1" />
                              Produto selecionado
                            </div>
                            <div className="d-flex flex-wrap gap-2 justify-content-between">
                              <div>
                                <div><span className="fw-semibold">Produto:</span> {buscarProdutoReposicaoSelectedRow?.CODPROD ?? "-"}</div>
                                <div className="text-muted">{buscarProdutoReposicaoSelectedRow?.DESCRICAO ?? "-"}</div>
                                <div className="text-muted">Auxiliar: {buscarProdutoReposicaoSelectedRow?.CODAUXILIAR ?? "-"}</div>
                              </div>
                              <div className="text-end">
                                <div><span className="fw-semibold">Fornecedor:</span> {buscarProdutoReposicaoSelectedRow?.FORNECEDOR ?? "-"}</div>
                                <div className="text-muted">Reposição em aberto: {buscarProdutoReposicaoSelectedRow?.NUMPEDREPOSICAO_ABERTO ?? "-"}</div>
                              </div>
                            </div>
                            <div className="row g-2 mt-1">
                              <div className="col-md-4">
                                <div className="border rounded p-2 h-100">
                                  <div><span className="fw-semibold">Disp.:</span> {buscarProdutoReposicaoSelectedRow?.DISPONIVEL ?? buscarProdutoReposicaoSelectedRow?.ESTOQUE_GERAL ?? 0}</div>
                                  <div><span className="fw-semibold">Bloq.:</span> {buscarProdutoReposicaoSelectedRow?.BLOQUEADO ?? 0}</div>
                                  <div><span className="fw-semibold">Avaria:</span> {buscarProdutoReposicaoSelectedRow?.AVARIA ?? 0}</div>
                                </div>
                              </div>
                              <div className="col-md-4">
                                <div className="border rounded p-2 h-100">
                                  <div><span className="fw-semibold">Min:</span> {buscarProdutoReposicaoSelectedRow?.ESTMIN ?? 0}</div>
                                  <div><span className="fw-semibold">Max:</span> {buscarProdutoReposicaoSelectedRow?.ESTMAX ?? 0}</div>
                                  <div><span className="fw-semibold">Vendas:</span> {buscarProdutoReposicaoSelectedRow?.VENDAS_ULTS_MESES ?? 0}</div>
                                </div>
                              </div>
                              <div className="col-md-4">
                                <div className="border rounded p-2 h-100">
                                  <div><span className="fw-semibold">QT (NF):</span> {buscarProdutoReposicaoSelectedRow?.QT ?? "-"}</div>
                                  <div><span className="fw-semibold">Ult. Ent:</span> {formatDateValue(buscarProdutoReposicaoSelectedRow?.DTULTENT)}</div>
                                  <div><span className="fw-semibold">Ult. Saída:</span> {formatDateValue(buscarProdutoReposicaoSelectedRow?.DTULTSAIDA)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-lg-6">
                      <div className="border rounded p-2 h-100 d-flex flex-column">
                        <div className="d-flex flex-wrap align-items-end gap-2 mb-2">
                          <div style={{ minWidth: 260, flex: "1 1 260px" }}>
                            <label className="form-label mb-1 d-flex align-items-center gap-1">
                              <ClipboardCheck />
                              Filtrar pedidos abertos
                            </label>
                            <input
                              className="form-control form-control-sm"
                              value={buscarProdutoReposicaoPedidoBusca}
                              onChange={(e) => setBuscarProdutoReposicaoPedidoBusca(e.target.value)}
                              placeholder="Pedido, fornecedor, obs..."
                            />
                          </div>
                          <div style={{ width: 220 }}>
                            <label className="form-label mb-1 d-flex align-items-center gap-1">
                              <ClipboardCheck />
                              Pedido destino
                            </label>
                            <select
                              className="form-select form-select-sm"
                              value={buscarProdutoReposicaoSelectedPedidoId ?? ""}
                              onChange={(e) => setBuscarProdutoReposicaoSelectedPedidoId(e.target.value ? Number(e.target.value) : null)}
                              disabled={buscarProdutoReposicaoPedidosLoading}
                            >
                              <option value="">Selecione...</option>
                              {buscarProdutoReposicaoPedidosFiltrados.map((p) => (
                                <option key={String(p.ID)} value={String(p.ID)}>
                                  {String(p.NUMPEDREPOSICAO)} - {String(p.FORNECEDOR ?? p.CODFORNEC ?? "")}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="text-muted" style={{ fontSize: "0.85rem", marginLeft: "auto" }}>
                            {buscarProdutoReposicaoPedidosLoading ? "Carregando pedidos..." : `Pedidos abertos: ${buscarProdutoReposicaoPedidosFiltrados.length}`}
                          </div>
                        </div>

                        {buscarProdutoReposicaoPedidoSelecionado && (
                          <div className="alert alert-info py-2">
                            Destino: <strong>{String(buscarProdutoReposicaoPedidoSelecionado?.NUMPEDREPOSICAO ?? "-")}</strong>{" "}
                            - {String(buscarProdutoReposicaoPedidoSelecionado?.FORNECEDOR ?? buscarProdutoReposicaoPedidoSelecionado?.CODFORNEC ?? "-")}
                          </div>
                        )}

                        <div className="table-responsive" style={{ maxHeight: "48vh", overflowY: "auto" }}>
                          <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.8rem" }}>
                            <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                              <tr>
                                <th style={{ width: "7rem" }}>Pedido</th>
                                <th style={{ width: "7rem" }}>Status</th>
                                <th style={{ width: "7rem" }}>Cod Fornec</th>
                                <th>Fornecedor</th>
                                <th style={{ width: "10rem" }}>Data</th>
                                <th style={{ width: "6rem" }} className="text-end">Itens</th>
                              </tr>
                            </thead>
                            <tbody>
                              {buscarProdutoReposicaoPedidosLoading ? (
                                <tr>
                                  <td colSpan={6} className="text-center text-muted py-3">Carregando...</td>
                                </tr>
                              ) : buscarProdutoReposicaoPedidosFiltrados.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="text-center text-muted py-3">Nenhum pedido aberto encontrado.</td>
                                </tr>
                              ) : (
                                buscarProdutoReposicaoPedidosFiltrados.map((p) => {
                                  const selected = buscarProdutoReposicaoSelectedPedidoId != null && Number(p?.ID) === buscarProdutoReposicaoSelectedPedidoId;
                                  return (
                                    <tr
                                      key={String(p.ID)}
                                      className={selected ? "table-primary" : ""}
                                      style={{ cursor: "pointer" }}
                                      onClick={() => setBuscarProdutoReposicaoSelectedPedidoId(Number(p.ID))}
                                    >
                                      <td className="fw-semibold">{p?.NUMPEDREPOSICAO ?? "-"}</td>
                                      <td>{p?.STATUSPEDIDO ?? "-"}</td>
                                      <td>{p?.CODFORNEC ?? "-"}</td>
                                      <td className="text-truncate" style={{ maxWidth: 220 }}>{p?.FORNECEDOR ?? "-"}</td>
                                      <td>{p?.DATACRIACAO ?? "-"}</td>
                                      <td className="text-end">{p?.QTITENS ?? 0}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowBuscarProdutoReposicaoModal(false)}>
                    <XCircle className="me-1" />
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => void handleAdicionarProdutoPesquisadoNoPedidoReposicao()}
                    disabled={buscarProdutoReposicaoSaving}
                  >
                    <PlusLg className="me-1" />
                    {buscarProdutoReposicaoSaving ? "Adicionando..." : "Adicionar ao Pedido"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {reposicaoMessageModal.show && (
        <>
          <div className="modal-backdrop fade show" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 4700 }} />
          <div className="modal d-block" tabIndex={-1} style={{ position: "fixed", inset: 0, zIndex: 4710 }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "1rem" }}>
                    {reposicaoMessageModal.isError ? (
                      <ExclamationTriangleFill className="me-2 text-danger" />
                    ) : (
                      <CheckCircleFill className="me-2 text-success" />
                    )}
                    {reposicaoMessageModal.title}
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setReposicaoMessageModal(prev => ({ ...prev, show: false }))} />
                </div>
                <div className="modal-body text-center py-4">
                  <p className="mb-0" style={{ fontSize: "0.95rem" }}>{reposicaoMessageModal.content}</p>
                </div>
                <div className="modal-footer py-1 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-3"
                    onClick={() => setReposicaoMessageModal(prev => ({ ...prev, show: false }))}
                  >
                    <XCircle className="me-1" />
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showGerirPedidosReposicaoModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4720, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4730 }}>
            <div className="modal-dialog modal-fullscreen">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <Gear className="me-2" />
                    Pedidos de Reposição
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowGerirPedidosReposicaoModal(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  {gerirPedidosReposicaoError && (
                    <div className="alert alert-danger py-2">{gerirPedidosReposicaoError}</div>
                  )}
                  <div className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>
                    {gerirPedidosReposicaoLoading ? "Carregando..." : `Total: ${gerirPedidosReposicaoRows.length}`}
                  </div>
                  <div className="table-responsive" style={{ maxHeight: "65vh", overflowY: "auto" }}>
                    <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "0.8rem" }}>
                      <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: "7rem" }}>Pedido</th>
                          <th style={{ width: "7rem" }}>Status</th>
                          <th style={{ width: "8rem" }}>Cod Fornec</th>
                          <th>Fornecedor</th>
                          <th style={{ width: "10rem" }}>Criação</th>
                          <th style={{ width: "10rem" }}>Usuário</th>
                          <th style={{ width: "6rem" }} className="text-center">Itens</th>
                          <th style={{ width: "7rem" }} className="text-center">Qtd</th>
                          <th>Obs</th>
                          <th style={{ width: "10rem" }} className="text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gerirPedidosReposicaoLoading ? (
                          <tr>
                            <td colSpan={10} className="text-center text-muted py-3">Carregando...</td>
                          </tr>
                        ) : gerirPedidosReposicaoRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center text-muted py-3">Nenhum pedido.</td>
                          </tr>
                        ) : (
                          gerirPedidosReposicaoRows.map((p, idx) => (
                            <tr key={`${p?.ID ?? "id"}-${idx}`}>
                              <td className="fw-semibold">{p?.NUMPEDREPOSICAO ?? "-"}</td>
                              <td>{p?.STATUSPEDIDO ?? "-"}</td>
                              <td>{p?.CODFORNEC ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 340 }}>{p?.FORNECEDOR ?? "-"}</td>
                              <td>{p?.DATACRIACAO ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 180 }}>{p?.USUARIOCRIACAO ?? "-"}</td>
                              <td className="text-center">{p?.QTITENS ?? 0}</td>
                              <td className="text-center">{p?.QTTOTAL ?? 0}</td>
                              <td className="text-truncate" style={{ maxWidth: 320 }}>{p?.OBSERVACAO ?? "-"}</td>
                              <td className="text-center">
                                <div className="d-inline-flex align-items-center gap-2">
                                  {String(p?.STATUSPEDIDO ?? "").trim().toUpperCase() === "ABERTO" ? (
                                    <>
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => void handleAbrirEditarPedidoReposicao(p)}
                                    title="Editar"
                                    aria-label="Editar"
                                  >
                                    <PencilSquare />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => void handleAbrirInventarioPedidoReposicao(p)}
                                    title="Inventário"
                                    aria-label="Inventário"
                                  >
                                    <CardChecklist />
                                  </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-outline-primary btn-sm"
                                        disabled
                                        title="Disponível apenas para pedidos ABERTOS"
                                        aria-label="Editar indisponível"
                                      >
                                        <PencilSquare />
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm"
                                        disabled
                                        title="Disponível apenas para pedidos ABERTOS"
                                        aria-label="Inventário indisponível"
                                      >
                                        <CardChecklist />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-outline-dark btn-sm"
                                    onClick={() => void handleAbrirImprimirPedidoReposicao(p)}
                                    title="Imprimir"
                                    aria-label="Imprimir"
                                  >
                                    <Printer />
                                  </button>
                                  {String(p?.STATUSPEDIDO ?? "").trim().toUpperCase() === "ENCERRADO" ? (
                                    <button
                                      type="button"
                                      className="btn btn-outline-success btn-sm"
                                      onClick={() => setReabrirPedidoReposicaoConfirm(p)}
                                      title="Reabrir"
                                      aria-label="Reabrir"
                                    >
                                      <UnlockFill />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-outline-danger btn-sm"
                                      onClick={() => setEncerrarPedidoReposicaoConfirm(p)}
                                      title="Encerrar"
                                      aria-label="Encerrar"
                                    >
                                      <LockFill />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowGerirPedidosReposicaoModal(false)}>
                    <XCircle className="me-1" />
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showEditarPedidoReposicaoModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4740, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4750 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <ClipboardCheck className="me-2" />
                    Pedido {editarPedidoReposicaoPedido?.NUMPEDREPOSICAO ?? "-"} - Itens
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowEditarPedidoReposicaoModal(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  {editarPedidoReposicaoError && <div className="alert alert-danger py-2">{editarPedidoReposicaoError}</div>}
                  <div className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>
                    {editarPedidoReposicaoLoading ? "Carregando..." : `Itens: ${editarPedidoReposicaoItens.length}`}
                  </div>
                  <div className="table-responsive" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                    <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "0.8rem" }}>
                      <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: "7rem" }}>Produto</th>
                          <th>Descrição</th>
                          <th style={{ width: "9rem" }}>Auxiliar</th>
                          <th style={{ width: "7rem" }} className="text-center">Qtd</th>
                          <th style={{ width: "10rem" }}>Criação</th>
                          <th style={{ width: "10rem" }}>Usuário</th>
                          <th style={{ width: "7rem" }} className="text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editarPedidoReposicaoLoading ? (
                          <tr>
                            <td colSpan={7} className="text-center text-muted py-3">Carregando...</td>
                          </tr>
                        ) : editarPedidoReposicaoItens.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center text-muted py-3">Nenhum item.</td>
                          </tr>
                        ) : (
                          editarPedidoReposicaoItens.map((it, idx) => (
                            <tr key={`${it?.ID ?? "id"}-${idx}`}>
                              <td className="fw-semibold">{it?.CODPROD ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 340 }}>{it?.DESCRICAO ?? "-"}</td>
                              <td>{it?.CODAUXILIAR ?? "-"}</td>
                              <td className="text-center">{it?.QTREPOSICAO ?? 0}</td>
                              <td>{it?.DATACRIACAO ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 180 }}>{it?.USUARIOCRIACAO ?? "-"}</td>
                              <td className="text-center">
                                <div className="d-inline-flex align-items-center gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                                    onClick={() => handleAbrirEditarItemReposicaoQt(it)}
                                  >
                                    <PencilSquare />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1"
                                    onClick={() => setExcluirItemReposicaoConfirm(it)}
                                  >
                                    <Trash />
                                    <span>Excluir</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditarPedidoReposicaoModal(false)}>
                    <XCircle className="me-1" />
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showImprimirPedidoReposicaoModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4740, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4750 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <Printer className="me-2" />
                    Impressão do Pedido {imprimirPedidoReposicaoPedido?.NUMPEDREPOSICAO ?? "-"}
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowImprimirPedidoReposicaoModal(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  {imprimirPedidoReposicaoError && <div className="alert alert-danger py-2">{imprimirPedidoReposicaoError}</div>}
                  <div className="row g-3 mb-3">
                    <div className="col-lg-6">
                      <div className="border rounded p-3 h-100">
                        <div className="fw-semibold mb-2">Pedido</div>
                        <div><span className="fw-semibold">Número:</span> {imprimirPedidoReposicaoPedido?.NUMPEDREPOSICAO ?? "-"}</div>
                        <div><span className="fw-semibold">Status:</span> {imprimirPedidoReposicaoPedido?.STATUSPEDIDO ?? "-"}</div>
                        <div><span className="fw-semibold">Criação:</span> {imprimirPedidoReposicaoPedido?.DATACRIACAO ?? "-"}</div>
                        <div><span className="fw-semibold">Usuário:</span> {imprimirPedidoReposicaoPedido?.USUARIOCRIACAO ?? "-"}</div>
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <div className="border rounded p-3 h-100">
                        <div className="fw-semibold mb-2">Fornecedor e Resumo</div>
                        <div><span className="fw-semibold">Fornecedor:</span> {imprimirPedidoReposicaoPedido?.CODFORNEC ?? "-"} - {imprimirPedidoReposicaoPedido?.FORNECEDOR ?? "-"}</div>
                        <div><span className="fw-semibold">Itens:</span> {imprimirPedidoReposicaoLoading ? "-" : imprimirPedidoReposicaoItens.length}</div>
                        <div><span className="fw-semibold">Qtd Total:</span> {imprimirPedidoReposicaoLoading ? "-" : imprimirPedidoReposicaoItens.reduce((acc, it) => acc + Number(it?.QTREPOSICAO ?? 0), 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</div>
                        <div><span className="fw-semibold">Obs:</span> {imprimirPedidoReposicaoPedido?.OBSERVACAO ?? "-"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="table-responsive" style={{ maxHeight: "55vh", overflowY: "auto" }}>
                    <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "0.8rem" }}>
                      <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: "4rem" }} className="text-center">#</th>
                          <th style={{ width: "7rem" }}>Produto</th>
                          <th>Descrição</th>
                          <th style={{ width: "9rem" }}>Auxiliar</th>
                          <th style={{ width: "7rem" }} className="text-center">Cod Fornec</th>
                          <th style={{ width: "7rem" }} className="text-center">Qtd</th>
                          <th style={{ width: "10rem" }}>Criação</th>
                          <th style={{ width: "10rem" }}>Usuário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imprimirPedidoReposicaoLoading ? (
                          <tr>
                            <td colSpan={8} className="text-center text-muted py-3">Carregando...</td>
                          </tr>
                        ) : imprimirPedidoReposicaoItens.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center text-muted py-3">Nenhum item.</td>
                          </tr>
                        ) : (
                          imprimirPedidoReposicaoItens.map((it, idx) => (
                            <tr key={`${it?.ID ?? "id"}-${idx}`}>
                              <td className="text-center">{idx + 1}</td>
                              <td className="fw-semibold">{it?.CODPROD ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 340 }}>{it?.DESCRICAO ?? "-"}</td>
                              <td>{it?.CODAUXILIAR ?? "-"}</td>
                              <td className="text-center">{it?.CODFORNEC ?? "-"}</td>
                              <td className="text-center">{it?.QTREPOSICAO ?? 0}</td>
                              <td>{it?.DATACRIACAO ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 180 }}>{it?.USUARIOCRIACAO ?? "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowImprimirPedidoReposicaoModal(false)}>
                    <XCircle className="me-1" />
                    Fechar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleImprimirPedidoReposicao}
                    disabled={imprimirPedidoReposicaoLoading || !!imprimirPedidoReposicaoError}
                  >
                    <Printer className="me-1" />
                    Imprimir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showInventarioPedidoReposicaoModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4740, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4750 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <CardChecklist className="me-2" />
                    Inventário - Pedido {inventarioPedidoReposicaoPedido?.NUMPEDREPOSICAO ?? "-"}
                  </h5>
                  <div className="d-flex align-items-center gap-2 ms-auto">
                    <button
                      type="button"
                      className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1"
                      onClick={handleAbrirCriarInventarioDoPedidoReposicao}
                      disabled={inventarioPedidoReposicaoLoading || inventarioPedidoReposicaoItens.length === 0}
                      title="Criar inventário e adicionar itens"
                    >
                      <PlusLg />
                      <span>Criar Inventário</span>
                    </button>
                    <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowInventarioPedidoReposicaoModal(false)} />
                  </div>
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  {inventarioPedidoReposicaoError && <div className="alert alert-danger py-2">{inventarioPedidoReposicaoError}</div>}
                  <div className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>
                    {inventarioPedidoReposicaoLoading ? "Carregando..." : `Itens: ${inventarioPedidoReposicaoItens.length}`}
                  </div>
                  <div className="table-responsive" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                    <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "0.8rem" }}>
                      <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: "7rem" }}>Produto</th>
                          <th>Descrição</th>
                          <th style={{ width: "9rem" }}>Auxiliar</th>
                          <th style={{ width: "7rem" }} className="text-center">Qtd</th>
                          <th style={{ width: "10rem" }}>Criação</th>
                          <th style={{ width: "10rem" }}>Usuário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventarioPedidoReposicaoLoading ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted py-3">Carregando...</td>
                          </tr>
                        ) : inventarioPedidoReposicaoItens.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted py-3">Nenhum item.</td>
                          </tr>
                        ) : (
                          inventarioPedidoReposicaoItens.map((it, idx) => (
                            <tr key={`${it?.ID ?? "id"}-${idx}`}>
                              <td className="fw-semibold">{it?.CODPROD ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 420 }}>{it?.DESCRICAO ?? "-"}</td>
                              <td>{it?.CODAUXILIAR ?? "-"}</td>
                              <td className="text-center">{it?.QTREPOSICAO ?? 0}</td>
                              <td>{it?.DATACRIACAO ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 180 }}>{it?.USUARIOCRIACAO ?? "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowInventarioPedidoReposicaoModal(false)}>
                    <XCircle className="me-1" />
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showCriarInventarioPedidoReposicaoModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4760, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4770 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <PlusLg className="me-2" />
                    Criar Inventário (Pedido {inventarioPedidoReposicaoPedido?.NUMPEDREPOSICAO ?? "-"})
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    onClick={() => setShowCriarInventarioPedidoReposicaoModal(false)}
                    disabled={criarInventarioPedidoSaving}
                  />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <div className="d-flex flex-wrap align-items-end gap-2">
                    <div style={{ width: 260 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <PencilSquare />
                        Nome
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={criarInventarioPedidoNome}
                        onChange={(e) => setCriarInventarioPedidoNome(e.target.value)}
                        placeholder="Nome do inventário"
                      />
                    </div>
                    <div style={{ width: 180 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <House />
                        Filial
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={criarInventarioPedidoFilial}
                        onChange={(e) => setCriarInventarioPedidoFilial(e.target.value)}
                        inputMode="numeric"
                        placeholder="Ex: 1"
                      />
                    </div>
                    <div style={{ width: 220 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <BoxSeam />
                        Local contagem
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={criarInventarioPedidoLocal}
                        onChange={(e) => setCriarInventarioPedidoLocal(e.target.value)}
                        placeholder="Local"
                      />
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 220 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <Truck />
                        Responsável
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={criarInventarioPedidoResponsavel}
                        onChange={(e) => setCriarInventarioPedidoResponsavel(e.target.value)}
                        placeholder="Responsável"
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-muted" style={{ fontSize: "0.85rem" }}>
                    <span className="fw-semibold text-dark">Usuário:</span> {nomeUsuarioLogado} ({codUsuarioLogado ?? "-"})
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                    <span className="fw-semibold text-dark">Itens:</span> {inventarioPedidoReposicaoItens.length}
                    {criarInventarioPedidoProgress && (
                      <span className="ms-2">
                        <span className="fw-semibold text-dark">Progresso:</span> {criarInventarioPedidoProgress.current}/{criarInventarioPedidoProgress.total}
                      </span>
                    )}
                  </div>

                  {criarInventarioPedidoError && <div className="alert alert-danger py-2 mt-3 mb-0">{criarInventarioPedidoError}</div>}
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowCriarInventarioPedidoReposicaoModal(false)}
                    disabled={criarInventarioPedidoSaving}
                  >
                    <XCircle className="me-1" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => void handleCriarInventarioEAdicionarItensDoPedidoReposicao()}
                    disabled={criarInventarioPedidoSaving}
                  >
                    <PlusLg className="me-1" />
                    {criarInventarioPedidoSaving ? "Criando..." : "Criar e adicionar itens"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showEditarItemReposicaoQtModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4755, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4765 }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <PencilSquare className="me-2" />
                    Editar Quantidade
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowEditarItemReposicaoQtModal(false)} disabled={editarItemReposicaoSaving} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <div className="mb-2">
                    <div className="fw-semibold">{editarItemReposicaoRow?.CODPROD ?? "-"}</div>
                    <div className="text-muted">{editarItemReposicaoRow?.DESCRICAO ?? "-"}</div>
                  </div>
                  <label className="form-label mb-1 d-flex align-items-center gap-1">
                    <BoxSeam />
                    Quantidade
                  </label>
                  <input
                    className="form-control form-control-sm"
                    value={editarItemReposicaoQt}
                    onChange={(e) => setEditarItemReposicaoQt(e.target.value)}
                    inputMode="decimal"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSalvarEditarItemReposicaoQt();
                      }
                    }}
                  />
                  {editarItemReposicaoError && <div className="alert alert-danger py-2 mt-3 mb-0">{editarItemReposicaoError}</div>}
                </div>
                <div className="modal-footer py-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditarItemReposicaoQtModal(false)} disabled={editarItemReposicaoSaving}>
                    <XCircle className="me-1" />
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleSalvarEditarItemReposicaoQt()} disabled={editarItemReposicaoSaving}>
                    <CheckCircleFill className="me-1" />
                    {editarItemReposicaoSaving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {excluirItemReposicaoConfirm && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4760, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4770 }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <Trash className="me-2" />
                    Excluir Item
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    disabled={excluindoItemReposicao}
                    onClick={() => {
                      if (excluindoItemReposicao) return;
                      setExcluirItemReposicaoConfirm(null);
                    }}
                  />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <div className="mb-2">
                    Excluir o item <strong>{excluirItemReposicaoConfirm?.CODPROD ?? "-"}</strong>?
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                    Esta ação não pode ser desfeita.
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={excluindoItemReposicao}
                    onClick={() => setExcluirItemReposicaoConfirm(null)}
                  >
                    <XCircle className="me-1" />
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={excluindoItemReposicao}
                    onClick={() => void handleExcluirItemReposicao(excluirItemReposicaoConfirm)}
                  >
                    <Trash className="me-1" />
                    {excluindoItemReposicao ? "Excluindo..." : "Sim, excluir"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {encerrarPedidoReposicaoConfirm && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4760, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4770 }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <LockFill className="me-2" />
                    Encerrar Pedido
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    disabled={encerrandoPedidoReposicao}
                    onClick={() => {
                      if (encerrandoPedidoReposicao) return;
                      setEncerrarPedidoReposicaoConfirm(null);
                    }}
                  />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <div className="mb-2">
                    Encerrar o pedido <strong>{encerrarPedidoReposicaoConfirm?.NUMPEDREPOSICAO ?? "-"}</strong>?
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                    Esta ação marca o pedido como ENCERRADO.
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={encerrandoPedidoReposicao}
                    onClick={() => setEncerrarPedidoReposicaoConfirm(null)}
                  >
                    <XCircle className="me-1" />
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={encerrandoPedidoReposicao}
                    onClick={() => void handleEncerrarPedidoReposicao(encerrarPedidoReposicaoConfirm)}
                  >
                    <LockFill className="me-1" />
                    {encerrandoPedidoReposicao ? "Encerrando..." : "Sim, encerrar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {reabrirPedidoReposicaoConfirm && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4760, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4770 }}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <UnlockFill className="me-2" />
                    Reabrir Pedido
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    disabled={reabrindoPedidoReposicao}
                    onClick={() => {
                      if (reabrindoPedidoReposicao) return;
                      setReabrirPedidoReposicaoConfirm(null);
                    }}
                  />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <div className="mb-2">
                    Reabrir o pedido <strong>{reabrirPedidoReposicaoConfirm?.NUMPEDREPOSICAO ?? "-"}</strong>?
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                    Esta ação marca o pedido como ABERTO.
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={reabrindoPedidoReposicao}
                    onClick={() => setReabrirPedidoReposicaoConfirm(null)}
                  >
                    <XCircle className="me-1" />
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={reabrindoPedidoReposicao}
                    onClick={() => void handleReabrirPedidoReposicao(reabrirPedidoReposicaoConfirm)}
                  >
                    <UnlockFill className="me-1" />
                    {reabrindoPedidoReposicao ? "Reabrindo..." : "Sim, reabrir"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showCriarPedidoReposicaoModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4600, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4610 }}>
            <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <PlusLg className="me-2" />
                    Criar Pedido de Reposição
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowCriarPedidoReposicaoModal(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <div className="d-flex flex-wrap align-items-end gap-2">
                    <div style={{ width: 320 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <Truck />
                        Fornecedor
                      </label>
                      <div className="input-group input-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => handleAbrirBuscarFornecedorDescricao("criacao")}
                          disabled={criacaoReposicaoBuscando}
                          title="Pesquisar fornecedor por descrição"
                        >
                          <Search />
                        </button>
                        <input
                          className="form-control"
                          value={criacaoReposicaoCodFornec}
                          onChange={(e) => setCriacaoReposicaoCodFornec(e.target.value)}
                          inputMode="numeric"
                          placeholder="Cod. fornecedor"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleBuscarFornecedorCriacao();
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ width: 120 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm w-100"
                        onClick={() => void handleBuscarFornecedorCriacao()}
                        disabled={criacaoReposicaoBuscando}
                      >
                        <Search className="me-1" />
                        {criacaoReposicaoBuscando ? "Buscando..." : "Pesquisar"}
                      </button>
                    </div>
                    <div className="flex-grow-1 text-end" style={{ minWidth: 240 }}>
                      <div style={{ fontSize: "0.85rem" }}>
                        <Truck className="me-1" />
                        <span className="fw-semibold">Fornecedor:</span>{" "}
                        <span className="text-muted">{criacaoReposicaoFornecedorNome ?? "-"}</span>
                      </div>
                      <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                        <House className="me-1" />
                        Usuario: {nomeUsuarioLogado}
                      </div>
                    </div>
                  </div>

                  {criacaoReposicaoErro && (
                    <div className="alert alert-danger py-2 mt-3 mb-0">{criacaoReposicaoErro}</div>
                  )}

                  <div className="mt-3 border rounded p-3">
                    <div className="fw-semibold mb-2 d-flex align-items-center">
                      <PencilSquare className="me-1" />
                      Observação
                    </div>
                    <div className="mb-0">
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <PencilSquare />
                        Texto
                      </label>
                      <textarea
                        className="form-control form-control-sm"
                        rows={6}
                        value={criacaoReposicaoObs}
                        onChange={(e) => setCriacaoReposicaoObs(e.target.value)}
                        placeholder="Observação do pedido"
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCriarPedidoReposicaoModal(false)} disabled={criacaoReposicaoSalvando}>
                    <XCircle className="me-1" />
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-success btn-sm" onClick={() => void handleSalvarPedidoReposicao()} disabled={criacaoReposicaoSalvando}>
                    <PlusLg className="me-1" />
                    {criacaoReposicaoSalvando ? "Salvando..." : "Criar Pedido"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showBuscarFornecedorDescricaoModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4620, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4630 }}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title d-flex align-items-center" style={{ fontSize: "0.95rem" }}>
                    <Search className="me-2" />
                    Buscar Fornecedor por Descrição
                  </h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowBuscarFornecedorDescricaoModal(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  {buscarFornecedorDescricaoError && <div className="alert alert-danger py-2">{buscarFornecedorDescricaoError}</div>}

                  <div className="d-flex flex-wrap align-items-end gap-2 mb-2">
                    <div className="flex-grow-1" style={{ minWidth: 260 }}>
                      <label className="form-label mb-1 d-flex align-items-center gap-1">
                        <Truck />
                        Descrição
                      </label>
                      <input
                        className="form-control form-control-sm"
                        value={buscarFornecedorDescricaoTermo}
                        onChange={(e) => setBuscarFornecedorDescricaoTermo(e.target.value)}
                        placeholder="Ex: acme ltda"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleBuscarFornecedorPorDescricao();
                          }
                        }}
                      />
                    </div>
                    <div style={{ width: 140 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm w-100"
                        onClick={() => void handleBuscarFornecedorPorDescricao()}
                        disabled={buscarFornecedorDescricaoLoading}
                      >
                        <Search className="me-1" />
                        {buscarFornecedorDescricaoLoading ? "Buscando..." : "Pesquisar"}
                      </button>
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.85rem", marginLeft: "auto" }}>
                      {buscarFornecedorDescricaoLoading ? "Carregando..." : `Resultados: ${buscarFornecedorDescricaoRows.length}`}
                    </div>
                  </div>

                  <div className="border rounded" style={{ maxHeight: "50vh", overflowY: "auto" }}>
                    <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.85rem" }}>
                      <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: 120 }}>Cod</th>
                          <th>Fornecedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buscarFornecedorDescricaoLoading ? (
                          <tr>
                            <td colSpan={2} className="text-center text-muted py-3">Carregando...</td>
                          </tr>
                        ) : buscarFornecedorDescricaoRows.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="text-center text-muted py-3">Nenhum fornecedor encontrado.</td>
                          </tr>
                        ) : (
                          buscarFornecedorDescricaoRows.map((f, idx) => (
                            <tr
                              key={`${f?.CODFORNEC ?? "c"}-${idx}`}
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                const cod = String(f?.CODFORNEC ?? "").trim();
                                const nome = String(f?.FORNECEDOR ?? "").trim();
                                if (buscarFornecedorDescricaoDestino === "reposicao") {
                                  setReposicaoCodFornec(cod);
                                  setReposicaoFornecedorNome(nome || null);
                                  setReposicaoError(null);
                                } else {
                                  setCriacaoReposicaoCodFornec(cod);
                                  setCriacaoReposicaoFornecedorNome(nome || null);
                                  setCriacaoReposicaoErro(null);
                                }
                                setShowBuscarFornecedorDescricaoModal(false);
                              }}
                            >
                              <td className="fw-semibold">{f?.CODFORNEC ?? "-"}</td>
                              <td className="text-truncate" style={{ maxWidth: 460 }}>{f?.FORNECEDOR ?? "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowBuscarFornecedorDescricaoModal(false)}>
                    <XCircle className="me-1" />
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {pedidoColetaConfirm && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 4000, backgroundColor: "rgba(0,0,0,0.5)" }} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 4010 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow">
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "0.95rem" }}>Enviar para Coleta Separando</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Fechar"
                    disabled={sendingStatus21}
                    onClick={() => {
                      if (sendingStatus21) return;
                      setPedidoColetaConfirm(null);
                    }}
                  />
                </div>
                <div className="modal-body" style={{ fontSize: "0.9rem" }}>
                  <p className="mb-2">
                    Pedido <strong>{pedidoColetaConfirm.pedido}</strong>
                  </p>
                  <p className="mb-3">
                    Cliente <strong>{pedidoColetaConfirm.cliente}</strong>
                  </p>
                  <p className="mb-0">
                    Confirmar envio deste pedido para <strong>Coleta Separando</strong>?
                  </p>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={sendingStatus21}
                    onClick={() => {
                      if (sendingStatus21) return;
                      setPedidoColetaConfirm(null);
                    }}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={sendingStatus21}
                    onClick={async () => {
                      if (!pedidoColetaConfirm) return;
                      setSendingStatus21(true);
                      try {
                        await handleEnviarParaColetaSeparando(pedidoColetaConfirm);
                        setPedidoColetaConfirm(null);
                      } catch (_err) {
                        // alerta já tratado em handleEnviarParaColetaSeparando
                      } finally {
                        setSendingStatus21(false);
                      }
                    }}
                  >
                    {sendingStatus21 ? "Enviando..." : "Sim, enviar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {validationOrder && (
        <ValidationModal
          show={showValidationModal}
          onClose={() => setShowValidationModal(false)}
          pedidos={validationOrder}
          onSuccess={() => loadPendencias()}
        />
      )}
    </div>
  );
};

export default Gestoper;
