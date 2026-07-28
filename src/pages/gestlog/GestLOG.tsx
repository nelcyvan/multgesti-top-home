import React, { useEffect, useState, useCallback, useRef } from 'react';
import TopBar from '../../components/TopBar';
import { ClipboardCheck, Map as MapIcon, FileText, Filter, Search, StarFill, BoxArrowInDown, Calendar3Week, Truck, GeoAlt, Calendar3, Layers, Signpost2, BoxSeam, Eye, Check2Circle, CalendarRange, XCircle, Camera } from 'react-bootstrap-icons';
import BuscarPedidosPorPeriodo from '../../components/gestlog/BuscarPedidosPorPeriodo';
import type { BuscarPedidosRef } from '../../components/gestlog/BuscarPedidosPorPeriodo';
import type { PedidoGestLOG } from '../../services/gestlog/BuscarPedidosPorPeriodo';
import TelaGeralRotas from '../../components/gestlog/modals/TelaGeralRotas';

import { appUrl } from "../../utils/appUrl";
const GestLOG: React.FC = () => {
  const buscarPedidosRef = useRef<BuscarPedidosRef>(null);
  const [matricula, setMatricula] = useState<string>('');
  const resolveBaseApi = () => {
    const envRaw = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    if (envRaw && typeof envRaw === 'string') {
      const trimmed = envRaw.replace(/\/+$/, '');
      if (isHttps && /^http:\/\//i.test(trimmed)) return '/api';
      return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    }
    return '/api';
  };

  useEffect(() => {
    const dadosUsuario = localStorage.getItem('usuarioLogado');
    if (dadosUsuario) {
      const dados = JSON.parse(dadosUsuario);
      setMatricula(dados.matricula || '');
    }
  }, []);

  const [rows, setRows] = useState<PedidoGestLOG[]>([]);
  const [showSeparacaoModal, setShowSeparacaoModal] = useState<boolean>(false);
  const [showColetaModal, setShowColetaModal] = useState<boolean>(false);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showPedidosPrioridadeModal, setShowPedidosPrioridadeModal] = useState<boolean>(false);
  const [showRetiraPosteriorModal, setShowRetiraPosteriorModal] = useState<boolean>(false);
  const [showEntregaFuturaModal, setShowEntregaFuturaModal] = useState<boolean>(false);
  const [showAguardandoRotaModal, setShowAguardandoRotaModal] = useState<boolean>(false);
  const [showEnviarMessejanaModal, setShowEnviarMessejanaModal] = useState<boolean>(false);
  const [showEntregaEspecificaModal, setShowEntregaEspecificaModal] = useState<boolean>(false);
  const [showEntregaFracionadaModal, setShowEntregaFracionadaModal] = useState<boolean>(false);
  const [showIncluidoRotaModal, setShowIncluidoRotaModal] = useState<boolean>(false);
  const [showAguardandoFornecedorModal, setShowAguardandoFornecedorModal] = useState<boolean>(false);
  const [showRoterizacaoPedidosModal, setShowRoterizacaoPedidosModal] = useState<boolean>(false);
  const [showPedidosEntreguesModal, setShowPedidosEntreguesModal] = useState<boolean>(false);
  const formatDateIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [pedidosEntreguesDataInicio, setPedidosEntreguesDataInicio] = useState<string>(() => formatDateIso(new Date()));
  const [pedidosEntreguesDataFim, setPedidosEntreguesDataFim] = useState<string>(() => formatDateIso(new Date()));
  const [loadingPedidosEntregues, setLoadingPedidosEntregues] = useState<boolean>(false);
  const [errorPedidosEntregues, setErrorPedidosEntregues] = useState<string | null>(null);
  const [pedidosEntreguesTotal, setPedidosEntreguesTotal] = useState<number>(0);
  const [pedidosEntreguesRows, setPedidosEntreguesRows] = useState<any[]>([]);
  const [selectedPedidoEntregue, setSelectedPedidoEntregue] = useState<number | null>(null);
  const [loadingPedidoEntregueDetalhes, setLoadingPedidoEntregueDetalhes] = useState<boolean>(false);
  const [errorPedidoEntregueDetalhes, setErrorPedidoEntregueDetalhes] = useState<string | null>(null);
  const [pedidoEntregueDadosRows, setPedidoEntregueDadosRows] = useState<any[]>([]);
  const [pedidoEntregueFotosRows, setPedidoEntregueFotosRows] = useState<any[]>([]);
  const [fotoStatusByUrl, setFotoStatusByUrl] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});
  const [showFotoFullscreen, setShowFotoFullscreen] = useState<boolean>(false);
  const [fotoFullscreenUrl, setFotoFullscreenUrl] = useState<string>('');
  const [fotoFullscreenLabel, setFotoFullscreenLabel] = useState<string>('');
  const [fotoFullscreenLoading, setFotoFullscreenLoading] = useState<boolean>(false);
  const [fotoFullscreenError, setFotoFullscreenError] = useState<string | null>(null);
  const toThumbUrl = (u: string) => {
    const base = u.includes('/pedidos-fotos/arquivo-thumb')
      ? u
      : u.replace('/pedidos-fotos/arquivo', '/pedidos-fotos/arquivo-thumb');
    if (base.includes('w=') || base.includes('width=')) return base;
    return `${base}&w=420&q=55&fmt=jpeg`;
  };
  const fotosItems = React.useMemo(() => {
    const f = pedidoEntregueFotosRows[0] || null;
    if (!selectedPedidoEntregue || !f) return [];
    return [
      { key: 'NFE', label: 'NFE', ok: !!f.TEM_FOTO_NFE, url: f.URL_FOTO_NFE },
      { key: 'MERC', label: 'Mercadoria', ok: !!f.TEM_FOTO_MERCADORIA, url: f.URL_FOTO_MERCADORIA },
      { key: 'LOCAL', label: 'Local', ok: !!f.TEM_FOTO_LOCAL, url: f.URL_FOTO_LOCAL },
      { key: 'RES', label: 'Residência', ok: !!f.TEM_FOTO_RESIDENCIA, url: f.URL_FOTO_RESIDENCIA },
      { key: 'VAL', label: 'Valor', ok: !!f.TEM_FOTO_VALOR_RECEBIDO, url: f.URL_FOTO_VALOR_RECEBIDO },
      { key: 'COMP', label: 'Comprovante', ok: !!f.TEM_FOTO_COMPROVANTE, url: f.URL_FOTO_COMPROVANTE },
    ].filter((p) => p.ok && p.url);
  }, [pedidoEntregueFotosRows, selectedPedidoEntregue]);
  const [onlyCimentoEntregaEspecifica, setOnlyCimentoEntregaEspecifica] = useState<boolean>(false);
  const [entregaEspecificaTab, setEntregaEspecificaTab] = useState<'dia' | 'horario'>('dia');
  const [onlyCimentoAguardandoRota, setOnlyCimentoAguardandoRota] = useState<boolean>(false);
  const [onlyCimentoAguardandoFornecedor, setOnlyCimentoAguardandoFornecedor] = useState<boolean>(false);
  const [onlyCimentoPedidosPrioridade, setOnlyCimentoPedidosPrioridade] = useState<boolean>(false);
  const [onlyCimentoRetiraPosterior, setOnlyCimentoRetiraPosterior] = useState<boolean>(false);
  const [onlyCimentoEntregaFutura, setOnlyCimentoEntregaFutura] = useState<boolean>(false);
  const [onlyCimentoEnviarMessejana, setOnlyCimentoEnviarMessejana] = useState<boolean>(false);
  const [onlyCimentoEntregaFracionada, setOnlyCimentoEntregaFracionada] = useState<boolean>(false);
  const [onlyCimentoIncluidoRota, setOnlyCimentoIncluidoRota] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [openViewerFn, setOpenViewerFn] = useState<((pedidoNum: number) => void) | null>(null);
  const handleExposeOpenViewer = useCallback((fn: (pedidoNum: number) => void) => {
    setOpenViewerFn(() => fn);
  }, []);

  const [refreshStatus, setRefreshStatus] = useState<{ loading: boolean; nextRefreshIn: number; hasSearched: boolean }>({ loading: false, nextRefreshIn: 15, hasSearched: false });
  const handleRefreshStatus = useCallback((status: { loading: boolean; nextRefreshIn: number; hasSearched: boolean }) => {
    setRefreshStatus(status);
  }, []);

  useEffect(() => {
    if (showEntregaEspecificaModal) setEntregaEspecificaTab('dia');
  }, [showEntregaEspecificaModal]);
  useEffect(() => {
    if (showEnviarMessejanaModal) setOnlyCimentoEnviarMessejana(false);
  }, [showEnviarMessejanaModal]);

  const loadPedidosEntregues = useCallback(async () => {
    setLoadingPedidosEntregues(true);
    setErrorPedidosEntregues(null);
    try {
      const baseApi = resolveBaseApi();
      const params = new URLSearchParams({
        dataInicio: pedidosEntreguesDataInicio,
        dataFim: pedidosEntreguesDataFim,
        limit: '200',
        offset: '0',
      });
      const resp = await fetch(`${baseApi}/gestlog/pedidos-entregues/por-data?${params.toString()}`);
      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      const isJson = ct.includes('application/json');
      const data: any = isJson ? await resp.json() : await resp.text();
      if (!resp.ok) {
        const msg = isJson ? String(data?.message || 'Falha ao carregar pedidos entregues') : String(data || 'Falha ao carregar pedidos entregues');
        throw new Error(msg);
      }
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      setPedidosEntreguesRows(rows);
      const total = Number(data?.total ?? rows.length);
      setPedidosEntreguesTotal(Number.isFinite(total) ? total : rows.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar pedidos entregues';
      setErrorPedidosEntregues(msg);
      setPedidosEntreguesRows([]);
      setPedidosEntreguesTotal(0);
    } finally {
      setLoadingPedidosEntregues(false);
    }
  }, [pedidosEntreguesDataInicio, pedidosEntreguesDataFim]);

  const loadDetalhesPedidoEntregue = useCallback(async (numPedido: number) => {
    setSelectedPedidoEntregue(numPedido);
    setLoadingPedidoEntregueDetalhes(true);
    setErrorPedidoEntregueDetalhes(null);
    setPedidoEntregueDadosRows([]);
    setPedidoEntregueFotosRows([]);
    try {
      const baseApi = resolveBaseApi();
      const [respDados, respFotos] = await Promise.all([
        fetch(`${baseApi}/gestlog/pedido-por-numped?numped=${encodeURIComponent(String(numPedido))}`),
        fetch(`${baseApi}/gestlog/pedidos-fotos/por-pedido?numPedido=${encodeURIComponent(String(numPedido))}`),
      ]);

      const parseResp = async (resp: Response) => {
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        const isJson = ct.includes('application/json');
        const data: any = isJson ? await resp.json() : await resp.text();
        if (!resp.ok) {
          const msg = isJson ? String(data?.message || 'Falha ao carregar') : String(data || 'Falha ao carregar');
          throw new Error(msg);
        }
        return data;
      };

      const [dados, fotos] = await Promise.all([parseResp(respDados), parseResp(respFotos)]);
      setPedidoEntregueDadosRows(Array.isArray(dados?.rows) ? dados.rows : []);
      setPedidoEntregueFotosRows(Array.isArray(fotos?.rows) ? fotos.rows : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar detalhes do pedido';
      setErrorPedidoEntregueDetalhes(msg);
    } finally {
      setLoadingPedidoEntregueDetalhes(false);
    }
  }, []);

  useEffect(() => {
    if (!showPedidosEntreguesModal) return;
    setSelectedPedidoEntregue(null);
    setPedidoEntregueDadosRows([]);
    setPedidoEntregueFotosRows([]);
    setErrorPedidoEntregueDetalhes(null);
    loadPedidosEntregues();
  }, [showPedidosEntreguesModal, loadPedidosEntregues]);

  useEffect(() => {
    const urls = fotosItems.map((it) => toThumbUrl(String(it.url)));
    if (urls.length === 0) {
      setFotoStatusByUrl({});
      return;
    }
    const next: Record<string, 'loading' | 'loaded' | 'error'> = {};
    urls.forEach((u) => { next[u] = 'loading'; });
    setFotoStatusByUrl(next);
  }, [fotosItems]);

  useEffect(() => {
    if (!showFotoFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFotoFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showFotoFullscreen]);

  const extractByStatusDesc = (list: PedidoGestLOG[], target: string) => {
    return list
      .filter(r => (r.STATUS_DESCRICAO || '').toLowerCase().includes(target.toLowerCase()))
      .map(r => ({ codCli: r.CODCLI, cliente: r.CLIENTE, pedido: r.NUMERO_DO_PEDIDO_TV8 }));
  };

  const extractStatusCode = (raw: unknown): number => {
    if (raw == null) return 0;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const n = Math.trunc(raw);
      if (n < 0) return 0;
      return n;
    }
    const s = String(raw).trim();
    if (!s) return 0;
    const parts = s.split(',').map(p => p.trim()).filter(p => p.length > 0);
    const last = parts.length ? parts[parts.length - 1] : s;
    const codeStr = last.includes('__') ? last.split('__')[0].trim() : last;
    const n = parseInt(codeStr, 10);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    return n;
  };

  const dedupeByPedido = <T extends { pedido: number }>(items: T[]) => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const it of items) {
      const k = String(it.pedido);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  };

  const parseDateFlexible = (v: unknown): Date | null => {
    if (v == null) return null;
    if (v instanceof Date) {
      if (!Number.isFinite(v.getTime())) return null;
      return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    }
    const s = String(v).trim();
    if (!s) return null;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]) - 1;
      const yyyy = Number(m[3]);
      const d = new Date(yyyy, mm, dd);
      if (Number.isFinite(d.getTime())) return d;
      return null;
    }
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
      dt.setDate(dt.getDate() + 1);
      if (dt > end) break;
      const day = dt.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  };

  const entregaRetiraLabel = (tipoEntrega: unknown, filialRetira: string): string => {
    const te = String(tipoEntrega || '').toUpperCase().trim();
    if (te === 'EF') return 'Entrega Futura';
    if (te === 'RP') return 'Retira Posterior';
    if (te === 'EN') return 'Entrega';
    return filialRetira !== '-' ? 'Retira' : 'Entrega';
  };

  type CardDef = { title: string; key: string; code?: number; compact?: boolean };
  const cardsData: CardDef[] = [];
  const hasSideCards = cardsData.length > 0;
  const [cementMap, setCementMap] = useState<Record<string, boolean>>(() => Object.fromEntries(cardsData.map(cd => [cd.title, false])) as Record<string, boolean>);
  const pedidosComCimento = React.useMemo(() => {
    const s = new Set<number>();
    rows.forEach(r => {
      const d = String(r.DESCRICAO || '').toLowerCase();
      if (d.includes('cimento')) s.add(Number(r.NUMERO_DO_PEDIDO_TV8));
    });
    return s;
  }, [rows]);
  const pedidosPrioridadePedidos = React.useMemo(() => {
    type PedidoCard = {
      codCli: number;
      cliente: string;
      pedido: number;
      ageDays: number;
      statusAtual: string;
      filialRetira: string;
      entregaRetira: string;
      hasCimento: boolean;
      items: { codProd: number; descricao: string; quantidade: number; qtTotal?: string }[];
    };

    const byPedido = new Map<string, PedidoCard>();
    for (const r of rows) {
      const statusCode = extractStatusCode(r.STATUS_PEDIDO);
      if (statusCode !== 23) continue;
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      const key = String(pedido);
      const existing = byPedido.get(key);
      const descricao = String(r.DESCRICAO || '');
      const isCimento = descricao.toLowerCase().includes('cimento');
      const statusAtual = (() => {
        const raw = String(r.STATUS_DESCRICAO || '').trim();
        if (raw) return raw;
        return 'Prioridade';
      })();
      const filialRetira = String(r.CODFILIALRETIRA || '').trim() || '-';
      const entregaRetira = entregaRetiraLabel(r.TIPOENTREGA, filialRetira);
      const ageDays = businessDaysSince(parseDateFlexible(r.DATA));
      const item = {
        codProd: Number(r.CODPROD),
        descricao,
        quantidade: Number(r.QUANTIDADE_ITEM_PEDIDO ?? 0),
        qtTotal: typeof r.QT_TOTAL === 'string' && r.QT_TOTAL.trim() ? r.QT_TOTAL.trim() : undefined,
      };
      if (!existing) {
        byPedido.set(key, {
          codCli: r.CODCLI,
          cliente: r.CLIENTE,
          pedido,
          ageDays,
          statusAtual,
          filialRetira,
          entregaRetira,
          hasCimento: isCimento,
          items: [item],
        });
      } else {
        existing.items.push(item);
        if (isCimento) existing.hasCimento = true;
        if (!existing.statusAtual && statusAtual) existing.statusAtual = statusAtual;
        if (existing.filialRetira === '-' && filialRetira !== '-') existing.filialRetira = filialRetira;
      }
    }
    return Array.from(byPedido.values());
  }, [rows]);
  const pedidosPrioridadeBadgeCount = pedidosPrioridadePedidos.length;
  const retiraPosteriorPedidos = React.useMemo(() => {
    type PedidoCard = {
      codCli: number;
      cliente: string;
      pedido: number;
      ageDays: number;
      statusAtual: string;
      filialRetira: string;
      entregaRetira: string;
      hasCimento: boolean;
      items: { codProd: number; descricao: string; quantidade: number; qtTotal?: string }[];
    };

    const byPedido = new Map<string, PedidoCard>();
    for (const r of rows) {
      const statusCode = extractStatusCode(r.STATUS_PEDIDO);
      if (statusCode !== 25) continue;
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      const key = String(pedido);
      const existing = byPedido.get(key);
      const descricao = String(r.DESCRICAO || '');
      const isCimento = descricao.toLowerCase().includes('cimento');
      const statusAtual = (() => {
        const raw = String(r.STATUS_DESCRICAO || '').trim();
        if (raw) return raw;
        return 'Retira Posterior';
      })();
      const filialRetira = String(r.CODFILIALRETIRA || '').trim() || '-';
      const entregaRetira = entregaRetiraLabel(r.TIPOENTREGA, filialRetira);
      const ageDays = businessDaysSince(parseDateFlexible(r.DATA));
      const item = {
        codProd: Number(r.CODPROD),
        descricao,
        quantidade: Number(r.QUANTIDADE_ITEM_PEDIDO ?? 0),
        qtTotal: typeof r.QT_TOTAL === 'string' && r.QT_TOTAL.trim() ? r.QT_TOTAL.trim() : undefined,
      };
      if (!existing) {
        byPedido.set(key, {
          codCli: r.CODCLI,
          cliente: r.CLIENTE,
          pedido,
          ageDays,
          statusAtual,
          filialRetira,
          entregaRetira,
          hasCimento: isCimento,
          items: [item],
        });
      } else {
        existing.items.push(item);
        if (isCimento) existing.hasCimento = true;
        if (!existing.statusAtual && statusAtual) existing.statusAtual = statusAtual;
        if (existing.filialRetira === '-' && filialRetira !== '-') existing.filialRetira = filialRetira;
      }
    }
    return Array.from(byPedido.values());
  }, [rows]);
  const retiraPosteriorBadgeCount = retiraPosteriorPedidos.length;
  const entregaFuturaPedidos = React.useMemo(() => {
    type PedidoCard = {
      codCli: number;
      cliente: string;
      pedido: number;
      ageDays: number;
      statusAtual: string;
      filialRetira: string;
      entregaRetira: string;
      hasCimento: boolean;
      items: { codProd: number; descricao: string; quantidade: number; qtTotal?: string }[];
    };

    const byPedido = new Map<string, PedidoCard>();
    for (const r of rows) {
      const statusCode = extractStatusCode(r.STATUS_PEDIDO);
      if (statusCode !== 24) continue;
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      const key = String(pedido);
      const existing = byPedido.get(key);
      const descricao = String(r.DESCRICAO || '');
      const isCimento = descricao.toLowerCase().includes('cimento');
      const statusAtual = (() => {
        const raw = String(r.STATUS_DESCRICAO || '').trim();
        if (raw) return raw;
        return 'Entrega Futura';
      })();
      const filialRetira = String(r.CODFILIALRETIRA || '').trim() || '-';
      const entregaRetira = entregaRetiraLabel(r.TIPOENTREGA, filialRetira);
      const ageDays = businessDaysSince(parseDateFlexible(r.DATA));
      const item = {
        codProd: Number(r.CODPROD),
        descricao,
        quantidade: Number(r.QUANTIDADE_ITEM_PEDIDO ?? 0),
        qtTotal: typeof r.QT_TOTAL === 'string' && r.QT_TOTAL.trim() ? r.QT_TOTAL.trim() : undefined,
      };
      if (!existing) {
        byPedido.set(key, {
          codCli: r.CODCLI,
          cliente: r.CLIENTE,
          pedido,
          ageDays,
          statusAtual,
          filialRetira,
          entregaRetira,
          hasCimento: isCimento,
          items: [item],
        });
      } else {
        existing.items.push(item);
        if (isCimento) existing.hasCimento = true;
        if (!existing.statusAtual && statusAtual) existing.statusAtual = statusAtual;
        if (existing.filialRetira === '-' && filialRetira !== '-') existing.filialRetira = filialRetira;
      }
    }
    return Array.from(byPedido.values());
  }, [rows]);
  const entregaFuturaBadgeCount = entregaFuturaPedidos.length;
  const aguardandoRotaPedidos = React.useMemo(() => {
    type PedidoCard = {
      codCli: number;
      cliente: string;
      pedido: number;
      ageDays: number;
      statusAtual: string;
      filialRetira: string;
      entregaRetira: string;
      hasCimento: boolean;
      items: { codProd: number; descricao: string; quantidade: number; qtTotal?: string }[];
    };

    const byPedido = new Map<string, PedidoCard>();
    for (const r of rows) {
      const statusCode = extractStatusCode(r.STATUS_PEDIDO);
      if (statusCode !== 4) continue;
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      const key = String(pedido);
      const existing = byPedido.get(key);
      const descricao = String(r.DESCRICAO || '');
      const isCimento = descricao.toLowerCase().includes('cimento');
      const statusAtual = (() => {
        const raw = String(r.STATUS_DESCRICAO || '').trim();
        if (raw) return raw;
        return 'Aguardando rota';
      })();
      const filialRetira = String(r.CODFILIALRETIRA || '').trim() || '-';
      const entregaRetira = entregaRetiraLabel(r.TIPOENTREGA, filialRetira);
      const ageDays = businessDaysSince(parseDateFlexible(r.DATA));
      const item = {
        codProd: Number(r.CODPROD),
        descricao,
        quantidade: Number(r.QUANTIDADE_ITEM_PEDIDO ?? 0),
        qtTotal: typeof r.QT_TOTAL === 'string' && r.QT_TOTAL.trim() ? r.QT_TOTAL.trim() : undefined,
      };
      if (!existing) {
        byPedido.set(key, {
          codCli: r.CODCLI,
          cliente: r.CLIENTE,
          pedido,
          ageDays,
          statusAtual,
          filialRetira,
          entregaRetira,
          hasCimento: isCimento,
          items: [item],
        });
      } else {
        existing.items.push(item);
        if (isCimento) existing.hasCimento = true;
        if (!existing.statusAtual && statusAtual) existing.statusAtual = statusAtual;
        if (existing.filialRetira === '-' && filialRetira !== '-') existing.filialRetira = filialRetira;
      }
    }
    return Array.from(byPedido.values());
  }, [rows]);
  const aguardandoRotaBadgeCount = aguardandoRotaPedidos.length;
  const incluidoRotaPedidos = React.useMemo(() => {
    type PedidoCard = {
      codCli: number;
      cliente: string;
      pedido: number;
      ageDays: number;
      statusAtual: string;
      filialRetira: string;
      entregaRetira: string;
      hasCimento: boolean;
      items: { codProd: number; descricao: string; quantidade: number; qtTotal?: string }[];
    };

    const byPedido = new Map<string, PedidoCard>();
    for (const r of rows) {
      const statusCode = extractStatusCode(r.STATUS_PEDIDO);
      if (statusCode !== 5 && statusCode !== 6) continue;
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      const key = String(pedido);
      const existing = byPedido.get(key);
      const descricao = String(r.DESCRICAO || '');
      const isCimento = descricao.toLowerCase().includes('cimento');
      const statusAtual = (() => {
        const raw = String(r.STATUS_DESCRICAO || '').trim();
        if (raw) return raw;
        return statusCode === 5 ? 'Incluído em rota' : 'Saindo em rota';
      })();
      const filialRetira = String(r.CODFILIALRETIRA || '').trim() || '-';
      const entregaRetira = entregaRetiraLabel(r.TIPOENTREGA, filialRetira);
      const ageDays = businessDaysSince(parseDateFlexible(r.DATA));
      const item = {
        codProd: Number(r.CODPROD),
        descricao,
        quantidade: Number(r.QUANTIDADE_ITEM_PEDIDO ?? 0),
        qtTotal: typeof r.QT_TOTAL === 'string' && r.QT_TOTAL.trim() ? r.QT_TOTAL.trim() : undefined,
      };
      if (!existing) {
        byPedido.set(key, {
          codCli: r.CODCLI,
          cliente: r.CLIENTE,
          pedido,
          ageDays,
          statusAtual,
          filialRetira,
          entregaRetira,
          hasCimento: isCimento,
          items: [item],
        });
      } else {
        existing.items.push(item);
        if (isCimento) existing.hasCimento = true;
        if (!existing.statusAtual && statusAtual) existing.statusAtual = statusAtual;
        if (existing.filialRetira === '-' && filialRetira !== '-') existing.filialRetira = filialRetira;
      }
    }
    return Array.from(byPedido.values());
  }, [rows]);
  const incluidoRotaBadgeCount = incluidoRotaPedidos.length;
  const enviarMessejanaPedidos = React.useMemo(() => {
    type PedidoCard = {
      codCli: number;
      cliente: string;
      pedido: number;
      ageDays: number;
      statusAtual: string;
      filialRetira: string;
      entregaRetira: string;
      hasCimento: boolean;
      items: { codProd: number; descricao: string; quantidade: number; qtTotal?: string }[];
    };

    const byPedido = new Map<string, PedidoCard>();
    for (const r of rows) {
      const statusCode = extractStatusCode(r.STATUS_PEDIDO);
      if (statusCode !== 20) continue;
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      const key = String(pedido);
      const existing = byPedido.get(key);
      const descricao = String(r.DESCRICAO || '');
      const isCimento = descricao.toLowerCase().includes('cimento');
      const statusAtual = (() => {
        const raw = String(r.STATUS_DESCRICAO || '').trim();
        if (raw) return raw;
        return 'Enviar p/ Messejana';
      })();
      const filialRetira = String(r.CODFILIALRETIRA || '').trim() || '-';
      const entregaRetira = entregaRetiraLabel(r.TIPOENTREGA, filialRetira);
      const ageDays = businessDaysSince(parseDateFlexible(r.DATA));
      const item = {
        codProd: Number(r.CODPROD),
        descricao,
        quantidade: Number(r.QUANTIDADE_ITEM_PEDIDO ?? 0),
        qtTotal: typeof r.QT_TOTAL === 'string' && r.QT_TOTAL.trim() ? r.QT_TOTAL.trim() : undefined,
      };
      if (!existing) {
        byPedido.set(key, {
          codCli: r.CODCLI,
          cliente: r.CLIENTE,
          pedido,
          ageDays,
          statusAtual,
          filialRetira,
          entregaRetira,
          hasCimento: isCimento,
          items: [item],
        });
      } else {
        existing.items.push(item);
        if (isCimento) existing.hasCimento = true;
        if (!existing.statusAtual && statusAtual) existing.statusAtual = statusAtual;
        if (existing.filialRetira === '-' && filialRetira !== '-') existing.filialRetira = filialRetira;
      }
    }
    return Array.from(byPedido.values());
  }, [rows]);
  const enviarMessejanaBadgeCount = enviarMessejanaPedidos.length;
  const entregaEspecificaPedidos = React.useMemo(() => {
    type PedidoCard = {
      codCli: number;
      cliente: string;
      pedido: number;
      ageDays: number;
      statusAtual: string;
      filialRetira: string;
      entregaRetira: string;
      hasCimento: boolean;
      items: { codProd: number; descricao: string; quantidade: number; qtTotal?: string }[];
    };

    const dia = new Map<string, PedidoCard>();
    const horario = new Map<string, PedidoCard>();
    for (const r of rows) {
      const statusCode = extractStatusCode(r.STATUS_PEDIDO);
      if (statusCode !== 9 && statusCode !== 12) continue;
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      const key = String(pedido);
      const target = statusCode === 9 ? dia : horario;
      const existing = target.get(key);
      const descricao = String(r.DESCRICAO || '');
      const isCimento = descricao.toLowerCase().includes('cimento');
      const statusAtual = (() => {
        const raw = String(r.STATUS_DESCRICAO || '').trim();
        if (raw) return raw;
        return statusCode === 9 ? 'Entrega em dia Específico' : 'Entrega em horário Específico';
      })();
      const filialRetira = String(r.CODFILIALRETIRA || '').trim() || '-';
      const entregaRetira = (() => {
        const te = String(r.TIPOENTREGA || '').toUpperCase().trim();
        if (te === 'EF') return 'Entrega Futura';
        if (te === 'RP') return 'Retira Posterior';
        if (te === 'EN') return 'Entrega';
        return filialRetira !== '-' ? 'Retira' : 'Entrega';
      })();
      const ageDays = businessDaysSince(parseDateFlexible(r.DATA));
      const item = {
        codProd: Number(r.CODPROD),
        descricao,
        quantidade: Number(r.QUANTIDADE_ITEM_PEDIDO ?? 0),
        qtTotal: typeof r.QT_TOTAL === 'string' && r.QT_TOTAL.trim() ? r.QT_TOTAL.trim() : undefined,
      };
      if (!existing) {
        target.set(key, {
          codCli: r.CODCLI,
          cliente: r.CLIENTE,
          pedido,
          ageDays,
          statusAtual,
          filialRetira,
          entregaRetira,
          hasCimento: isCimento,
          items: [item],
        });
      } else {
        existing.items.push(item);
        if (isCimento) existing.hasCimento = true;
        if (!existing.statusAtual && statusAtual) existing.statusAtual = statusAtual;
        if (existing.filialRetira === '-' && filialRetira !== '-') existing.filialRetira = filialRetira;
      }
    }
    return { dia: Array.from(dia.values()), horario: Array.from(horario.values()) };
  }, [rows]);
  const entregaEspecificaBadgeCount = React.useMemo(() => {
    const s = new Set<string>();
    entregaEspecificaPedidos.dia.forEach(it => s.add(String(it.pedido)));
    entregaEspecificaPedidos.horario.forEach(it => s.add(String(it.pedido)));
    return s.size;
  }, [entregaEspecificaPedidos]);
  const entregaFracionadaPedidos = React.useMemo(() => {
    type PedidoCard = {
      codCli: number;
      cliente: string;
      pedido: number;
      ageDays: number;
      statusAtual: string;
      filialRetira: string;
      entregaRetira: string;
      hasCimento: boolean;
      items: { codProd: number; descricao: string; quantidade: number; qtTotal?: string }[];
    };

    const byPedido = new Map<string, PedidoCard>();
    for (const r of rows) {
      const statusCode = extractStatusCode(r.STATUS_PEDIDO);
      if (statusCode !== 11) continue;
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      const key = String(pedido);
      const existing = byPedido.get(key);
      const descricao = String(r.DESCRICAO || '');
      const isCimento = descricao.toLowerCase().includes('cimento');
      const statusAtual = (() => {
        const raw = String(r.STATUS_DESCRICAO || '').trim();
        if (raw) return raw;
        return 'Entrega Fracionada';
      })();
      const filialRetira = String(r.CODFILIALRETIRA || '').trim() || '-';
      const entregaRetira = entregaRetiraLabel(r.TIPOENTREGA, filialRetira);
      const ageDays = businessDaysSince(parseDateFlexible(r.DATA));
      const item = {
        codProd: Number(r.CODPROD),
        descricao,
        quantidade: Number(r.QUANTIDADE_ITEM_PEDIDO ?? 0),
        qtTotal: typeof r.QT_TOTAL === 'string' && r.QT_TOTAL.trim() ? r.QT_TOTAL.trim() : undefined,
      };
      if (!existing) {
        byPedido.set(key, {
          codCli: r.CODCLI,
          cliente: r.CLIENTE,
          pedido,
          ageDays,
          statusAtual,
          filialRetira,
          entregaRetira,
          hasCimento: isCimento,
          items: [item],
        });
      } else {
        existing.items.push(item);
        if (isCimento) existing.hasCimento = true;
        if (!existing.statusAtual && statusAtual) existing.statusAtual = statusAtual;
        if (existing.filialRetira === '-' && filialRetira !== '-') existing.filialRetira = filialRetira;
      }
    }
    return Array.from(byPedido.values());
  }, [rows]);
  const entregaFracionadaBadgeCount = entregaFracionadaPedidos.length;
  const aguardandoFornecedorPedidos = React.useMemo(() => {
    type PedidoCard = {
      codCli: number;
      cliente: string;
      pedido: number;
      ageDays: number;
      statusAtual: string;
      filialRetira: string;
      entregaRetira: string;
      hasCimento: boolean;
      items: { codProd: number; descricao: string; quantidade: number; qtTotal?: string }[];
    };

    const byPedido = new Map<string, PedidoCard>();
    for (const r of rows) {
      const statusCode = extractStatusCode(r.STATUS_PEDIDO);
      if (statusCode !== 10) continue;
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      const key = String(pedido);
      const existing = byPedido.get(key);
      const descricao = String(r.DESCRICAO || '');
      const isCimento = descricao.toLowerCase().includes('cimento');
      const statusAtual = (() => {
        const raw = String(r.STATUS_DESCRICAO || '').trim();
        if (raw) return raw;
        return 'Aguardando Fornecedor';
      })();
      const filialRetira = String(r.CODFILIALRETIRA || '').trim() || '-';
      const entregaRetira = entregaRetiraLabel(r.TIPOENTREGA, filialRetira);
      const ageDays = businessDaysSince(parseDateFlexible(r.DATA));
      const item = {
        codProd: Number(r.CODPROD),
        descricao,
        quantidade: Number(r.QUANTIDADE_ITEM_PEDIDO ?? 0),
        qtTotal: typeof r.QT_TOTAL === 'string' && r.QT_TOTAL.trim() ? r.QT_TOTAL.trim() : undefined,
      };
      if (!existing) {
        byPedido.set(key, {
          codCli: r.CODCLI,
          cliente: r.CLIENTE,
          pedido,
          ageDays,
          statusAtual,
          filialRetira,
          entregaRetira,
          hasCimento: isCimento,
          items: [item],
        });
      } else {
        existing.items.push(item);
        if (isCimento) existing.hasCimento = true;
        if (!existing.statusAtual && statusAtual) existing.statusAtual = statusAtual;
        if (existing.filialRetira === '-' && filialRetira !== '-') existing.filialRetira = filialRetira;
      }
    }
    return Array.from(byPedido.values());
  }, [rows]);
  const aguardandoFornecedorBadgeCount = aguardandoFornecedorPedidos.length;
  const totalPedidosUnicos = React.useMemo(() => {
    const seen = new Set<number>();
    for (const r of rows) {
      const pedido = Number(r.NUMERO_DO_PEDIDO_TV8);
      if (!Number.isFinite(pedido)) continue;
      seen.add(pedido);
    }
    return seen.size;
  }, [rows]);

  return (
    <div
      style={{
        fontFamily: "'Poppins', sans-serif",
        height: '100vh',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <TopBar 
        title=""
        titleClassName="d-none"
        showBack={true} 
        backLink={appUrl("/dashboard")}
      >
        <div className="d-flex align-items-center gap-4 ms-0">
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => buscarPedidosRef.current?.openConciliar()} title="Conciliar Entregas">
            <ClipboardCheck size={28} className="text-primary" />
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Conciliar</div>
              <div>Entregas</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => buscarPedidosRef.current?.openMapa()} title="Mapa">
            <MapIcon size={28} className="text-success" />
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Pesquisa</div>
              <div>no Mapa</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => buscarPedidosRef.current?.openResumo()} title="Resumo">
            <FileText size={28} className="text-secondary" />
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Resumo</div>
              <div>Pedidos</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => buscarPedidosRef.current?.openFiltros()} title="Filtros">
            <Filter size={28} className="text-secondary" />
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Filtros</div>
              <div>de Busca</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowSearchModal(true)} title="Pesquisa Avançada Cliente">
            <Search size={28} className="text-secondary" />
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Pesquisa</div>
              <div>Avançada</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowPedidosPrioridadeModal(true)} title="Pedidos Prioridade">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <StarFill size={28} className="text-warning" />
              {pedidosPrioridadeBadgeCount > 0 && (
                <span
                  className="badge bg-danger text-white"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {pedidosPrioridadeBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Pedidos</div>
              <div>Prioridade</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowRetiraPosteriorModal(true)} title="Retira Posterior">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <BoxArrowInDown size={28} className="text-danger" />
              {retiraPosteriorBadgeCount > 0 && (
                <span
                  className="badge bg-danger text-white"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {retiraPosteriorBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Retira</div>
              <div>Posterior</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowEntregaFuturaModal(true)} title="Entrega Futura">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Calendar3Week size={28} className="text-info" />
              {entregaFuturaBadgeCount > 0 && (
                <span
                  className="badge bg-danger text-white"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {entregaFuturaBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Entrega</div>
              <div>Futura</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowAguardandoRotaModal(true)} title="Aguardando Rota">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Truck size={28} className="text-primary" />
              {aguardandoRotaBadgeCount > 0 && (
                <span
                  className="badge bg-danger text-white"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {aguardandoRotaBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Aguardando</div>
              <div>Rota</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowEnviarMessejanaModal(true)} title="Enviar p/ Messejana">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <GeoAlt size={28} className="text-primary" />
              {enviarMessejanaBadgeCount > 0 && (
                <span
                  className="badge bg-danger text-white"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {enviarMessejanaBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Enviar p/</div>
              <div>Messejana</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowEntregaEspecificaModal(true)} title="Entrega Específica">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Calendar3 size={28} className="text-secondary" />
              {entregaEspecificaBadgeCount > 0 && (
                <span
                  className="badge bg-danger text-white"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {entregaEspecificaBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Entrega</div>
              <div>Específica</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowEntregaFracionadaModal(true)} title="Entrega Fracionada">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Layers size={28} className="text-secondary" />
              {entregaFracionadaBadgeCount > 0 && (
                <span
                  className="badge bg-danger text-white"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {entregaFracionadaBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Entrega</div>
              <div>Fracionada</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowIncluidoRotaModal(true)} title="Incluído em Rota">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Signpost2 size={28} className="text-primary" />
              {incluidoRotaBadgeCount > 0 && (
                <span
                  className="badge bg-danger text-white"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {incluidoRotaBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Incluído</div>
              <div>em Rota</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowAguardandoFornecedorModal(true)} title="Aguardando Fornecedor">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <BoxSeam size={28} className="text-warning" />
              {aguardandoFornecedorBadgeCount > 0 && (
                <span
                  className="badge bg-danger text-white"
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.55rem',
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {aguardandoFornecedorBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Aguardando</div>
              <div>Fornecedor</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowRoterizacaoPedidosModal(true)} title="Roterização de Pedidos">
            <Signpost2 size={28} className="text-success" />
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Roterização</div>
              <div>Pedidos</div>
            </div>
          </div>
          <div className="d-flex flex-column align-items-center" style={{ cursor: 'pointer' }} onClick={() => setShowPedidosEntreguesModal(true)} title="Pedidos Entregues">
            <Check2Circle size={28} className="text-success" />
            <div className="text-muted" style={{ fontSize: '0.60rem', lineHeight: 1, marginTop: '2px', textAlign: 'center' }}>
              <div>Pedidos</div>
              <div>Entregues</div>
            </div>
          </div>
        </div>
      </TopBar>

      <div className="container-fluid py-2" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="row gx-4" style={{ flex: 1, minHeight: 0, flexWrap: 'nowrap', alignItems: 'stretch', ['--bs-gutter-y' as any]: 0 }}>
          <div className="col d-flex" style={{ minHeight: 0, flex: '1 1 0', minWidth: 0 }}>
            <div className="card shadow-sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
              <div className="card-header py-1 d-flex justify-content-between align-items-center" style={{ minHeight: 0 }}>
                <h5 className="mb-0">Triagem de Pedidos</h5>
                <div className="d-flex align-items-center gap-2">
                  {refreshStatus.hasSearched && (
                    <span className="badge bg-secondary text-white" title="Sincronização automática" style={{ fontSize: '0.66rem' }}>
                      {refreshStatus.loading ? 'Sincronizando...' : `Atualiza em ${refreshStatus.nextRefreshIn}s`}
                    </span>
                  )}
                  {refreshStatus.hasSearched && (
                    <span className="badge bg-dark text-white" title="Total de pedidos retornados" style={{ fontSize: '0.66rem' }}>
                      Total pedidos: {totalPedidosUnicos}
                    </span>
                  )}
                </div>
              </div>
              <div className="card-body py-1" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <BuscarPedidosPorPeriodo ref={buscarPedidosRef} onResultado={(r) => setRows(r)} onExposeOpenViewer={handleExposeOpenViewer} matricula={matricula} onRefreshStatus={handleRefreshStatus} />
              </div>
            </div>
          </div>
          {hasSideCards && (
          <div className="col-auto" style={{ width: 'clamp(260px, 30vw, 360px)', display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: 0, height: '100%', overflow: 'hidden', flex: '0 0 auto' }}>
            {cardsData.map(cd => {
              const items = cd.code != null
                ? dedupeByPedido(rows.filter(r => extractStatusCode(r.STATUS_PEDIDO) === cd.code).map(r => ({ codCli: r.CODCLI, cliente: r.CLIENTE, pedido: r.NUMERO_DO_PEDIDO_TV8 })))
                : dedupeByPedido(extractByStatusDesc(rows, cd.key));
              const compact = !!cd.compact;
              const bodyFont = compact ? '0.62rem' : '0.72rem';
              const onlyCimento = cementMap[cd.title] ?? true;
              const filteredItems = onlyCimento
                ? items
                : items.filter(it => !pedidosComCimento.has(Number(it.pedido)));
              
              const visibleCount = filteredItems.length;
              const totalCardCount = items.length;

              return (
                <div key={cd.title} className="card shadow-sm" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 0', overflow: 'hidden' }}>
                  <div className="card-header py-0 px-2 d-flex align-items-center justify-content-between" style={{ fontSize: '0.72rem', minHeight: '28px' }}>
                    <span className="fw-semibold text-truncate" style={{ maxWidth: '60%' }} title={cd.title}>{cd.title}</span>
                    <div className="d-flex" style={{ gap: '4px' }}>
                       <span className="badge rounded-pill bg-primary border border-white shadow-sm" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-block', textAlign: 'center' }} title="Parcial:">Parcial: {visibleCount}</span>
                       <span className="badge rounded-pill bg-warning text-dark border border-white shadow-sm" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'inline-block', textAlign: 'center' }} title="Total:">Total: {totalCardCount}</span>
                    </div>
                  </div>
                  <div className="card-body py-1 px-2" style={{ fontSize: bodyFont, flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {filteredItems.length === 0 ? (
                      <span className="text-muted" style={{ fontSize: compact ? '0.6rem' : '0.68rem' }}>Sem registros</span>
                    ) : (
                      filteredItems.map((it, idx) => (
                        compact ? (
                          <div key={`${cd.key}-${it.codCli}-${idx}`} className="px-2 py-1 d-flex align-items-center border-bottom" style={{ gap: '8px' }}>
                            <div className="d-flex flex-column" style={{ lineHeight: 1.2 }}>
                              <span><strong>Pedido TV8:</strong> {it.pedido}</span>
                              <span><strong>Cliente:</strong> {it.cliente}</span>
                            </div>
                              <button
                                className="btn btn-outline-secondary btn-sm ms-auto py-0 px-2"
                                style={{ fontSize: '0.6rem', lineHeight: 1 }}
                                onClick={() => openViewerFn?.(Number(it.pedido))}
                              >
                                Visualizar
                              </button>
                          </div>
                        ) : (
                          <div key={`${cd.key}-${it.codCli}-${idx}`} className="px-2 py-1 border-bottom">
                            <div><strong>Pedido TV8:</strong> {it.pedido}</div>
                            <div>
                              <span><strong>Código:</strong> {it.codCli}</span>
                              <span> | </span>
                              <span><strong>Cliente:</strong> {it.cliente}</span>
                            </div>
                            <button className="btn btn-outline-secondary btn-sm mt-1" onClick={() => openViewerFn?.(Number(it.pedido))}>Visualizar</button>
                          </div>
                        )
                      ))
                    )}
                  </div>
                  <div className="card-footer py-0 d-flex align-items-center justify-content-between" style={{ fontSize: '0.65rem', minHeight: '26px' }}>
                    <span>Filtro cimento</span>
                    <div className="form-check form-switch m-0 d-flex align-items-center gap-1" style={{ fontSize: '0.65rem', minHeight: 'unset' }}>
                      <input
                        className="form-check-input m-0"
                        style={{ width: '2em', height: '1em', marginTop: '0.1em' }}
                        type="checkbox"
                        checked={onlyCimento}
                        onChange={(e) => setCementMap(prev => ({ ...prev, [cd.title]: e.target.checked }))}
                        id={`switch-cimento-${cd.code ?? cd.key}`}
                      />
                      <label className="form-check-label" htmlFor={`switch-cimento-${cd.code ?? cd.key}`} style={{ cursor: 'pointer' }}>
                        {onlyCimento ? 'Todos' : 'Oculto'}
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Card Faturar removido: disponível apenas via modal de Faturar no componente de busca */}
          </div>
          )}
        </div>
      </div>

      <footer className="bg-white text-muted border-top flex-shrink-0" style={{ fontSize: '0.72rem', lineHeight: 1.2 }}>
        <div className="container-fluid px-4 py-1 d-flex justify-content-center">
          <span>GestLOG - 2026</span>
        </div>
      </footer>
      {showSeparacaoModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos em Separação</h6>
                  <button type="button" className="btn-close" onClick={() => setShowSeparacaoModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                      const items = dedupeByPedido(rows
                        .filter(r => {
                          const c = extractStatusCode(r.STATUS_PEDIDO);
                          return c === 2 || c === 3;
                        })
                        .map(r => ({
                          codCli: r.CODCLI,
                          cliente: r.CLIENTE,
                          pedido: r.NUMERO_DO_PEDIDO_TV8,
                          statusCode: extractStatusCode(r.STATUS_PEDIDO),
                          statusDescricao: r.STATUS_DESCRICAO
                        }))
                      );

                      const s2 = items.filter(p => p.statusCode === 2);
                      const s3 = items.filter(p => p.statusCode === 3);
                      const hasAny = s2.length > 0 || s3.length > 0;

                      const renderPedidoCards = (arr: typeof items, keyPrefix: string) => (
                        <div className="d-flex flex-column gap-2 p-2">
                          {arr.map((p, idx) => (
                            <div key={`${keyPrefix}-${p.pedido}-${idx}`} className="card border-secondary">
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {p.pedido ?? '-'}
                                  </div>
                                  <div
                                    className="text-muted"
                                    style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                    title={p.cliente || ''}
                                  >
                                    {p.cliente || '-'}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge bg-secondary">Cód. Cliente: {p.codCli ?? '-'}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>
                                      Status: {p.statusDescricao || p.statusCode || '-'}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                  style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px' }}
                                  onClick={() => { setShowSeparacaoModal(false); openViewerFn?.(Number(p.pedido)); }}
                                >
                                  Visualizar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );

                      if (!hasAny) return <span className="text-muted">Sem pedidos em separação</span>;

                      return (
                        <div className="d-flex flex-column gap-2" style={{ flex: 1, minHeight: 0 }}>
                          <div className="card border-info" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <div className="card-header py-1 bg-info bg-opacity-10 text-info-emphasis fw-bold d-flex justify-content-between align-items-center" style={{ fontSize: '0.74rem' }}>
                              <span>Status 2</span>
                              <span className="badge bg-info rounded-pill">{s2.length}</span>
                            </div>
                            <div className="card-body p-0" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                              {s2.length === 0 ? <div className="p-2 text-muted text-center">Sem pedidos</div> : renderPedidoCards(s2, 'sep-s2')}
                            </div>
                          </div>

                          <div className="card border-secondary" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                            <div className="card-header py-1 bg-secondary bg-opacity-10 text-secondary-emphasis fw-bold d-flex justify-content-between align-items-center" style={{ fontSize: '0.74rem' }}>
                              <span>Status 3</span>
                              <span className="badge bg-secondary rounded-pill">{s3.length}</span>
                            </div>
                            <div className="card-body p-0" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                              {s3.length === 0 ? <div className="p-2 text-muted text-center">Sem pedidos</div> : renderPedidoCards(s3, 'sep-s3')}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowSeparacaoModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showColetaModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos de Coleta</h6>
                  <button type="button" className="btn-close" onClick={() => setShowColetaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                  {(() => {
                    const items = dedupeByPedido(rows
                      .filter(r => extractStatusCode(r.STATUS_PEDIDO) === 17)
                      .map(r => ({ codCli: r.CODCLI, cliente: r.CLIENTE, pedido: r.NUMERO_DO_PEDIDO_TV8 }))
                    );
                    if (items.length === 0) return <span className="text-muted">Sem pedidos de coleta</span>;
                    return (
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Pedido TV8</th>
                              <th>Cliente</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((g, idx) => (
                              <tr key={`col-${g.pedido}-${idx}`}>
                                <td>{g.pedido}</td>
                                <td>{g.cliente}</td>
                                <td>
                                  <button className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ fontSize: '0.62rem', lineHeight: 1 }} onClick={() => { setShowColetaModal(false); openViewerFn?.(Number(g.pedido)); }}>Visualizar</button>
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
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowColetaModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSearchModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pesquisa Avançada Cliente</h6>
                  <button type="button" className="btn-close" onClick={() => setShowSearchModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                  <div className="mb-3">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Digite nome ou código do cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {(() => {
                     if (!searchTerm.trim()) return <span className="text-muted">Digite algo para pesquisar...</span>;
                     
                     const term = searchTerm.toLowerCase();
                     const filtered = rows.filter(r => {
                        const nome = (r.CLIENTE || '').toLowerCase();
                        const cod = String(r.CODCLI || '');
                        return nome.includes(term) || cod.includes(term);
                     });
                     
                     const seen = new Set<string>();
                     const items: PedidoGestLOG[] = [];
                     for (const r of filtered) {
                        const k = String(r.NUMERO_DO_PEDIDO_TV8);
                        if (seen.has(k)) continue;
                        seen.add(k);
                        items.push(r);
                     }

                     if (items.length === 0) return <span className="text-muted">Nenhum pedido encontrado.</span>;

                    return (
                      <div className="table-responsive" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <table className="table table-sm table-hover">
                          <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                            <tr>
                              <th>Pedido TV8</th>
                              <th>Cód.</th>
                              <th>Cliente</th>
                              <th>Status</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((r, idx) => (
                              <tr key={`search-${r.NUMERO_DO_PEDIDO_TV8}-${idx}`}>
                                <td>{r.NUMERO_DO_PEDIDO_TV8}</td>
                                <td>{r.CODCLI}</td>
                                <td>{r.CLIENTE}</td>
                                <td>{r.STATUS_DESCRICAO}</td>
                                <td>
                                  <button 
                                    className="btn btn-outline-secondary btn-sm py-0 px-2" 
                                    style={{ fontSize: '0.62rem', lineHeight: 1 }} 
                                    onClick={() => { setShowSearchModal(false); openViewerFn?.(Number(r.NUMERO_DO_PEDIDO_TV8)); }}
                                  >
                                    Visualizar
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
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowSearchModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPedidosPrioridadeModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Pedidos Prioridade</h6>
                  <button type="button" className="btn-close" onClick={() => setShowPedidosPrioridadeModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div className="d-flex justify-content-end">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="onlyCimentoPedidosPrioridade"
                        checked={onlyCimentoPedidosPrioridade}
                        onChange={(e) => setOnlyCimentoPedidosPrioridade(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="onlyCimentoPedidosPrioridade" style={{ fontSize: '0.72rem' }}>
                        Apenas com cimento
                      </label>
                    </div>
                  </div>

                  {(() => {
                    const list = onlyCimentoPedidosPrioridade ? pedidosPrioridadePedidos.filter(p => p.hasCimento) : pedidosPrioridadePedidos;
                    if (list.length === 0) return <span className="text-muted">Sem pedidos prioridade</span>;
                    return (
                      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <div className="d-flex flex-column gap-2">
                          {list.map((p) => (
                            <div className="card border-secondary" key={`prioridade-${p.pedido}`}>
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {p.pedido}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.cliente}>
                                    {p.cliente}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Status atual: {p.statusAtual || '-'}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.filialRetira}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.entregaRetira}</span>
                                  </div>
                                </div>
                                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary">{p.items.length}</span>
                                    <button
                                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                      onClick={() => { setShowPedidosPrioridadeModal(false); openViewerFn?.(Number(p.pedido)); }}
                                    >
                                      <Eye size={12} />
                                      <span>Visualizar</span>
                                    </button>
                                  </div>
                                  <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                                    Dias úteis: {p.ageDays}
                                  </span>
                                </div>
                              </div>
                              <div className="card-body p-0">
                                <div className="table-responsive">
                                  <table
                                    className="mb-0 w-100"
                                    style={{
                                      fontSize: '0.70rem',
                                      borderCollapse: 'collapse',
                                      ['--bs-table-border-color' as any]: 'transparent',
                                      ['--bs-table-striped-bg' as any]: 'transparent',
                                      ['--bs-table-hover-bg' as any]: 'transparent',
                                      ['--bs-table-active-bg' as any]: 'transparent',
                                      ['--bs-table-bg' as any]: 'transparent',
                                    }}
                                  >
                                    <thead>
                                      <tr>
                                        <th style={{ width: '14%', border: 0 }}>Cód.</th>
                                        <th style={{ width: '56%', border: 0 }}>Descrição</th>
                                        <th style={{ width: '15%', border: 0 }}>Qtd</th>
                                        <th style={{ width: '15%', border: 0 }}>Qt Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {p.items.map((it, idx) => (
                                        <tr key={`prioridade-${p.pedido}-it-${it.codProd}-${idx}`}>
                                          <td style={{ border: 0 }}>{it.codProd ?? '-'}</td>
                                          <td style={{ border: 0 }}>{it.descricao || '-'}</td>
                                          <td style={{ border: 0 }}>{it.quantidade ?? '-'}</td>
                                          <td style={{ border: 0 }}>{it.qtTotal ?? '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowPedidosPrioridadeModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRetiraPosteriorModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Retira Posterior</h6>
                  <button type="button" className="btn-close" onClick={() => setShowRetiraPosteriorModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div className="d-flex justify-content-end">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="onlyCimentoRetiraPosterior"
                        checked={onlyCimentoRetiraPosterior}
                        onChange={(e) => setOnlyCimentoRetiraPosterior(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="onlyCimentoRetiraPosterior" style={{ fontSize: '0.72rem' }}>
                        Apenas com cimento
                      </label>
                    </div>
                  </div>

                  {(() => {
                    const list = onlyCimentoRetiraPosterior ? retiraPosteriorPedidos.filter(p => p.hasCimento) : retiraPosteriorPedidos;
                    if (list.length === 0) return <span className="text-muted">Sem pedidos Retira Posterior</span>;
                    return (
                      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <div className="d-flex flex-column gap-2">
                          {list.map((p) => (
                            <div className="card border-secondary" key={`retira-posterior-${p.pedido}`}>
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {p.pedido}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.cliente}>
                                    {p.cliente}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Status atual: {p.statusAtual || '-'}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.filialRetira}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.entregaRetira}</span>
                                  </div>
                                </div>
                                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary">{p.items.length}</span>
                                    <button
                                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                      onClick={() => { setShowRetiraPosteriorModal(false); openViewerFn?.(Number(p.pedido)); }}
                                    >
                                      <Eye size={12} />
                                      <span>Visualizar</span>
                                    </button>
                                  </div>
                                  <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                                    Dias úteis: {p.ageDays}
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
                                      {p.items.map((it, idx) => (
                                        <tr key={`retira-posterior-${p.pedido}-it-${it.codProd}-${idx}`}>
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
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowRetiraPosteriorModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEntregaFuturaModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Entrega Futura</h6>
                  <button type="button" className="btn-close" onClick={() => setShowEntregaFuturaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div className="d-flex justify-content-end">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="onlyCimentoEntregaFutura"
                        checked={onlyCimentoEntregaFutura}
                        onChange={(e) => setOnlyCimentoEntregaFutura(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="onlyCimentoEntregaFutura" style={{ fontSize: '0.72rem' }}>
                        Apenas com cimento
                      </label>
                    </div>
                  </div>

                  {(() => {
                    const list = onlyCimentoEntregaFutura ? entregaFuturaPedidos.filter(p => p.hasCimento) : entregaFuturaPedidos;
                    if (list.length === 0) return <span className="text-muted">Sem pedidos Entrega Futura</span>;
                    return (
                      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <div className="d-flex flex-column gap-2">
                          {list.map((p) => (
                            <div className="card border-secondary" key={`entrega-futura-${p.pedido}`}>
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {p.pedido}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.cliente}>
                                    {p.cliente}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Status atual: {p.statusAtual || '-'}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.filialRetira}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.entregaRetira}</span>
                                  </div>
                                </div>
                                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary">{p.items.length}</span>
                                    <button
                                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                      onClick={() => { setShowEntregaFuturaModal(false); openViewerFn?.(Number(p.pedido)); }}
                                    >
                                      <Eye size={12} />
                                      <span>Visualizar</span>
                                    </button>
                                  </div>
                                  <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                                    Dias úteis: {p.ageDays}
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
                                      {p.items.map((it, idx) => (
                                        <tr key={`entrega-futura-${p.pedido}-it-${it.codProd}-${idx}`}>
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
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowEntregaFuturaModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAguardandoRotaModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Aguardando Rota</h6>
                  <button type="button" className="btn-close" onClick={() => setShowAguardandoRotaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div className="d-flex justify-content-end">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="onlyCimentoAguardandoRota"
                        checked={onlyCimentoAguardandoRota}
                        onChange={(e) => setOnlyCimentoAguardandoRota(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="onlyCimentoAguardandoRota" style={{ fontSize: '0.72rem' }}>
                        Apenas com cimento
                      </label>
                    </div>
                  </div>

                  {(() => {
                    const list = onlyCimentoAguardandoRota ? aguardandoRotaPedidos.filter(p => p.hasCimento) : aguardandoRotaPedidos;
                    if (list.length === 0) return <span className="text-muted">Sem pedidos aguardando rota</span>;
                    return (
                      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <div className="d-flex flex-column gap-2">
                          {list.map((p) => (
                            <div className="card border-secondary" key={`aguardando-rota-${p.pedido}`}>
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {p.pedido}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.cliente}>
                                    {p.cliente}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Status atual: {p.statusAtual || '-'}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.filialRetira}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.entregaRetira}</span>
                                  </div>
                                </div>
                                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary">{p.items.length}</span>
                                    <button
                                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                      onClick={() => { setShowAguardandoRotaModal(false); openViewerFn?.(Number(p.pedido)); }}
                                    >
                                      <Eye size={12} />
                                      <span>Visualizar</span>
                                    </button>
                                  </div>
                                  <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                                    Dias úteis: {p.ageDays}
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
                                      {p.items.map((it, idx) => (
                                        <tr key={`aguardando-rota-${p.pedido}-it-${it.codProd}-${idx}`}>
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
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowAguardandoRotaModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEnviarMessejanaModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Enviar p/ Messejana</h6>
                  <button type="button" className="btn-close" onClick={() => setShowEnviarMessejanaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div className="d-flex justify-content-end">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="onlyCimentoEnviarMessejana"
                        checked={onlyCimentoEnviarMessejana}
                        onChange={(e) => setOnlyCimentoEnviarMessejana(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="onlyCimentoEnviarMessejana" style={{ fontSize: '0.72rem' }}>
                        Apenas com cimento
                      </label>
                    </div>
                  </div>

                  {(() => {
                    const list = onlyCimentoEnviarMessejana ? enviarMessejanaPedidos.filter(p => p.hasCimento) : enviarMessejanaPedidos;
                    if (list.length === 0) return <span className="text-muted">Sem pedidos</span>;
                    return (
                      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <div className="d-flex flex-column gap-2">
                          {list.map((p) => (
                            <div className="card border-secondary" key={`messejana-${p.pedido}`}>
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {p.pedido}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.cliente}>
                                    {p.cliente}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Status atual: {p.statusAtual || '-'}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.filialRetira}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.entregaRetira}</span>
                                  </div>
                                </div>
                                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary">{p.items.length}</span>
                                    <button
                                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                      onClick={() => { setShowEnviarMessejanaModal(false); openViewerFn?.(Number(p.pedido)); }}
                                    >
                                      <Eye size={12} />
                                      <span>Visualizar</span>
                                    </button>
                                  </div>
                                  <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                                    Dias úteis: {p.ageDays}
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
                                      {p.items.map((it, idx) => (
                                        <tr key={`messejana-${p.pedido}-it-${it.codProd}-${idx}`}>
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
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowEnviarMessejanaModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEntregaEspecificaModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Entrega Específica</h6>
                  <button type="button" className="btn-close" onClick={() => setShowEntregaEspecificaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div className="d-flex justify-content-end">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="onlyCimentoEntregaEspecifica"
                        checked={onlyCimentoEntregaEspecifica}
                        onChange={(e) => setOnlyCimentoEntregaEspecifica(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="onlyCimentoEntregaEspecifica" style={{ fontSize: '0.72rem' }}>
                        Apenas com cimento
                      </label>
                    </div>
                  </div>

                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                    const applyFilter = (arr: typeof entregaEspecificaPedidos.dia) => (onlyCimentoEntregaEspecifica ? arr.filter(p => p.hasCimento) : arr);
                    const dia = applyFilter(entregaEspecificaPedidos.dia);
                    const horario = applyFilter(entregaEspecificaPedidos.horario);
                    const hasAny = dia.length > 0 || horario.length > 0;

                    const renderPedidoCards = (arr: typeof dia, keyPrefix: string) => {
                      const sorted = [...arr].sort((a, b) => (b.ageDays - a.ageDays) || String(a.pedido).localeCompare(String(b.pedido)));
                      return (
                      <div className="d-flex flex-column gap-2 p-2">
                        {sorted.map((p) => (
                          <div key={`${keyPrefix}-${p.pedido}`} className="card border-secondary">
                            <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                              <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                  Pedido TV8: {p.pedido}
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.cliente}>
                                  {p.cliente}
                                </div>
                                <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                  <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Status atual: {p.statusAtual || '-'}</span>
                                  <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.filialRetira}</span>
                                  <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.entregaRetira}</span>
                                </div>
                              </div>
                              <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                <div className="d-flex align-items-center gap-2">
                                  <span className="badge bg-secondary">{p.items.length}</span>
                                  <button
                                    className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                    style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                    onClick={() => { setShowEntregaEspecificaModal(false); openViewerFn?.(Number(p.pedido)); }}
                                  >
                                    <Eye size={12} />
                                    <span>Visualizar</span>
                                  </button>
                                </div>
                                <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                                  Dias úteis: {p.ageDays}
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
                                    {p.items.map((it, idx) => (
                                      <tr key={`${keyPrefix}-${p.pedido}-it-${it.codProd}-${idx}`}>
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

                    if (!hasAny) return <span className="text-muted">Sem pedidos</span>;

                    return (
                      <div className="d-flex flex-column" style={{ flex: 1, minHeight: 0, gap: '8px' }}>
                        <ul className="nav nav-tabs" style={{ fontSize: '0.72rem' }}>
                          <li className="nav-item">
                            <button
                              type="button"
                              className={`nav-link ${entregaEspecificaTab === 'dia' ? 'active' : ''}`}
                              onClick={() => setEntregaEspecificaTab('dia')}
                            >
                              Entrega em dia Específico <span className="badge bg-info rounded-pill ms-1">{dia.length}</span>
                            </button>
                          </li>
                          <li className="nav-item">
                            <button
                              type="button"
                              className={`nav-link ${entregaEspecificaTab === 'horario' ? 'active' : ''}`}
                              onClick={() => setEntregaEspecificaTab('horario')}
                            >
                              Entrega em horário Específico <span className="badge bg-secondary rounded-pill ms-1">{horario.length}</span>
                            </button>
                          </li>
                        </ul>

                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                          {entregaEspecificaTab === 'dia' && (
                            dia.length === 0
                              ? <div className="p-2 text-muted text-center">Sem pedidos</div>
                              : renderPedidoCards(dia, 'dia-especifico')
                          )}
                          {entregaEspecificaTab === 'horario' && (
                            horario.length === 0
                              ? <div className="p-2 text-muted text-center">Sem pedidos</div>
                              : renderPedidoCards(horario, 'horario-especifico')
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowEntregaEspecificaModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEntregaFracionadaModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Entrega Fracionada</h6>
                  <button type="button" className="btn-close" onClick={() => setShowEntregaFracionadaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div className="d-flex justify-content-end">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="onlyCimentoEntregaFracionada"
                        checked={onlyCimentoEntregaFracionada}
                        onChange={(e) => setOnlyCimentoEntregaFracionada(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="onlyCimentoEntregaFracionada" style={{ fontSize: '0.72rem' }}>
                        Apenas com cimento
                      </label>
                    </div>
                  </div>

                  {(() => {
                    const list = onlyCimentoEntregaFracionada ? entregaFracionadaPedidos.filter(p => p.hasCimento) : entregaFracionadaPedidos;
                    if (list.length === 0) return <span className="text-muted">Sem pedidos</span>;
                    return (
                      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <div className="d-flex flex-column gap-2">
                          {list.map((p) => (
                            <div className="card border-secondary" key={`entrega-fracionada-${p.pedido}`}>
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {p.pedido}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.cliente}>
                                    {p.cliente}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Status atual: {p.statusAtual || '-'}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.filialRetira}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.entregaRetira}</span>
                                  </div>
                                </div>
                                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary">{p.items.length}</span>
                                    <button
                                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                      onClick={() => { setShowEntregaFracionadaModal(false); openViewerFn?.(Number(p.pedido)); }}
                                    >
                                      <Eye size={12} />
                                      <span>Visualizar</span>
                                    </button>
                                  </div>
                                  <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                                    Dias úteis: {p.ageDays}
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
                                      {p.items.map((it, idx) => (
                                        <tr key={`entrega-fracionada-${p.pedido}-it-${it.codProd}-${idx}`}>
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
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowEntregaFracionadaModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showIncluidoRotaModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Incluído em Rota</h6>
                  <button type="button" className="btn-close" onClick={() => setShowIncluidoRotaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div className="d-flex justify-content-end">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="onlyCimentoIncluidoRota"
                        checked={onlyCimentoIncluidoRota}
                        onChange={(e) => setOnlyCimentoIncluidoRota(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="onlyCimentoIncluidoRota" style={{ fontSize: '0.72rem' }}>
                        Apenas com cimento
                      </label>
                    </div>
                  </div>

                  {(() => {
                    const list = onlyCimentoIncluidoRota ? incluidoRotaPedidos.filter(p => p.hasCimento) : incluidoRotaPedidos;
                    if (list.length === 0) return <span className="text-muted">Sem pedidos</span>;
                    return (
                      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <div className="d-flex flex-column gap-2">
                          {list.map((p) => (
                            <div className="card border-secondary" key={`incluido-rota-${p.pedido}`}>
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {p.pedido}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.cliente}>
                                    {p.cliente}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Status atual: {p.statusAtual || '-'}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.filialRetira}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.entregaRetira}</span>
                                  </div>
                                </div>
                                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary">{p.items.length}</span>
                                    <button
                                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                      onClick={() => { setShowIncluidoRotaModal(false); openViewerFn?.(Number(p.pedido)); }}
                                    >
                                      <Eye size={12} />
                                      <span>Visualizar</span>
                                    </button>
                                  </div>
                                  <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                                    Dias úteis: {p.ageDays}
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
                                      {p.items.map((it, idx) => (
                                        <tr key={`incluido-rota-${p.pedido}-it-${it.codProd}-${idx}`}>
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
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowIncluidoRotaModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAguardandoFornecedorModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title" style={{ fontSize: '0.85rem' }}>Aguardando Fornecedor</h6>
                  <button type="button" className="btn-close" onClick={() => setShowAguardandoFornecedorModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
                  <div className="d-flex justify-content-end">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="onlyCimentoAguardandoFornecedor"
                        checked={onlyCimentoAguardandoFornecedor}
                        onChange={(e) => setOnlyCimentoAguardandoFornecedor(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="onlyCimentoAguardandoFornecedor" style={{ fontSize: '0.72rem' }}>
                        Apenas com cimento
                      </label>
                    </div>
                  </div>

                  {(() => {
                    const list = onlyCimentoAguardandoFornecedor ? aguardandoFornecedorPedidos.filter(p => p.hasCimento) : aguardandoFornecedorPedidos;
                    if (list.length === 0) return <span className="text-muted">Sem pedidos</span>;
                    return (
                      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        <div className="d-flex flex-column gap-2">
                          {list.map((p) => (
                            <div className="card border-secondary" key={`aguardando-fornecedor-${p.pedido}`}>
                              <div className="card-header py-1 d-flex justify-content-between align-items-start" style={{ gap: '10px' }}>
                                <div className="d-flex flex-column" style={{ gap: '4px', minWidth: 0 }}>
                                  <div className="fw-bold" style={{ fontSize: '0.80rem', lineHeight: 1.1 }}>
                                    Pedido TV8: {p.pedido}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.cliente}>
                                    {p.cliente}
                                  </div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Status atual: {p.statusAtual || '-'}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Filial retira: {p.filialRetira}</span>
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#212529' }}>Entrega/Retira: {p.entregaRetira}</span>
                                  </div>
                                </div>
                                <div className="d-flex flex-column align-items-end" style={{ gap: '4px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-secondary">{p.items.length}</span>
                                    <button
                                      className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center justify-content-center"
                                      style={{ fontSize: '0.62rem', lineHeight: 1, minWidth: '92px', gap: '6px' }}
                                      onClick={() => { setShowAguardandoFornecedorModal(false); openViewerFn?.(Number(p.pedido)); }}
                                    >
                                      <Eye size={12} />
                                      <span>Visualizar</span>
                                    </button>
                                  </div>
                                  <span className="badge" style={{ backgroundColor: '#212529', color: '#fff', fontSize: '0.66rem', lineHeight: 1, padding: '2px 5px', borderRadius: '999px', minWidth: '92px' }}>
                                    Dias úteis: {p.ageDays}
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
                                      {p.items.map((it, idx) => (
                                        <tr key={`aguardando-fornecedor-${p.pedido}-it-${it.codProd}-${idx}`}>
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
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={() => setShowAguardandoFornecedorModal(false)}>Fechar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPedidosEntreguesModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0 }}>
                <div className="modal-header py-1">
                  <h6 className="modal-title d-flex align-items-center" style={{ fontSize: '0.85rem', gap: '6px' }}>
                    <Check2Circle size={16} className="text-success" />
                    <span>Pedidos Entregues</span>
                  </h6>
                  <button type="button" className="btn-close" onClick={() => setShowPedidosEntreguesModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
                  <div className="d-flex align-items-end justify-content-between gap-2 flex-wrap">
                    <div className="d-flex align-items-end gap-2 flex-wrap">
                      <div>
                        <label className="form-label mb-0 d-flex align-items-center" style={{ fontSize: '0.70rem', gap: '6px' }}>
                          <CalendarRange size={14} className="text-secondary" />
                          <span>Data início</span>
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={pedidosEntreguesDataInicio}
                          onChange={(e) => setPedidosEntreguesDataInicio(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label mb-0 d-flex align-items-center" style={{ fontSize: '0.70rem', gap: '6px' }}>
                          <CalendarRange size={14} className="text-secondary" />
                          <span>Data fim</span>
                        </label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={pedidosEntreguesDataFim}
                          onChange={(e) => setPedidosEntreguesDataFim(e.target.value)}
                        />
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ minWidth: '88px' }}
                        onClick={loadPedidosEntregues}
                        disabled={loadingPedidosEntregues}
                      >
                        <span className="d-inline-flex align-items-center" style={{ gap: '6px' }}>
                          <Search size={14} />
                          <span>{loadingPedidosEntregues ? 'Buscando...' : 'Buscar'}</span>
                        </span>
                      </button>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-dark text-white d-inline-flex align-items-center" style={{ fontSize: '0.66rem', gap: '6px' }}>
                        <FileText size={12} />
                        <span>Total: {pedidosEntreguesTotal}</span>
                      </span>
                      {errorPedidosEntregues && (
                        <span className="badge bg-danger text-white" style={{ fontSize: '0.66rem' }} title={errorPedidosEntregues}>Erro</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
                    <div className="card shadow-sm" style={{ width: 'clamp(320px, 34vw, 420px)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <div className="card-header py-1 d-flex align-items-center justify-content-between">
                        <div className="fw-semibold d-flex align-items-center" style={{ fontSize: '0.78rem', gap: '6px' }}>
                          <Calendar3Week size={14} className="text-primary" />
                          <span>Pedidos por envio</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          {loadingPedidosEntregues && <div className="spinner-border spinner-border-sm text-secondary" role="status" aria-label="Carregando"></div>}
                          <span className="badge bg-secondary" style={{ fontSize: '0.66rem' }}>{pedidosEntreguesRows.length}</span>
                        </div>
                      </div>
                      <div className="card-body p-0" style={{ overflowY: 'auto', minHeight: 0 }}>
                        {errorPedidosEntregues ? (
                          <div className="p-2 text-danger">{errorPedidosEntregues}</div>
                        ) : pedidosEntreguesRows.length === 0 ? (
                          <div className="p-2 text-muted">Sem registros no período</div>
                        ) : (
                          pedidosEntreguesRows.map((r, idx) => {
                            const num = Number(r?.NUM_PEDIDO ?? 0);
                            const selected = selectedPedidoEntregue != null && num === selectedPedidoEntregue;
                            const fotosCount = [
                              !!r?.TEM_FOTO_NFE,
                              !!r?.TEM_FOTO_MERCADORIA,
                              !!r?.TEM_FOTO_LOCAL,
                              !!r?.TEM_FOTO_RESIDENCIA,
                              !!r?.TEM_FOTO_VALOR_RECEBIDO,
                              !!r?.TEM_FOTO_COMPROVANTE,
                            ].filter(Boolean).length;
                            return (
                              <div
                                key={`ped-ent-${num}-${idx}`}
                                className={`px-2 py-2 border-bottom ${selected ? 'bg-primary text-white' : ''}`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => { if (num > 0) loadDetalhesPedidoEntregue(num); }}
                              >
                                <div className="d-flex align-items-center justify-content-between" style={{ gap: '8px' }}>
                                  <div className="fw-bold d-flex align-items-center" style={{ fontSize: '0.78rem', gap: '6px' }}>
                                    <FileText size={14} />
                                    <span>Pedido: {num || '-'}</span>
                                  </div>
                                  <span className={`badge ${selected ? 'bg-light text-primary' : 'bg-primary'} d-inline-flex align-items-center`} style={{ fontSize: '0.62rem', gap: '6px' }}>
                                    <Camera size={12} />
                                    <span>Fotos: {fotosCount}</span>
                                  </span>
                                </div>
                                <div className={selected ? 'text-white-50' : 'text-muted'} style={{ fontSize: '0.70rem', lineHeight: 1.2 }}>
                                  <div title={String(r?.CLIENTE || '')} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {r?.CLIENTE || '-'}
                                  </div>
                                  <div className="d-flex align-items-center justify-content-between" style={{ gap: '8px' }}>
                                    <span title={String(r?.ENTREGADOR || '')} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {r?.ENTREGADOR || '-'}
                                    </span>
                                    <span style={{ whiteSpace: 'nowrap' }}>{r?.DATA_HORA || '-'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="card shadow-sm" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <div className="card-header py-1 d-flex align-items-center justify-content-between">
                        <div className="fw-semibold d-flex align-items-center" style={{ fontSize: '0.78rem', gap: '6px' }}>
                          <Eye size={14} className="text-primary" />
                          <span>{selectedPedidoEntregue ? `Pedido ${selectedPedidoEntregue}` : 'Selecione um pedido'}</span>
                        </div>
                        {loadingPedidoEntregueDetalhes && <div className="spinner-border spinner-border-sm text-secondary" role="status" aria-label="Carregando"></div>}
                      </div>
                      <div className="card-body" style={{ overflowY: 'auto', minHeight: 0 }}>
                        {errorPedidoEntregueDetalhes && (
                          <div className="alert alert-danger py-1 mb-2" style={{ fontSize: '0.74rem' }}>{errorPedidoEntregueDetalhes}</div>
                        )}

                        {!selectedPedidoEntregue ? (
                          <div className="text-muted">Clique em um pedido na lista para carregar dados e fotos.</div>
                        ) : (
                          <>
                            {(() => {
                              const head = pedidoEntregueDadosRows[0] || null;
                              if (!head) return <div className="text-muted">Sem dados do pedido.</div>;
                              return (
                                <div className="mb-2">
                                  <div className="fw-bold" style={{ fontSize: '0.82rem' }}>{head.CLIENTE || '-'}</div>
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    <span className="badge bg-secondary">Cód. Cliente: {head.CODCLI ?? '-'}</span>
                                    <span className="badge bg-secondary">Filial: {head.CODFILIAL ?? '-'}</span>
                                    <span className="badge bg-secondary">Cobrança: {head.COBRANCA ?? '-'}</span>
                                    <span className="badge bg-secondary">Vendedor: {head.VENDEDOR ?? '-'}</span>
                                    <span className="badge bg-warning text-dark">Posição: {head.POSICAO ?? '-'}</span>
                                    <span className="badge bg-info text-dark">Data: {head.DATA ?? '-'}</span>
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="mb-2">
                              <div className="fw-semibold mb-1 d-flex align-items-center" style={{ fontSize: '0.78rem', gap: '6px' }}>
                                <BoxSeam size={14} className="text-primary" />
                                <span>Itens</span>
                              </div>
                              {pedidoEntregueDadosRows.length === 0 ? (
                                <div className="text-muted">Sem itens.</div>
                              ) : (
                                <div className="table-responsive">
                                  <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.70rem' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ width: '10%' }}>Cód</th>
                                        <th style={{ width: '55%' }}>Descrição</th>
                                        <th style={{ width: '12%' }}>Qtd</th>
                                        <th style={{ width: '23%' }}>Qt Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pedidoEntregueDadosRows.slice(0, 80).map((it, idx) => (
                                        <tr key={`it-ent-${selectedPedidoEntregue}-${it.CODPROD ?? 'x'}-${idx}`}>
                                          <td>{it.CODPROD ?? '-'}</td>
                                          <td title={String(it.DESCRICAO || '')} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0 }}>
                                            {it.DESCRICAO || '-'}
                                          </td>
                                          <td>{it.QUANTIDADE_ITEM_PEDIDO ?? '-'}</td>
                                          <td>{it.QT_TOTAL ?? '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="fw-semibold mb-1 d-flex align-items-center" style={{ fontSize: '0.78rem', gap: '6px' }}>
                                <Camera size={14} className="text-primary" />
                                <span>Fotos</span>
                              </div>
                              {(() => {
                                const f = pedidoEntregueFotosRows[0] || null;
                                if (!f) return <div className="text-muted">Sem fotos cadastradas para este pedido.</div>;
                                if (fotosItems.length === 0) return <div className="text-muted">Nenhuma foto disponível.</div>;
                                const anyLoading = fotosItems.some((it) => fotoStatusByUrl[toThumbUrl(String(it.url))] === 'loading');

                                return (
                                  <>
                                    {anyLoading && (
                                      <div className="d-flex align-items-center gap-2 mb-2">
                                        <div className="spinner-border spinner-border-sm text-primary" role="status" aria-label="Carregando fotos"></div>
                                        <span className="text-muted">Carregando fotos...</span>
                                      </div>
                                    )}
                                    <div className="row g-2">
                                    {fotosItems.map((p) => {
                                      const url = String(p.url);
                                      const thumbUrl = toThumbUrl(url);
                                      const st = fotoStatusByUrl[thumbUrl] || 'loading';
                                      return (
                                      <div key={`foto-${selectedPedidoEntregue}-${p.key}`} className="col-6 col-md-4 col-xl-3">
                                        <button
                                          type="button"
                                          className="btn p-0 text-start w-100"
                                          onClick={() => {
                                            setFotoFullscreenUrl(url);
                                            setFotoFullscreenLabel(String(p.label || 'Foto'));
                                            setFotoFullscreenError(null);
                                            setFotoFullscreenLoading(true);
                                            setShowFotoFullscreen(true);
                                          }}
                                        >
                                          <div className="border rounded p-1 position-relative" style={{ background: '#fff' }}>
                                            <div className="text-muted" style={{ fontSize: '0.66rem', lineHeight: 1, marginBottom: '4px' }}>{p.label}</div>
                                            <img
                                              src={thumbUrl}
                                              alt={p.label}
                                              loading="lazy"
                                              decoding="async"
                                              fetchPriority="low"
                                              onLoad={() => setFotoStatusByUrl((prev) => ({ ...prev, [thumbUrl]: 'loaded' }))}
                                              onError={() => setFotoStatusByUrl((prev) => ({ ...prev, [thumbUrl]: 'error' }))}
                                              style={{
                                                width: '100%',
                                                height: '120px',
                                                objectFit: 'cover',
                                                borderRadius: '4px',
                                                opacity: st === 'loaded' ? 1 : 0.35,
                                              }}
                                            />
                                            {st === 'loading' && (
                                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <div className="spinner-border text-primary" role="status" aria-label="Carregando foto"></div>
                                              </div>
                                            )}
                                            {st === 'error' && (
                                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span className="badge bg-danger">Erro ao carregar</span>
                                              </div>
                                            )}
                                          </div>
                                        </button>
                                      </div>
                                    );
                                    })}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2 d-inline-flex align-items-center" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px', gap: '6px' }} onClick={() => setShowPedidosEntreguesModal(false)}>
                    <XCircle size={14} />
                    <span>Fechar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFotoFullscreen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.82)', zIndex: 1075 }}>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1080 }}>
            <div className="modal-dialog" style={{ width: '100vw', maxWidth: '100vw', height: '100vh', margin: 0 }}>
              <div className="modal-content" style={{ height: '100vh', borderRadius: 0, background: '#000' }}>
                <div className="modal-header py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                  <h6 className="modal-title d-flex align-items-center" style={{ fontSize: '0.85rem', color: '#fff', gap: '6px' }}>
                    <Eye size={14} />
                    <span>{fotoFullscreenLabel || 'Foto'}</span>
                  </h6>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowFotoFullscreen(false)}></button>
                </div>
                <div className="modal-body p-0" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {fotoFullscreenLoading && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="spinner-border text-light" role="status" aria-label="Carregando foto"></div>
                    </div>
                  )}
                  {fotoFullscreenError && (
                    <div className="text-white p-3">{fotoFullscreenError}</div>
                  )}
                  <img
                    src={fotoFullscreenUrl}
                    alt={fotoFullscreenLabel || 'Foto'}
                    onLoad={() => setFotoFullscreenLoading(false)}
                    onError={() => { setFotoFullscreenLoading(false); setFotoFullscreenError('Falha ao carregar a imagem'); }}
                    style={{
                      maxWidth: '100vw',
                      maxHeight: 'calc(100vh - 44px)',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: fotoFullscreenError ? 'none' : 'block',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <TelaGeralRotas show={showRoterizacaoPedidosModal} onClose={() => setShowRoterizacaoPedidosModal(false)} />
    </div>
  );
};

export default GestLOG;
