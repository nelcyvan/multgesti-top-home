import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { House, BoxArrowRight, ClipboardCheck, Truck, GeoAlt, CashCoin, Scissors, Eye, JournalText, PencilSquare, Funnel, PlusLg, Trash, Map as MapIcon, BarChartLine, XLg, ListUl, Person, FileText, Printer, CircleFill } from 'react-bootstrap-icons';
import { buscarPedidosPorPeriodo } from '../../services/gestlog/BuscarPedidosPorPeriodo';
import type { BuscarPedidosParams, BuscarPedidosResponse, PedidoGestLOG } from '../../services/gestlog/BuscarPedidosPorPeriodo';
import VisualizarPedido from './VisualizarPedido';
import FiltrosModal from './modals/FiltrosModal';
import NotasRecentesModal from './modals/NotasRecentesModal';
import PedidosFaturarModal from './modals/PedidosFaturarModal';
import type { PedidoGroup } from './modals/PedidosFaturarModal';
import { atualizarStatusPedido } from '../../services/gestlog/MarcarVisualizacao';
import type { PedidoDetalhe } from './VisualizarPedido';
import AtualizarCadastro from './AtualizarCadastro';
import type { AtualizarCadastroItem } from './AtualizarCadastro';
import { atualizarCadastro } from '../../services/gestlog/AtualizarCadastro';
import { buscarLogs } from '../../services/gestlog/BuscarLogs';

// Componente auxiliar para badge + switch integrado
  const AutoRefresher: React.FC<{ intervalMs: number; onRefresh: () => Promise<void>; isActive: boolean }> = ({ intervalMs, onRefresh, isActive }) => {
    useEffect(() => {
      if (!isActive) return;
      const interval = setInterval(() => {
        onRefresh();
      }, intervalMs);
      return () => clearInterval(interval);
    }, [isActive, intervalMs, onRefresh]);
    return null;
  };

  const ColorFilter: React.FC<{ bg: string; fg: string; text: string; checked: boolean; onChange: (v: boolean) => void; id: string; }> = ({ bg, fg, text, checked, onChange, id }) => (
    <button
      type="button"
      className="d-inline-flex align-items-center rounded-pill"
      style={{
        backgroundColor: bg,
        color: fg,
        border: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
        padding: '0 8px',
        gap: '4px',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        justifyContent: 'center',
        fontSize: '0.62rem',
        height: '20px',
      }}
      onClick={() => onChange(!checked)}
    >
      <CircleFill size={8} style={{ opacity: 0.9 }} />
      <span className="fw-semibold" style={{ userSelect: 'none' }}>{text}</span>
      <div className="form-check form-switch m-0 p-0 d-flex align-items-center">
        <input
          className="form-check-input m-0"
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer', transform: 'scale(0.6)' }}
        />
      </div>
    </button>
);

const HeaderField: React.FC<{
  label: string;
  value: React.ReactNode;
  divider?: boolean;
  valueClassName?: string;
  valueStyle?: React.CSSProperties;
  title?: string;
}> = ({ label, value, divider, valueClassName, valueStyle, title }) => (
  <div
    className={`d-flex flex-row align-items-baseline ${divider ? 'border-start ps-2 ms-2' : ''}`}
    style={{ minWidth: 0, gap: '4px' }}
    title={title}
  >
    <span className="text-white" style={{ fontSize: '0.7rem', lineHeight: 1, whiteSpace: 'nowrap' }}>{label}</span>
    <span className={`${valueClassName ?? ''} fw-bold text-white`} style={{ fontSize: '0.7rem', lineHeight: 1.1, ...valueStyle, minWidth: 0 }}>
      {value}
    </span>
  </div>
);

const STATUS_LABELS: Record<number, string> = {
  0: 'Aguardando Visualização',
  1: 'Visualizado',
  2: 'Separando',
  3: 'Separado',
  4: 'Aguardando rota',
  5: 'Incluído em rota',
  6: 'Saindo em rota',
  7: 'Entregue',
  8: 'Retornou',
  9: 'Entrega em dia Específico',
  10: 'Aguardando Fornecedor',
  11: 'Entrega Fracionada',
  12: 'Entrega em horário Específico',
  13: 'Corte',
  14: 'Pegar Localização',
  15: 'Faturar',
  16: 'Separação Cancelada',
  17: 'Coleta',
  18: 'Localização Inserida',
  19: 'Coleta Separada',
  20: 'Enviar p/ Messejana',
  21: 'Coleta Separando',
  22: 'Corte Realizado',
  23: 'Pedidos Prioridade',
  24: 'Entrega Futura',
  25: 'Retira Posterior',
};

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Cálculo de Quantidade Total com ponto fixo (6 casas decimais)
const SCALE = 1_000_000n;
const toScaled = (val?: number | string): bigint | null => {
  if (val == null) return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return null;
    const s = val.toFixed(6);
    const [iRaw, fRaw = ''] = s.split('.');
    const iClean = iRaw.replace(/[^\d-]/g, '') || '0';
    let f = fRaw.replace(/[^\d]/g, '');
    if (f.length > 6) f = f.slice(0, 6);
    while (f.length < 6) f += '0';
    try {
      const iBig = BigInt(iClean);
      const fBig = BigInt(f);
      const scaled = iBig * SCALE + (iBig < 0n ? -fBig : fBig);
      return scaled;
    } catch {
      return null;
    }
  } else {
    let s = String(val).trim();
    if (!s) return null;
    s = s.replace(',', '.');
    // Determina sinal pelo primeiro caractere
    let sign: 1n | -1n = 1n;
    if (s.startsWith('-')) sign = -1n;
    // Remove sinal inicial e caracteres extras (inclui trailing + ou -)
    s = s.replace(/^[+-]/, '');
    s = s.replace(/[^0-9.]/g, '');
    if (!s) return null;
    const [iRaw, fRaw = ''] = s.split('.');
    const iClean = iRaw || '0';
    let f = fRaw;
    if (f.length > 6) f = f.slice(0, 6);
    while (f.length < 6) f += '0';
    try {
      const iBig = BigInt(iClean);
      const fBig = BigInt(f);
      let scaled = iBig * SCALE + fBig;
      if (sign < 0n) scaled = -scaled;
      return scaled;
    } catch {
      return null;
    }
  }
};

// Converte bigint escalado para string decimal amigável
const fromScaledToString = (scaled: bigint): string => {
  const neg = scaled < 0n;
  const abs = neg ? -scaled : scaled;
  const intPart = abs / SCALE;
  let fracPart = (abs % SCALE).toString().padStart(6, '0');
  // remove zeros à direita na parte fracionária
  fracPart = fracPart.replace(/0+$/, '');
  const base = fracPart.length ? `${intPart.toString()}.${fracPart}` : intPart.toString();
  return neg ? `-${base}` : base;
};

const formatQuantidade = (quantidade?: number | string): string => {
  const qScaled = toScaled(quantidade);
  if (qScaled == null) return '-';
  return fromScaledToString(qScaled);
};

// removido: formatEmbalagem (não utilizado)

// removido: calcQuantidadeTotal (não utilizado após uso de QT_TOTAL)

const extractStatusCode = (raw: unknown): number => {
  if (raw == null) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    let n = raw;
    if (n < 0) n = 0; if (n > 25) n = 25;
    return n;
  }
  const s = String(raw).trim();
  if (!s) return 0;
  const parts = s.split(',').map(p => p.trim()).filter(p => p.length > 0);
  const last = parts.length ? parts[parts.length - 1] : s;
  const codeStr = last.includes('__') ? last.split('__')[0].trim() : last;
  const n = parseInt(codeStr, 10);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0; if (n > 25) return 25;
  return n;
};

const formatLogLine = (ln: string): string => {
  const s = (ln || '').trim();
  if (!s) return '-';
  if (s.includes('__')) {
    const idx = s.indexOf('__');
    const code = s.slice(0, idx).trim();
    const rest = s.slice(idx + 2);
    const lastUnd = rest.lastIndexOf('_');
    if (lastUnd > 0) {
      const date = rest.slice(0, lastUnd).trim();
      const user = rest.slice(lastUnd + 1).trim();
      const n = parseInt(code, 10);
      const label = Number.isFinite(n) ? (STATUS_LABELS[Math.max(0, Math.min(25, n))] ?? 'Indefinido') : 'Indefinido';
      return `Status: ${label} , Usuário: ${user} Registro: ${date}`;
    }
    const n = parseInt(code, 10);
    const label = Number.isFinite(n) ? (STATUS_LABELS[Math.max(0, Math.min(25, n))] ?? 'Indefinido') : 'Indefinido';
    return `Status: ${label} , Usuário: - Registro: ${rest.trim()}`;
  }
  const firstDash = s.indexOf('-');
  const lastDash = s.lastIndexOf('-');
  if (firstDash > 0 && lastDash > firstDash) {
    const code = s.slice(0, firstDash).trim();
    const date = s.slice(firstDash + 1, lastDash).trim();
    const user = s.slice(lastDash + 1).trim();
    const n = parseInt(code, 10);
    const label = Number.isFinite(n) ? (STATUS_LABELS[Math.max(0, Math.min(25, n))] ?? 'Indefinido') : 'Indefinido';
    return `Status: ${label} , Usuário: ${user} Registro: ${date}`;
  }
  return s;
};

  const formatObsStatus = (raw: unknown): string => {
    if (raw == null) return '-';
    const s = String(raw).trim();
    if (!s) return '-';
    if (s.includes('__')) {
      const codeStr = s.split('__')[0].trim();
      const n = parseInt(codeStr, 10);
      if (!Number.isFinite(n)) return s;
      const idx = Math.max(0, Math.min(25, n));
      return STATUS_LABELS[idx] ?? 'Indefinido';
    }
    const n = parseInt(s, 10);
    if (!Number.isFinite(n)) return s;
    const idx = Math.max(0, Math.min(25, n));
    return STATUS_LABELS[idx] ?? 'Indefinido';
};

export interface BuscarPedidosRef {
  openConciliar: () => void;
  openMapa: () => void;
  openResumo: () => void;
  openFiltros: () => void;
}

const BuscarPedidosPorPeriodo = forwardRef<BuscarPedidosRef, { onResultado?: (rows: PedidoGestLOG[]) => void; onExposeOpenViewer?: (open: (pedidoNum: number) => void) => void; matricula?: string; onRefreshStatus?: (status: { loading: boolean; nextRefreshIn: number; hasSearched: boolean }) => void; }>(({ onResultado, onExposeOpenViewer, matricula, onRefreshStatus }, ref) => {
  const [filiais, setFiliais] = useState<string[]>(['1']);
  const [tiposEntrega] = useState<string[]>(['EN', 'EF', 'RP']);
  const [filiaisRetira, setFiliaisRetira] = useState<string[]>(['1', '3']);
  const [posicoes] = useState<string[]>(['P', 'L', 'M']);
  const [dataInicio] = useState<string>('2025-01-01');
  const [dataFim] = useState<string>(todayYYYYMMDD());
  const [resultado, setResultado] = useState<BuscarPedidosResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState<boolean>(false);

  // Filtros por cor
  const [showGreen, setShowGreen] = useState<boolean>(true);
  const [showOrange, setShowOrange] = useState<boolean>(true);
  const [showRed, setShowRed] = useState<boolean>(true);
  const [showPurple, setShowPurple] = useState<boolean>(true);
  const [showBlue, setShowBlue] = useState<boolean>(true);
  const [showBlack, setShowBlack] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoDetalhe | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [itemSelecionado, setItemSelecionado] = useState<AtualizarCadastroItem | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [logsConteudo, setLogsConteudo] = useState<{ obs?: string; linhas: string[] } | null>(null);
  const [orderBy, setOrderBy] = useState<'date_asc' | 'bairro' | 'cliente' | 'status'>('date_asc');
  const [clienteFiltro, setClienteFiltro] = useState<string>('');
  const [produtoFiltroCod, setProdutoFiltroCod] = useState<string>('');
  const [showProdutoModal, setShowProdutoModal] = useState<boolean>(false);
  const [produtoPrintUser, setProdutoPrintUser] = useState<string>('APP');
  const [produtoPrintAt, setProdutoPrintAt] = useState<Date | null>(null);
  const [showResumoModal, setShowResumoModal] = useState<boolean>(false);
  const [resumoTab, setResumoTab] = useState<'bairro' | 'cliente' | 'pedido'>('bairro');
  const [resumoSearchTerm, setResumoSearchTerm] = useState<string>('');
  const [showCortesModal, setShowCortesModal] = useState<boolean>(false);
  const [cortesTab, setCortesTab] = useState<13 | 22>(13);
  const [showVisualizadosModal, setShowVisualizadosModal] = useState<boolean>(false);
  const [showFaturarModal, setShowFaturarModal] = useState<boolean>(false);
  const [showSepCanceladaModal, setShowSepCanceladaModal] = useState<boolean>(false);
  const [showSeparacaoModal, setShowSeparacaoModal] = useState<boolean>(false);
  const [separacaoTab, setSeparacaoTab] = useState<2 | 3 | 16>(2);
  const [showColetaModal, setShowColetaModal] = useState<boolean>(false);
  const [coletaTab, setColetaTab] = useState<17 | 19 | 21>(17);
  const [localizacaoTab, setLocalizacaoTab] = useState<14 | 18>(14);
  const [showNotasModal, setShowNotasModal] = useState<boolean>(false);
  const [showInformativoModal, setShowInformativoModal] = useState<boolean>(false);
  const [informativoTab, setInformativoTab] = useState<string>('Entregas em dia Específico');
  const [highlightedPedidos, setHighlightedPedidos] = useState<Set<string>>(new Set());
  const [faturarViewedPedidos, setFaturarViewedPedidos] = useState<Set<string>>(new Set());
  const [showLocalizacaoModal, setShowLocalizacaoModal] = useState<boolean>(false);
  const [showMapaModal, setShowMapaModal] = useState<boolean>(false);
  const [mapPoints, setMapPoints] = useState<{ cep: string; num?: string }[]>([]);
  const [cepInput, setCepInput] = useState<string>('');
  const [cepNumInput, setCepNumInput] = useState<string>('');
  const [routeInfo, setRouteInfo] = useState<{
    totalDistanceKm: number;
    totalDurationMin: number;
    legs: { from: string; to: string; distanceKm: number; durationMin: number }[];
  } | null>(null);
  const [routeLoading, setRouteLoading] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    openConciliar: () => setShowNotasModal(true),
    openMapa: () => setShowMapaModal(true),
    openResumo: () => {
      setResumoTab(orderBy === 'bairro' ? 'bairro' : orderBy === 'cliente' ? 'cliente' : 'bairro');
      setShowResumoModal(true);
    },
    openFiltros: () => setFiltersModalOpen(true),
  }));

  useEffect(() => {
    if (showColetaModal) setColetaTab(17);
  }, [showColetaModal]);

  useEffect(() => {
    if (showLocalizacaoModal) setLocalizacaoTab(14);
  }, [showLocalizacaoModal]);

  useEffect(() => {
    if (showSeparacaoModal) setSeparacaoTab(2);
  }, [showSeparacaoModal]);

  useEffect(() => {
    if (showCortesModal) setCortesTab(13);
  }, [showCortesModal]);

  useEffect(() => {
    const computeRoute = async () => {
      setRouteError(null);
      setRouteInfo(null);
      const points = mapPoints
        .map(p => ({ cep: (p.cep || '').replace(/\D+/g, ''), num: (p.num || '').trim() }))
        .filter(p => p.cep.length > 0);
      if (points.length < 2) return;
      setRouteLoading(true);
      try {
        const coords: { cep: string; lat: number; lon: number }[] = [];
        for (const p of points) {
          const cepOnly = p.cep;
          const numPart = p.num ? ` ${p.num}` : '';
          const queryVariants = [
            `https://nominatim.openstreetmap.org/search?format=json&country=Brazil&city=Fortaleza&postalcode=${encodeURIComponent(cepOnly)}`,
            `https://nominatim.openstreetmap.org/search?format=json&country=Brazil&city=Fortaleza&q=${encodeURIComponent(cepOnly + numPart)}`,
            `https://nominatim.openstreetmap.org/search?format=json&country=Brazil&q=${encodeURIComponent(cepOnly + ' Fortaleza')}`,
          ];
          let found: unknown = null;
          for (const url of queryVariants) {
            try {
              const resp = await fetch(url);
              const data = await resp.json();
              if (Array.isArray(data) && data.length > 0) { found = data[0]; break; }
            } catch {
              // silencioso: segue para próxima variante de consulta
            }
          }
          if (!found || typeof found !== 'object' || found == null || !('lat' in found) || !('lon' in found)) {
            throw new Error(`CEP não encontrado: ${cepOnly}${p.num ? ' ' + p.num : ''}, Fortaleza`);
          }
          const f = found as { lat: string | number; lon: string | number };
          coords.push({ cep: `${cepOnly}${p.num ? ' ' + p.num : ''}, Fortaleza`, lat: Number(f.lat), lon: Number(f.lon) });
        }
        let totalDistanceKm = 0;
        let totalDurationMin = 0;
        const legs: { from: string; to: string; distanceKm: number; durationMin: number }[] = [];
        for (let i = 0; i < coords.length - 1; i++) {
          const a = coords[i];
          const b = coords[i + 1];
          const routeResp = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`);
          const routeData = await routeResp.json();
          const route = routeData && routeData.routes && routeData.routes[0];
          if (!route) throw new Error('Falha ao calcular rota');
          const distKm = (route.distance || 0) / 1000;
          const durMin = (route.duration || 0) / 60;
          totalDistanceKm += distKm;
          totalDurationMin += durMin;
          legs.push({ from: a.cep, to: b.cep, distanceKm: distKm, durationMin: durMin });
        }
        setRouteInfo({ totalDistanceKm, totalDurationMin, legs });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao calcular distância/tempo da rota';
        setRouteError(msg);
      } finally {
        setRouteLoading(false);
      }
    };
    void computeRoute();
  }, [mapPoints]);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const MIN_ACTION_OVERLAY_MS = 600;
  const [openingPedido, setOpeningPedido] = useState<string | null>(null);
  const wrapToggle = (setter: (v: boolean) => void) => (v: boolean) => {
    setActionLoading(true);
    const start = Date.now();
    setter(v);
    const elapsed = Date.now() - start;
    const ms = elapsed < MIN_ACTION_OVERLAY_MS ? MIN_ACTION_OVERLAY_MS - elapsed : 0;
    setTimeout(() => setActionLoading(false), ms);
  };

  useEffect(() => {
    setFiltersModalOpen(true);
    setShowFilters(true);
  }, []);

  const getUsuarioLogado = (): string => {
    try {
      const raw = localStorage.getItem('usuarioLogado');
      if (!raw) return 'APP';
      const obj = JSON.parse(raw) as { usuario?: unknown } | null;
      const nome = (obj?.usuario ?? '').toString().trim();
      return nome || 'APP';
    } catch {
      return 'APP';
    }
  };

  useEffect(() => {
    // Atualiza a aba padrão do resumo conforme a ordenação selecionada
    setResumoTab(orderBy === 'bairro' ? 'bairro' : orderBy === 'cliente' ? 'cliente' : 'bairro');
  }, [orderBy]);
  useEffect(() => {
    // Limpa a pesquisa ao abrir o modal de resumo
    if (showResumoModal) setResumoSearchTerm('');
  }, [showResumoModal]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ obs?: string; linhas: string[] }>;
      const detail = ce.detail || { obs: 'Erro ao buscar', linhas: [] };
      setLogsConteudo({ obs: detail.obs, linhas: detail.linhas });
      setShowLogsModal(true);
    };
    document.addEventListener('abrirLogsPedido', handler as EventListener);
    return () => document.removeEventListener('abrirLogsPedido', handler as EventListener);
  }, []);

  const openViewer = (pedidoNum: number) => {
    if (!resultado) return;
    setActionLoading(true);
    const groups = groupPedidos(resultado.rows);
    const found = groups.find(g => Number(g.pedido) === Number(pedidoNum));
    if (!found) { setActionLoading(false); return; }
    setOpeningPedido(String(pedidoNum));
    setPedidoSelecionado({
      pedido: found.pedido,
      data: found.data,
      tipoEntrega: found.tipoEntrega,
      cliente: found.cliente,
      codFilial: found.codFilial,
      codFilialRetira: found.codFilialRetira,
      codCli: found.codCli,
      cobranca: found.cobranca,
      vendedor: found.vendedor,
      bairroEnt: found.bairroEnt,
      enderEnt: found.enderEnt,
      numeroEnt: found.numeroEnt,
      municEnt: found.municEnt,
      telEnt: found.telEnt,
      posicao: found.posicao,
      obs: found.obs,
      obs1: found.obs1,
      obs2: found.obs2,
      obsEntrega1: found.obsEntrega1,
      obsEntrega2: found.obsEntrega2,
      obsEntrega3: found.obsEntrega3,
      log3: found.log3,
      vlFrete: found.vlFrete,
      items: found.items,
      ageDays: found.ageDays,
      normalizedDate: found.normalizedDate,
      statusPedido: found.statusPedido,
    });
    setShowModal(true);
    setTimeout(() => setActionLoading(false), 200);
  };

  useEffect(() => {
    if (typeof onExposeOpenViewer === 'function') {
      onExposeOpenViewer(openViewer);
    }
  }, [onExposeOpenViewer, resultado]);
  useEffect(() => {
    if (showModal) setOpeningPedido(null);
  }, [showModal]);
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(15);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const refreshTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    onRefreshStatus?.({ loading, nextRefreshIn, hasSearched });
  }, [loading, nextRefreshIn, hasSearched, onRefreshStatus]);

  const handleBuscar = async () => {
    setErro(null);
    setLoading(true);
    setActionLoading(true);
    const start = Date.now();
    setResultado(null);
    setShowFilters(false);
    try {
      const params: BuscarPedidosParams = {
        filiais,
        tiposEntrega,
        filiaisRetira: filiaisRetira.length ? filiaisRetira : undefined,
        dataInicio,
        dataFim,
        posicoesPedido: posicoes,
      };
      const resp = await buscarPedidosPorPeriodo(params);
      setResultado(resp);
      onResultado?.(resp.rows);
      setHasSearched(true);
      setFiltersModalOpen(false);
      setOrderBy('date_asc');
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao buscar pedidos');
    } finally {
       const elapsed = Date.now() - start;
       if (elapsed < MIN_ACTION_OVERLAY_MS) {
         await new Promise(r => setTimeout(r, MIN_ACTION_OVERLAY_MS - elapsed));
       }
       setActionLoading(false);
       setLoading(false);
     }
  };

  // Atualização automática a cada 15s usando filtros atuais (quando filtros estão ocultos)
  const refreshPedidos = async () => {
    try {
      setErro(null);
      setLoading(true);
      const params: BuscarPedidosParams = {
        filiais,
        tiposEntrega,
        filiaisRetira: filiaisRetira.length ? filiaisRetira : undefined,
        dataInicio,
        dataFim,
        posicoesPedido: posicoes,
      };
      const resp = await buscarPedidosPorPeriodo(params);
      setResultado(resp);
      onResultado?.(resp.rows);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao sincronizar pedidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasSearched || showFilters || filtersModalOpen) {
      if (refreshTimerRef.current != null) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      setNextRefreshIn(15);
      return;
    }
    if (refreshTimerRef.current != null) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    refreshTimerRef.current = window.setInterval(() => {
      setNextRefreshIn((prev) => {
        const v = Number(prev);
        if (!Number.isFinite(v)) return 15;
        if (v <= 1) {
          if (!loading) { void refreshPedidos(); }
          return 15;
        }
        return v - 1;
      });
    }, 1000);
    return () => {
      if (refreshTimerRef.current != null) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [hasSearched, showFilters, filtersModalOpen, filiais, tiposEntrega, filiaisRetira, dataInicio, dataFim, posicoes, loading]);

  // Resetar o contador quando filtros mudam ou ao alternar mostrar/ocultar filtros
  useEffect(() => {
    setNextRefreshIn(15);
  }, [filiais, tiposEntrega, filiaisRetira, dataInicio, dataFim, posicoes, showFilters]);

  const resultsScrollStyle: React.CSSProperties = { flex: 1, overflow: 'auto', minHeight: 0 };

  // Utilidades para data e coloração
  const parseDateFlexible = (v: unknown): Date | null => {
    if (v == null) return null;

    // Já é Date
    if (v instanceof Date) {
      return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    }

    if (typeof v === 'string') {
      // Priorizar formato brasileiro DD/MM/YYYY (com ou sem hora)
      const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
      if (br) {
        const day = parseInt(br[1], 10);
        const mon = parseInt(br[2], 10) - 1;
        const yr = parseInt(br[3], 10);
        const d2 = new Date(yr, mon, day);
        if (!isNaN(d2.getTime())) return new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
      }

      // Formato ISO ou YYYY-MM-DD
      const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        const yr = parseInt(iso[1], 10);
        const mon = parseInt(iso[2], 10) - 1;
        const day = parseInt(iso[3], 10);
        const d2 = new Date(yr, mon, day);
        if (!isNaN(d2.getTime())) return new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
      }

      // Fallback: tentar new Date com a string (pode interpretar MM/DD/YYYY)
      const tmp = new Date(v);
      if (!isNaN(tmp.getTime())) return new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
    }

    if (typeof v === 'number') {
      const tmp = new Date(v);
      if (!isNaN(tmp.getTime())) return new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
    }

    return null;
  };

  const formatDateTimeBR = (v: unknown): string => {
    if (v == null) return 'N/A';
    const s = String(v).trim();
    if (!s) return 'N/A';
    if (s.toUpperCase() === 'N/A') return 'N/A';
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  const businessDaysSince = (d: Date | null): number => {
    if (!d) return 0;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (end <= start) return 0;
    let count = 0;
    const dt = new Date(start.getTime());
    while (true) {
      dt.setDate(dt.getDate() + 1); // conta dias após a compra
      if (dt > end) break;
      const day = dt.getDay(); // 0=Domingo, 6=Sábado
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  };

  const rowStyleByAge = (ageDays: number): React.CSSProperties => {
    if (ageDays > 5) return { backgroundColor: '#212529', color: '#fff' }; // preto (> 5 dias úteis)
    if (ageDays === 5) return { backgroundColor: '#0d6efd', color: '#fff' }; // azul (== 5 dias úteis)
    if (ageDays === 4) return { backgroundColor: '#6f42c1', color: '#fff' }; // roxo (== 4 dias úteis)
    if (ageDays === 3) return { backgroundColor: '#dc3545', color: '#fff' }; // vermelho (== 3 dias úteis)
    if (ageDays >= 2) return { backgroundColor: '#fd7e14', color: '#212529' }; // laranja (== 2 dias úteis)
    return { backgroundColor: '#198754', color: '#fff' }; // verde (0 ou 1 dia útil)
  };

  const cardHeaderStyleByAge = (ageDays: number): React.CSSProperties => rowStyleByAge(ageDays);

  const ageCategory = (ageDays: number): 'green' | 'orange' | 'red' | 'purple' | 'blue' | 'black' => {
    if (ageDays > 5) return 'black';
    if (ageDays === 5) return 'blue';
    if (ageDays === 4) return 'purple';
    if (ageDays === 3) return 'red';
    if (ageDays >= 2) return 'orange';
    return 'green';
  };

  const groupPedidos = (rows: PedidoGestLOG[]): PedidoGroup[] => {
    const map = new Map<string, PedidoGroup>();
    rows.forEach((r: PedidoGestLOG) => {
      const key = String(r.NUMERO_DO_PEDIDO_TV8);
      const existing = map.get(key);
      const d = parseDateFlexible(r.DATA);
      const age = businessDaysSince(d);
      if (!existing) {
        const latestRaw = (() => {
          const u = r.ULTIMASITUACAOCFAT;
          if (typeof u === 'string' && u.trim()) return u;
          return r.STATUS_PEDIDO as unknown; // fallback ao LOG1
        })();
        const statusNum = extractStatusCode(latestRaw);
        map.set(key, {
          pedido: key,
          data: r.DATA,
          tipoEntrega: r.TIPOENTREGA,
          cliente: r.CLIENTE,
          codFilial: r.CODFILIAL,
          codFilialRetira: r.CODFILIALRETIRA,
          codCli: r.CODCLI,
          cobranca: r.COBRANCA,
          vendedor: r.VENDEDOR,
          bairroEnt: r.BAIRROENT,
          enderEnt: r.ENDERENT,
          numeroEnt: r.NUMEROENT,
          municEnt: r.MUNICENT,
          telEnt: r.TELENT,
          posicao: r.POSICAO,
          obs: r.OBS,
          obs1: r.OBS1,
          obs2: r.OBS2,
          obsEntrega1: r.OBSENTREGA1,
          obsEntrega2: r.OBSENTREGA2,
          obsEntrega3: r.OBSENTREGA3,
          log3: r.LOG3,
          vlFrete: r.VLFRETE,
          items: [{ descricao: r.DESCRICAO, quantidade: r.QUANTIDADE_ITEM_PEDIDO, codigoDeBarras: r.CODIGO_DE_BARRAS, codProd: r.CODPROD, multiplo: r.MULTIPLO, embalagem: r.EMBALAGEM, qtTotal: r.QT_TOTAL }],
          ageDays: age,
          normalizedDate: d,
          statusPedido: statusNum,
          ultimoStatusRaw: typeof r.ULTIMASITUACAOCFAT === 'string' ? r.ULTIMASITUACAOCFAT : String(r.ULTIMASITUACAOCFAT ?? ''),
          statusEspecialPrioridade: r.STATUS_ESPECIAL_PRIORIDADE,
          statusEspecialSeparado: r.STATUS_ESPECIAL_SEPARADO,
          statusEspecialColeta: r.STATUS_ESPECIAL_COLETA,
          statusEspecialRota: r.STATUS_ESPECIAL_ROTA,
          statusEspecialLocalizacao: r.STATUS_ESPECIAL_LOCALIZACAO,
          statusEspecialFatura: r.STATUS_ESPECIAL_FATURA,
          statusEspecialCorte: r.STATUS_ESPECIAL_CORTE,
          statusEspecialEnvMessejana: r.STATUS_ESPECIAL_ENV_MESSEJANA,
          dtInicialSep: r.DTINICIALSEP,
        });
      } else {
        existing.items.push({ descricao: r.DESCRICAO, quantidade: r.QUANTIDADE_ITEM_PEDIDO, codigoDeBarras: r.CODIGO_DE_BARRAS, codProd: r.CODPROD, multiplo: r.MULTIPLO, embalagem: r.EMBALAGEM, qtTotal: r.QT_TOTAL });
        existing.ageDays = Math.max(existing.ageDays, age);
        if (!existing.telEnt && typeof r.TELENT === 'string' && r.TELENT.trim()) {
          existing.telEnt = r.TELENT;
        }
        if (d) {
          if (!existing.normalizedDate) existing.normalizedDate = d;
          else if (d.getTime() < existing.normalizedDate.getTime()) existing.normalizedDate = d;
        }
        const latestRaw2 = (() => {
          const u = r.ULTIMASITUACAOCFAT;
          if (typeof u === 'string' && u.trim()) return u;
          return r.STATUS_PEDIDO as unknown;
        })();
        existing.statusPedido = extractStatusCode(latestRaw2);
        if (r.ULTIMASITUACAOCFAT != null) {
          existing.ultimoStatusRaw = typeof r.ULTIMASITUACAOCFAT === 'string' ? r.ULTIMASITUACAOCFAT : String(r.ULTIMASITUACAOCFAT ?? '');
        }
      }
    });
    return Array.from(map.values());
  };

  const produtoPedidos = React.useMemo(() => {
    if (!resultado?.rows) return [];
    const codStr = produtoFiltroCod.trim();
    if (!codStr) return [];
    const codNum = Number(codStr);
    if (!Number.isFinite(codNum)) return [];
    return groupPedidos(resultado.rows)
      .map((g) => {
        const itens = g.items.filter((it) => Number(it.codProd) === codNum);
        if (itens.length === 0) return null;
        const totalScaled = itens.reduce((acc, it) => {
          const s = toScaled(it.quantidade);
          return s == null ? acc : acc + s;
        }, 0n);
        return {
          pedido: g.pedido,
          data: g.data,
          cliente: g.cliente ?? '',
          bairroEnt: g.bairroEnt ?? '',
          statusPedido: g.statusPedido ?? 0,
          statusLabel: STATUS_LABELS[g.statusPedido ?? 0] ?? 'Indefinido',
          ageDays: g.ageDays,
          totalScaled,
          totalQuantidade: fromScaledToString(totalScaled),
          itens,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [resultado, produtoFiltroCod]);

  const produtoPedidosPorStatus = React.useMemo(() => {
    const map = new Map<number, { statusPedido: number; statusLabel: string; pedidos: typeof produtoPedidos }>();
    for (const p of produtoPedidos) {
      const k = p.statusPedido ?? 0;
      const existing = map.get(k);
      if (existing) existing.pedidos.push(p);
      else map.set(k, { statusPedido: k, statusLabel: p.statusLabel ?? (STATUS_LABELS[k] ?? 'Indefinido'), pedidos: [p] });
    }
    const arr = Array.from(map.values()).sort((a, b) => a.statusPedido - b.statusPedido);
    for (const g of arr) {
      g.pedidos.sort((a, b) => b.ageDays - a.ageDays);
    }
    return arr;
  }, [produtoPedidos]);

  const produtoTotalScaled = React.useMemo(() => {
    return produtoPedidos.reduce((acc, p) => acc + (p.totalScaled ?? 0n), 0n);
  }, [produtoPedidos]);

  const [produtoStatusActive, setProdutoStatusActive] = useState<'todos' | number>('todos');

  const filteredGroups = (rows: PedidoGestLOG[]) => {
    const groups = groupPedidos(rows);
    const base = groups.filter(
      (g) =>
        g.statusPedido !== 10 &&
        g.statusPedido !== 9 &&
        g.statusPedido !== 11 &&
        g.statusPedido !== 12 &&
        g.statusPedido !== 5 &&
        g.statusPedido !== 1 &&
        g.statusPedido !== 13 &&
        g.statusPedido !== 14 &&
        g.statusPedido !== 15 &&
        g.statusPedido !== 16 &&
        g.statusPedido !== 2 &&
        g.statusPedido !== 3 &&
        g.statusPedido !== 17 &&
        g.statusPedido !== 4 &&
        g.statusPedido !== 18 &&
        g.statusPedido !== 19 &&
        g.statusPedido !== 20 &&
        g.statusPedido !== 21 &&
        g.statusPedido !== 22 &&
        g.statusPedido !== 23 &&
        g.statusPedido !== 24 &&
        g.statusPedido !== 25
    );
    const term = clienteFiltro.trim().toLowerCase();
    const filtered = base.filter((g) => {
      const cat = ageCategory(g.ageDays);
      if (cat === 'green') return showGreen;
      if (cat === 'orange') return showOrange;
      if (cat === 'red') return showRed;
      if (cat === 'purple') return showPurple;
      if (cat === 'blue') return showBlue;
      if (cat === 'black') return showBlack;
      return true;
  });
    // Filtro avançado conforme seleção de "Ordenar por"
    const filteredByTerm = term
      ? filtered.filter((g) => {
          const value = orderBy === 'bairro' ? (g.bairroEnt ?? '') : (g.cliente ?? '');
          return value.toLowerCase().includes(term);
        })
      : filtered;
    filteredByTerm.sort((a, b) => {
      if (orderBy === 'date_asc') {
        const da = a.normalizedDate;
        const db = b.normalizedDate;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        // crescente: data mais antiga primeiro
        return da.getTime() - db.getTime();
      }
      if (orderBy === 'bairro') {
        const ba = (a.bairroEnt ?? '').toLowerCase();
        const bb = (b.bairroEnt ?? '').toLowerCase();
        return ba.localeCompare(bb);
      }
      if (orderBy === 'status') {
        const sa = a.statusPedido ?? 0;
        const sb = b.statusPedido ?? 0;
        if (sa !== sb) return sa - sb;
        const da = a.normalizedDate ? a.normalizedDate.getTime() : 0;
        const db = b.normalizedDate ? b.normalizedDate.getTime() : 0;
        return da - db;
      }
      // cliente
      const ca = (a.cliente ?? '').toLowerCase();
      const cb = (b.cliente ?? '').toLowerCase();
      return ca.localeCompare(cb);
    });
    return filteredByTerm;
  };

  const handleCloseInformativo = () => {
    setShowInformativoModal(false);
  };

  // Cria seções agrupadas quando a ordenação for por cliente ou bairro
  const makeGroupedSections = (groups: ReturnType<typeof filteredGroups>) => {
    if (orderBy === 'date_asc') {
      const deduped = (() => {
        const map = new Map<string, typeof groups[number]>();
        for (const g of groups) {
          if (!map.has(g.pedido)) map.set(g.pedido, g);
        }
        return Array.from(map.values());
      })();
      return [{ key: 'data', title: null as string | null, items: deduped }];
    }
    const getKey = (g: typeof groups[number]) =>
      orderBy === 'bairro'
        ? (g.bairroEnt ?? '').trim()
        : orderBy === 'status'
          ? (STATUS_LABELS[g.statusPedido] ?? 'Indefinido')
          : (g.cliente ?? '').trim();
    const map = new Map<string, typeof groups>();
    for (const g of groups) {
      const k = getKey(g) || '(vazio)';
      const arr = map.get(k);
      if (arr) {
        // evita duplicar o mesmo pedido dentro da seção
        if (!arr.find(x => x.pedido === g.pedido)) arr.push(g);
      } else {
        map.set(k, [g]);
      }
    }
    return Array.from(map.entries()).map(([k, items]) => ({ key: k, title: k, items }));
  };

  // Estatísticas detalhadas conforme ordenação
  const buildStats = (groups: ReturnType<typeof filteredGroups>) => {
    const clientesSet = new Set<string>();
    const bairrosSet = new Set<string>();
    const byBairro = new Map<string, { pedidos: number; clientes: Set<string> }>();
    const byCliente = new Map<string, { pedidos: number; bairros: Set<string> }>();
    const ageBuckets = { green: 0, orange: 0, red: 0, purple: 0, blue: 0 } as Record<string, number>;

    for (const g of groups) {
      const cliente = (g.cliente ?? '').trim();
      const bairro = (g.bairroEnt ?? '').trim().toUpperCase(); // normaliza para evitar duplicidades por caixa
      if (cliente) clientesSet.add(cliente);
      if (bairro) bairrosSet.add(bairro);

      // buckets por idade útil
      const bucket = ageCategory(g.ageDays);
      ageBuckets[bucket] = (ageBuckets[bucket] ?? 0) + 1;

      // agrupamento por bairro
      const bb = byBairro.get(bairro || '(vazio)');
      if (bb) {
        bb.pedidos += 1;
        if (cliente) bb.clientes.add(cliente);
      } else {
        byBairro.set(bairro || '(vazio)', { pedidos: 1, clientes: new Set(cliente ? [cliente] : []) });
      }

      // agrupamento por cliente
      const bc = byCliente.get(cliente || '(vazio)');
      if (bc) {
        bc.pedidos += 1;
        if (bairro) bc.bairros.add(bairro);
      } else {
        byCliente.set(cliente || '(vazio)', { pedidos: 1, bairros: new Set(bairro ? [bairro] : []) });
      }
    }

    return {
      totalPedidos: groups.length,
      uniqueClientes: clientesSet.size,
      uniqueBairros: bairrosSet.size,
      byBairro: Array.from(byBairro.entries()).map(([key, v]) => ({ key, pedidos: v.pedidos, clientes: v.clientes.size })).sort((a, b) => b.pedidos - a.pedidos),
      byCliente: Array.from(byCliente.entries()).map(([key, v]) => ({ key, pedidos: v.pedidos, bairros: v.bairros.size })).sort((a, b) => b.pedidos - a.pedidos),
      ageBuckets,
    };
  };

  // Resumo por pedido
  const buildPedidoSummary = (groups: ReturnType<typeof filteredGroups>) => {
    return groups
      .map((g) => ({
        key: g.pedido,
        cliente: (g.cliente ?? '').trim(),
        bairro: (g.bairroEnt ?? '').trim(),
        itens: g.items.length,
        ageDays: g.ageDays,
        dtInicialSep: g.dtInicialSep ?? 'N/A',
        filialRetira: g.codFilialRetira ?? '-',
      }))
      .sort((a, b) => b.ageDays - a.ageDays);
  };

  const counts = React.useMemo(() => {
    if (!resultado?.rows) return { separacao: 0, separando: 0, separado: 0, coleta: 0, coletaSeparando: 0, coletaSeparada: 0, aguardandoRota: 0, localizacao: 0, aguardandoLocalizacao: 0, localizacaoInserida: 0, faturar: 0, cortar: 0, corteRealizado: 0, sepCancelada: 0, visualizados: 0 };
    const all = groupPedidos(resultado.rows);
    return {
      separacao: all.filter(g => g.statusPedido === 2 || g.statusPedido === 3).length,
      separando: all.filter(g => g.statusPedido === 2).length,
      separado: all.filter(g => g.statusPedido === 3).length,
      coleta: all.filter(g => g.statusPedido === 17).length,
      coletaSeparando: all.filter(g => g.statusPedido === 21).length,
      coletaSeparada: all.filter(g => g.statusPedido === 19).length,
      aguardandoRota: all.filter(g => g.statusPedido === 4).length,
      localizacao: all.filter(g => g.statusPedido === 14 || g.statusPedido === 18).length,
      aguardandoLocalizacao: all.filter(g => g.statusPedido === 14).length,
      localizacaoInserida: all.filter(g => g.statusPedido === 18).length,
      faturar: all.filter(g => g.statusPedido === 15).length,
      faturarPendente: all.filter(g => g.statusPedido === 15 && g.posicao === 'P').length,
      faturarLiberado: all.filter(g => g.statusPedido === 15 && g.posicao === 'L').length,
      faturarMontado: all.filter(g => g.statusPedido === 15 && g.posicao === 'M').length,
      cortar: all.filter(g => g.statusPedido === 13).length,
      corteRealizado: all.filter(g => g.statusPedido === 22).length,
      sepCancelada: all.filter(g => g.statusPedido === 16).length,
      visualizados: all.filter(g => g.statusPedido === 1).length,
      entregaFutura: all.filter(g => g.statusPedido === 24).length,
      retiraPosterior: all.filter(g => g.statusPedido === 25).length,
    };
  }, [resultado]);

  return (
    <div className="container-fluid py-2" style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, position: 'relative' }}>
      {actionLoading && (
        <div className="position-fixed w-100 h-100" style={{ inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-center">
            <div className="spinner-border text-danger" role="status" style={{ width: '2rem', height: '2rem' }}>
              <span className="visually-hidden">Carregando...</span>
            </div>
            <div className="mt-2" style={{ fontSize: '0.8rem', color: '#dc3545' }}>Processando...</div>
          </div>
        </div>
      )}
      <FiltrosModal
        isOpen={filtersModalOpen}
        onClose={() => setFiltersModalOpen(false)}
        dataInicio={dataInicio}
        dataFim={dataFim}
        filiais={filiais}
        setFiliais={setFiliais}
        filiaisRetira={filiaisRetira}
        setFiliaisRetira={setFiliaisRetira}
        handleBuscar={handleBuscar}
        loading={loading}
        erro={erro}
      />

  {!showFilters && (
      <div className="d-flex gap-1 mb-2 flex-wrap" style={{ justifyContent: 'flex-start' }}>
          <button
            className="btn btn-outline-primary btn-sm py-1 position-relative"
            style={{ fontSize: '0.62rem', lineHeight: 1.1, width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', textAlign: 'left', paddingLeft: '8px', paddingRight: '28px' }}
            onClick={() => setShowSeparacaoModal(true)}
          >
            <ClipboardCheck size={14} />
            <span>Separação</span>
            <div className="position-absolute top-0 end-0 translate-middle-y d-flex" style={{ zIndex: 5, gap: '1px', marginRight: '4px' }}>
               {counts.separando > 0 && <span className="badge rounded-pill bg-warning text-dark border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.separando}</span>}
               {counts.separado > 0 && <span className="badge rounded-pill bg-success border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.separado}</span>}
               {counts.sepCancelada > 0 && <span className="badge rounded-pill bg-danger border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.sepCancelada}</span>}
            </div>
          </button>
          <button
            className="btn btn-outline-dark btn-sm py-1 position-relative"
            style={{ fontSize: '0.62rem', lineHeight: 1.1, width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', textAlign: 'left', paddingLeft: '8px', paddingRight: '28px' }}
            onClick={() => setShowColetaModal(true)}
          >
            <Truck size={14} />
            <span>Coleta</span>
            <div className="position-absolute top-0 end-0 translate-middle-y d-flex" style={{ zIndex: 5, gap: '1px', marginRight: '4px' }}>
               {counts.coleta > 0 && <span className="badge rounded-pill bg-danger border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.coleta}</span>}
               {counts.coletaSeparando > 0 && <span className="badge rounded-pill bg-warning text-dark border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.coletaSeparando}</span>}
               {counts.coletaSeparada > 0 && <span className="badge rounded-pill bg-success border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.coletaSeparada}</span>}
            </div>
          </button>
          <button
            className="btn btn-outline-warning btn-sm py-1 position-relative"
            style={{ fontSize: '0.62rem', lineHeight: 1.1, width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', textAlign: 'left', paddingLeft: '8px', paddingRight: '28px' }}
            onClick={() => setShowLocalizacaoModal(true)}
          >
            <GeoAlt size={14} />
            <span>Localização</span>
            <div className="position-absolute top-0 end-0 translate-middle-y d-flex" style={{ zIndex: 5, gap: '1px', marginRight: '4px' }}>
               {counts.aguardandoLocalizacao > 0 && <span className="badge rounded-pill bg-danger border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.aguardandoLocalizacao}</span>}
               {counts.localizacaoInserida > 0 && <span className="badge rounded-pill bg-success border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.localizacaoInserida}</span>}
            </div>
          </button>

          <button
            className="btn btn-outline-primary btn-sm py-1 position-relative"
            style={{ fontSize: '0.62rem', lineHeight: 1.1, width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', textAlign: 'left', paddingLeft: '8px', paddingRight: '28px' }}
            onClick={() => setShowFaturarModal(true)}
          >
            <CashCoin size={14} />
            <span>Só Faturar</span>
            <div className="position-absolute top-0 end-0 translate-middle-y d-flex" style={{ zIndex: 5, gap: '1px', marginRight: '4px' }}>
               {(counts.faturarPendente ?? 0) > 0 && <span className="badge rounded-pill bg-warning text-dark border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.faturarPendente}</span>}
               {(counts.faturarLiberado ?? 0) > 0 && <span className="badge rounded-pill bg-success border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.faturarLiberado}</span>}
               {(counts.faturarMontado ?? 0) > 0 && <span className="badge rounded-pill bg-primary border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.faturarMontado}</span>}
            </div>
          </button>
          <button
            className="btn btn-outline-danger btn-sm py-1 position-relative"
            style={{ fontSize: '0.62rem', lineHeight: 1.1, width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', textAlign: 'left', paddingLeft: '8px', paddingRight: '28px' }}
            onClick={() => setShowCortesModal(true)}
          >
            <Scissors size={14} />
            <span>Corte</span>
            <div className="position-absolute top-0 end-0 translate-middle-y d-flex" style={{ zIndex: 5, gap: '1px', marginRight: '4px' }}>
               {counts.cortar > 0 && <span className="badge rounded-pill bg-danger border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.cortar}</span>}
               {counts.corteRealizado > 0 && <span className="badge rounded-pill bg-success border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.corteRealizado}</span>}
            </div>
          </button>
          <button
            className="btn btn-outline-success btn-sm py-1 position-relative"
            style={{ fontSize: '0.62rem', lineHeight: 1.1, width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', textAlign: 'left', paddingLeft: '8px', paddingRight: '28px' }}
            onClick={() => setShowVisualizadosModal(true)}
          >
            <Eye size={14} />
            <span>Visualizados</span>
            <div className="position-absolute top-0 end-0 translate-middle-y d-flex" style={{ zIndex: 5, gap: '1px', marginRight: '4px' }}>
               {counts.visualizados > 0 && <span className="badge rounded-pill bg-success border border-white shadow-sm" style={{ fontSize: '0.55rem', lineHeight: 1, padding: '2px 5px', minWidth: '16px', display: 'inline-block', textAlign: 'center' }}>{counts.visualizados}</span>}
            </div>
          </button>
      </div>
  )}

      {resultado && (
        <div className="card p-2 shadow-sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="d-flex flex-wrap align-items-center mb-1" style={{ gap: '2px' }}>
            <ColorFilter bg="#198754" fg="#fff" text="≤ 1 dia útil" checked={showGreen} onChange={wrapToggle(setShowGreen)} id="sw-green" />
            <ColorFilter bg="#fd7e14" fg="#fff" text="2 dias úteis" checked={showOrange} onChange={wrapToggle(setShowOrange)} id="sw-orange" />
            <ColorFilter bg="#dc3545" fg="#fff" text="3 dias úteis" checked={showRed} onChange={wrapToggle(setShowRed)} id="sw-red" />
            <ColorFilter bg="#6f42c1" fg="#fff" text="4 dias úteis" checked={showPurple} onChange={wrapToggle(setShowPurple)} id="sw-purple" />
            <ColorFilter bg="#0d6efd" fg="#fff" text="5 dias úteis" checked={showBlue} onChange={wrapToggle(setShowBlue)} id="sw-blue" />
            <ColorFilter bg="#212529" fg="#fff" text="> 5 dias úteis" checked={showBlack} onChange={wrapToggle(setShowBlack)} id="sw-black" />
            <div className="ms-auto d-flex align-items-center gap-2" style={{ fontSize: '0.68rem' }}>
              {(() => {
                const groups = filteredGroups(resultado.rows);
                const stats = buildStats(groups);
                return (
                  <>
                    <span className="badge" style={{ backgroundColor: '#6c757d', color: '#fff' }}>Pedidos ({groups.length}) • Itens ({resultado.count})</span>
                    <span className="badge" style={{ backgroundColor: '#198754', color: '#fff' }}>Verde: {stats.ageBuckets.green}</span>
                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Laranja: {stats.ageBuckets.orange}</span>
                    <span className="badge" style={{ backgroundColor: '#dc3545', color: '#fff' }}>Vermelho: {stats.ageBuckets.red}</span>
                    <span className="badge" style={{ backgroundColor: '#6f42c1', color: '#fff' }}>Roxo: {stats.ageBuckets.purple}</span>
                    <span className="badge" style={{ backgroundColor: '#0d6efd', color: '#fff' }}>Azul: {stats.ageBuckets.blue}</span>
                    <span className="badge" style={{ backgroundColor: '#212529', color: '#fff' }}>Preto: {stats.ageBuckets.black}</span>
                  </>
                );
              })()}
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-end mb-1" style={{ gap: '6px' }}>
            <div className="d-flex align-items-center" style={{ gap: '6px' }}>
              <label className="text-muted" style={{ fontSize: '0.68rem', lineHeight: 1 }}>Produto:</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={12}
                className="form-control form-control-sm"
                style={{ fontSize: '0.62rem', height: '24px', width: '110px', padding: '2px 6px' }}
                placeholder="Cod. Produto"
                value={produtoFiltroCod}
                onChange={(e) => setProdutoFiltroCod(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm py-1 px-2"
                style={{ fontSize: '0.62rem', lineHeight: 1.1, height: '24px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                disabled={!produtoFiltroCod.trim() || !resultado}
                onClick={() => {
                  setProdutoPrintUser(getUsuarioLogado());
                  setProdutoPrintAt(new Date());
                  setShowProdutoModal(true);
                }}
              >
                <Funnel size={14} />
                <span>Filtrar pedidos do produto</span>
              </button>
            </div>
            <div className="d-flex align-items-center" style={{ gap: '6px' }}>
              <label className="text-muted" style={{ fontSize: '0.68rem', lineHeight: 1 }}>{orderBy === 'bairro' ? 'Bairro:' : 'Cliente:'}</label>
              <input
                type="text"
                maxLength={20}
                className="form-control form-control-sm"
                style={{ fontSize: '0.62rem', height: '24px', width: '220px', padding: '2px 6px' }}
                placeholder={orderBy === 'bairro' ? 'Filtrar por bairro' : 'Filtrar por cliente'}
                value={clienteFiltro}
                onChange={(e) => setClienteFiltro(e.target.value)}
              />
            </div>
            <label className="text-muted" style={{ fontSize: '0.68rem', lineHeight: 1 }}>Ordenar por:</label>
            <select
              className="form-select form-select-sm"
              style={{ fontSize: '0.62rem', height: '24px', width: '160px', padding: '2px 6px' }}
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as 'date_asc' | 'bairro' | 'cliente' | 'status')}
            >
              <option value="date_asc">Data (cresc.)</option>
              <option value="bairro">Bairro</option>
              <option value="cliente">Cliente</option>
              <option value="status">Status</option>
            </select>
          </div>


          <div style={{ ...resultsScrollStyle, maxHeight: '70vh' }} className="d-flex flex-column gap-1">
            {makeGroupedSections(filteredGroups(resultado.rows)).map((section) => (
              section.title ? (
                <div key={`sec-${section.key}`} className="card border border-danger bg-danger-subtle rounded shadow-sm" style={{ marginTop: '4.5rem' }}>
                  <div className="card-header py-1 px-2" style={{ fontSize: '0.68rem' }}>
                    <strong>{orderBy === 'bairro' ? 'Bairro' : orderBy === 'status' ? 'Status' : 'Cliente'}:</strong> {section.title}
                  </div>
                  <div className="card-body p-1">
                    <div className="d-flex flex-column gap-1">
                      {section.items.map((g) => (
                        <div key={`card-${g.pedido}`} className="card shadow-sm">
                          <div className="card-header py-1 px-2 position-relative" style={cardHeaderStyleByAge(g.ageDays)}>
                    <div className="position-absolute top-0 end-0 p-1 d-flex flex-column align-items-end" style={{ gap: '2px', zIndex: 10 }}>
                        <span
                          className="fw-bold text-white mb-1"
                          style={{ fontSize: '0.75rem', lineHeight: 1 }}
                          title={`Status ${g.statusPedido}: ${formatObsStatus(g.ultimoStatusRaw ?? String(g.statusPedido))}`}
                        >
                          {(() => {
                            const label = formatObsStatus(g.ultimoStatusRaw ?? String(g.statusPedido));
                            return label === '-' ? 'Aguardando Visualização' : label;
                          })()}
                        </span>
                        <div className="d-flex align-items-center" style={{ gap: '6px' }}>
                        {g.statusEspecialPrioridade === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Prioridade</span>
                        )}
                        {g.statusEspecialSeparado === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Separado</span>
                        )}
                        {g.statusEspecialColeta === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Coleta</span>
                        )}
                        {g.statusEspecialRota === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Em Rota</span>
                        )}
                        {g.statusEspecialLocalizacao === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Localização</span>
                        )}
                        {g.statusEspecialFatura === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Faturar</span>
                        )}
                        {g.statusEspecialCorte === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Corte</span>
                        )}
                        {g.statusEspecialEnvMessejana === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Messejana</span>
                        )}
                        <button
                          className="btn btn-secondary btn-sm py-1 px-2"
                          style={{ fontSize: '0.7rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          onClick={async () => {
                            setActionLoading(true);
                            try {
                              const r = await buscarLogs(Number(g.pedido));
                              const raw = (r.LOG1 ?? '').toString();
                              const linhas = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
                              setLogsConteudo({ obs: typeof r.ULTIMASITUACAOCFAT === 'string' ? r.ULTIMASITUACAOCFAT : String(r.ULTIMASITUACAOCFAT ?? ''), linhas });
                              setShowLogsModal(true);
                            } catch {
                              setLogsConteudo({ obs: 'Erro ao buscar', linhas: [] });
                              setShowLogsModal(true);
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                        >
                          <JournalText size={14} />
                          <span>Logs</span>
                        </button>
                        <button
                          className="btn btn-light btn-sm py-1 px-2"
                          style={{ fontSize: '0.7rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          disabled={openingPedido === g.pedido}
                          onClick={async () => {
                            setOpeningPedido(g.pedido);
                            setActionLoading(true);
                            const start = Date.now();
                            try {
                              const usuario = (() => {
                                try {
                                  const raw = localStorage.getItem('usuarioLogado');
                                  if (!raw) return 'APP';
                                  const obj = JSON.parse(raw);
                                  const nome = (obj?.usuario ?? '').toString().trim();
                                  return nome || 'APP';
                                } catch { return 'APP'; }
                              })();
                              if (g.statusPedido === 0) {
                                await atualizarStatusPedido({ numped: Number(g.pedido), status: 1, usuario });
                              }
                            } catch {
                              // erro ao atualizar status inicial; continua
                            }
                            if (g.statusPedido === 0) {
                              setResultado((prev) => prev ? { ...prev, rows: prev.rows.map((row) => row.NUMERO_DO_PEDIDO_TV8 === Number(g.pedido) ? { ...row, STATUS_PEDIDO: 1 } : row) } : prev);
                            }
                            setPedidoSelecionado({
                              pedido: g.pedido,
                              data: g.data,
                              tipoEntrega: g.tipoEntrega,
                              cliente: g.cliente,
                              codFilial: g.codFilial,
                              codFilialRetira: g.codFilialRetira,
                              codCli: g.codCli,
                              cobranca: g.cobranca,
                              vendedor: g.vendedor,
                              bairroEnt: g.bairroEnt,
                              telEnt: g.telEnt,
                              posicao: g.posicao,
                              obs: g.obs,
                              obs1: g.obs1,
                              obs2: g.obs2,
                              obsEntrega1: g.obsEntrega1,
                              obsEntrega2: g.obsEntrega2,
                              obsEntrega3: g.obsEntrega3,
                              vlFrete: g.vlFrete,
                              items: g.items,
                              ageDays: g.ageDays,
                              normalizedDate: g.normalizedDate,
                            });
                            setShowModal(true);
                            const elapsed = Date.now() - start;
                            if (elapsed < MIN_ACTION_OVERLAY_MS) {
                              await new Promise(r => setTimeout(r, MIN_ACTION_OVERLAY_MS - elapsed));
                            }
                            setActionLoading(false);
                          }}
                        >
                          {openingPedido === g.pedido && (
                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                          )}
                          <Eye size={14} />
                          <span>{openingPedido === g.pedido ? 'Carregando...' : 'Visualizar'}</span>
                        </button>
                        </div>
                    </div>
                    <div className="d-flex flex-wrap align-items-center" style={{ fontSize: '0.68rem', rowGap: '4px', paddingRight: 'clamp(0px, 20vw, 220px)' }}>
                      <div className="d-flex flex-wrap align-items-center" style={{ minWidth: 0, rowGap: '4px' }}>
                        <div className="d-flex flex-row align-items-stretch w-100" style={{ minWidth: 0, gap: '12px', flexWrap: 'wrap' }}>
                          {[
                            [
                              { label: 'Data:', value: typeof g.data === 'string' ? g.data : (g.data as Date).toLocaleDateString() },
                              { label: 'Pedido TV8:', value: g.pedido },
                              { label: 'Tipo:', value: g.tipoEntrega },
                            ] as { label: string; value: React.ReactNode; title?: string; valueClassName?: string; valueStyle?: React.CSSProperties }[],
                            [
                              { label: 'Cód. Cliente:', value: g.codCli ?? '-' },
                              { label: 'Cliente:', value: g.cliente, title: g.cliente, valueClassName: 'text-truncate', valueStyle: { maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' } },
                              { label: 'Bairro:', value: g.bairroEnt ?? '-', title: g.bairroEnt ?? '', valueClassName: 'text-truncate', valueStyle: { maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' } },
                            ] as { label: string; value: React.ReactNode; title?: string; valueClassName?: string; valueStyle?: React.CSSProperties }[],
                            [
                              { label: 'Filial:', value: g.codFilial },
                              { label: 'Retira:', value: g.codFilialRetira ?? '-' },
                              { label: 'Posição:', value: g.posicao ?? '-' },
                            ] as { label: string; value: React.ReactNode; title?: string; valueClassName?: string; valueStyle?: React.CSSProperties }[],
                            [
                              { label: 'Vendedor(a):', value: g.vendedor ?? '-', title: g.vendedor ?? '', valueClassName: 'text-truncate', valueStyle: { maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' } },
                              { label: 'Cobrança:', value: g.cobranca ?? '-', title: g.cobranca ?? '', valueClassName: 'text-truncate', valueStyle: { maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' } },
                              { label: 'Dias úteis:', value: g.ageDays },
                            ] as { label: string; value: React.ReactNode; title?: string; valueClassName?: string; valueStyle?: React.CSSProperties }[]
                          ].map((group, groupIdx) => (
                            <React.Fragment key={groupIdx}>
                              <div
                                className="d-flex flex-column justify-content-start"
                                style={{
                                  gap: '2px',
                                  minWidth: groupIdx === 1 ? '280px' : '200px',
                                  flex: groupIdx === 1 ? '2 1 280px' : '1 1 200px',
                                  maxWidth: '100%',
                                  borderLeft: groupIdx > 0 ? '1px solid #dee2e6' : undefined,
                                  paddingLeft: groupIdx > 0 ? '12px' : undefined,
                                }}
                              >
                                {group.map((field, fieldIdx) => (
                                  <div key={fieldIdx} className="w-100 text-truncate">
                                    <HeaderField
                                      label={field.label}
                                      value={field.value}
                                      title={field.title}
                                      valueClassName={field.valueClassName}
                                      valueStyle={field.valueStyle}
                                      divider={false}
                                    />
                                  </div>
                                ))}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                          </div>
                          <div className="card-body p-1" style={{ fontSize: '0.68rem', maxHeight: '48vh', overflow: 'auto' }}>
                            <table className="table table-sm mb-0" style={{ fontSize: '0.68rem' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '15%' }}>Cod. Produto</th>
                                  <th style={{ width: '30%' }}>Produto</th>
                                  <th style={{ width: '20%' }}>Cód. Barras</th>
                                  <th style={{ width: '10%' }}>Múltiplo</th>
                                  <th style={{ width: '15%' }}>Qdt</th>
                                  <th style={{ width: '10%' }}>Qdt Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.items.map((it, idx) => (
                                  <tr key={`${g.pedido}-${idx}`}>
                                    <td>{it.codProd ?? '-'}</td>
                                    <td>{it.descricao}</td>
                                    <td>{it.codigoDeBarras ?? '-'}</td>
                                    <td>{it.multiplo ?? '-'}</td>
                                    <td>{formatQuantidade(it.quantidade)}</td>
                                    <td>{it.qtTotal ?? '-'}</td>
                                    <td>
                                      <button
                                        className="btn btn-outline-primary btn-sm py-1 px-2"
                                        style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        onClick={() => {
                                          setItemSelecionado({
                                            codProd: it.codProd,
                                            descricao: it.descricao,
                                            multiplo: it.multiplo,
                                            embalagem: it.embalagem,
                                          });
                                          setShowUpdateModal(true);
                                        }}
                                      >
                                        <PencilSquare size={12} />
                                        <span>Corrigir</span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                section.items.map((g) => (
                  <div key={`card-${g.pedido}`} className="card shadow-sm">
                          <div className="card-header py-1 px-2 position-relative" style={cardHeaderStyleByAge(g.ageDays)}>
                    <div className="position-absolute top-0 end-0 p-1 d-flex flex-column align-items-end" style={{ gap: '2px', zIndex: 10 }}>
                        <span
                          className="fw-bold text-white mb-1"
                          style={{ fontSize: '0.75rem', lineHeight: 1 }}
                          title={`Status ${g.statusPedido}: ${formatObsStatus(g.ultimoStatusRaw ?? String(g.statusPedido))}`}
                        >
                          {(() => {
                            const label = formatObsStatus(g.ultimoStatusRaw ?? String(g.statusPedido));
                            return label === '-' ? 'Aguardando Visualização' : label;
                          })()}
                        </span>
                        <div className="d-flex align-items-center" style={{ gap: '6px' }}>
                        {g.statusEspecialPrioridade === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Prioridade</span>
                        )}
                        {g.statusEspecialSeparado === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Separado</span>
                        )}
                        {g.statusEspecialColeta === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Coleta</span>
                        )}
                        {g.statusEspecialRota === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Em Rota</span>
                        )}
                        {g.statusEspecialLocalizacao === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Localização</span>
                        )}
                        {g.statusEspecialFatura === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Faturar</span>
                        )}
                        {g.statusEspecialCorte === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Corte</span>
                        )}
                        {g.statusEspecialEnvMessejana === 'S' && (
                          <span className="badge bg-warning text-dark shadow-sm border border-dark" style={{ fontSize: '0.65rem' }}>Messejana</span>
                        )}
                        <button
                          className="btn btn-secondary btn-sm py-1 px-2"
                          style={{ fontSize: '0.7rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          onClick={async () => {
                            setActionLoading(true);
                            try {
                              const r = await buscarLogs(Number(g.pedido));
                              const raw = (r.LOG1 ?? '').toString();
                              const linhas = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
                              setLogsConteudo({ obs: typeof r.ULTIMASITUACAOCFAT === 'string' ? r.ULTIMASITUACAOCFAT : String(r.ULTIMASITUACAOCFAT ?? ''), linhas });
                              setShowLogsModal(true);
                            } catch {
                              setLogsConteudo({ obs: 'Erro ao buscar', linhas: [] });
                              setShowLogsModal(true);
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                        >
                          <JournalText size={14} />
                          <span>Logs</span>
                        </button>
                        <button
                          className="btn btn-light btn-sm py-1 px-2"
                          style={{ fontSize: '0.7rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          disabled={openingPedido === g.pedido}
                          onClick={async () => {
                            setOpeningPedido(g.pedido);
                            setActionLoading(true);
                            const start = Date.now();
                            try {
                              const usuario = (() => {
                                try {
                                  const raw = localStorage.getItem('usuarioLogado');
                                  if (!raw) return 'APP';
                                  const obj = JSON.parse(raw);
                                  const nome = (obj?.usuario ?? '').toString().trim();
                                  return nome || 'APP';
                                } catch { return 'APP'; }
                              })();
                              if (g.statusPedido === 0) {
                                await atualizarStatusPedido({ numped: Number(g.pedido), status: 1, usuario });
                              }
                            } catch {
                              // erro ao atualizar status inicial; continua
                            }
                            if (g.statusPedido === 0) {
                              setResultado((prev) => prev ? { ...prev, rows: prev.rows.map((row) => row.NUMERO_DO_PEDIDO_TV8 === Number(g.pedido) ? { ...row, STATUS_PEDIDO: 1 } : row) } : prev);
                            }
                            setPedidoSelecionado({
                              pedido: g.pedido,
                              data: g.data,
                              tipoEntrega: g.tipoEntrega,
                              cliente: g.cliente,
                              codFilial: g.codFilial,
                              codFilialRetira: g.codFilialRetira,
                              codCli: g.codCli,
                              cobranca: g.cobranca,
                              vendedor: g.vendedor,
                              bairroEnt: g.bairroEnt,
                              telEnt: g.telEnt,
                              posicao: g.posicao,
                              obs: g.obs,
                              obs1: g.obs1,
                              obs2: g.obs2,
                              obsEntrega1: g.obsEntrega1,
                              obsEntrega2: g.obsEntrega2,
                              obsEntrega3: g.obsEntrega3,
                              vlFrete: g.vlFrete,
                              items: g.items,
                              ageDays: g.ageDays,
                              normalizedDate: g.normalizedDate,
                            });
                            setShowModal(true);
                            const elapsed = Date.now() - start;
                            if (elapsed < MIN_ACTION_OVERLAY_MS) {
                              await new Promise(r => setTimeout(r, MIN_ACTION_OVERLAY_MS - elapsed));
                            }
                            setActionLoading(false);
                          }}
                        >
                          {openingPedido === g.pedido && (
                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                          )}
                          <Eye size={14} />
                          <span>{openingPedido === g.pedido ? 'Carregando...' : 'Visualizar'}</span>
                        </button>
                        </div>
                    </div>
                    <div className="d-flex flex-wrap align-items-center" style={{ fontSize: '0.68rem', rowGap: '4px', paddingRight: 'clamp(0px, 20vw, 220px)' }}>
                      <div className="d-flex flex-wrap align-items-center" style={{ minWidth: 0, rowGap: '4px' }}>
                          <div className="d-flex flex-row align-items-stretch w-100" style={{ minWidth: 0, gap: '12px', flexWrap: 'wrap' }}>
                            {[
                              [
                              { label: 'Data:', value: typeof g.data === 'string' ? g.data : (g.data as Date).toLocaleDateString() },
                              { label: 'Pedido TV8:', value: g.pedido },
                              { label: 'Entrega/Retira:', value: g.tipoEntrega },
                            ] as { label: string; value: React.ReactNode; title?: string; valueClassName?: string; valueStyle?: React.CSSProperties }[],
                            [
                              { label: 'Cód. Cliente:', value: g.codCli ?? '-' },
                              { label: 'Cliente:', value: g.cliente, title: g.cliente, valueClassName: 'text-truncate', valueStyle: { maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' } },
                              { label: 'Bairro:', value: g.bairroEnt ?? '-', title: g.bairroEnt ?? '', valueClassName: 'text-truncate', valueStyle: { maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' } },
                            ] as { label: string; value: React.ReactNode; title?: string; valueClassName?: string; valueStyle?: React.CSSProperties }[],
                            [
                              { label: 'Filial:', value: g.codFilial },
                              { label: 'Filial Retira:', value: g.codFilialRetira ?? '-' },
                              { label: 'Posição:', value: g.posicao ?? '-' },
                            ] as { label: string; value: React.ReactNode; title?: string; valueClassName?: string; valueStyle?: React.CSSProperties }[],
                            [
                              { label: 'Vendedor(a):', value: g.vendedor ?? '-', title: g.vendedor ?? '', valueClassName: 'text-truncate', valueStyle: { maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' } },
                              { label: 'Cobrança:', value: g.cobranca ?? '-', title: g.cobranca ?? '', valueClassName: 'text-truncate', valueStyle: { maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' } },
                              { label: 'Dias úteis:', value: g.ageDays },
                            ] as { label: string; value: React.ReactNode; title?: string; valueClassName?: string; valueStyle?: React.CSSProperties }[]
                            ].map((group, groupIdx) => (
                              <React.Fragment key={groupIdx}>
                                <div
                                  className="d-flex flex-column justify-content-start"
                                  style={{
                                    gap: '2px',
                                    minWidth: groupIdx === 1 ? '280px' : '200px',
                                    flex: groupIdx === 1 ? '2 1 280px' : '1 1 200px',
                                    maxWidth: '100%',
                                    borderLeft: groupIdx > 0 ? '1px solid #dee2e6' : undefined,
                                    paddingLeft: groupIdx > 0 ? '12px' : undefined,
                                  }}
                                >
                                  {group.map((field, fieldIdx) => (
                                    <div key={fieldIdx} className="w-100 text-truncate">
                                      <HeaderField
                                        label={field.label}
                                        value={field.value}
                                        title={field.title}
                                        valueClassName={field.valueClassName}
                                        valueStyle={field.valueStyle}
                                        divider={false}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                    <div className="card-body p-1" style={{ fontSize: '0.68rem', maxHeight: '48vh', overflow: 'auto' }}>
                      <table className="mb-0 w-100" style={{ fontSize: '0.68rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '15%', border: 0 }}>Cod. Produto</th>
                            <th style={{ width: '30%', border: 0 }}>Produto</th>
                            <th style={{ width: '20%', border: 0 }}>Código de Barras</th>
                            <th style={{ width: '10%', border: 0 }}>Múltiplo</th>
                            <th style={{ width: '15%', border: 0 }}>Qtd</th>
                            <th style={{ width: '10%', border: 0 }}>Qtd Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.items.map((it, idx) => (
                            <tr key={`${g.pedido}-${idx}`}>
                              <td style={{ border: 0 }}>{it.codProd ?? '-'}</td>
                              <td style={{ border: 0 }}>{it.descricao || '-'}</td>
                              <td style={{ border: 0 }}>{it.codigoDeBarras ?? '-'}</td>
                              <td style={{ border: 0 }}>{it.multiplo ?? '-'}</td>
                              <td style={{ border: 0 }}>{formatQuantidade(it.quantidade)}</td>
                              <td style={{ border: 0 }}>{it.qtTotal ?? '-'}</td>
                              <td>
                                <button
                                  className="btn btn-outline-primary btn-sm py-1 px-2"
                                  style={{ fontSize: '0.7rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  onClick={() => {
                                    setItemSelecionado({
                                      codProd: it.codProd,
                                      descricao: it.descricao,
                                      multiplo: it.multiplo,
                                      embalagem: it.embalagem,
                                    });
                                    setShowUpdateModal(true);
                                  }}
                                >
                                  <PencilSquare size={12} />
                                  <span>Múltiplo</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )
            ))}
          </div>
        </div>
      )}

      {showLocalizacaoModal && resultado && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos aguardando Localização</h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowLocalizacaoModal(false)}></button>
                </div>
                <div className="modal-body bg-light" style={{ fontSize: '0.74rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                      const all = groupPedidos(resultado.rows);
                      const locs = all.filter(g => g.statusPedido === 14);
                      const locsInserida = all.filter(g => g.statusPedido === 18);
                      const hasAny = locs.length > 0 || locsInserida.length > 0;

                      const renderPedidoCards = (list: typeof locs, keyPrefix: string, emptyMsg: string) => {
                        if (list.length === 0) return <div className="p-2 text-muted text-center">{emptyMsg}</div>;
                        const sorted = [...list].sort((a, b) => (b.ageDays - a.ageDays) || String(a.pedido).localeCompare(String(b.pedido)));
                        return (
                          <div className="d-flex flex-column gap-2 p-2">
                            {sorted.map((g) => (
                              <div key={`${keyPrefix}-${g.pedido}`} className="card border-secondary">
                                <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                  <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                    <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                      Pedido TV8: {g.pedido}
                                    </div>
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                      title={g.cliente ?? ''}
                                    >
                                      {g.cliente ?? '-'}
                                    </div>
                                    <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                      <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                        Status atual: {formatObsStatus(g.ultimoStatusRaw ?? String(g.statusPedido ?? ''))}
                                      </span>
                                      <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                        Filial retira: {g.codFilialRetira ?? '-'}
                                      </span>
                                      <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                        Entrega/Retira: {g.tipoEntrega ?? '-'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="badge bg-secondary">{g.items.length}</span>
                                      <button
                                        className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                        style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                        onClick={() => { setShowLocalizacaoModal(false); setPedidoSelecionado(g); setShowModal(true); }}
                                      >
                                        <Eye size={12} />
                                        <span>Visualizar</span>
                                      </button>
                                    </div>
                                    <span
                                      className="badge"
                                      style={{
                                        ...rowStyleByAge(g.ageDays),
                                        fontSize: '0.66rem',
                                        lineHeight: 1,
                                        padding: '2px 5px',
                                        borderRadius: '999px',
                                        minWidth: '92px',
                                      }}
                                    >
                                      Dias úteis: {g.ageDays}
                                    </span>
                                  </div>
                                </div>

                                <div className="card-body p-0">
                                  <div className="table-responsive">
                                    <table className="table table-borderless table-sm mb-0" style={{ fontSize: '0.70rem', ['--bs-table-border-color' as any]: 'transparent' }}>
                                      <thead>
                                        <tr>
                                          <th style={{ width: '14%' }}>Cód.</th>
                                          <th style={{ width: '56%' }}>Descrição</th>
                                          <th style={{ width: '15%' }}>Qtd</th>
                                          <th style={{ width: '15%' }}>Qt Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {g.items.map((it, idx) => (
                                          <tr key={`${keyPrefix}-${g.pedido}-it-${it.codProd}-${idx}`}>
                                            <td>{it.codProd}</td>
                                            <td>{it.descricao}</td>
                                            <td>{it.quantidade}</td>
                                            <td>{it.qtTotal ?? '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      };

                      if (!hasAny) return <span className="text-muted">Sem pedidos em localização</span>;

                      return (
                        <div className="d-flex flex-column" style={{ flex: 1, minHeight: 0, gap: '8px' }}>
                          <ul className="nav nav-tabs" style={{ fontSize: '0.72rem' }}>
                            <li className="nav-item">
                              <button
                                type="button"
                                className={`nav-link ${localizacaoTab === 14 ? 'active' : ''}`}
                                onClick={() => setLocalizacaoTab(14)}
                              >
                                Aguardando Localização <span className="badge bg-danger rounded-pill ms-1">{locs.length}</span>
                              </button>
                            </li>
                            <li className="nav-item">
                              <button
                                type="button"
                                className={`nav-link ${localizacaoTab === 18 ? 'active' : ''}`}
                                onClick={() => setLocalizacaoTab(18)}
                              >
                                Localização Inserida <span className="badge bg-success rounded-pill ms-1">{locsInserida.length}</span>
                              </button>
                            </li>
                          </ul>

                          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                            {localizacaoTab === 14 && renderPedidoCards(locs, 'localizacao-14', 'Sem pedidos aguardando localização')}
                            {localizacaoTab === 18 && renderPedidoCards(locsInserida, 'localizacao-18', 'Sem pedidos com localização inserida')}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowLocalizacaoModal(false)}>
                    <XLg size={12} />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSeparacaoModal && resultado && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos em Separação</h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowSeparacaoModal(false)}></button>
                </div>
                <div className="modal-body bg-light" style={{ fontSize: '0.74rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                      const all = groupPedidos(resultado.rows);
                      const separando = all.filter(g => g.statusPedido === 2);
                      const separado = all.filter(g => g.statusPedido === 3);
                      const sepCancelada = all.filter(g => g.statusPedido === 16);
                      const hasAny = separando.length > 0 || separado.length > 0 || sepCancelada.length > 0;

                      const renderPedidoCards = (list: typeof separando, keyPrefix: string, emptyMsg: string) => {
                        if (list.length === 0) return <div className="p-2 text-muted text-center">{emptyMsg}</div>;
                        const sorted = [...list].sort((a, b) => (b.ageDays - a.ageDays) || String(a.pedido).localeCompare(String(b.pedido)));
                        return (
                          <div className="d-flex flex-column gap-2 p-2">
                            {sorted.map((g) => (
                              <div key={`${keyPrefix}-${g.pedido}`} className="card border-secondary">
                                <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                  <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                    <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                      Pedido TV8: {g.pedido}
                                    </div>
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                      title={g.cliente ?? ''}
                                    >
                                      {g.cliente ?? '-'}
                                    </div>
                                    <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                      <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                        Status atual: {formatObsStatus(g.ultimoStatusRaw ?? String(g.statusPedido ?? ''))}
                                      </span>
                                      <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                        Bairro: {g.bairroEnt ?? '-'}
                                      </span>
                                      <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                        Dt Início Sep: {formatDateTimeBR(g.dtInicialSep)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="badge bg-secondary">{g.items.length}</span>
                                      <button
                                        className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                        style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                        onClick={() => { setShowSeparacaoModal(false); setPedidoSelecionado(g); setShowModal(true); }}
                                      >
                                        <Eye size={12} />
                                        <span>Visualizar</span>
                                      </button>
                                    </div>
                                    <span
                                      className="badge"
                                      style={{
                                        ...rowStyleByAge(g.ageDays),
                                        fontSize: '0.66rem',
                                        lineHeight: 1,
                                        padding: '2px 5px',
                                        borderRadius: '999px',
                                        minWidth: '92px',
                                      }}
                                    >
                                      Dias úteis: {g.ageDays}
                                    </span>
                                  </div>
                                </div>

                                <div className="card-body p-0">
                                  <div className="table-responsive">
                                    <table className="table table-borderless table-sm mb-0" style={{ fontSize: '0.70rem', ['--bs-table-border-color' as any]: 'transparent' }}>
                                      <thead>
                                        <tr>
                                          <th style={{ width: '14%' }}>Cód.</th>
                                          <th style={{ width: '56%' }}>Descrição</th>
                                          <th style={{ width: '15%' }}>Qtd</th>
                                          <th style={{ width: '15%' }}>Qt Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {g.items.map((it, idx) => (
                                          <tr key={`${keyPrefix}-${g.pedido}-it-${it.codProd}-${idx}`}>
                                            <td>{it.codProd}</td>
                                            <td>{it.descricao}</td>
                                            <td>{it.quantidade}</td>
                                            <td>{it.qtTotal ?? '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      };

                      if (!hasAny) return <span className="text-muted">Sem pedidos em separação</span>;

                      return (
                        <div className="d-flex flex-column" style={{ flex: 1, minHeight: 0, gap: '8px' }}>
                          <ul className="nav nav-tabs" style={{ fontSize: '0.72rem' }}>
                            <li className="nav-item">
                              <button type="button" className={`nav-link ${separacaoTab === 2 ? 'active' : ''}`} onClick={() => setSeparacaoTab(2)}>
                                Separando <span className="badge bg-warning rounded-pill text-dark ms-1">{separando.length}</span>
                              </button>
                            </li>
                            <li className="nav-item">
                              <button type="button" className={`nav-link ${separacaoTab === 3 ? 'active' : ''}`} onClick={() => setSeparacaoTab(3)}>
                                Separado <span className="badge bg-success rounded-pill ms-1">{separado.length}</span>
                              </button>
                            </li>
                            <li className="nav-item">
                              <button type="button" className={`nav-link ${separacaoTab === 16 ? 'active' : ''}`} onClick={() => setSeparacaoTab(16)}>
                                Separação Cancelada <span className="badge bg-danger rounded-pill ms-1">{sepCancelada.length}</span>
                              </button>
                            </li>
                          </ul>

                          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                            {separacaoTab === 2 && renderPedidoCards(separando, 'sep-2', 'Sem pedidos separando')}
                            {separacaoTab === 3 && renderPedidoCards(separado, 'sep-3', 'Sem pedidos separados')}
                            {separacaoTab === 16 && renderPedidoCards(sepCancelada, 'sep-16', 'Sem pedidos com separação cancelada')}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowSeparacaoModal(false)}>
                    <XLg size={12} />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showColetaModal && resultado && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos de Coleta</h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowColetaModal(false)}></button>
                </div>
                <div className="modal-body bg-light" style={{ fontSize: '0.74rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                      const all = groupPedidos(resultado.rows);
                      const col17 = all.filter(g => g.statusPedido === 17);
                      const col21 = all.filter(g => g.statusPedido === 21);
                      const col19 = all.filter(g => g.statusPedido === 19);

                      const renderPedidoCards = (list: typeof col17, keyPrefix: string, emptyMsg: string) => {
                        if (list.length === 0) return <div className="p-2 text-muted text-center">{emptyMsg}</div>;
                        const sorted = [...list].sort((a, b) => (b.ageDays - a.ageDays) || String(a.pedido).localeCompare(String(b.pedido)));
                        return (
                          <div className="d-flex flex-column gap-2 p-2">
                            {sorted.map((g) => (
                              <div key={`${keyPrefix}-${g.pedido}`} className="card border-secondary">
                                <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                  <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                    <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                      Pedido TV8: {g.pedido}
                                    </div>
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                      title={g.cliente ?? ''}
                                    >
                                      {g.cliente ?? '-'}
                                    </div>
                                    <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                      <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                        Status atual: {formatObsStatus(g.ultimoStatusRaw ?? String(g.statusPedido ?? ''))}
                                      </span>
                                      <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                        Filial retira: {g.codFilialRetira ?? '-'}
                                      </span>
                                      <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                        Entrega/Retira: {g.tipoEntrega ?? '-'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="badge bg-secondary">{g.items.length}</span>
                                      <button
                                        className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                        style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                        onClick={() => { setShowColetaModal(false); setPedidoSelecionado(g); setShowModal(true); }}
                                      >
                                        <Eye size={12} />
                                        <span>Visualizar</span>
                                      </button>
                                    </div>
                                    <span
                                      className="badge"
                                      style={{
                                        ...rowStyleByAge(g.ageDays),
                                        fontSize: '0.66rem',
                                        lineHeight: 1,
                                        padding: '2px 5px',
                                        borderRadius: '999px',
                                        minWidth: '92px',
                                      }}
                                    >
                                      Dias úteis: {g.ageDays}
                                    </span>
                                  </div>
                                </div>

                                <div className="card-body p-0">
                                  <div className="table-responsive">
                                    <table className="table table-borderless table-sm mb-0" style={{ fontSize: '0.70rem', ['--bs-table-border-color' as any]: 'transparent' }}>
                                      <thead>
                                        <tr>
                                          <th style={{ width: '14%' }}>Cód.</th>
                                          <th style={{ width: '56%' }}>Descrição</th>
                                          <th style={{ width: '15%' }}>Qtd</th>
                                          <th style={{ width: '15%' }}>Qt Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {g.items.map((it, idx) => (
                                          <tr key={`${keyPrefix}-${g.pedido}-it-${it.codProd}-${idx}`}>
                                            <td>{it.codProd}</td>
                                            <td>{it.descricao}</td>
                                            <td>{it.quantidade}</td>
                                            <td>{it.qtTotal ?? '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      };

                      return (
                        <div className="d-flex flex-column" style={{ flex: 1, minHeight: 0, gap: '8px' }}>
                          <ul className="nav nav-tabs" style={{ fontSize: '0.72rem' }}>
                            <li className="nav-item">
                              <button
                                type="button"
                                className={`nav-link ${coletaTab === 17 ? 'active' : ''}`}
                                onClick={() => setColetaTab(17)}
                              >
                                Coleta p/ Separar <span className="badge bg-danger rounded-pill ms-1">{col17.length}</span>
                              </button>
                            </li>
                            <li className="nav-item">
                              <button
                                type="button"
                                className={`nav-link ${coletaTab === 21 ? 'active' : ''}`}
                                onClick={() => setColetaTab(21)}
                              >
                                Coleta Separando <span className="badge bg-warning rounded-pill text-dark ms-1">{col21.length}</span>
                              </button>
                            </li>
                            <li className="nav-item">
                              <button
                                type="button"
                                className={`nav-link ${coletaTab === 19 ? 'active' : ''}`}
                                onClick={() => setColetaTab(19)}
                              >
                                Coleta Separada <span className="badge bg-success rounded-pill ms-1">{col19.length}</span>
                              </button>
                            </li>
                          </ul>

                          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                            {coletaTab === 17 && renderPedidoCards(col17, 'coleta-17', 'Nenhuma coleta para separar')}
                            {coletaTab === 21 && renderPedidoCards(col21, 'coleta-21', 'Nenhuma coleta separando')}
                            {coletaTab === 19 && renderPedidoCards(col19, 'coleta-19', 'Nenhuma coleta separada')}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowColetaModal(false)}>
                    <XLg size={12} />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
  )}

      {showNotasModal && (
        <NotasRecentesModal show={showNotasModal} onClose={() => setShowNotasModal(false)} />
      )}

      {showMapaModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Mapa</h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowMapaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                  <div className="card mb-2">
                    <div className="card-body py-2" style={{ fontSize: '0.72rem' }}>
                      <div className="d-flex align-items-center" style={{ gap: '6px' }}>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          style={{ fontSize: '0.7rem', height: '28px' }}
                          placeholder="Digite CEP e pressione Adicionar"
                          value={cepInput}
                          onChange={(e) => setCepInput(e.target.value)}
                          maxLength={16}
                        />
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          style={{ fontSize: '0.7rem', height: '28px', width: '120px' }}
                          placeholder="Número"
                          value={cepNumInput}
                          onChange={(e) => setCepNumInput(e.target.value)}
                          maxLength={10}
                        />
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => {
                            const v = cepInput.trim();
                            if (!v) return;
                            const cepDigits = v.replace(/\D+/g, '');
                            const numDigits = cepNumInput.trim().replace(/\D+/g, '');
                            setMapPoints(prev => [...prev, { cep: cepDigits || v, num: (numDigits || cepNumInput.trim()) || undefined }]);
                            setCepInput('');
                            setCepNumInput('');
                          }}
                        >
                          <PlusLg size={14} />
                          <span>Adicionar</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => { setMapPoints([]); setRouteInfo(null); setRouteError(null); }}
                        >
                          <Trash size={14} />
                          <span>Limpar</span>
                        </button>
                      </div>
                      {!!mapPoints.length && (
                        <div className="mt-2" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {mapPoints.map((p, idx) => (
                            <span key={`${p.cep}-${p.num ?? ''}-${idx}`} className="badge bg-light text-dark border" style={{ fontSize: '0.68rem' }}>
                              {p.cep}{p.num ? `, ${p.num}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '65vh' }}>
                    {(() => {
                      const pointsStr = mapPoints
                        .map(p => `${String(p.cep || '').replace(/\D+/g, '')}${p.num ? ` ${p.num}` : ''}, Fortaleza`.trim())
                        .filter(Boolean);
                      let src = 'https://maps.google.com/maps?q=&output=embed';
                      if (pointsStr.length >= 2) {
                        const qRaw = pointsStr.join(' to ');
                        const q = encodeURIComponent(qRaw);
                        src = `https://maps.google.com/maps?q=${q}&output=embed`;
                      } else if (pointsStr.length === 1) {
                        const q = encodeURIComponent(pointsStr[0]);
                        src = `https://maps.google.com/maps?q=${q}&output=embed`;
                      }
                      return (
                        <iframe
                          title="Rota por CEPs"
                          src={src}
                          style={{ border: 0, width: '100%', height: '100%' }}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      );
                    })()}
                  </div>
                  <div className="mt-2 d-flex align-items-center gap-2">
                    {routeLoading && (
                      <span className="badge bg-light text-dark">Calculando…</span>
                    )}
                    {!routeLoading && routeInfo && (
                      <>
                        <span className="badge bg-primary">Distância total: {routeInfo.totalDistanceKm.toFixed(1)} km</span>
                        <span className="badge bg-secondary">Tempo total: {Math.round(routeInfo.totalDurationMin)} min</span>
                      </>
                    )}
                    {!routeLoading && routeError && (
                      <span className="text-danger" style={{ fontSize: '0.72rem' }}>{routeError}</span>
                    )}
                  </div>
                  {!!(routeInfo?.legs?.length) && (
                    <div className="mt-2" style={{ fontSize: '0.72rem' }}>
                      {routeInfo.legs.map((l, i) => (
                        <div key={`leg-${i}`} className="d-flex justify-content-between border rounded px-2 py-1 mb-1">
                          <span>Ponto {i + 1}: {l.from} → {l.to}</span>
                          <span className="text-muted">{l.distanceKm.toFixed(1)} km • {Math.round(l.durationMin)} min</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {mapPoints.length >= 2 && (
                    <div className="mt-2">
                      {(() => {
                        const wp = mapPoints.map(p => encodeURIComponent(`${p.cep}${p.num ? ` ${p.num}` : ''}`.trim())).filter(s => s.length > 0);
                        const href = `https://www.google.com/maps/dir/${wp.join('/')}`;
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm d-inline-flex align-items-center" style={{ gap: '6px' }}>
                            <MapIcon size={14} />
                            <span>Abrir rota no Google Maps</span>
                          </a>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowMapaModal(false)}>
                    <XLg size={12} />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resumo */}
      {showResumoModal && resultado && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header py-1">
                <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Resumo</h6>
                <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowResumoModal(false)}></button>
              </div>
              <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                {(() => {
                  const groups = filteredGroups(resultado.rows);
                  const stats = buildStats(groups);
                  const pedidos = buildPedidoSummary(groups);
                  const terms = resumoSearchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
                  const matches = (text: string) => terms.every(t => text.includes(t));
                  const byBairroFiltered = terms.length === 0 ? stats.byBairro : stats.byBairro.filter(r => matches(r.key.toLowerCase()));
                  const byClienteFiltered = terms.length === 0 ? stats.byCliente : stats.byCliente.filter(r => matches(r.key.toLowerCase()));
                  const pedidosFiltered = terms.length === 0 ? pedidos : pedidos.filter(p => matches(`${p.key} ${p.cliente ?? ''} ${p.bairro ?? ''}`.toLowerCase()));
                  return (
                    <div>
                      <div className="position-sticky" style={{ top: 0, zIndex: 1, backgroundColor: '#fff', paddingBottom: '6px', borderBottom: '1px solid #dee2e6' }}>
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-1">
                          <div className="d-flex flex-wrap align-items-center gap-1">
                            <label className="text-muted" style={{ fontSize: '0.72rem' }}>Pesquisa:</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              style={{ fontSize: '0.66rem', height: '24px', width: '220px', padding: '2px 6px' }}
                              placeholder="Filtrar por termos"
                              value={resumoSearchTerm}
                              onChange={(e) => setResumoSearchTerm(e.target.value)}
                            />
                            <span className="badge bg-light text-dark" style={{ fontSize: '0.68rem', lineHeight: 1, padding: '2px 6px' }}>Pedidos: {stats.totalPedidos}</span>
                            <span className="badge bg-light text-dark" style={{ fontSize: '0.68rem', lineHeight: 1, padding: '2px 6px' }}>Clientes: {stats.uniqueClientes}</span>
                            <span className="badge bg-light text-dark" style={{ fontSize: '0.68rem', lineHeight: 1, padding: '2px 6px' }}>Bairros: {stats.uniqueBairros}</span>
                          </div>
                          <div className="btn-group" role="group" aria-label="Resumo tabs">
                            <button className={`btn btn-sm ${resumoTab === 'bairro' ? 'btn-primary' : 'btn-outline-primary'} d-inline-flex align-items-center`} style={{ padding: '2px 8px', fontSize: '0.66rem', gap: '6px' }} onClick={() => setResumoTab('bairro')}>
                              <GeoAlt size={12} />
                              <span>Bairro</span>
                            </button>
                            <button className={`btn btn-sm ${resumoTab === 'cliente' ? 'btn-primary' : 'btn-outline-primary'} d-inline-flex align-items-center`} style={{ padding: '2px 8px', fontSize: '0.66rem', gap: '6px' }} onClick={() => setResumoTab('cliente')}>
                              <Person size={12} />
                              <span>Cliente</span>
                            </button>
                            <button className={`btn btn-sm ${resumoTab === 'pedido' ? 'btn-primary' : 'btn-outline-primary'} d-inline-flex align-items-center`} style={{ padding: '2px 8px', fontSize: '0.66rem', gap: '6px' }} onClick={() => setResumoTab('pedido')}>
                              <FileText size={12} />
                              <span>Pedido</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingTop: '6px' }}>
                      {resumoTab === 'bairro' && (
                        <div>
                          <div className="d-flex flex-column gap-0">
                            {byBairroFiltered.map((r) => (
                              <div key={r.key} className="d-flex justify-content-between border-bottom py-0" style={{ padding: '2px 0' }}>
                                <span>{r.key}</span>
                                <span className="text-muted">{r.pedidos} pedidos • {r.clientes} clientes</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {resumoTab === 'cliente' && (
                        <div>
                          <div className="d-flex flex-column gap-0">
                            {byClienteFiltered.map((r) => (
                              <div key={r.key} className="d-flex justify-content-between border-bottom py-0" style={{ padding: '2px 0' }}>
                                <span>{r.key}</span>
                                <span className="text-muted">{r.pedidos} pedidos • {r.bairros} bairros</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {resumoTab === 'pedido' && (
                        <div>
                          <div className="table-responsive">
                            <table className="table table-sm mb-0" style={{ fontSize: '0.7rem' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '10%' }}>Pedido</th>
                                  <th style={{ width: '25%' }}>Cliente</th>
                                  <th style={{ width: '15%' }}>Bairro</th>
                                  <th style={{ width: '10%' }}>Filial Retira</th>
                                  <th style={{ width: '8%' }}>Itens</th>
                                  <th style={{ width: '10%' }}>Dias Úteis</th>
                                  <th style={{ width: '22%' }}>Dt Início Sep</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pedidosFiltered.map((p) => (
                                  <tr key={p.key}>
                                    <td>{p.key}</td>
                                    <td>{p.cliente || '-'}</td>
                                    <td>{p.bairro || '-'}</td>
                                    <td>{p.filialRetira}</td>
                                    <td>{p.itens}</td>
                                    <td>{p.ageDays}</td>
                                    <td>{formatDateTimeBR(p.dtInicialSep)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer py-1">
                <button
                  className="btn btn-outline-primary btn-sm py-1 px-2"
                  style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '120px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => { setShowResumoModal(false); setShowInformativoModal(true); }}
                >
                  <BarChartLine size={14} />
                  <span>Resumo Detalhado</span>
                </button>
                <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowResumoModal(false)}>
                  <XLg size={12} />
                  <span>Fechar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCortesModal && resultado && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos para Corte</h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowCortesModal(false)}></button>
                </div>
                <div className="modal-body bg-light" style={{ fontSize: '0.74rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  {(() => {
                    const all = groupPedidos(resultado.rows);
                    const cortes = all.filter(g => g.statusPedido === 13);
                    const cortesRealizados = all.filter(g => g.statusPedido === 22);
                    const hasAny = cortes.length > 0 || cortesRealizados.length > 0;
                    
                    const renderPedidoCards = (list: typeof cortes, keyPrefix: string, emptyMsg: string) => {
                      if (list.length === 0) return <div className="p-2 text-muted text-center">{emptyMsg}</div>;
                      const sorted = [...list].sort((a, b) => (b.ageDays - a.ageDays) || String(a.pedido).localeCompare(String(b.pedido)));
                      return (
                        <div className="d-flex flex-column gap-2 p-2">
                          {sorted.map((g) => (
                            <div key={`${keyPrefix}-${g.pedido}`} className="card border-secondary">
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {g.pedido}
                                  </div>
                                  <div
                                    className="text-muted"
                                    style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                    title={g.cliente ?? ''}
                                  >
                                    {g.cliente ?? '-'}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                      Status atual: {formatObsStatus(g.ultimoStatusRaw ?? String(g.statusPedido ?? ''))}
                                    </span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                      Filial retira: {g.codFilialRetira ?? '-'}
                                    </span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                      Entrega/Retira: {g.tipoEntrega ?? '-'}
                                    </span>
                                  </div>
                                </div>

                                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary">{g.items.length}</span>
                                    <button
                                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                      onClick={() => { setShowCortesModal(false); setPedidoSelecionado(g); setShowModal(true); }}
                                    >
                                      <Eye size={12} />
                                      <span>Visualizar</span>
                                    </button>
                                  </div>
                                  <span
                                    className="badge"
                                    style={{
                                      ...rowStyleByAge(g.ageDays),
                                      fontSize: '0.66rem',
                                      lineHeight: 1,
                                      padding: '2px 5px',
                                      borderRadius: '999px',
                                      minWidth: '92px',
                                    }}
                                  >
                                    Dias úteis: {g.ageDays}
                                  </span>
                                </div>
                              </div>

                              <div className="card-body p-0">
                                <div className="table-responsive">
                                  <table className="table table-borderless table-sm mb-0" style={{ fontSize: '0.70rem', ['--bs-table-border-color' as any]: 'transparent' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ width: '14%' }}>Cód.</th>
                                        <th style={{ width: '56%' }}>Descrição</th>
                                        <th style={{ width: '15%' }}>Qtd</th>
                                        <th style={{ width: '15%' }}>Qt Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {g.items.map((it, idx) => (
                                        <tr key={`${keyPrefix}-${g.pedido}-it-${it.codProd}-${idx}`}>
                                          <td>{it.codProd}</td>
                                          <td>{it.descricao}</td>
                                          <td>{it.quantidade}</td>
                                          <td>{it.qtTotal ?? '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    };

                    if (!hasAny) return <span className="text-muted">Sem pedidos em corte</span>;

                    return (
                      <div className="d-flex flex-column" style={{ flex: 1, minHeight: 0, gap: '8px' }}>
                        <ul className="nav nav-tabs" style={{ fontSize: '0.72rem' }}>
                          <li className="nav-item">
                            <button type="button" className={`nav-link ${cortesTab === 13 ? 'active' : ''}`} onClick={() => setCortesTab(13)}>
                              Pedidos para Corte <span className="badge bg-danger rounded-pill ms-1">{cortes.length}</span>
                            </button>
                          </li>
                          <li className="nav-item">
                            <button type="button" className={`nav-link ${cortesTab === 22 ? 'active' : ''}`} onClick={() => setCortesTab(22)}>
                              Corte Realizado <span className="badge bg-success rounded-pill ms-1">{cortesRealizados.length}</span>
                            </button>
                          </li>
                        </ul>

                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                          {cortesTab === 13 && renderPedidoCards(cortes, 'corte-13', 'Sem pedidos em corte')}
                          {cortesTab === 22 && renderPedidoCards(cortesRealizados, 'corte-22', 'Sem pedidos com corte realizado')}
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowCortesModal(false)}>
                    <XLg size={12} />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVisualizadosModal && resultado && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos Visualizados</h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowVisualizadosModal(false)}></button>
                </div>

                <div className="modal-body bg-light" style={{ fontSize: '0.74rem', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                      const all = groupPedidos(resultado.rows);
                      const visualizados = all.filter(g => g.statusPedido === 1);
                      const hasAny = visualizados.length > 0;

                      const renderPedidoCards = (list: typeof visualizados, keyPrefix: string, emptyMsg: string) => {
                        if (list.length === 0) return <div className="p-2 text-muted text-center">{emptyMsg}</div>;
                        const sorted = [...list].sort((a, b) => (b.ageDays - a.ageDays) || String(a.pedido).localeCompare(String(b.pedido)));
                        return (
                          <div className="d-flex flex-column gap-2 p-2">
                            {sorted.map((g) => (
                              <div key={`${keyPrefix}-${g.pedido}`} className="card border-secondary">
                                <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                  <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                    <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                      Pedido TV8: {g.pedido}
                                    </div>
                                    <div
                                      className="text-muted"
                                      style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                      title={g.cliente ?? ''}
                                    >
                                      {g.cliente ?? '-'}
                                    </div>
                                    <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                      <span className="badge" style={{ backgroundColor: '#198754', color: '#fff' }}>
                                        Status: {formatObsStatus(g.ultimoStatusRaw ?? String(g.statusPedido ?? ''))}
                                      </span>
                                      <span className="badge" style={{ backgroundColor: '#6c757d', color: '#fff' }}>
                                        Filial retira: {g.codFilialRetira ?? '-'}
                                      </span>
                                      <span className="badge" style={{ backgroundColor: '#6c757d', color: '#fff' }}>
                                        Entrega/Retira: {g.tipoEntrega ?? '-'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                    <div className="d-flex align-items-center gap-2">
                                      <span className="badge bg-secondary">{g.items.length}</span>
                                      <button
                                        className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                        style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                        onClick={() => { setShowVisualizadosModal(false); setPedidoSelecionado(g); setShowModal(true); }}
                                      >
                                        <Eye size={12} />
                                        <span>Visualizar</span>
                                      </button>
                                    </div>
                                    <span
                                      className="badge"
                                      style={{
                                        ...rowStyleByAge(g.ageDays),
                                        fontSize: '0.66rem',
                                        lineHeight: 1,
                                        padding: '2px 5px',
                                        borderRadius: '999px',
                                        minWidth: '92px',
                                      }}
                                    >
                                      Dias úteis: {g.ageDays}
                                    </span>
                                  </div>
                                </div>

                                <div className="card-body p-0">
                                  <div className="table-responsive">
                                    <table className="table table-borderless table-sm mb-0" style={{ fontSize: '0.70rem', ['--bs-table-border-color' as any]: 'transparent' }}>
                                      <thead>
                                        <tr>
                                          <th style={{ width: '14%' }}>Cód.</th>
                                          <th style={{ width: '56%' }}>Descrição</th>
                                          <th style={{ width: '15%' }}>Qtd</th>
                                          <th style={{ width: '15%' }}>Qt Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {g.items.map((it, idx) => (
                                          <tr key={`${keyPrefix}-${g.pedido}-it-${it.codProd}-${idx}`}>
                                            <td>{it.codProd}</td>
                                            <td>{it.descricao}</td>
                                            <td>{it.quantidade}</td>
                                            <td>{it.qtTotal ?? '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      };

                      if (!hasAny) return <span className="text-muted">Sem pedidos visualizados</span>;

                      return (
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                          {renderPedidoCards(visualizados, 'viz-1', 'Sem pedidos visualizados')}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowVisualizadosModal(false)}>
                    <XLg size={12} />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFaturarModal && resultado && (
        <PedidosFaturarModal
          show={showFaturarModal}
          onClose={() => setShowFaturarModal(false)}
          pedidos={(() => {
            const all = groupPedidos(resultado.rows);
            return all.filter(g => g.statusPedido === 15);
          })()}
          viewedPedidos={faturarViewedPedidos}
          onViewPedido={(g) => {
            setFaturarViewedPedidos(prev => new Set(prev).add(String(g.pedido)));
            setPedidoSelecionado(g);
            setShowModal(true);
          }}
        />
      )}

      {showSepCanceladaModal && resultado && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos com Separação Cancelada</h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowSepCanceladaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                  {(() => {
                    const all = groupPedidos(resultado.rows);
                    const sepCanc = all.filter(g => g.statusPedido === 16);
                    if (sepCanc.length === 0) {
                      return <span className="text-muted">Sem pedidos com separação cancelada</span>;
                    }
                    return (
                      <div className="table-responsive">
                        <table className="table table-sm" style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '12%' }}>TV8</th>
                              <th style={{ width: '28%' }}>Cliente</th>
                              <th style={{ width: '20%' }}>Bairro</th>
                              <th style={{ width: '20%' }}>Data</th>
                              <th style={{ width: '10%' }}>Itens</th>
                              <th style={{ width: '10%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {sepCanc.map((g, idx) => (
                              <tr key={`sep-cancelada-${g.pedido}-${idx}`}>
                                <td>{g.pedido}</td>
                                <td>{g.cliente}</td>
                                <td>{g.bairroEnt ?? '-'}</td>
                                <td>{g.normalizedDate ? g.normalizedDate.toLocaleDateString('pt-BR') : '-'}</td>
                                <td>{g.items.length}</td>
                                <td>
                                  <button className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ fontSize: '0.62rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => { setShowSepCanceladaModal(false); setPedidoSelecionado(g); setShowModal(true); }}>
                                    <Eye size={12} />
                                    <span>Visualizar</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              <div className="modal-footer py-1">
                <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowSepCanceladaModal(false)}>
                  <XLg size={12} />
                  <span>Fechar</span>
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInformativoModal && resultado && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <AutoRefresher intervalMs={15000} onRefresh={refreshPedidos} isActive={true} />
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog modal-fullscreen">
              <div className="modal-content">
                <div className="bg-white shadow-sm flex-shrink-0">
                  <div className="container-fluid px-4">
                    <div className="d-flex justify-content-between align-items-center py-3">
                      <div className="d-flex align-items-center">
                        <h1 className="h4 m-0 text-primary">Resumo de Operações</h1>
                      </div>
                      
                      <div className="d-flex align-items-center position-relative">
                        <div className="position-relative me-3">
                           {/* Espaço reservado para manter layout similar se necessário, ou apenas removido pois o modal não precisa de usuário logado duplicado */}
                        </div>

                        <button 
                          type="button"
                          className="btn btn-outline-secondary btn-sm ms-3 d-inline-flex align-items-center" 
                          onClick={() => { setShowInformativoModal(false); window.location.href = '/dashboard'; }}
                          title="Voltar para Dashboard" 
                          style={{ height: '38px', padding: '0 10px', gap: '8px' }}
                        >
                          <House size={20} />
                          <span>Dashboard</span>
                        </button>

                        <button 
                          type="button"
                          className="btn btn-outline-danger btn-sm ms-3 d-inline-flex align-items-center"
                          onClick={() => { localStorage.removeItem('usuarioLogado'); window.location.href = '/'; }}
                          title="Sair do Sistema"
                          style={{ height: '38px', padding: '0 10px', gap: '8px' }}
                        >
                          <BoxArrowRight size={20} />
                          <span>Sair</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-body p-0" style={{ fontSize: '0.7rem' }}>
                  {(() => {
                    const all = groupPedidos(resultado.rows);
                    const buildRow = (label: string, st: number) => {
                      const arr = all.filter(g => g.statusPedido === st);
                      const pedidos = arr.length;
                      const itens = arr.reduce((sum, g) => sum + g.items.length, 0);
                      const clientes = new Set(arr.map(a => (a.cliente ?? '').trim()).filter(Boolean)).size;
                      const exemplos = arr.map(a => ({ pedido: a.pedido, codCli: a.codCli, cliente: (a.cliente ?? '').trim(), ageDays: a.ageDays, dtInicialSep: a.dtInicialSep, filialRetira: a.codFilialRetira }));
                      return { label, pedidos, itens, clientes, exemplos, status: st };
                    };
                    const rows = [
                      // Vermelho (Crítico/Atenção)
                      buildRow('Pedidos para Cortar', 13),
                      buildRow('Só Faturar', 15),
                      buildRow('Separação Cancelada', 16),
                      buildRow('Pedidos para Coleta', 17),
                      buildRow('Retornou', 8),
                      buildRow('Corte Realizado', 22),
                      buildRow('Pedidos Prioridade', 23),
                      buildRow('Entrega Futura', 24),
                      buildRow('Retira Posterior', 25),
                      
                      // Laranja (Processamento/Pendência)
                      buildRow('Separando', 2),
                      buildRow('Aguardando Localização', 14),
                      buildRow('Localização Inserida', 18),
                      buildRow('Coleta Separando', 21),
                      buildRow('Aguardando Visualização', 0),
                      
                      // Roxo (Aguardando)
                      buildRow('Aguardando rota', 4),
                      buildRow('Aguardando Fornecedor', 10),
                      
                      // Azul (Específicos/Agendados)
                      buildRow('Entregas em dia Específico', 9),
                      buildRow('Entrega Fracionada', 11),
                      buildRow('Entrega em horário Específico', 12),
                      buildRow('Enviar p/ Messejana', 20),
                      buildRow('Visualizado', 1),
                      
                      // Verde (Concluídos/Prontos/Em Progresso)
                      buildRow('Separado', 3),
                      buildRow('Coleta Separada', 19),
                      buildRow('Incluído em rota', 5),
                      buildRow('Saindo em rota', 6),
                      buildRow('Entregue', 7),
                      
                      // Outros (Pegar Localização)
                      buildRow('Pegar Localização', 14),
                    ];
                    
                    const rowsFiltered = rows.filter(r => r.pedidos > 0);
                    
                    // Cálculo dos totais
                    const totalPedidos = rowsFiltered.reduce((acc, r) => acc + r.pedidos, 0);
                    const totalItens = rowsFiltered.reduce((acc, r) => acc + r.itens, 0);
                    const totalClientes = rowsFiltered.reduce((acc, r) => acc + r.clientes, 0);
                    
                    if (rowsFiltered.length === 0) {
                        return (
                            <div className="d-flex h-100 w-100 align-items-center justify-content-center">
                                <span className="text-muted">Nenhum pedido encontrado.</span>
                            </div>
                        );
                    }
                    
                    const activeRow = rowsFiltered.find(r => r.label === informativoTab) || rowsFiltered[0];

                    return (
                      <div className="d-flex h-100 w-100 p-2">
                        <div className="d-flex w-100 h-100 bg-white border rounded shadow-sm" style={{ overflow: 'hidden' }}>
                            <div className="d-flex flex-column border-end" style={{ width: '260px', overflowY: 'hidden' }}>
                                <div className="px-2 py-3 border-bottom text-center d-flex flex-column justify-content-center" style={{ height: '85px' }}>
                                    <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: '0.65rem' }}>Total Geral</small>
                                    <div className="d-flex justify-content-between mt-1" style={{ fontSize: '0.7rem' }}>
                                        <div className="text-center px-1">
                                            <div className="fw-bold text-primary">{totalPedidos}</div>
                                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>Pedidos</div>
                                        </div>
                                        <div className="border-end mx-1"></div>
                                        <div className="text-center px-1">
                                            <div className="fw-bold text-dark">{totalItens}</div>
                                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>Itens</div>
                                        </div>
                                        <div className="border-end mx-1"></div>
                                        <div className="text-center px-1">
                                            <div className="fw-bold text-dark">{totalClientes}</div>
                                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>Clientes</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex-fill p-2 d-flex flex-column gap-1" style={{ overflowY: 'auto' }}>
                                    {rowsFiltered.map(r => {
                                  const isOrange = [14, 18, 2, 21, 0].includes(r.status);
                                  const isBlue = [9, 11, 12, 20, 1].includes(r.status);
                                  const isRed = [15, 13, 17, 16, 8, 22, 23, 24, 25].includes(r.status);
                                  const isPurple = [10, 4].includes(r.status);
                                  const isGreen = [3, 19, 5, 6, 7].includes(r.status);
                                  const active = r.label === activeRow.label;
                                  
                                  let borderLeftColor = 'transparent';
                                  if (isOrange) borderLeftColor = '#fd7e14';
                                  else if (isBlue) borderLeftColor = '#0d6efd';
                                  else if (isRed) borderLeftColor = '#dc3545';
                                  else if (isPurple) borderLeftColor = '#6f42c1';
                                  else if (isGreen) borderLeftColor = '#198754';

                                  return (
                                    <button
                                      key={r.label}
                                      className={`btn btn-sm text-start d-flex justify-content-between align-items-center ${active ? 'bg-white shadow-sm border' : ''}`}
                                      style={{ 
                                          borderLeft: `4px solid ${borderLeftColor}`,
                                          fontSize: '0.7rem'
                                      }}
                                      onClick={() => setInformativoTab(r.label)}
                                    >
                                      <span className="text-truncate d-inline-flex align-items-center" style={{ maxWidth: '180px', gap: '6px' }} title={r.label}>
                                        <ListUl size={12} />
                                        <span>{r.label}</span>
                                      </span>
                                      <span className="badge bg-secondary rounded-pill" style={{ fontSize: '0.6rem' }}>{r.pedidos}</span>
                                    </button>
                                  );
                            })}
                                </div>
                            </div>
                        
                            <div className="flex-fill d-flex flex-column" style={{ overflow: 'hidden' }}>
                                <div className="px-3 py-3 border-bottom d-flex flex-column justify-content-center" style={{ height: '85px' }}>
                                    <h5 className="m-0 mb-1 text-primary text-truncate" style={{ fontSize: '1.1rem' }} title={activeRow.label}>{activeRow.label}</h5>
                                    <div className="d-flex gap-3 text-muted" style={{ fontSize: '0.8rem' }}>
                                        <span><strong>{activeRow.pedidos}</strong> Pedidos</span>
                                        <span><strong>{activeRow.itens}</strong> Itens</span>
                                        <span><strong>{activeRow.clientes}</strong> Clientes</span>
                                    </div>
                                </div>
                                
                                <div className="table-responsive flex-fill" style={{ overflowY: 'auto' }}>
                                    <table className="table table-hover table-sm mb-0" style={{ fontSize: '0.75rem' }}>
                                    <thead className="table-light sticky-top">
                                        <tr>
                                            <th style={{ width: '15%' }}>Pedido TV8</th>
                                            <th style={{ width: '10%' }}>CODCLI</th>
                                            <th style={{ width: '10%' }}>Filial Retira</th>
                                            <th>Cliente</th>
                                            <th style={{ width: '15%' }}>Dt Início Sep</th>
                                            <th style={{ width: '10%' }}>Dias Úteis</th>
                                            <th style={{ width: '10%' }} className="text-end">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(Array.isArray(activeRow.exemplos) ? activeRow.exemplos : []).map((ex: { pedido: string; codCli?: number; cliente?: string; ageDays: number; dtInicialSep?: string; filialRetira?: string }, idx: number) => (
                                            <tr key={`${activeRow.label}-ex-${idx}`} 
                                                onClick={() => setHighlightedPedidos(prev => new Set(prev).add(String(ex.pedido)))} 
                                                className={highlightedPedidos.has(String(ex.pedido)) ? 'table-success' : undefined} 
                                                style={{ cursor: 'pointer' }}>
                                                <td>{ex.pedido ?? '-'}</td>
                                                <td>{ex.codCli ?? '-'}</td>
                                                <td>{ex.filialRetira ?? '-'}</td>
                                                <td>{ex.cliente ?? '-'}</td>
                                                <td>{formatDateTimeBR(ex.dtInicialSep)}</td>
                                                <td>{ex.ageDays}</td>
                                                <td className="text-end">
                                                    <button className="btn btn-outline-primary btn-sm py-0 px-2" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={(e) => { e.stopPropagation(); setHighlightedPedidos(prev => new Set(prev).add(String(ex.pedido))); openViewer(Number(ex.pedido)); }}>
                                                        <Eye size={12} />
                                                        <span>Visualizar</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!Array.isArray(activeRow.exemplos) || activeRow.exemplos.length === 0) && (
                                            <tr>
                                                <td colSpan={7} className="text-center text-muted py-4">Nenhum pedido encontrado nesta categoria.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1" style={{ fontSize: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleCloseInformativo}
                  >
                    <Eye size={14} />
                    <span>Ver Pedidos</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProdutoModal && (
        <>
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              #produto-print-area, #produto-print-area * { visibility: visible !important; }
              html, body { height: auto !important; overflow: visible !important; }
              .modal, .modal-dialog, .modal-content, .modal-body { overflow: visible !important; height: auto !important; max-height: none !important; }
              .modal-backdrop { display: none !important; }
              .table-responsive { overflow: visible !important; }
              #produto-print-area { position: static !important; width: 100%; }
              .no-print { display: none !important; }
              .grupo-status { display: block !important; border: 1px solid #000 !important; padding: 6px !important; margin-bottom: 8px !important; break-inside: avoid !important; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #000; padding: 4px; font-size: 12px; vertical-align: top; }
              th { background: #eee !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          `}</style>
          <div className="modal-backdrop fade show" style={{ zIndex: 1150, backgroundColor: 'rgba(0,0,0,0.45)' }} />
          <div className="modal fade show d-block" tabIndex={-1} style={{ zIndex: 1160 }}>
            <div className="modal-dialog modal-fullscreen">
              <div className="modal-content" style={{ fontSize: '0.74rem' }}>
                <div className="modal-header py-1 no-print">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos por Produto</h6>
                  <button type="button" className="btn-close" style={{ transform: 'scale(0.85)' }} aria-label="Fechar" title="Fechar" onClick={() => setShowProdutoModal(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                  <div id="produto-print-area">
                    <div className="d-flex justify-content-between align-items-start mb-2" style={{ gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Pedidos relacionados ao produto</div>
                        <div><strong>CodProd:</strong> {produtoFiltroCod.trim() || '-'}</div>
                        <div className="d-flex flex-column" style={{ gap: '2px' }}>
                          <div><strong>Total pedidos:</strong> {produtoPedidos.length}</div>
                          <div><strong>Total produtos (Qt):</strong> {fromScaledToString(produtoTotalScaled)}</div>
                        </div>
                      </div>
                      <div className="text-end" style={{ fontSize: '0.72rem' }}>
                        <div><strong>Data/hora:</strong> {produtoPrintAt ? produtoPrintAt.toLocaleString('pt-BR') : '-'}</div>
                        <div><strong>Usuário:</strong> {produtoPrintUser || 'APP'}</div>
                      </div>
                    </div>

                    <div className="no-print mb-2">
                      <ul className="nav nav-pills" style={{ gap: '6px', flexWrap: 'wrap' as const }}>
                        <li className="nav-item">
                          <button
                            type="button"
                            className={`nav-link btn btn-sm ${produtoStatusActive === 'todos' ? 'active' : ''} d-inline-flex align-items-center`}
                            onClick={() => setProdutoStatusActive('todos')}
                            style={{ fontSize: '0.72rem', gap: '6px' }}
                          >
                            <ListUl size={12} />
                            <span>Todos</span>
                            <span className="badge bg-secondary ms-1">{produtoPedidos.length}</span>
                            <span className="badge bg-info text-dark ms-1">{fromScaledToString(produtoTotalScaled)}</span>
                          </button>
                        </li>
                        {produtoPedidosPorStatus.map((grp) => (
                          <li className="nav-item" key={`tab-${grp.statusPedido}`}>
                            <button
                              type="button"
                              className={`nav-link btn btn-sm ${produtoStatusActive === grp.statusPedido ? 'active' : ''} d-inline-flex align-items-center`}
                              onClick={() => setProdutoStatusActive(grp.statusPedido)}
                              style={{ fontSize: '0.72rem', gap: '6px' }}
                              title={`Status ${grp.statusPedido}: ${grp.statusLabel}`}
                            >
                              <ListUl size={12} />
                              <span>{grp.statusLabel}</span>
                              <span className="badge bg-secondary ms-1">{grp.pedidos.length}</span>
                              <span className="badge bg-info text-dark ms-1">
                                {fromScaledToString(grp.pedidos.reduce((acc, p) => acc + (p.totalScaled ?? 0n), 0n))}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {(!produtoFiltroCod.trim() || !Number.isFinite(Number(produtoFiltroCod.trim()))) ? (
                      <div className="text-muted py-4 text-center">Informe um código de produto válido.</div>
                    ) : produtoPedidos.length === 0 ? (
                      <div className="text-muted py-4 text-center">Nenhum pedido encontrado para este produto no período filtrado.</div>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {produtoPedidosPorStatus.map((grp) => (
                          <div
                            key={`pps-${grp.statusPedido}`}
                            className="grupo-status border rounded p-2 mb-3"
                            style={{ display: produtoStatusActive === 'todos' || produtoStatusActive === grp.statusPedido ? undefined : 'none', borderColor: '#ced4da' }}
                          >
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <div style={{ fontWeight: 700 }}>Status: {grp.statusLabel}</div>
                              <span className="badge bg-secondary">{grp.pedidos.length}</span>
                            </div>
                            <div className="table-responsive">
                              <table className="table table-sm" style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
                                <thead>
                                  <tr>
                                    <th style={{ width: '10%' }}>TV8</th>
                                    <th style={{ width: '33%' }}>Cliente</th>
                                    <th style={{ width: '20%' }}>Bairro</th>
                                    <th style={{ width: '10%' }} className="text-end">Qt.</th>
                                    <th style={{ width: '27%' }}>Itens</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {grp.pedidos.map((p) => (
                                    <tr key={`pp-${grp.statusPedido}-${p.pedido}`}>
                                      <td>{p.pedido}</td>
                                      <td>{p.cliente || '-'}</td>
                                      <td>{p.bairroEnt || '-'}</td>
                                      <td className="text-end">{p.totalQuantidade}</td>
                                      <td>
                                        <div className="d-flex flex-column" style={{ gap: '2px' }}>
                                          {p.itens.map((it, idx) => (
                                            <div key={`ppi-${grp.statusPedido}-${p.pedido}-${idx}`}>
                                              <div style={{ fontWeight: 600 }}>{String(it.descricao ?? '-')}</div>
                                              <div style={{ fontSize: '0.65rem' }}>
                                                <span><strong>Qt:</strong> {formatQuantidade(it.quantidade)}</span>
                                                {it.qtTotal ? <span> • <strong>Total:</strong> {String(it.qtTotal)}</span> : null}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer py-1 no-print">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setShowProdutoModal(false)}
                  >
                    <XLg size={12} />
                    <span>Fechar</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => {
                      setProdutoPrintUser(getUsuarioLogado());
                      setProdutoPrintAt(new Date());
                      setTimeout(() => window.print(), 50);
                    }}
                  >
                    <Printer size={14} />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showModal && pedidoSelecionado && (
        <VisualizarPedido
          show={showModal}
          onClose={() => setShowModal(false)}
          pedido={pedidoSelecionado}
          matricula={matricula}
          outrosPedidos={(() => {
            if (!resultado) return [];
            const groups = groupPedidos(resultado.rows);
            const codCliSel = pedidoSelecionado.codCli ?? null;
            const nomeSel = (pedidoSelecionado.cliente ?? '').trim().toLowerCase();
            const isOpen = (st: number) => st !== 7;
            return groups
              .filter(g => String(g.pedido) !== String(pedidoSelecionado.pedido))
              .filter(g => (
                codCliSel != null
                  ? Number(g.codCli) === Number(codCliSel)
                  : (g.cliente ?? '').trim().toLowerCase() === nomeSel
              ))
              .filter(g => isOpen(g.statusPedido))
              .map(g => ({
                pedido: g.pedido,
                cliente: g.cliente,
                bairroEnt: g.bairroEnt,
                normalizedDate: g.normalizedDate,
                itens: g.items.length,
                statusPedido: g.statusPedido,
                posicao: g.posicao,
                codFilialRetira: g.codFilialRetira,
              }));
          })()}
          abrirPedido={(num) => openViewer(num)}
          onStatusUpdated={async () => {
            await refreshPedidos();
          }}
        />
      )}

      {showUpdateModal && itemSelecionado && (
        <AtualizarCadastro
          show={showUpdateModal}
          item={itemSelecionado}
          onClose={() => setShowUpdateModal(false)}
          onUpdate={async (updated) => {
            if (!updated.codProd) {
              throw new Error('Produto inválido.');
            }
            if (!updated.embalagem || !updated.embalagem.trim()) {
              throw new Error('Selecione a Embalagem Master.');
            }
            if (updated.multiplo == null || !Number.isFinite(updated.multiplo)) {
              throw new Error('Informe um múltiplo válido.');
            }
            await atualizarCadastro({
              codigoDoProduto: updated.codProd,
              novaEmbalagem: updated.embalagem.trim(),
              novoMultiplo: updated.multiplo,
            });
            // Atualiza a lista para refletir alterações
            await refreshPedidos();
          }}
        />
      )}

      {showLogsModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1150 }}>
          <div className="modal-dialog modal-lg" style={{ zIndex: 1160 }}>
            <div className="modal-content">
              <div className="modal-header py-1">
                <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Logs do Pedido</h6>
                <button type="button" className="btn-close" style={{ transform: 'scale(0.85)' }} aria-label="Fechar" title="Fechar" onClick={() => setShowLogsModal(false)}></button>
              </div>
              <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                <div className="d-flex" style={{ gap: '12px' }}>
                  <div style={{ width: '280px', minWidth: '280px' }}>
                    <div className="card">
                      <div className="card-header py-1" style={{ fontSize: '0.75rem' }}>Resumo</div>
                      <div className="card-body py-2" style={{ fontSize: '0.74rem' }}>
                        <div className="mb-2"><strong>Status atual:</strong> {formatObsStatus(logsConteudo?.obs)}</div>
                        <div className="mb-2"><strong>Total eventos:</strong> {(logsConteudo?.linhas ?? []).length}</div>
                        <div className="mb-2"><strong>Primeiro registro:</strong> {(() => {
                          const ls = logsConteudo?.linhas ?? []; if (ls.length === 0) return '-'; return formatLogLine(ls[0]);
                        })()}</div>
                        <hr className="my-2" />
                        <div><strong>Último registro:</strong> {(() => {
                          const ls = logsConteudo?.linhas ?? []; if (ls.length === 0) return '-'; return formatLogLine(ls[ls.length - 1]);
                        })()}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-grow-1">
                    <div className="d-flex flex-column gap-1" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                      {(logsConteudo?.linhas ?? []).length === 0 ? (
                        <span className="text-muted">Sem logs</span>
                      ) : (
                        (logsConteudo?.linhas ?? []).map((ln, idx) => (
                          <div key={`log-${idx}`} className="border rounded px-2 py-1">{formatLogLine(ln)}</div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer py-1">
                <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowLogsModal(false)}>
                  <XLg size={12} />
                  <span>Fechar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default BuscarPedidosPorPeriodo;
