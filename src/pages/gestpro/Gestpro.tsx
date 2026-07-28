import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Gestpro.css";
import TopBar from "../../components/TopBar";
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { ArrowLeft, ArrowLeftRight, ArrowRepeat, BoxArrowUpRight, BoxSeam, CashCoin, ClipboardCheck, GeoAlt, House, Key, PersonX, Scissors, Search, StarFill, Truck } from "react-bootstrap-icons";
import { buscarComissaoPorLiquidez } from "../../services/gestpro/ComissaoPorLiquidez";
import type { ComissaoPorLiquidezRow } from "../../services/gestpro/ComissaoPorLiquidez";
import { buscarEmAbertoMesAtual } from "../../services/gestpro/EmAbertoMesAtual";
import type { EmAbertoRow } from "../../services/gestpro/EmAbertoMesAtual";
import { buscarComissoesPorFreteMesAtual } from "../../services/gestpro/ComissoesPorFreteMesAtual";
import type { FretePorLiquidezResumoRow } from "../../services/gestpro/ComissoesPorFreteMesAtual";
import { buscarComissoesPorFreteMesAnterior } from "../../services/gestpro/ComissoesPorFreteMesAnterior";
import FreteModal from "./FreteModal";
import LiquidezModal from "./LiquidezModal";
import EmAbertoModal from "./EmAbertoModal";
import ModalBuscaAvancadaDescricaoGestpro from "./ModalBuscaAvancadaDescricaoGestpro";
import ProdutosDisponiveisModal from "./ProdutosDisponiveisModal";
import AjusteEstoqueModal from "./components/modals/AjusteEstoqueModal";
import TokensPrecoFixoModal from "./TokensPrecoFixoModal";
import LocalizacaoEntregaModal from "../../components/gestlog/LocalizacaoEntregaModal";
import ConfirmarEnvioModal from "../../components/gestlog/modals/ConfirmarEnvioModal";
import type { PedidoDetalhe } from "../../components/gestlog/VisualizarPedido";
import PedidosParaAnaliseModal from "./components/modals/PedidosParaAnaliseModal";
import PegarLocalizacaoCard from "./components/cards/PegarLocalizacaoCard";
import CortePendenciasCard from "./components/cards/CortePendenciasCard";
import ColetaPendenciasCard from "./components/cards/ColetaPendenciasCard";
import ColetaSeparandoPendenciasCard from "./components/cards/ColetaSeparandoPendenciasCard";
import AguardandoFornecedorPendenciasCard from "./components/cards/AguardandoFornecedorPendenciasCard";
import SoFaturarSidebarModal from "./components/modals/SoFaturarSidebarModal";
import CorteRealizadoPendenciasCard from "./components/cards/CorteRealizadoPendenciasCard";
import { buscarDuplicatasEmAbertoMesAtual } from "../../services/gestpro/DuplicatasEmAbertoMesAtual";
import type { DuplicataAbertaRow } from "../../services/gestpro/DuplicatasEmAbertoMesAtual";
import { buscarDuplicatasEmAbertoMesAnterior } from "../../services/gestpro/DuplicatasEmAbertoMesAnterior";
import type { DuplicataAbertaAnteriorRow } from "../../services/gestpro/DuplicatasEmAbertoMesAnterior";
import { buscarComissaoPorLiquidezMesAnterior } from "../../services/gestpro/ComissaoPorLiquidezMesAnterior";
import type { ComissaoPorLiquidezMesAnteriorRow } from "../../services/gestpro/ComissaoPorLiquidezMesAnterior";
import { buscarEmAbertoMesAnterior } from "../../services/gestpro/EmAbertoMesAnterior";
import type { EmAbertoMesAnteriorRow } from "../../services/gestpro/EmAbertoMesAnterior";
import ClientesSemVendaModal from "./components/modals/ClientesSemVendaModal";
import ConciliacaoTV7Modal from "./ConciliacaoTV7Modal";
import PedidosPrioridadeModal from "./PedidosPrioridadeModal";
import RetMessejanaSidebarModal from "./components/modals/RetMessejanaSidebarModal";

import { appUrl } from "../../utils/appUrl";
// Helper functions for Qtd Total calculation
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
    let sign: 1n | -1n = 1n;
    if (s.startsWith('-')) sign = -1n;
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

const fromScaledToString = (scaled: bigint): string => {
  const neg = scaled < 0n;
  const abs = neg ? -scaled : scaled;
  const intPart = abs / SCALE;
  let fracPart = (abs % SCALE).toString().padStart(6, '0');
  fracPart = fracPart.replace(/0+$/, '');
  const base = fracPart.length ? `${intPart.toString()}.${fracPart}` : intPart.toString();
  return neg ? `-${base}` : base;
};

const calcQtdTotal = (qtd: number | string, multiplo: number | string): string => {
  const qScaled = toScaled(qtd);
  const mScaled = toScaled(multiplo);
  if (qScaled == null || mScaled == null) return '-';
  const totalScaled = (qScaled * mScaled) / SCALE;
  return fromScaledToString(totalScaled);
};

interface PendenciaGestproRow {
  NUMPED: number;
  NUMPEDENTFUT?: number;
  CODCLI: number;
  CLIENTE: string;
  VLTOTAL: number;
  CODFILIAL: string;
  DATA: string;
  CODUSUR: number;
  LOG2: string;
  TIPOENTREGA?: string;
  CODFILIALRETIRA?: string;
  POSICAO: string;
  CODPROD: number;
  QT: number;
  DESCRICAO: string;
  CODAUXILIAR: string;
  MULTIPLO?: number;
  EMBALAGEMMASTER?: number;
  MOTIVO_CORTE?: string;
  NOME?: string;
  ENDERENT?: string;
  NUMEROENT?: string;
  BAIRROENT?: string;
  MUNICENT?: string;
  CEP?: string;
}

interface Usuario {
  usuario?: string;
  matricula?: string;
  codfilial?: string;
  codusur?: number;
  CODUSUR?: number;
  MATRICULA?: string;
  CODFILIAL?: string;
}

interface CampanhaVendasMesAnteriorRow {
  [key: string]: unknown;
}

type CampanhaVendasOffset = 0 | 1 | 2;

type ComissoesPorFreteResumoRow = {
  CODUSUR: number;
  VENDEDOR: string;
  QTD_VENDAS_FRETE: number;
  VALOR_FRETE_TOTAL: number;
};

const currency = (value: number | null | undefined) => {
  const n = Number(value ?? 0);
  return isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";
};

const dateBR = (d: unknown): string => {
  if (d == null) return "—";
  try {
    const dt = typeof d === "string" || typeof d === "number" ? new Date(d) : d instanceof Date ? d : null;
    if (!dt || isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
};

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

const Gestpro: React.FC = () => {
  const tooltipContainer = typeof document !== "undefined" ? document.body : undefined;
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
  const buscaDescBadgeCount = 0;
  const produtosDisponiveisBadgeCount = 0;
  const tokensPrecoFixoBadgeCount = 0;
  const clientesSemVendaBadgeCount = 0;
  const conciliacaoTV7BadgeCount = 0;
  const pedidosPrioridadeBadgeCount = 0;
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [comissoes, setComissoes] = useState<ComissaoPorLiquidezRow[]>([]);
  const [loadingComissoes, setLoadingComissoes] = useState<boolean>(false);
  const [errorComissoes, setErrorComissoes] = useState<string | null>(null);
  const [showLiquidez, setShowLiquidez] = useState<boolean>(false);
  const [comissoesAnterior, setComissoesAnterior] = useState<ComissaoPorLiquidezMesAnteriorRow[]>([]);
  const [loadingComissoesAnterior, setLoadingComissoesAnterior] = useState<boolean>(false);
  const [errorComissoesAnterior, setErrorComissoesAnterior] = useState<string | null>(null);
  const [showLiquidezAnterior, setShowLiquidezAnterior] = useState<boolean>(false);

  const [emAberto, setEmAberto] = useState<EmAbertoRow[]>([]);
  const [loadingEmAberto, setLoadingEmAberto] = useState<boolean>(false);
  const [errorEmAberto, setErrorEmAberto] = useState<string | null>(null);
  const [showEmAberto, setShowEmAberto] = useState<boolean>(false);
  const [emAbertoAnterior, setEmAbertoAnterior] = useState<EmAbertoMesAnteriorRow[]>([]);
  const [loadingEmAbertoAnterior, setLoadingEmAbertoAnterior] = useState<boolean>(false);
  const [errorEmAbertoAnterior, setErrorEmAbertoAnterior] = useState<string | null>(null);
  const [showEmAbertoAnterior, setShowEmAbertoAnterior] = useState<boolean>(false);
  const [showCarteiraClientes, setShowCarteiraClientes] = useState<boolean>(false);
  const [emAbertoCarteira, setEmAbertoCarteira] = useState<EmAbertoRow[]>([]);

  const [frete, setFrete] = useState<FretePorLiquidezResumoRow[]>([]);
  const [loadingFrete, setLoadingFrete] = useState<boolean>(false);
  const [errorFrete, setErrorFrete] = useState<string | null>(null);
  const [showFrete, setShowFrete] = useState<boolean>(false);
  const [freteAnterior, setFreteAnterior] = useState<FretePorLiquidezResumoRow[]>([]);
  const [loadingFreteAnterior, setLoadingFreteAnterior] = useState<boolean>(false);
  const [errorFreteAnterior, setErrorFreteAnterior] = useState<string | null>(null);
  const [showFreteAnterior, setShowFreteAnterior] = useState<boolean>(false);
  const [freteEmAbertoAtual, setFreteEmAbertoAtual] = useState<FretePorLiquidezResumoRow[]>([]);
  const [loadingFreteEmAbertoAtual, setLoadingFreteEmAbertoAtual] = useState<boolean>(false);
  const [errorFreteEmAbertoAtual, setErrorFreteEmAbertoAtual] = useState<string | null>(null);
  const [showFreteEmAbertoAtual, setShowFreteEmAbertoAtual] = useState<boolean>(false);
  const [freteEmAbertoAnterior, setFreteEmAbertoAnterior] = useState<FretePorLiquidezResumoRow[]>([]);
  const [loadingFreteEmAbertoAnterior, setLoadingFreteEmAbertoAnterior] = useState<boolean>(false);
  const [errorFreteEmAbertoAnterior, setErrorFreteEmAbertoAnterior] = useState<string | null>(null);
  const [showFreteEmAbertoAnterior, setShowFreteEmAbertoAnterior] = useState<boolean>(false);
  const [showBuscaAvancadaProd, setShowBuscaAvancadaProd] = useState<boolean>(false);
  const [showProdutosDisponiveis, setShowProdutosDisponiveis] = useState<boolean>(false);
  const [showAjusteEstoque, setShowAjusteEstoque] = useState<boolean>(false);
  const [showTokensPrecoFixo, setShowTokensPrecoFixo] = useState<boolean>(false);
  const [showClientesSemVenda, setShowClientesSemVenda] = useState<boolean>(false);

  const [showPegarLocalizacao, setShowPegarLocalizacao] = useState<boolean>(false);
  const [showCortePendencias, setShowCortePendencias] = useState<boolean>(false);
  const [showCorteRealizadoPendencias, setShowCorteRealizadoPendencias] = useState<boolean>(false);
  const [showColetaPendencias, setShowColetaPendencias] = useState<boolean>(false);
  const [showColetaSeparandoPendencias, setShowColetaSeparandoPendencias] = useState<boolean>(false);
  const [showAguardandoFornecedorPendencias, setShowAguardandoFornecedorPendencias] = useState<boolean>(false);
  const [hasPendencias, setHasPendencias] = useState<boolean>(false);
  const [pendencias, setPendencias] = useState<PendenciaGestproRow[]>([]);
  const [loadingPendencias, setLoadingPendencias] = useState<boolean>(false);
  const [errorPendencias, setErrorPendencias] = useState<string | null>(null);
  const pendenciasLocalizacaoCount = useMemo(() => {
    const set = new Set<number>();
    pendencias.forEach(p => {
      if (String(p.LOG2) !== "14") return;
      const n = Number((p as any)?.NUMPED);
      if (!Number.isFinite(n)) return;
      set.add(n);
    });
    return set.size;
  }, [pendencias]);
  const pendenciasCorteCount = useMemo(() => {
    const set = new Set<number>();
    pendencias.forEach(p => {
      if (String(p.LOG2) !== "13") return;
      const n = Number((p as any)?.NUMPED);
      if (!Number.isFinite(n)) return;
      set.add(n);
    });
    return set.size;
  }, [pendencias]);
  const pendenciasCorteRealizadoCount = useMemo(() => {
    const set = new Set<number>();
    pendencias.forEach(p => {
      if (String(p.LOG2) !== "22") return;
      const n = Number((p as any)?.NUMPED);
      if (!Number.isFinite(n)) return;
      set.add(n);
    });
    return set.size;
  }, [pendencias]);
  const pendenciasColetaCount = useMemo(() => {
    const set = new Set<number>();
    pendencias.forEach(p => {
      if (String(p.LOG2) !== "17") return;
      const n = Number((p as any)?.NUMPED);
      if (!Number.isFinite(n)) return;
      set.add(n);
    });
    return set.size;
  }, [pendencias]);
  const pendenciasColetaSeparandoCount = useMemo(() => {
    const set = new Set<number>();
    pendencias.forEach(p => {
      if (String(p.LOG2) !== "21") return;
      const n = Number((p as any)?.NUMPED);
      if (!Number.isFinite(n)) return;
      set.add(n);
    });
    return set.size;
  }, [pendencias]);
  const pendenciasAguardandoFornecedorCount = useMemo(() => {
    const set = new Set<number>();
    pendencias.forEach(p => {
      if (String(p.LOG2) !== "10") return;
      const n = Number((p as any)?.NUMPED);
      if (!Number.isFinite(n)) return;
      set.add(n);
    });
    return set.size;
  }, [pendencias]);
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [pedidoLocalizacao, setPedidoLocalizacao] = useState<PedidoDetalhe | null>(null);
  const [localizacaoOptions, setLocalizacaoOptions] = useState<{ autoUpdateStatus18?: boolean } | null>(null);
  const [showConfirmEnvio, setShowConfirmEnvio] = useState<boolean>(false);
  const [pedidoColeta, setPedidoColeta] = useState<PedidoDetalhe | null>(null);
  const [totalCobrancasEspeciais, setTotalCobrancasEspeciais] = useState<number>(0);
  const [loadingCobrancasEspeciais, setLoadingCobrancasEspeciais] = useState<boolean>(false);
  const [errorCobrancasEspeciais, setErrorCobrancasEspeciais] = useState<string | null>(null);
  const [duplicatasEspeciais, setDuplicatasEspeciais] = useState<DuplicataAbertaRow[]>([]);
  const [showPedidosAnalise, setShowPedidosAnalise] = useState<boolean>(false);
  const [pedidosAnaliseInitialOpen, setPedidosAnaliseInitialOpen] = useState<null | "coletaSeparada19">(null);
  const [showSoFaturar15, setShowSoFaturar15] = useState<boolean>(false);
  const [soFaturar15Count, setSoFaturar15Count] = useState<number>(0);
  const [showRetMessejana20, setShowRetMessejana20] = useState<boolean>(false);
  const [retMessejana20Count, setRetMessejana20Count] = useState<number>(0);
  const [pedidosAnaliseCount, setPedidosAnaliseCount] = useState<number>(0);
  const [coletaSeparada19Count, setColetaSeparada19Count] = useState<number>(0);
  const [showConciliacaoTV7, setShowConciliacaoTV7] = useState<boolean>(false);
  const [showPedidosPrioridade, setShowPedidosPrioridade] = useState<boolean>(false);

  const [totalCobrancasEspeciaisMesAnterior, setTotalCobrancasEspeciaisMesAnterior] = useState<number>(0);
  const [loadingCobrancasEspeciaisMesAnterior, setLoadingCobrancasEspeciaisMesAnterior] = useState<boolean>(false);
  const [errorCobrancasEspeciaisMesAnterior, setErrorCobrancasEspeciaisMesAnterior] = useState<string | null>(null);
  const [duplicatasEspeciaisMesAnterior, setDuplicatasEspeciaisMesAnterior] = useState<DuplicataAbertaAnteriorRow[]>([]);
  const [showCarteiraClientesMesAnterior, setShowCarteiraClientesMesAnterior] = useState<boolean>(false);
  const [emAbertoCarteiraMesAnterior, setEmAbertoCarteiraMesAnterior] = useState<EmAbertoRow[]>([]);
  const [qtdNotasFaturadas, setQtdNotasFaturadas] = useState<number>(0);
  const [totalVendaDiaria, setTotalVendaDiaria] = useState<number>(0);
  const [totalDevolucaoDiaria, setTotalDevolucaoDiaria] = useState<number>(0);
  const [totalFaturamentoMensal, setTotalFaturamentoMensal] = useState<number>(0);
  const [totalDevolucaoMensal, setTotalDevolucaoMensal] = useState<number>(0);
  const [loadingFaturamento111, setLoadingFaturamento111] = useState<boolean>(false);
  const [errorFaturamento111, setErrorFaturamento111] = useState<string | null>(null);

  const [campanhaVendasPorOffset, setCampanhaVendasPorOffset] = useState<Record<CampanhaVendasOffset, CampanhaVendasMesAnteriorRow[]>>({
    0: [],
    1: [],
    2: [],
  });
  const [loadingCampanhaVendasPorOffset, setLoadingCampanhaVendasPorOffset] = useState<Record<CampanhaVendasOffset, boolean>>({
    0: false,
    1: false,
    2: false,
  });
  const [errorCampanhaVendasPorOffset, setErrorCampanhaVendasPorOffset] = useState<Record<CampanhaVendasOffset, string | null>>({
    0: null,
    1: null,
    2: null,
  });
  const [campanhaVendasOffsetAberto, setCampanhaVendasOffsetAberto] = useState<CampanhaVendasOffset | null>(null);
  const [campanhaVendedorSelecionado, setCampanhaVendedorSelecionado] = useState<{ codusur: number; nome: string } | null>(null);
  const [campanhaPedidoSelecionado, setCampanhaPedidoSelecionado] = useState<string | null>(null);

  const fecharLiquidez = () => setShowLiquidez(false);
  const abrirLiquidez = () => setShowLiquidez(true);
  const fecharEmAberto = () => setShowEmAberto(false);
  const abrirEmAberto = () => setShowEmAberto(true);
  const fecharCarteiraClientes = () => setShowCarteiraClientes(false);
  const fecharCarteiraClientesMesAnterior = () => setShowCarteiraClientesMesAnterior(false);
  const fecharFrete = () => setShowFrete(false);
  const abrirFrete = () => setShowFrete(true);
  const fecharFreteAnterior = () => setShowFreteAnterior(false);
  const abrirFreteAnterior = () => setShowFreteAnterior(true);
  const fecharFreteEmAbertoAtual = () => setShowFreteEmAbertoAtual(false);
  const abrirFreteEmAbertoAtual = () => setShowFreteEmAbertoAtual(true);
  const fecharFreteEmAbertoAnterior = () => setShowFreteEmAbertoAnterior(false);
  const abrirFreteEmAbertoAnterior = () => setShowFreteEmAbertoAnterior(true);
  const fecharLiquidezAnterior = () => setShowLiquidezAnterior(false);
  const abrirLiquidezAnterior = () => setShowLiquidezAnterior(true);
  const fecharEmAbertoAnterior = () => setShowEmAbertoAnterior(false);
  const abrirEmAbertoAnterior = () => setShowEmAbertoAnterior(true);
  const abrirBuscaAvancadaProd = () => setShowBuscaAvancadaProd(true);
  const fecharBuscaAvancadaProd = () => setShowBuscaAvancadaProd(false);
  const abrirProdutosDisponiveis = () => setShowProdutosDisponiveis(true);
  const fecharProdutosDisponiveis = () => setShowProdutosDisponiveis(false);
  const fecharAjusteEstoque = () => setShowAjusteEstoque(false);
  const abrirTokensPrecoFixo = () => setShowTokensPrecoFixo(true);
  const fecharTokensPrecoFixo = () => setShowTokensPrecoFixo(false);
  const abrirClientesSemVenda = () => setShowClientesSemVenda(true);
  const fecharClientesSemVenda = () => setShowClientesSemVenda(false);

  const fecharCampanhaVendasMesAnterior = () => {
    setCampanhaVendasOffsetAberto(null);
    setCampanhaVendedorSelecionado(null);
    setCampanhaPedidoSelecionado(null);
  };
  const abrirCampanhaVendasMesAnterior = () => {
    setCampanhaVendedorSelecionado(null);
    setCampanhaPedidoSelecionado(null);
    setCampanhaVendasOffsetAberto(1);
  };
  const abrirCampanhaVendasMesAtual = () => {
    setCampanhaVendedorSelecionado(null);
    setCampanhaPedidoSelecionado(null);
    setCampanhaVendasOffsetAberto(0);
  };
  const abrirCampanhaVendasMesAntesAnterior = () => {
    setCampanhaVendedorSelecionado(null);
    setCampanhaPedidoSelecionado(null);
    setCampanhaVendasOffsetAberto(2);
  };

  const campanhaOffsetAtivo: CampanhaVendasOffset = campanhaVendasOffsetAberto ?? 1;
  const campanhaVendasSelecionadas = campanhaVendasPorOffset[campanhaOffsetAtivo] || [];

  const campanhaResumoPorVendedor = useMemo(() => {
    const acc: Record<
      string,
      { codusur: number; nome: string; total: number; itens: number; pedidos: Set<string> }
    > = {};

    for (const row of campanhaVendasSelecionadas) {
      const codusur = Number(row.CODUSUR ?? row.codusur ?? 0);
      const nome = String(row.nomeVendedor ?? row.NOMEVENDEDOR ?? "N/I").trim() || "N/I";
      const total = Number(row.VALORTOTAL ?? row.valorTotal ?? 0);
      const pedido = String(row.NUMPED ?? row.numped ?? "");
      const key = `${codusur}::${nome}`;
      if (!acc[key]) acc[key] = { codusur, nome, total: 0, itens: 0, pedidos: new Set<string>() };
      acc[key].total += Number.isFinite(total) ? total : 0;
      acc[key].itens += 1;
      if (pedido) acc[key].pedidos.add(pedido);
    }

    return Object.values(acc)
      .map((r) => ({ codusur: r.codusur, nome: r.nome, total: r.total, itens: r.itens, pedidos: r.pedidos.size }))
      .sort((a, b) => b.total - a.total);
  }, [campanhaVendasSelecionadas]);

  const campanhaPedidosDoVendedor = useMemo(() => {
    if (!campanhaVendedorSelecionado) return [];

    const acc: Record<
      string,
      { pedido: string; data: unknown; cliente: string; itens: number; qt: number; total: number }
    > = {};

    for (const row of campanhaVendasSelecionadas) {
      const codusur = Number(row.CODUSUR ?? row.codusur ?? 0);
      if (codusur !== campanhaVendedorSelecionado.codusur) continue;
      const pedido = String(row.NUMPED ?? row.numped ?? "");
      if (!pedido) continue;
      const total = Number(row.VALORTOTAL ?? row.valorTotal ?? 0);
      const qt = Number(row.QT ?? row.qt ?? 0);
      const cliente = String(row.nomeCliente ?? row.NOMECLIENTE ?? "—");
      const data = row.DATA ?? row.data;

      if (!acc[pedido]) {
        acc[pedido] = { pedido, data, cliente, itens: 0, qt: 0, total: 0 };
      }
      acc[pedido].itens += 1;
      acc[pedido].total += Number.isFinite(total) ? total : 0;
      acc[pedido].qt += Number.isFinite(qt) ? qt : 0;
      if (acc[pedido].data == null && data != null) acc[pedido].data = data;
    }

    return Object.values(acc).sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
  }, [campanhaVendasSelecionadas, campanhaVendedorSelecionado]);

  const campanhaItensDoPedidoSelecionado = useMemo(() => {
    if (!campanhaVendedorSelecionado || !campanhaPedidoSelecionado) return [];
    const pedido = String(campanhaPedidoSelecionado);

    return campanhaVendasSelecionadas
      .filter((row) => {
        const codusur = Number(row.CODUSUR ?? row.codusur ?? 0);
        const numped = String(row.NUMPED ?? row.numped ?? "");
        return codusur === campanhaVendedorSelecionado.codusur && numped === pedido;
      })
      .map((row) => {
        const codProd = String(row.CODPROD ?? row.codprod ?? "—");
        const descricao = String(row.DESCRICAO ?? row.descricao ?? "—");
        const codAux = String(row.CODAUXILIAR ?? row.codauxiliar ?? "—");
        const qt = Number(row.QT ?? row.qt ?? 0);
        const total = Number(row.VALORTOTAL ?? row.valorTotal ?? 0);
        return {
          pedido,
          data: row.DATA ?? row.data,
          cliente: String(row.nomeCliente ?? row.NOMECLIENTE ?? "—"),
          codProd,
          descricao,
          codAux,
          qt: Number.isFinite(qt) ? qt : 0,
          total: Number.isFinite(total) ? total : 0,
        };
      });
  }, [campanhaPedidoSelecionado, campanhaVendasSelecionadas, campanhaVendedorSelecionado]);

  const campanhaTotaisDoVendedor = useMemo(() => {
    if (!campanhaVendedorSelecionado) return null;
    const totalQt = campanhaPedidosDoVendedor.reduce((acc, p) => acc + Number(p.qt || 0), 0);
    const totalValor = campanhaPedidosDoVendedor.reduce((acc, p) => acc + Number(p.total || 0), 0);
    return {
      pedidos: campanhaPedidosDoVendedor.length,
      totalQt: Number.isFinite(totalQt) ? totalQt : 0,
      totalValor: Number.isFinite(totalValor) ? totalValor : 0,
    };
  }, [campanhaPedidosDoVendedor, campanhaVendedorSelecionado]);

  const campanhaTotaisDoPedido = useMemo(() => {
    if (!campanhaVendedorSelecionado || !campanhaPedidoSelecionado) return null;
    const totalQt = campanhaItensDoPedidoSelecionado.reduce((acc, it) => acc + Number(it.qt || 0), 0);
    const totalValor = campanhaItensDoPedidoSelecionado.reduce((acc, it) => acc + Number(it.total || 0), 0);
    return {
      pedidos: 1,
      totalQt: Number.isFinite(totalQt) ? totalQt : 0,
      totalValor: Number.isFinite(totalValor) ? totalValor : 0,
    };
  }, [campanhaItensDoPedidoSelecionado, campanhaPedidoSelecionado, campanhaVendedorSelecionado]);


  const abrirCarteiraClientes = () => {
    if (!duplicatasEspeciais || duplicatasEspeciais.length === 0) {
      setShowCarteiraClientes(true);
      return;
    }
    const agrupado: Record<string, { CODUSUR: number; RCA: string; VALOR: number }> = {};
    for (const dup of duplicatasEspeciais) {
      const codusur = Number(dup.CODUSUR || 0);
      const rca = String(dup.NOME || '').trim();
      const key = `${codusur}::${rca}`;
      if (!agrupado[key]) {
        agrupado[key] = { CODUSUR: codusur, RCA: rca, VALOR: 0 };
      }
      agrupado[key].VALOR += Number(dup.VALOR || 0);
    }
    const lista = Object.values(agrupado) as unknown as EmAbertoRow[];
    setEmAbertoCarteira(lista);
    setShowCarteiraClientes(true);
  };

  const abrirCarteiraClientesMesAnterior = () => {
    if (!duplicatasEspeciaisMesAnterior || duplicatasEspeciaisMesAnterior.length === 0) {
      setShowCarteiraClientesMesAnterior(true);
      return;
    }
    const agrupado: Record<string, { CODUSUR: number; RCA: string; VALOR: number }> = {};
    for (const dup of duplicatasEspeciaisMesAnterior) {
      const codusur = Number(dup.CODUSUR || 0);
      const rca = String(dup.NOME || '').trim();
      const key = `${codusur}::${rca}`;
      if (!agrupado[key]) {
        agrupado[key] = { CODUSUR: codusur, RCA: rca, VALOR: 0 };
      }
      agrupado[key].VALOR += Number(dup.VALOR || 0);
    }
    const lista = Object.values(agrupado) as unknown as EmAbertoRow[];
    setEmAbertoCarteiraMesAnterior(lista);
    setShowCarteiraClientesMesAnterior(true);
  };

  useEffect(() => {
    const dadosSalvos = localStorage.getItem("usuarioLogado");
    if (dadosSalvos) setUsuario(JSON.parse(dadosSalvos));
  }, []);

  useEffect(() => {
    const measure = () => {
      try {
        const el = leftColRef.current;
        if (el) {
          el.getBoundingClientRect();
        }
      } catch {}
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const loadComissoes = async () => {
    setLoadingComissoes(true);
    setErrorComissoes(null);
    try {
      const data = await buscarComissaoPorLiquidez();
      setComissoes(data.rows || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar comissões";
      setErrorComissoes(msg);
    } finally {
      setLoadingComissoes(false);
    }
  };

  const loadPendencias = async () => {
    setLoadingPendencias(true);
    setErrorPendencias(null);
    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestpro/pendenciasGestpro`);
      if (!resp.ok) throw new Error("Erro ao buscar pendências");
      const data = await resp.json();
      setPendencias(data.rows || []);
      setHasPendencias((data.rows || []).length > 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar pendências";
      setErrorPendencias(msg);
    } finally {
      setLoadingPendencias(false);
    }
  };

  const loadSoFaturar15Count = useCallback(async () => {
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

      const set15 = new Set<number>();
      const set19 = new Set<number>();
      const set20 = new Set<number>();
      const setAnalise = new Set<number>();
      rows.forEach(r => {
        const parsed = r?.ULTIMASITUACAOCFAT ? parseInt(String(r.ULTIMASITUACAOCFAT).split("__")[0], 10) : -1;
        const statusCode = Number.isFinite(parsed) ? parsed : -1;
        const statusPedido = r?.STATUS_PEDIDO != null ? String(r.STATUS_PEDIDO) : "";
        const pedido = Number(r?.NUMERO_DO_PEDIDO_TV8);
        if (!Number.isFinite(pedido)) return;
        if (statusCode === 15 || statusPedido === "15") set15.add(pedido);
        if (statusCode === 19 || statusPedido === "19") set19.add(pedido);
        if (statusCode === 20 || statusPedido === "20") set20.add(pedido);
        if (statusCode === 0 || statusCode === 1 || statusPedido === "0" || statusPedido === "1") setAnalise.add(pedido);
      });
      setSoFaturar15Count(set15.size);
      setColetaSeparada19Count(set19.size);
      setRetMessejana20Count(set20.size);
      setPedidosAnaliseCount(setAnalise.size);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPendencias();
  }, []);

  useEffect(() => {
    loadSoFaturar15Count();
    const interval = setInterval(() => {
      loadSoFaturar15Count();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadSoFaturar15Count]);

  useEffect(() => {
    if (showPegarLocalizacao || showCortePendencias || showCorteRealizadoPendencias || showColetaPendencias || showColetaSeparandoPendencias || showAguardandoFornecedorPendencias) {
      loadPendencias();
    }
  }, [showPegarLocalizacao, showCortePendencias, showCorteRealizadoPendencias, showColetaPendencias, showColetaSeparandoPendencias, showAguardandoFornecedorPendencias]);

  const loadComissoesAnterior = async () => {
    setLoadingComissoesAnterior(true);
    setErrorComissoesAnterior(null);
    try {
      const data = await buscarComissaoPorLiquidezMesAnterior();
      setComissoesAnterior(data.rows || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar comissões (mês anterior)";
      setErrorComissoesAnterior(msg);
    } finally {
      setLoadingComissoesAnterior(false);
    }
  };

  const loadCobrancasEspeciais = async () => {
    setLoadingCobrancasEspeciais(true);
    setErrorCobrancasEspeciais(null);
    try {
      const data = await buscarDuplicatasEmAbertoMesAtual();
      const codigos = new Set(["CTB", "CTC", "CTD", "CTDI", "CTDP", "CTP", "CART"]);
      const especiais = (data.rows || []).filter((row: DuplicataAbertaRow) => {
        const cod = String(row.CODCOB || "").trim().toUpperCase();
        return codigos.has(cod);
      });
      const total = especiais.reduce((acc, row) => acc + Number(row.VALOR || 0), 0);
      setDuplicatasEspeciais(especiais);
      setTotalCobrancasEspeciais(total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar cobranças especiais";
      setErrorCobrancasEspeciais(msg);
    } finally {
      setLoadingCobrancasEspeciais(false);
    }
  };

  const loadCobrancasEspeciaisMesAnterior = async () => {
    setLoadingCobrancasEspeciaisMesAnterior(true);
    setErrorCobrancasEspeciaisMesAnterior(null);
    try {
      const data = await buscarDuplicatasEmAbertoMesAnterior();
      const codigos = new Set(["CTB", "CTC", "CTD", "CTDI", "CTDP", "CTP", "CART"]);
      const especiais = (data.rows || []).filter((row: DuplicataAbertaAnteriorRow) => {
        const cod = String(row.CODCOB || "").trim().toUpperCase();
        return codigos.has(cod);
      });
      const total = especiais.reduce((acc, row) => acc + Number(row.VALOR || 0), 0);
      setDuplicatasEspeciaisMesAnterior(especiais);
      setTotalCobrancasEspeciaisMesAnterior(total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar cobranças especiais (mês anterior)";
      setErrorCobrancasEspeciaisMesAnterior(msg);
    } finally {
      setLoadingCobrancasEspeciaisMesAnterior(false);
    }
  };

  const loadFrete = async () => {
    setLoadingFrete(true);
    setErrorFrete(null);
    try {
      const data = await buscarComissoesPorFreteMesAtual();
      setFrete(data.rows || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar comissões por frete";
      setErrorFrete(msg);
    } finally {
      setLoadingFrete(false);
    }
  };

  const loadFreteAnterior = async () => {
    setLoadingFreteAnterior(true);
    setErrorFreteAnterior(null);
    try {
      const data = await buscarComissoesPorFreteMesAnterior();
      setFreteAnterior(data.rows || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar comissões por frete (mês anterior)";
      setErrorFreteAnterior(msg);
    } finally {
      setLoadingFreteAnterior(false);
    }
  };

  const loadFreteEmAbertoAnterior = async () => {
    const codfilial = String(usuario?.codfilial || (usuario as any)?.CODFILIAL || "1").trim() || "1";
    setLoadingFreteEmAbertoAnterior(true);
    setErrorFreteEmAbertoAnterior(null);
    try {
      const baseApi = resolveBaseApi();
      const params = new URLSearchParams({ codfilial });
      const resp = await fetch(`${baseApi}/gestpro/comissoes-por-frete-mes-anterior-em-aberto-total?${params.toString()}`);
      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await resp.text();
        throw new Error(text || "Resposta inválida da API GestPRO (frete-em-aberto-mes-anterior)");
      }
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error((data as any)?.message || "Falha ao carregar frete em aberto (mês anterior)");
      }
      const rowsRaw = (data as any)?.rows;
      const rows = Array.isArray(rowsRaw) ? (rowsRaw as FretePorLiquidezResumoRow[]) : [];
      setFreteEmAbertoAnterior(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar frete em aberto (mês anterior)";
      setErrorFreteEmAbertoAnterior(msg);
    } finally {
      setLoadingFreteEmAbertoAnterior(false);
    }
  };

  const loadFreteEmAbertoAtual = async () => {
    const codfilial = String(usuario?.codfilial || (usuario as any)?.CODFILIAL || "1").trim() || "1";
    setLoadingFreteEmAbertoAtual(true);
    setErrorFreteEmAbertoAtual(null);
    try {
      const baseApi = resolveBaseApi();
      const params = new URLSearchParams({ codfilial });
      const resp = await fetch(`${baseApi}/gestpro/comissoes-por-frete-mes-atual-em-aberto-total?${params.toString()}`);
      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await resp.text();
        throw new Error(text || "Resposta inválida da API GestPRO (frete-em-aberto-mes-atual)");
      }
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error((data as any)?.message || "Falha ao carregar frete em aberto (mês atual)");
      }
      const rowsRaw = (data as any)?.rows;
      const rows = Array.isArray(rowsRaw) ? (rowsRaw as FretePorLiquidezResumoRow[]) : [];
      setFreteEmAbertoAtual(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar frete em aberto (mês atual)";
      setErrorFreteEmAbertoAtual(msg);
    } finally {
      setLoadingFreteEmAbertoAtual(false);
    }
  };

  const loadCampanhaVendas = async (offset: CampanhaVendasOffset) => {
    setLoadingCampanhaVendasPorOffset((prev) => ({ ...prev, [offset]: true }));
    setErrorCampanhaVendasPorOffset((prev) => ({ ...prev, [offset]: null }));
    try {
      const baseApi = resolveBaseApi();
      const params = new URLSearchParams({ offset: String(offset) });
      const resp = await fetch(`${baseApi}/gestpro/campanha-vendas-mes-anterior?${params.toString()}`);
      const ct = resp.headers.get("content-type") || "";
      const isJson = ct.toLowerCase().includes("application/json");
      const data = isJson ? await resp.json() : await resp.text();

      if (!resp.ok) {
        const message =
          isJson && typeof data === "object" && data && "message" in data
            ? String((data as { message?: unknown }).message || "Falha ao carregar Campanha Vendas (mês anterior)")
            : String(data || "Falha ao carregar Campanha Vendas (mês anterior)");
        throw new Error(message);
      }

      if (!isJson || typeof data !== "object" || data == null) {
        throw new Error(typeof data === "string" ? data : "Resposta inválida da API GestPRO (campanha-vendas-mes-anterior)");
      }

      const rowsRaw = (data as Record<string, unknown>)?.rows;
      const rows = Array.isArray(rowsRaw) ? (rowsRaw as CampanhaVendasMesAnteriorRow[]) : [];
      setCampanhaVendasPorOffset((prev) => ({ ...prev, [offset]: rows }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar Campanha Vendas";
      setErrorCampanhaVendasPorOffset((prev) => ({ ...prev, [offset]: msg }));
    } finally {
      setLoadingCampanhaVendasPorOffset((prev) => ({ ...prev, [offset]: false }));
    }
  };

  const loadFaturamento111 = async () => {
    setLoadingFaturamento111(true);
    setErrorFaturamento111(null);
    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestpro/faturamento-111`);
      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await resp.text();
        throw new Error(text || "Resposta inválida da API GestPRO (faturamento-111)");
      }
      const data = await resp.json();
      const diarioRows = Array.isArray((data as any).diario) ? (data as any).diario : [];
      const mensalRows = Array.isArray((data as any).mensal) ? (data as any).mensal : [];

      const totalVenda = diarioRows.reduce(
        (acc: number, row: any) => acc + Number(row.VLVENDA || 0),
        0
      );
      const totalDevDiaria = diarioRows.reduce(
        (acc: number, row: any) => acc + Number(row.VLDEVOLUCAO || 0),
        0
      );
      const totalVendaMensal = mensalRows.reduce(
        (acc: number, row: any) => acc + Number(row.VLVENDA || 0),
        0
      );
      const totalDevMensal = mensalRows.reduce(
        (acc: number, row: any) => acc + Number(row.VLDEVOLUCAO || 0),
        0
      );
      const qtd = Number((data as any).qtdNotas ?? 0);
      setQtdNotasFaturadas(Number.isFinite(qtd) ? qtd : 0);
      setTotalVendaDiaria(Number.isFinite(totalVenda) ? totalVenda : 0);
      setTotalDevolucaoDiaria(Number.isFinite(totalDevDiaria) ? totalDevDiaria : 0);
      setTotalFaturamentoMensal(Number.isFinite(totalVendaMensal) ? totalVendaMensal : 0);
      setTotalDevolucaoMensal(Number.isFinite(totalDevMensal) ? totalDevMensal : 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar Faturamento 111";
      setErrorFaturamento111(msg);
    } finally {
      setLoadingFaturamento111(false);
    }
  };

  useEffect(() => {
    loadComissoes();
  }, []);

  useEffect(() => {
    loadEmAberto();
  }, []);

  useEffect(() => {
    loadCobrancasEspeciais();
  }, []);

  useEffect(() => {
    loadCobrancasEspeciaisMesAnterior();
  }, []);

  useEffect(() => {
    loadFrete();
  }, []);

  useEffect(() => {
    loadFreteAnterior();
  }, []);

  useEffect(() => {
    if (!usuario) return;
    loadFreteEmAbertoAtual();
    loadFreteEmAbertoAnterior();
  }, [usuario]);

  useEffect(() => {
    loadComissoesAnterior();
  }, []);

  useEffect(() => {
    loadCampanhaVendas(0);
    loadCampanhaVendas(1);
    loadCampanhaVendas(2);
  }, []);

  useEffect(() => {
    loadFaturamento111();
  }, []);

  const loadEmAbertoAnterior = async () => {
    setLoadingEmAbertoAnterior(true);
    setErrorEmAbertoAnterior(null);
    try {
      const data = await buscarEmAbertoMesAnterior();
      setEmAbertoAnterior(data.rows || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar Em Aberto (mês anterior)";
      setErrorEmAbertoAnterior(msg);
    } finally {
      setLoadingEmAbertoAnterior(false);
    }
  };

  useEffect(() => {
    loadEmAbertoAnterior();
  }, []);

  const loadEmAberto = async () => {
    setLoadingEmAberto(true);
    setErrorEmAberto(null);
    try {
      const data = await buscarEmAbertoMesAtual();
      setEmAberto(data.rows || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao carregar Em Aberto";
      setErrorEmAberto(msg);
    } finally {
      setLoadingEmAberto(false);
    }
  };

  useEffect(() => {
    loadEmAberto();
  }, []);

  const hoje = new Date();
  const mesAtualLabel = hoje.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const mesAnteriorDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnteriorLabel = mesAnteriorDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const mesAntesAnteriorDate = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
  const mesAntesAnteriorLabel = mesAntesAnteriorDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const campanhaMesLabelAtivo =
    campanhaOffsetAtivo === 0 ? mesAtualLabel : campanhaOffsetAtivo === 2 ? mesAntesAnteriorLabel : mesAnteriorLabel;

  const totalLiquidez = comissoes.reduce((acc, row) => acc + Number(row.VALOR || 0), 0);
  const totalLiquidezAnterior = comissoesAnterior.reduce((acc, row) => acc + Number(row.VALOR || 0), 0);
  const totalEmAberto = emAberto.reduce((acc, row) => acc + Number((row as any).VALOR || 0), 0);
  const totalEmAbertoAnterior = emAbertoAnterior.reduce((acc, row) => acc + Number((row as any).VALOR || 0), 0);
  const totalFrete = frete.reduce((acc, row) => acc + Number(row.FRETE || 0), 0);
  const freteResumoAtualPorVendedor = useMemo<ComissoesPorFreteResumoRow[]>(() => {
    const agrupado: Record<string, ComissoesPorFreteResumoRow> = {};

    for (const row of frete) {
      const codusur = Number(row.CODUSUR || 0);
      const vendedor = String(row.NOME || "N/I").trim() || "N/I";
      const valorFrete = Number(row.FRETE || 0);
      const key = `${codusur}::${vendedor}`;
      if (!agrupado[key]) {
        agrupado[key] = {
          CODUSUR: codusur,
          VENDEDOR: vendedor,
          QTD_VENDAS_FRETE: 0,
          VALOR_FRETE_TOTAL: 0,
        };
      }
      if (valorFrete > 0) agrupado[key].QTD_VENDAS_FRETE += 1;
      agrupado[key].VALOR_FRETE_TOTAL += Number.isFinite(valorFrete) ? valorFrete : 0;
    }

    return Object.values(agrupado)
      .filter((item) => item.VALOR_FRETE_TOTAL > 0 || item.QTD_VENDAS_FRETE > 0)
      .sort((a, b) => b.VALOR_FRETE_TOTAL - a.VALOR_FRETE_TOTAL);
  }, [frete]);
  const totalFreteAnterior = freteAnterior.reduce((acc, row) => acc + Number(row.FRETE || 0), 0);
  const freteResumoAnteriorPorVendedor = useMemo<ComissoesPorFreteResumoRow[]>(() => {
    const agrupado: Record<string, ComissoesPorFreteResumoRow> = {};

    for (const row of freteAnterior) {
      const codusur = Number(row.CODUSUR || 0);
      const vendedor = String(row.NOME || "N/I").trim() || "N/I";
      const valorFrete = Number(row.FRETE || 0);
      const key = `${codusur}::${vendedor}`;
      if (!agrupado[key]) {
        agrupado[key] = {
          CODUSUR: codusur,
          VENDEDOR: vendedor,
          QTD_VENDAS_FRETE: 0,
          VALOR_FRETE_TOTAL: 0,
        };
      }
      if (valorFrete > 0) agrupado[key].QTD_VENDAS_FRETE += 1;
      agrupado[key].VALOR_FRETE_TOTAL += Number.isFinite(valorFrete) ? valorFrete : 0;
    }

    return Object.values(agrupado)
      .filter((item) => item.VALOR_FRETE_TOTAL > 0 || item.QTD_VENDAS_FRETE > 0)
      .sort((a, b) => b.VALOR_FRETE_TOTAL - a.VALOR_FRETE_TOTAL);
  }, [freteAnterior]);
  const totalFreteEmAbertoAtual = freteEmAbertoAtual.reduce((acc, row) => acc + Number(row.FRETE || 0), 0);
  const freteEmAbertoResumoAtualPorVendedor = useMemo<ComissoesPorFreteResumoRow[]>(() => {
    const agrupado: Record<string, ComissoesPorFreteResumoRow> = {};

    for (const row of freteEmAbertoAtual) {
      const codusur = Number(row.CODUSUR || 0);
      const vendedor = String(row.NOME || "N/I").trim() || "N/I";
      const valorFrete = Number(row.FRETE || 0);
      const key = `${codusur}::${vendedor}`;
      if (!agrupado[key]) {
        agrupado[key] = {
          CODUSUR: codusur,
          VENDEDOR: vendedor,
          QTD_VENDAS_FRETE: 0,
          VALOR_FRETE_TOTAL: 0,
        };
      }
      if (valorFrete > 0) agrupado[key].QTD_VENDAS_FRETE += 1;
      agrupado[key].VALOR_FRETE_TOTAL += Number.isFinite(valorFrete) ? valorFrete : 0;
    }

    return Object.values(agrupado)
      .filter((item) => item.VALOR_FRETE_TOTAL > 0 || item.QTD_VENDAS_FRETE > 0)
      .sort((a, b) => b.VALOR_FRETE_TOTAL - a.VALOR_FRETE_TOTAL);
  }, [freteEmAbertoAtual]);
  const totalFreteEmAbertoAnterior = freteEmAbertoAnterior.reduce((acc, row) => acc + Number(row.FRETE || 0), 0);
  const freteEmAbertoResumoAnteriorPorVendedor = useMemo<ComissoesPorFreteResumoRow[]>(() => {
    const agrupado: Record<string, ComissoesPorFreteResumoRow> = {};

    for (const row of freteEmAbertoAnterior) {
      const codusur = Number(row.CODUSUR || 0);
      const vendedor = String(row.NOME || "N/I").trim() || "N/I";
      const valorFrete = Number(row.FRETE || 0);
      const key = `${codusur}::${vendedor}`;
      if (!agrupado[key]) {
        agrupado[key] = {
          CODUSUR: codusur,
          VENDEDOR: vendedor,
          QTD_VENDAS_FRETE: 0,
          VALOR_FRETE_TOTAL: 0,
        };
      }
      if (valorFrete > 0) agrupado[key].QTD_VENDAS_FRETE += 1;
      agrupado[key].VALOR_FRETE_TOTAL += Number.isFinite(valorFrete) ? valorFrete : 0;
    }

    return Object.values(agrupado)
      .filter((item) => item.VALOR_FRETE_TOTAL > 0 || item.QTD_VENDAS_FRETE > 0)
      .sort((a, b) => b.VALOR_FRETE_TOTAL - a.VALOR_FRETE_TOTAL);
  }, [freteEmAbertoAnterior]);
  const totalCampanhaVendasMesAnterior = (campanhaVendasPorOffset[1] || []).reduce(
    (acc, row) => acc + Number(row.VALORTOTAL ?? row.valorTotal ?? 0),
    0
  );
  const totalCampanhaVendasMesAtual = (campanhaVendasPorOffset[0] || []).reduce(
    (acc, row) => acc + Number(row.VALORTOTAL ?? row.valorTotal ?? 0),
    0
  );
  const totalCampanhaVendasMesAntesAnterior = (campanhaVendasPorOffset[2] || []).reduce(
    (acc, row) => acc + Number(row.VALORTOTAL ?? row.valorTotal ?? 0),
    0
  );
  const totalCampanhaVendasSelecionada = (campanhaVendasSelecionadas || []).reduce(
    (acc, row) => acc + Number(row.VALORTOTAL ?? row.valorTotal ?? 0),
    0
  );
  const ticketMedioDiario = qtdNotasFaturadas > 0 ? totalVendaDiaria / qtdNotasFaturadas : 0;

  const renderBlockedValue = (value: number, loading: boolean, error: string | null, options?: { block?: boolean; isCurrency?: boolean }) => {
    const block = options?.block ?? true;
    const isCurrency = options?.isCurrency ?? true;

    if (loading) {
      return (
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      );
    }
    if (error) return 'Erro';
    if (block && hasPendencias) {
      return (
        <span title="Há pedidos pendentes, mas a visualização está liberada.">
          {isCurrency ? currency(value) : value}
        </span>
      );
    }
    return isCurrency ? currency(value) : value;
  };

  return (
    <div className="d-flex flex-column min-vh-100" style={{ fontFamily: "'Poppins', sans-serif", backgroundColor: "#f8f9fa" }}>
      {/* Header */}
      <TopBar
        title=""
        titleClassName="d-none"
        showBack={true}
        backLink={appUrl("/dashboard")}
        actions={
          <button
            className="btn btn-primary d-flex align-items-center justify-content-center"
            type="button"
            onClick={() => {
              loadComissoes();
              loadComissoesAnterior();
              loadEmAberto();
              loadEmAbertoAnterior();
              loadFrete();
              loadFreteAnterior();
              loadFreteEmAbertoAtual();
              loadFreteEmAbertoAnterior();
              loadCobrancasEspeciais();
              loadCobrancasEspeciaisMesAnterior();
              loadFaturamento111();
              loadCampanhaVendas(0);
              loadCampanhaVendas(1);
              loadCampanhaVendas(2);
            }}
            title="Sincronizar"
            style={{ width: "38px", height: "38px", padding: 0 }}
          >
            <ArrowRepeat size={20} />
          </button>
        }
      >
        <div className="d-flex flex-wrap align-items-center ms-0" style={{ columnGap: "1.15rem", rowGap: "0.75rem" }}>
          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowCortePendencias(true)} title="Corte">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Scissors size={28} className={pendenciasCorteCount > 0 ? "text-danger" : "text-secondary"} />
              {pendenciasCorteCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {pendenciasCorteCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Corte</div>
              <div>Pendências</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowCorteRealizadoPendencias(true)} title="Corte Realizado">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <ClipboardCheck size={28} className={pendenciasCorteRealizadoCount > 0 ? "text-primary" : "text-secondary"} />
              {pendenciasCorteRealizadoCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {pendenciasCorteRealizadoCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Corte</div>
              <div>Realizado</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowColetaPendencias(true)} title="Coleta">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <BoxArrowUpRight size={28} className={pendenciasColetaCount > 0 ? "text-success" : "text-secondary"} />
              {pendenciasColetaCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {pendenciasColetaCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Coleta</div>
              <div>Pendências</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowColetaSeparandoPendencias(true)} title="Coleta Separando">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <ArrowRepeat size={28} className={pendenciasColetaSeparandoCount > 0 ? "text-warning" : "text-secondary"} />
              {pendenciasColetaSeparandoCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {pendenciasColetaSeparandoCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Coleta</div>
              <div>Separando</div>
            </div>
          </div>

          <div
            className="d-flex flex-column align-items-center"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setPedidosAnaliseInitialOpen("coletaSeparada19");
              setShowPedidosAnalise(true);
            }}
            title="Pedidos Coleta Separada"
          >
            <div style={{ position: "relative", display: "inline-flex" }}>
              <BoxSeam size={28} className={coletaSeparada19Count > 0 ? "text-success" : "text-secondary"} />
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

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowAguardandoFornecedorPendencias(true)} title="Aguardando Fornecedor">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Truck size={28} className={pendenciasAguardandoFornecedorCount > 0 ? "text-warning" : "text-secondary"} />
              {pendenciasAguardandoFornecedorCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {pendenciasAguardandoFornecedorCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Aguardando</div>
              <div>Fornecedor</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowSoFaturar15(true)} title="Pedidos Só Faturar">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <CashCoin size={28} className={soFaturar15Count > 0 ? "text-success" : "text-secondary"} />
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

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowRetMessejana20(true)} title="Pedidos Ret. Messejana">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <House size={28} className={retMessejana20Count > 0 ? "text-primary" : "text-secondary"} />
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

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowPegarLocalizacao(true)} title="Pegar Localização">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <GeoAlt size={28} className={pendenciasLocalizacaoCount > 0 ? "text-info" : "text-secondary"} />
              {pendenciasLocalizacaoCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {pendenciasLocalizacaoCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Pegar</div>
              <div>Localização</div>
            </div>
          </div>

          <div
            className="d-flex flex-column align-items-center"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setPedidosAnaliseInitialOpen(null);
              setShowPedidosAnalise(true);
            }}
            title="Pedidos para Análise"
          >
            <div style={{ position: "relative", display: "inline-flex" }}>
              <ClipboardCheck size={28} className={pedidosAnaliseCount > 0 ? "text-primary" : "text-secondary"} />
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

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={abrirBuscaAvancadaProd} title="Pesquisa avançada por descrição">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Search size={28} className="text-secondary" />
              {buscaDescBadgeCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {buscaDescBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Busca</div>
              <div>Desc.</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={abrirProdutosDisponiveis} title="Busca avançada de estoque">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <BoxSeam size={28} className="text-success" />
              {produtosDisponiveisBadgeCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {produtosDisponiveisBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Prod.</div>
              <div>Disp.</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={abrirTokensPrecoFixo} title="Tokens de preço fixo">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Key size={28} className="text-secondary" />
              {tokensPrecoFixoBadgeCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {tokensPrecoFixoBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Tokens</div>
              <div>Preço</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={abrirClientesSemVenda} title="Clientes sem vendas">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <PersonX size={28} className="text-danger" />
              {clientesSemVendaBadgeCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {clientesSemVendaBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Sem</div>
              <div>Venda</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowConciliacaoTV7(true)} title="Conciliação TV7">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <ArrowLeftRight size={28} className="text-info" />
              {conciliacaoTV7BadgeCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {conciliacaoTV7BadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Concil.</div>
              <div>TV7</div>
            </div>
          </div>

          <div className="d-flex flex-column align-items-center" style={{ cursor: "pointer" }} onClick={() => setShowPedidosPrioridade(true)} title="Pedidos prioridades">
            <div style={{ position: "relative", display: "inline-flex" }}>
              <StarFill size={28} className="text-warning" />
              {pedidosPrioridadeBadgeCount > 0 && (
                <span className="badge bg-danger text-white" style={topBarBadgeStyle}>
                  {pedidosPrioridadeBadgeCount}
                </span>
              )}
            </div>
            <div className="text-muted" style={topBarLabelStyle}>
              <div>Pedidos</div>
              <div>Prior.</div>
            </div>
          </div>
        </div>
      </TopBar>

      {/* Conteúdo */}
      <div className="container-fluid p-0 flex-grow-1 d-flex flex-column" style={{ position: 'relative' }}>
        <div className="d-flex flex-row align-items-stretch flex-grow-1">
          {/* Indicadores Comerciais ou aviso de pendências */}
          <div className="flex-grow-1" ref={leftColRef}>
            <div className="card h-100 rounded-0 border-0 shadow-none">
              <div className="card-header bg-white border-bottom-0 border-top d-flex justify-content-between align-items-center px-3 py-2">
                <h5 className="mb-0">Indicadores Comerciais</h5>
              </div>
              <div className="card-body p-3">
                  {/* Seção: Mês Atual */}
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">Mês Atual</h6>
                    <span className="badge bg-primary text-capitalize">{mesAtualLabel}</span>
                  </div>
                  <div className="row g-2">
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">R$ Faturamento Líquido</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-acessar-fatliq">Acessar (em breve)</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button type="button" className="btn p-0 border-0 bg-transparent text-success lh-1" disabled aria-label="Acessar faturamento líquido">
                                <BoxArrowUpRight size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-success mt-2 mb-0">
                          {renderBlockedValue(totalFaturamentoMensal, loadingFaturamento111, errorFaturamento111, { block: false })}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">R$ Devolução</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-acessar-devolucao">Acessar (em breve)</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button type="button" className="btn p-0 border-0 bg-transparent text-danger lh-1" disabled aria-label="Acessar devolução">
                                <BoxArrowUpRight size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-danger mt-2 mb-0">
                          {renderBlockedValue(totalDevolucaoMensal, loadingFaturamento111, errorFaturamento111, { block: false })}
                        </h4>
                      </div>
                    </div>
                  </div>



                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Liquidez</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-liquidez">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-info lh-1"
                                onClick={abrirLiquidez}
                                aria-label="Detalhar liquidez"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-info mt-2 mb-0">
                          {renderBlockedValue(totalLiquidez, loadingComissoes, errorComissoes)}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Novo card: Comissões por Frete (Mês Atual) */}
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Frete  por liquidez</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-frete">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-info lh-1"
                                onClick={abrirFrete}
                                disabled={!!errorFrete}
                                aria-label="Detalhar frete"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-info mt-2 mb-0">{renderBlockedValue(totalFrete, loadingFrete, errorFrete)}</h4>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Frete em Aberto</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-frete-emaberto">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-info lh-1"
                                onClick={abrirFreteEmAbertoAtual}
                                disabled={!!errorFreteEmAbertoAtual}
                                aria-label="Detalhar frete em aberto"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-info mt-2 mb-0">
                          {renderBlockedValue(totalFreteEmAbertoAtual, loadingFreteEmAbertoAtual, errorFreteEmAbertoAtual)}
                        </h4>
                      </div>
                    </div>
                  </div>

                  

                  {/* Em Aberto (Mês Atual) */}
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Total em Aberto</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-emaberto">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button type="button" className="btn p-0 border-0 bg-transparent text-dark lh-1" onClick={abrirEmAberto} aria-label="Detalhar total em aberto">
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-dark mt-2 mb-0">
                          {renderBlockedValue(totalEmAberto, loadingEmAberto, errorEmAberto, { block: false })}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Carteira em aberto</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-carteira">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-dark lh-1"
                                onClick={abrirCarteiraClientes}
                                disabled={!!errorCobrancasEspeciais}
                                aria-label="Detalhar carteira em aberto"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-dark mt-2 mb-0">
                          {renderBlockedValue(totalCobrancasEspeciais, loadingCobrancasEspeciais, errorCobrancasEspeciais)}
                        </h4>
                      </div>
                    </div>
                  </div>

                </div>
                
                <div className="gestpro-section-divider" />
                {/* Seção: Mês Anterior */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Mês Anterior</h6>
                  <span className="badge bg-secondary text-capitalize">{mesAnteriorLabel}</span>
                </div>

                <div className="row g-2">
                  {/* Liquidez (Mês Anterior) */}
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Liquidez</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-liquidez-ant">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-secondary lh-1"
                                onClick={abrirLiquidezAnterior}
                                disabled={!!errorComissoesAnterior}
                                aria-label="Detalhar liquidez mês anterior"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-secondary mt-2 mb-0">
                          {renderBlockedValue(totalLiquidezAnterior, loadingComissoesAnterior, errorComissoesAnterior)}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Comissões por Frete (Mês Anterior) */}
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Frete por Liquidez</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-frete-ant">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-secondary lh-1"
                                onClick={abrirFreteAnterior}
                                disabled={!!errorFreteAnterior}
                                aria-label="Detalhar frete mês anterior"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-secondary mt-2 mb-0">
                          {renderBlockedValue(totalFreteAnterior, loadingFreteAnterior, errorFreteAnterior)}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Frete em Aberto (Mês Anterior) */}
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Frete em Aberto</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-frete-emaberto-ant">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-secondary lh-1"
                                onClick={abrirFreteEmAbertoAnterior}
                                disabled={!!errorFreteEmAbertoAnterior}
                                aria-label="Detalhar frete em aberto mês anterior"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-secondary mt-2 mb-0">
                          {renderBlockedValue(totalFreteEmAbertoAnterior, loadingFreteEmAbertoAnterior, errorFreteEmAbertoAnterior)}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Em Aberto (Mês Anterior) */}
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Total em Aberto</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-emaberto-ant">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-secondary lh-1"
                                onClick={abrirEmAbertoAnterior}
                                disabled={!!errorEmAbertoAnterior}
                                aria-label="Detalhar total em aberto mês anterior"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-secondary mt-2 mb-0">
                          {renderBlockedValue(totalEmAbertoAnterior, loadingEmAbertoAnterior, errorEmAbertoAnterior, { block: false })}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Carteira em aberto (Mês Anterior) */}
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">Carteira em aberto</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-carteira-ant">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-secondary lh-1"
                                onClick={abrirCarteiraClientesMesAnterior}
                                disabled={!!errorCobrancasEspeciaisMesAnterior}
                                aria-label="Detalhar carteira em aberto mês anterior"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-secondary mt-2 mb-0">
                          {renderBlockedValue(totalCobrancasEspeciaisMesAnterior, loadingCobrancasEspeciaisMesAnterior, errorCobrancasEspeciaisMesAnterior)}
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="gestpro-section-divider" />
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Faturamento 111 (Diário)</h6>
                </div>

                <div className="row g-2">
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2 d-flex flex-column">
                        <small className="text-muted">Venda Líquida</small>
                        <h4 className="text-success mt-1 mb-2">
                          {renderBlockedValue(totalVendaDiaria, loadingFaturamento111, errorFaturamento111)}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2 d-flex flex-column">
                        <small className="text-muted">Devolução</small>
                        <h4 className="text-danger mt-1 mb-2">
                          {renderBlockedValue(totalDevolucaoDiaria, loadingFaturamento111, errorFaturamento111, { block: false })}
                        </h4>
                      </div>
                    </div>
                  </div>



                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2 d-flex flex-column">
                        <small className="text-muted">N° Notas Faturadas</small>
                        <h4 className="text-info mt-1 mb-2">
                          {renderBlockedValue(qtdNotasFaturadas, loadingFaturamento111, errorFaturamento111, { block: true, isCurrency: false })}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2 d-flex flex-column">
                        <small className="text-muted">Ticket Médio</small>
                        <h4 className="text-warning mt-1 mb-2">
                          {renderBlockedValue(ticketMedioDiario, loadingFaturamento111, errorFaturamento111)}
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="gestpro-section-divider" />
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Campanhas de Vendas</h6>
                </div>

                <div className="row g-2">
                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">R$ {mesAtualLabel}</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-campanha-vendas-mes-atual">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-primary lh-1"
                                onClick={abrirCampanhaVendasMesAtual}
                                disabled={!!errorCampanhaVendasPorOffset[0]}
                                aria-label="Detalhar"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-primary mt-2 mb-0">
                          {renderBlockedValue(totalCampanhaVendasMesAtual, loadingCampanhaVendasPorOffset[0], errorCampanhaVendasPorOffset[0])}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">R$ {mesAnteriorLabel}</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-campanha-vendas-mes-anterior">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-secondary lh-1"
                                onClick={abrirCampanhaVendasMesAnterior}
                                disabled={!!errorCampanhaVendasPorOffset[1]}
                                aria-label="Detalhar"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-secondary mt-2 mb-0">
                          {renderBlockedValue(totalCampanhaVendasMesAnterior, loadingCampanhaVendasPorOffset[1], errorCampanhaVendasPorOffset[1])}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-2">
                    <div className="card border-0 bg-light h-100">
                      <div className="card-body p-2">
                        <div className="d-flex justify-content-between align-items-start">
                          <small className="text-muted">R$ {mesAntesAnteriorLabel}</small>
                          <OverlayTrigger
                            placement="top"
                            trigger={["hover", "focus"]}
                            overlay={<Tooltip id="gestpro-tooltip-detalhar-campanha-vendas-mes-antes-anterior">Detalhar</Tooltip>}
                          >
                            <span className="d-inline-flex">
                              <button
                                type="button"
                                className="btn p-0 border-0 bg-transparent text-secondary lh-1"
                                onClick={abrirCampanhaVendasMesAntesAnterior}
                                disabled={!!errorCampanhaVendasPorOffset[2]}
                                aria-label="Detalhar"
                              >
                                <Search size={16} />
                              </button>
                            </span>
                          </OverlayTrigger>
                        </div>
                        <h4 className="text-secondary mt-2 mb-0">
                          {renderBlockedValue(totalCampanhaVendasMesAntesAnterior, loadingCampanhaVendasPorOffset[2], errorCampanhaVendasPorOffset[2])}
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>

                {campanhaVendasOffsetAberto !== null && (
                  <div>
                    <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.5)" }} />
                    <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103 }}>
                      <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
                        <div className="modal-content" style={{ fontSize: "0.75rem", maxHeight: "85vh" }}>
                          <div className="modal-header py-2">
                            <div className="d-flex align-items-center w-100">
                              <h5 className="modal-title mb-0" style={{ fontSize: "0.9rem" }}>
                                {campanhaVendedorSelecionado
                                  ? campanhaPedidoSelecionado
                                    ? `Pedido ${campanhaPedidoSelecionado} - ${campanhaVendedorSelecionado.nome} (${campanhaMesLabelAtivo})`
                                    : `Pedidos - ${campanhaVendedorSelecionado.nome} (${campanhaMesLabelAtivo})`
                                  : `Campanha de Vendas (${campanhaMesLabelAtivo}) Fornecedor 1207 - LM`}
                              </h5>
                              <div className="d-flex align-items-center gap-2 ms-auto">
                                {campanhaVendedorSelecionado && (
                                  <OverlayTrigger
                                    placement="top"
                                    trigger={["hover", "focus"]}
                                    container={tooltipContainer}
                                    overlay={<Tooltip id="gestpro-tooltip-voltar-campanha-vendas" style={{ zIndex: 4000 }}>Voltar</Tooltip>}
                                  >
                                    <span className="d-inline-flex">
                                      <button
                                        type="button"
                                        className="btn p-0 border-0 bg-transparent text-secondary lh-1"
                                        onClick={() => {
                                          if (campanhaPedidoSelecionado) {
                                            setCampanhaPedidoSelecionado(null);
                                            return;
                                          }
                                          setCampanhaVendedorSelecionado(null);
                                        }}
                                        aria-label="Voltar"
                                      >
                                        <ArrowLeft size={20} />
                                      </button>
                                    </span>
                                  </OverlayTrigger>
                                )}
                                <OverlayTrigger
                                  placement="top"
                                  trigger={["hover", "focus"]}
                                  container={tooltipContainer}
                                  overlay={<Tooltip id="gestpro-tooltip-fechar-campanha-vendas" style={{ zIndex: 4000 }}>Fechar</Tooltip>}
                                >
                                  <span className="d-inline-flex">
                                    <button type="button" className="btn-close" aria-label="Fechar" onClick={fecharCampanhaVendasMesAnterior} />
                                  </span>
                                </OverlayTrigger>
                              </div>
                            </div>
                          </div>

                          <div className="modal-body" style={{ overflow: "auto" }}>
                            <div className="d-flex align-items-center justify-content-end mb-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-flex align-items-center"
                                onClick={() => loadCampanhaVendas(campanhaOffsetAtivo)}
                                disabled={loadingCampanhaVendasPorOffset[campanhaOffsetAtivo]}
                              >
                                <ArrowRepeat className="me-2" />
                                Atualizar
                              </button>
                            </div>

                            {loadingCampanhaVendasPorOffset[campanhaOffsetAtivo] && (
                              <div className="d-flex align-items-center gap-2 text-primary">
                                <div className="spinner-border spinner-border-sm" role="status" />
                                <span>Carregando...</span>
                              </div>
                            )}

                            {errorCampanhaVendasPorOffset[campanhaOffsetAtivo] && (
                              <div className="alert alert-danger py-2">{errorCampanhaVendasPorOffset[campanhaOffsetAtivo]}</div>
                            )}

                            {!loadingCampanhaVendasPorOffset[campanhaOffsetAtivo] && !errorCampanhaVendasPorOffset[campanhaOffsetAtivo] && !campanhaVendedorSelecionado && (
                              <div className="table-responsive">
                                <table className="table table-sm table-striped align-middle">
                                  <thead>
                                    <tr>
                                      <th>Vendedor(a)</th>
                                      <th className="text-end">Pedidos</th>
                                      <th className="text-end">Itens</th>
                                      <th className="text-end">Total</th>
                                      <th className="text-end">Detalhar</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {campanhaResumoPorVendedor.map((v) => (
                                      <tr key={`${v.codusur}-${v.nome}`}>
                                        <td>{v.nome}</td>
                                        <td className="text-end">{v.pedidos}</td>
                                        <td className="text-end">{v.itens}</td>
                                        <td className="text-end fw-bold">{currency(v.total)}</td>
                                        <td className="text-end">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => setCampanhaVendedorSelecionado({ codusur: v.codusur, nome: v.nome })}
                                          >
                                            Ver pedidos
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                    {campanhaResumoPorVendedor.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="text-center text-muted py-3">Sem dados</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {!loadingCampanhaVendasPorOffset[campanhaOffsetAtivo] && !errorCampanhaVendasPorOffset[campanhaOffsetAtivo] && campanhaVendedorSelecionado && (
                              <div className="table-responsive">
                                <table className="table table-sm table-striped align-middle">
                                  <thead>
                                    <tr>
                                      <th>Data</th>
                                      <th>Pedido</th>
                                      <th>Cliente</th>
                                      <th className="text-end">Qt</th>
                                      <th className="text-end">Total</th>
                                      <th className="text-end">{campanhaPedidoSelecionado ? "Produto" : "Detalhar"}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {!campanhaPedidoSelecionado && campanhaPedidosDoVendedor.map((p) => (
                                      <tr key={p.pedido}>
                                        <td>{dateBR(p.data)}</td>
                                        <td>{p.pedido}</td>
                                        <td title={p.cliente}>{p.cliente}</td>
                                        <td className="text-end">{p.qt}</td>
                                        <td className="text-end fw-bold">{currency(p.total)}</td>
                                        <td className="text-end">
                                          <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => setCampanhaPedidoSelecionado(p.pedido)}
                                          >
                                            Itens
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                    {!campanhaPedidoSelecionado && campanhaPedidosDoVendedor.length === 0 && (
                                      <tr>
                                        <td colSpan={6} className="text-center text-muted py-3">Sem pedidos</td>
                                      </tr>
                                    )}
                                    {!!campanhaPedidoSelecionado && campanhaItensDoPedidoSelecionado.map((it, idx) => (
                                      <tr key={`${it.pedido}-${it.codProd}-${idx}`}>
                                        <td>{dateBR(it.data)}</td>
                                        <td>{it.pedido}</td>
                                        <td title={it.cliente}>{it.cliente}</td>
                                        <td className="text-end">{it.qt.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                                        <td className="text-end fw-bold">{currency(it.total)}</td>
                                        <td className="text-end">
                                          <span className="text-muted">{it.codProd} - {it.descricao}</span>
                                        </td>
                                      </tr>
                                    ))}
                                    {!!campanhaPedidoSelecionado && campanhaItensDoPedidoSelecionado.length === 0 && (
                                      <tr>
                                        <td colSpan={6} className="text-center text-muted py-3">Sem itens</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                          <div className="modal-footer py-2">
                            <div className="ms-auto d-flex align-items-center gap-2">
                              <span className="text-muted">Total:</span>
                              <span className="fw-bold">
                                {campanhaVendedorSelecionado
                                  ? campanhaPedidoSelecionado
                                    ? currency(campanhaTotaisDoPedido?.totalValor || 0)
                                    : currency(campanhaTotaisDoVendedor?.totalValor || 0)
                                  : currency(totalCampanhaVendasSelecionada)}
                              </span>
                              {campanhaVendedorSelecionado ? (
                                <span className="fw-bold">
                                  {campanhaPedidoSelecionado ? (campanhaTotaisDoPedido?.pedidos || 0) : (campanhaTotaisDoVendedor?.pedidos || 0)} pedidos,{" "}
                                  {(campanhaPedidoSelecionado ? (campanhaTotaisDoPedido?.totalQt || 0) : (campanhaTotaisDoVendedor?.totalQt || 0)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} qt
                                </span>
                              ) : (
                                <span className="text-muted">({campanhaVendasSelecionadas.length} itens)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {/* Modal Comissões por Liquidez */}
                {showLiquidez && (
                  <LiquidezModal
                    rows={comissoes}
                    loading={loadingComissoes}
                    error={errorComissoes}
                    onClose={fecharLiquidez}
                    title="Comissões por Liquidez (Mês Atual)"
                  />
                )}

                {/* Modal Comissões por Liquidez (Mês Anterior) */}
                {showLiquidezAnterior && (
                  <LiquidezModal
                    rows={comissoesAnterior}
                    loading={loadingComissoesAnterior}
                    error={errorComissoesAnterior}
                    onClose={fecharLiquidezAnterior}
                    title={`Comissões por Liquidez (${mesAnteriorLabel})`}
                  />
                )}

                {/* Modal Comissões por Frete (Mês Atual) */}
                {showFrete && (
                  <FreteModal
                    rows={freteResumoAtualPorVendedor}
                    detailRows={frete}
                    loading={loadingFrete}
                    error={errorFrete}
                    onClose={fecharFrete}
                    title="Frete por Liquidez (Mês atual)"
                  />
                )}

                {showFreteEmAbertoAtual && (
                  <FreteModal
                    rows={freteEmAbertoResumoAtualPorVendedor}
                    detailRows={freteEmAbertoAtual}
                    loading={loadingFreteEmAbertoAtual}
                    error={errorFreteEmAbertoAtual}
                    onClose={fecharFreteEmAbertoAtual}
                    title="Frete em Aberto (Mês atual)"
                  />
                )}

                {/* Modal Em Aberto (Mês Atual) */}
                {showEmAberto && (
                  <EmAbertoModal
                    rows={emAberto}
                    loading={loadingEmAberto}
                    error={errorEmAberto}
                    onClose={fecharEmAberto}
                    title="Em Aberto (Mês Atual)"
                  />
                )}
                
                {/* Modal Em Aberto Carteira Clientes (Resumo por Vendedor) */}
                {showCarteiraClientes && (
                  <EmAbertoModal
                    rows={emAbertoCarteira}
                    loading={false}
                    error={null}
                    onClose={fecharCarteiraClientes}
                    title="Em aberto Carteira Clientes"
                    filtroCobrancaInicial={["CTB", "CTC", "CTD", "CTDI", "CTDP", "CTP", "CART"]}
                  />
                )}

                {/* Modal Comissões por Frete (Mês Anterior) */}
                {showFreteAnterior && (
                  <FreteModal
                    rows={freteResumoAnteriorPorVendedor}
                    detailRows={freteAnterior}
                    loading={loadingFreteAnterior}
                    error={errorFreteAnterior}
                    onClose={fecharFreteAnterior}
                    title={`Frete por Liquidez (${mesAnteriorLabel})`}
                  />
                )}

                {/* Modal Frete em Aberto (Mês Anterior) */}
                {showFreteEmAbertoAnterior && (
                  <FreteModal
                    rows={freteEmAbertoResumoAnteriorPorVendedor}
                    detailRows={freteEmAbertoAnterior}
                    loading={loadingFreteEmAbertoAnterior}
                    error={errorFreteEmAbertoAnterior}
                    onClose={fecharFreteEmAbertoAnterior}
                    title={`Frete em Aberto (${mesAnteriorLabel})`}
                  />
                )}

                {/* Modal Em Aberto (Mês Anterior) */}
                {showEmAbertoAnterior && (
                  <EmAbertoModal
                    rows={emAbertoAnterior}
                    loading={loadingEmAbertoAnterior}
                    error={errorEmAbertoAnterior}
                    onClose={fecharEmAbertoAnterior}
                    title={`Em Aberto (${mesAnteriorLabel})`}
                    mesAnterior
                  />
                )}

                {/* Modal Em Aberto Carteira Clientes (Resumo por Vendedor - Mês Anterior) */}
                {showCarteiraClientesMesAnterior && (
                  <EmAbertoModal
                    rows={emAbertoCarteiraMesAnterior}
                    loading={false}
                    error={null}
                    onClose={fecharCarteiraClientesMesAnterior}
                    title={`Em aberto Carteira Clientes (${mesAnteriorLabel})`}
                    mesAnterior
                    filtroCobrancaInicial={["CTB", "CTC", "CTD", "CTDI", "CTDP", "CTP", "CART"]}
                  />
                )}

                {showBuscaAvancadaProd && (
                  <div>
                    <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.5)" }} />
                    <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103 }}>
                      <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
                        <div className="modal-content" style={{ fontSize: "0.75rem", maxHeight: "85vh" }}>
                          <div className="modal-header py-2">
                            <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Busca Avançada por Descrição (GestPRO)</h5>
                            <button type="button" className="btn-close" aria-label="Fechar" onClick={fecharBuscaAvancadaProd} />
                          </div>
                          <ModalBuscaAvancadaDescricaoGestpro
                            codFilialSel={String(usuario?.codfilial || (usuario as any)?.CODFILIAL || "")}
                            descricaoInicial=""
                            onCancelar={fecharBuscaAvancadaProd}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showClientesSemVenda && (
                  <ClientesSemVendaModal onClose={fecharClientesSemVenda} />
                )}

                {showProdutosDisponiveis && (
                  <ProdutosDisponiveisModal onClose={fecharProdutosDisponiveis} />
                )}

                {showAjusteEstoque && (
                  <AjusteEstoqueModal 
                    onClose={fecharAjusteEstoque} 
                    codUsuario={usuario?.codusur || (usuario as any)?.CODUSUR || usuario?.matricula || (usuario as any)?.MATRICULA}
                    codFilial={usuario?.codfilial || (usuario as any)?.CODFILIAL}
                  />
                )}

                {showTokensPrecoFixo && (
                  <TokensPrecoFixoModal onClose={fecharTokensPrecoFixo} />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      <footer className="bg-white text-muted border-top flex-shrink-0" style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>
        <div className="container-fluid px-4 py-1 d-flex justify-content-center">
          <span>GestPRO - 2026</span>
        </div>
      </footer>

      {showPegarLocalizacao && (
        <div>
          <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.6)", position: "fixed", inset: 0 }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103, position: "fixed", inset: 0 }}>
            <div className="modal-dialog modal-fullscreen" role="document">
              <div className="modal-content" style={{ fontSize: "0.95rem" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "1rem" }}>Pegar Localização</h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowPegarLocalizacao(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "1rem", overflowY: "auto", backgroundColor: "#f8f9fa" }}>
                  {loadingPendencias && <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>}
                  {errorPendencias && <div className="alert alert-danger">{errorPendencias}</div>}

                  {!loadingPendencias && !errorPendencias && (
                    <PegarLocalizacaoCard
                      pendencias={pendencias}
                      bodyHeight="calc(100vh - 160px)"
                      onLocate={(pd: PedidoDetalhe, options?: { autoUpdateStatus18?: boolean }) => {
                        setShowPegarLocalizacao(false);
                        setPedidoLocalizacao(pd);
                        setLocalizacaoOptions(options || null);
                        setShowLocationModal(true);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCortePendencias && (
        <div>
          <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.6)", position: "fixed", inset: 0 }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103, position: "fixed", inset: 0 }}>
            <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
              <div className="modal-content" style={{ fontSize: "0.95rem", maxHeight: "85vh" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "1rem" }}>Corte</h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowCortePendencias(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "1rem", overflowY: "auto", backgroundColor: "#f8f9fa" }}>
                  {loadingPendencias && <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>}
                  {errorPendencias && <div className="alert alert-danger">{errorPendencias}</div>}

                  {!loadingPendencias && !errorPendencias && (
                    <CortePendenciasCard
                      pendencias={pendencias}
                      bodyHeight="calc(85vh - 160px)"
                      onRefresh={loadPendencias}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCorteRealizadoPendencias && (
        <div>
          <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.6)", position: "fixed", inset: 0 }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103, position: "fixed", inset: 0 }}>
            <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
              <div className="modal-content" style={{ fontSize: "0.95rem", maxHeight: "85vh" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "1rem" }}>Corte Realizado</h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowCorteRealizadoPendencias(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "1rem", overflowY: "auto", backgroundColor: "#f8f9fa" }}>
                  {loadingPendencias && <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>}
                  {errorPendencias && <div className="alert alert-danger">{errorPendencias}</div>}

                  {!loadingPendencias && !errorPendencias && (
                    <CorteRealizadoPendenciasCard
                      pendencias={pendencias}
                      bodyHeight="calc(85vh - 160px)"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showColetaPendencias && (
        <div>
          <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.6)", position: "fixed", inset: 0 }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103, position: "fixed", inset: 0 }}>
            <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
              <div className="modal-content" style={{ fontSize: "0.95rem", maxHeight: "85vh" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "1rem" }}>Coleta</h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowColetaPendencias(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "1rem", overflowY: "auto", backgroundColor: "#f8f9fa" }}>
                  {loadingPendencias && <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>}
                  {errorPendencias && <div className="alert alert-danger">{errorPendencias}</div>}

                  {!loadingPendencias && !errorPendencias && (
                    <ColetaPendenciasCard
                      pendencias={pendencias}
                      bodyHeight="calc(85vh - 160px)"
                      onRefresh={loadPendencias}
                      onBeforeColeta={() => setShowColetaPendencias(false)}
                      onColeta={(pd: PedidoDetalhe) => { setPedidoColeta(pd); setShowConfirmEnvio(true); }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showColetaSeparandoPendencias && (
        <div>
          <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.6)", position: "fixed", inset: 0 }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103, position: "fixed", inset: 0 }}>
            <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
              <div className="modal-content" style={{ fontSize: "0.95rem", maxHeight: "85vh" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "1rem" }}>Coleta Separando</h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowColetaSeparandoPendencias(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "1rem", overflowY: "auto", backgroundColor: "#f8f9fa" }}>
                  {loadingPendencias && <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>}
                  {errorPendencias && <div className="alert alert-danger">{errorPendencias}</div>}

                  {!loadingPendencias && !errorPendencias && (
                    <ColetaSeparandoPendenciasCard
                      pendencias={pendencias}
                      bodyHeight="calc(85vh - 160px)"
                      onRefresh={loadPendencias}
                      onPrint={(pd: PedidoDetalhe) => {
                        const printWindow = window.open('', '_blank', 'width=1000,height=800');
                        if (!printWindow) return;

                        const formatDateBR = (d: string | Date | null | undefined) => {
                          if (!d) return '-';
                          try {
                            const date = typeof d === 'string' ? new Date(d) : d;
                            if (isNaN(date.getTime())) return String(d);
                            return date.toLocaleDateString('pt-BR');
                          } catch {
                            return String(d);
                          }
                        };

                        const now = new Date();
                        const dataHoraImpressao = now.toLocaleString('pt-BR');
                        const usuarioNome = usuario?.usuario || 'N/A';

                        const htmlContent = `
                          <html>
                            <head>
                              <title>Mapa de Separação - Pedido ${pd.pedido}</title>
                              <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
                              <style>
                                body { font-family: 'Roboto', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 13px; margin: 0; padding: 20px; color: #333; line-height: 1.3; }
                                
                                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                                .title { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #000; }
                                .page-badge { font-size: 18px; font-weight: 800; border: 2px solid #000; padding: 4px 15px; border-radius: 6px; }

                                .section { margin-bottom: 20px; }
                                .section-title { font-size: 15px; font-weight: 700; color: #555; border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 10px; text-transform: uppercase; }

                                .grid-container { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 20px; align-items: stretch; }
                                .vertical-line { background-color: #000; width: 1px; height: 100%; }
                                
                                .left-block { border-left: 1px solid #000; padding-left: 10px; }

                                .info-group { margin-bottom: 4px; }
                                
                                .label { font-size: 12px; text-transform: uppercase; color: #333; font-weight: 700; margin-right: 4px; }
                                .label::after { content: ":"; }
                                .value { font-size: 13px; font-weight: 500; color: #000; word-break: break-word; }
                                .value-highlight { font-size: 15px; font-weight: 700; color: #000; }
                                .value-money { font-size: 15px; font-weight: 700; color: #2e7d32; }

                                .obs-box { background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 10px; border-radius: 4px; font-style: italic; font-size: 13px; }

                                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                                thead th { background-color: #f1f3f5; color: #495057; font-weight: 700; text-transform: uppercase; font-size: 11px; padding: 8px; border-bottom: 2px solid #dee2e6; text-align: left; }
                                tbody td { padding: 8px; border-bottom: 1px solid #000; vertical-align: middle; font-weight: 700; color: #000; }
                                tbody tr:nth-of-type(even) { background-color: #f8f9fa; }
                                
                                .text-center { text-align: center; }
                                .text-right { text-align: right; }
                                .fw-bold { font-weight: 700; }
                                .text-muted { color: #6c757d; }

                                .footer-print { 
                                  margin-top: 40px; 
                                  padding-top: 10px; 
                                  border-top: 1px solid #000; 
                                  text-align: right; 
                                  font-size: 14px; 
                                  color: #000; 
                                  font-weight: 700;
                                }

                                @media print {
                                  body { -webkit-print-color-adjust: exact; padding: 10px; }
                                  .obs-box { background-color: #f8f9fa !important; border-left-color: #6c757d !important; }
                                  thead th { background-color: #f1f3f5 !important; color: #000 !important; }
                                  tbody tr:nth-of-type(even) { background-color: #f8f9fa !important; }
                                }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <div class="title">Coleta Separando</div>
                                <div class="page-badge">1</div>
                              </div>

                              <div class="section">
                                <div class="grid-container">
                                  <div class="left-block">
                                    <div class="info-group">
                                      <span class="label">Pedido</span>
                                      <span class="value-highlight">${pd.pedido}</span>
                                    </div>
                                    <div class="info-group">
                                      <span class="label">Cliente</span>
                                      <span class="value">${pd.codCli} - ${pd.cliente}</span>
                                    </div>
                                    <div class="info-group">
                                      <span class="label">Vendedor(a)</span>
                                      <span class="value">${pd.vendedor || '-'}</span>
                                    </div>
                                    <div class="info-group">
                                      <span class="label">Data</span>
                                      <span class="value">${formatDateBR(pd.data)}</span>
                                    </div>
                                    <div class="info-group">
                                      <span class="label">Entrega</span>
                                      <span class="value">${pd.tipoEntrega || '-'}</span>
                                    </div>
                                  </div>

                                  <div class="vertical-line"></div>
                                  
                                  <div>
                                     <div class="info-group">
                                      <span class="label">Total do Pedido</span>
                                      <span class="value-money">${currency(pd.vlTotal)}</span>
                                    </div>
                                    
                                    <div class="info-group">
                                          <span class="label">Filial retira</span>
                                          <span class="value">${pd.codFilialRetira || '1'}</span>
                                    </div>
                                    <div class="info-group">
                                          <span class="label">Separador</span>
                                          <span class="value">${pd.separador || '-'}</span>
                                    </div>
                                    <div class="info-group">
                                          <span class="label">Emissor</span>
                                          <span class="value">${pd.emissorMapa || '-'}</span>
                                    </div>
                                    <div class="info-group">
                                          <span class="label">Vias</span>
                                          <span class="value">${pd.viasMapa || '-'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              ${(pd.obs || pd.obs1 || pd.obs2) ? `
                              <div class="section">
                                <div class="section-title">Observações do Pedido</div>
                                <div class="obs-box">
                                  ${[pd.obs, pd.obs1, pd.obs2].filter(Boolean).join(' ')}
                                </div>
                              </div>
                              ` : ''}

                              ${(pd.obsEntrega1 || pd.obsEntrega2 || pd.obsEntrega3) ? `
                              <div class="section">
                                <div class="section-title">Observações de Entrega</div>
                                <div class="obs-box">
                                  ${[pd.obsEntrega1, pd.obsEntrega2, pd.obsEntrega3].filter(Boolean).join(' ')}
                                </div>
                              </div>
                              ` : ''}

                              <div class="section">
                                <div class="section-title">Itens para Separação</div>
                                <table>
                                  <thead>
                                    <tr>
                                      <th style="width: 8%">Cód.</th>
                                      <th style="width: 32%">Descrição</th>
                                      <th class="text-center" style="width: 7%">Múlt.</th>
                                      <th class="text-center" style="width: 7%">Master</th>
                                      <th class="text-center" style="width: 8%">Qtd</th>
                                      <th class="text-center" style="width: 8%">Total</th>
                                      <th class="text-center" style="width: 10%">Posição</th>
                                      <th class="text-center" style="width: 20%">Cód.Barras</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    ${pd.items.map(item => `
                                      <tr>
                                        <td>${item.codProd || ''}</td>
                                        <td>${item.descricao}</td>
                                        <td class="text-center">${item.multiplo || ''}</td>
                                        <td class="text-center">${item.embalagemMaster || ''}</td>
                                        <td class="text-center"><span style="font-size: 15px;">${item.quantidade}</span></td>
                                        <td class="text-center">${item.qtTotal || calcQtdTotal(item.quantidade, item.multiplo || 1)} ${item.embalagemMaster || ''}</td>
                                        <td class="text-center">${item.posicao || ''}</td>
                                        <td class="text-center"></td>
                                      </tr>
                                    `).join('')}
                                  </tbody>
                                </table>
                              </div>

                              <div class="footer-print">
                                <div>Gerado em: ${dataHoraImpressao} &bull; Usuário: ${usuarioNome}</div>
                                <div style="margin-top: 5px;">GestPRO</div>
                                <div style="margin-top: 2px;">Este documento não tem validade fiscal</div>
                              </div>

                              <script>
                                window.onload = function() {
                                    setTimeout(function() {
                                        window.print();
                                    }, 500);
                                }
                              </script>
                            </body>
                          </html>
                        `;
                        printWindow.document.open();
                        printWindow.document.write(htmlContent);
                        printWindow.document.close();
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAguardandoFornecedorPendencias && (
        <div>
          <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.6)", position: "fixed", inset: 0 }} />
          <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103, position: "fixed", inset: 0 }}>
            <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
              <div className="modal-content" style={{ fontSize: "0.95rem", maxHeight: "85vh" }}>
                <div className="modal-header py-2">
                  <h5 className="modal-title" style={{ fontSize: "1rem" }}>Aguardando Fornecedor</h5>
                  <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowAguardandoFornecedorPendencias(false)} />
                </div>
                <div className="modal-body" style={{ fontSize: "1rem", overflowY: "auto", backgroundColor: "#f8f9fa" }}>
                  {loadingPendencias && <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>}
                  {errorPendencias && <div className="alert alert-danger">{errorPendencias}</div>}

                  {!loadingPendencias && !errorPendencias && (
                    <AguardandoFornecedorPendenciasCard
                      pendencias={pendencias}
                      bodyHeight="calc(85vh - 160px)"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPedidosAnalise && (
        <PedidosParaAnaliseModal
          onClose={() => {
            setShowPedidosAnalise(false);
            setPedidosAnaliseInitialOpen(null);
          }}
          initialOpen={pedidosAnaliseInitialOpen}
        />
      )}

      {showSoFaturar15 && (
        <SoFaturarSidebarModal
          onClose={() => setShowSoFaturar15(false)}
        />
      )}

      {showRetMessejana20 && (
        <RetMessejanaSidebarModal
          onClose={() => setShowRetMessejana20(false)}
        />
      )}

      {showConciliacaoTV7 && (
        <ConciliacaoTV7Modal
          onClose={() => setShowConciliacaoTV7(false)}
        />
      )}

      {showPedidosPrioridade && (
        <PedidosPrioridadeModal
          onClose={() => setShowPedidosPrioridade(false)}
        />
      )}
      {showLocationModal && pedidoLocalizacao && (
        <LocalizacaoEntregaModal
          show={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          pedido={pedidoLocalizacao}
          autoUpdateStatus18={localizacaoOptions?.autoUpdateStatus18}
          onStatusUpdated={() => {
            loadPendencias();
          }}
        />
      )}
      {pedidoColeta && (
        <ConfirmarEnvioModal
          show={showConfirmEnvio}
          targetStatus={21}
          onClose={() => { setShowConfirmEnvio(false); setPedidoColeta(null); }}
          pedido={pedidoColeta}
          onStatusUpdated={() => {
            loadPendencias();
          }}
          zIndex={3150}
        />
      )}
    </div>
  );
};

export default Gestpro;
