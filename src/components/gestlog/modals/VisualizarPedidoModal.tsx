import React from 'react';
import LocalizacaoEntregaModal from '../LocalizacaoEntregaModal';
import ValidarCepModal from '../ValidarCepModal';
import MapaExpedicaoModal from './MapaExpedicaoModal';
import ConfirmarEnvioModal from './ConfirmarEnvioModal';
import ConfirmarPegarLocalizacaoModal from './ConfirmarPegarLocalizacaoModal';
import RotasPedidosModal from '../roterizacao/modals/RotasPedidosModal';
import TelaGeralRotas from './TelaGeralRotas';
import { buscarLogs } from '../../../services/gestlog/BuscarLogs';
import { atualizarStatusEspecial, atualizarStatusPedido } from '../../../services/gestlog/MarcarVisualizacao';
import { BoxArrowRight, Scissors, Printer, FileText, ClipboardCheck, PlusCircle, Calendar3, HourglassSplit, Layers, Alarm, Signpost2, CashCoin, BoxSeam, Send, StarFill, Calendar3Week, ArrowRepeat, Search, ChatLeftText, GeoAlt, ArrowLeft, X, ClipboardPlus } from 'react-bootstrap-icons';

export type PedidoItem = {
  descricao: string;
  quantidade: number | string;
  codigoDeBarras?: string;
  codProd?: number;
  multiplo?: number;
  embalagemMaster?: number;
  embalagem?: string;
  qtTotal?: string;
  posicao?: string;
};

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

export type PedidoDetalhe = {
  pedido: string;
  data: string | Date;
  tipoEntrega: string;
  cliente: string;
  codFilial: string;
  codFilialRetira?: string;
  codCli?: number;
  cobranca?: string;
  vendedor?: string;
  bairroEnt?: string;
  enderEnt?: string;
  numeroEnt?: string;
  municEnt?: string;
  telEnt?: string;
  cep?: string;
  posicao?: string;
  obs?: string;
  obs1?: string;
  obs2?: string;
  obsEntrega1?: string;
  obsEntrega2?: string;
  obsEntrega3?: string;
  log3?: string;
  vlFrete?: number;
  items: PedidoItem[];
  ageDays: number;
  normalizedDate: Date | null;
  statusPedido?: number;
  vlTotal?: number;
  separador?: string;
  emissorMapa?: string;
  viasMapa?: number;
  log2Real?: string;
};

export type PedidoResumo = {
  pedido: string;
  cliente: string;
  bairroEnt?: string;
  normalizedDate: Date | null;
  itens: number;
  statusPedido: number;
  posicao?: string;
  codFilialRetira?: string;
};

export interface VisualizarPedidoModalProps {
  show: boolean;
  onClose: () => void;
  pedido: PedidoDetalhe;
  onStatusUpdated?: () => void;
  outrosPedidos?: PedidoResumo[];
  abrirPedido?: (pedidoNum: number) => void;
  matricula?: string;
}

const isPresent = (s?: string) => {
  if (s == null) return false;
  const t = String(s).trim();
  if (t.length === 0) return false;
  const hyphenOnly = /^[-–—]+$/.test(t);
  return !hyphenOnly;
};

const VisualizarPedidoModal: React.FC<VisualizarPedidoModalProps> = ({ show, onClose, pedido, onStatusUpdated, outrosPedidos = [], abrirPedido, matricula }) => {
  const hasObs = isPresent(pedido.obs) || isPresent(pedido.obs1) || isPresent(pedido.obs2);
  const hasObsEntrega = isPresent(pedido.obsEntrega1) || isPresent(pedido.obsEntrega2) || isPresent(pedido.obsEntrega3);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [confirmSep, setConfirmSep] = React.useState<boolean>(false);
  const [confirmPegarLocalizacao, setConfirmPegarLocalizacao] = React.useState<boolean>(false);
  const [confirmCorte, setConfirmCorte] = React.useState<boolean>(false);
  const [corteMotivo, setCorteMotivo] = React.useState<string>('');
  const [showPrintModal, setShowPrintModal] = React.useState<boolean>(false);
  const [printUser, setPrintUser] = React.useState<string>('APP');
  const [printAt, setPrintAt] = React.useState<Date | null>(null);
  const [statusLabelAtual, setStatusLabelAtual] = React.useState<string | null>(null);
  const [showTriagemBlockModal, setShowTriagemBlockModal] = React.useState<boolean>(false);
  const [triagemBlockMsg, setTriagemBlockMsg] = React.useState<string>('');
  const [showColetaFilialBlockCard, setShowColetaFilialBlockCard] = React.useState<boolean>(false);
  const [coletaFilialBlockMsg, setColetaFilialBlockMsg] = React.useState<string>('');
  const [inventoryItem, setInventoryItem] = React.useState<PedidoItem | null>(null);
  const [showInventoryModal, setShowInventoryModal] = React.useState<boolean>(false);
  const [messageModal, setMessageModal] = React.useState<{ show: boolean; title: string; content: string; isError?: boolean }>({ show: false, title: '', content: '' });
  const [blinkAgeDays, setBlinkAgeDays] = React.useState<boolean>(false);
  const [pendentesInventario, setPendentesInventario] = React.useState<number[]>([]);
  const [showLocationModal, setShowLocationModal] = React.useState<boolean>(false);
  const [showValidarCepModal, setShowValidarCepModal] = React.useState<boolean>(false);
  const [showIncluirRotaModal, setShowIncluirRotaModal] = React.useState<boolean>(false);
  const [showTelaGeralRotas, setShowTelaGeralRotas] = React.useState<boolean>(false);
  const [pedidoVinculoRota, setPedidoVinculoRota] = React.useState<{
    loading: boolean;
    found: boolean;
    rota?: {
      idRota: number;
      descricaoRota?: string | null;
      dataRota?: string | Date | null;
      turnoSeparacao?: string | null;
      codMotorista?: number | null;
      motoristaNome?: string | null;
      codVeiculo?: number | null;
      veiculoDescricao?: string | null;
      veiculoPlaca?: string | null;
      dataAdd?: string | Date | null;
    };
  }>({ loading: false, found: false });
  
  const [validatedCepData, setValidatedCepData] = React.useState<{
    cep: string;
    logradouro: string;
    complemento: string;
    bairro: string;
    localidade: string;
    uf: string;
    erro?: boolean;
  } | null>(null);

  const [hasValidatedAddress, setHasValidatedAddress] = React.useState<boolean>(false);

  const [addressData, setAddressData] = React.useState<{
    enderEnt?: string;
    numeroEnt?: string;
    bairroEnt?: string;
    municEnt?: string;
    cepEnt?: string;
  }>({
    enderEnt: pedido.enderEnt,
    numeroEnt: pedido.numeroEnt,
    bairroEnt: pedido.bairroEnt,
    municEnt: pedido.municEnt,
    cepEnt: undefined
  });

  React.useEffect(() => {
    setHasValidatedAddress(false);
    setShowColetaFilialBlockCard(false);
    setColetaFilialBlockMsg('');
    setAddressData({
      enderEnt: pedido.enderEnt,
      numeroEnt: pedido.numeroEnt,
      bairroEnt: pedido.bairroEnt,
      municEnt: pedido.municEnt,
      cepEnt: undefined
    });
  }, [pedido]);

  React.useEffect(() => {
    const numped = Number(pedido?.pedido);
    if (!show || !Number.isFinite(numped)) {
      setPedidoVinculoRota({ loading: false, found: false });
      return;
    }
    let alive = true;
    setPedidoVinculoRota(prev => ({ ...prev, loading: true }));
    fetch(`/api/gestlog/rotas/pedidos/${numped}/vinculo`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const t = typeof data?.message === 'string' ? data.message : 'Falha ao validar vínculo do pedido';
          throw new Error(t);
        }
        return data as {
          found?: boolean;
          rota?: {
            idRota?: number;
            descricaoRota?: string | null;
            dataRota?: string | null;
            turnoSeparacao?: string | null;
            codMotorista?: number | null;
            motoristaNome?: string | null;
            codVeiculo?: number | null;
            veiculoDescricao?: string | null;
            veiculoPlaca?: string | null;
            dataAdd?: string | null;
          };
        };
      })
      .then((data) => {
        if (!alive) return;
        const found = Boolean(data?.found);
        const idRota = Number(data?.rota?.idRota);
        const rota = found && Number.isFinite(idRota)
          ? {
            idRota,
            descricaoRota: data?.rota?.descricaoRota ?? null,
            dataRota: data?.rota?.dataRota ?? null,
            turnoSeparacao: data?.rota?.turnoSeparacao ?? null,
            codMotorista: data?.rota?.codMotorista ?? null,
            motoristaNome: data?.rota?.motoristaNome ?? null,
            codVeiculo: data?.rota?.codVeiculo ?? null,
            veiculoDescricao: data?.rota?.veiculoDescricao ?? null,
            veiculoPlaca: data?.rota?.veiculoPlaca ?? null,
            dataAdd: data?.rota?.dataAdd ?? null,
          }
          : undefined;
        setPedidoVinculoRota({ loading: false, found, rota });
      })
      .catch(() => {
        if (!alive) return;
        setPedidoVinculoRota({ loading: false, found: false });
      });
    return () => { alive = false; };
  }, [show, pedido?.pedido]);

  React.useEffect(() => {
    const ageDaysNum = Number(pedido.ageDays);
    if (!show || !Number.isFinite(ageDaysNum) || ageDaysNum < 3) {
      setBlinkAgeDays(false);
      return;
    }
    const intervalId = window.setInterval(() => {
      setBlinkAgeDays(prev => !prev);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [show, pedido.ageDays]);
  

  

  const checkPendencias = React.useCallback(async () => {
    if (!pedido?.items || pedido.items.length === 0) return;
    const codProds = pedido.items.map(it => it.codProd).filter(c => c != null) as number[];
    if (codProds.length === 0) return;

    try {
      const res = await fetch('/api/gestlog/inventario/verificar-pendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codProds })
      });
      const data = await res.json();
      if (Array.isArray(data.pendentes)) {
        setPendentesInventario(data.pendentes);
      }
    } catch (err) {
      console.error('Erro ao verificar pendencias', err);
    }
  }, [pedido?.items]);

  React.useEffect(() => {
    if (show) {
      checkPendencias();
    }
  }, [show, checkPendencias]);


  // Helpers de formatação usados no cabeçalho
  const formatDateBR = (d: string | Date) => {
    try {
      const date = typeof d === 'string' ? new Date(d) : d;
      if (isNaN(date.getTime())) return String(d);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return String(d);
    }
  };

  const getTurnoLabel = (t: string): string => {
    const code = (t || '').trim() || '-';
    if (code === 'M') return 'Turno: Manhã';
    if (code === 'T') return 'Turno: Tarde';
    if (code === '-') return 'Sem turno';
    return `Turno: ${code}`;
  };

  const calcBusinessDays = (start: Date | null | undefined, end: Date = new Date()) => {
    if (!start) return null;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    if (e < s) return 0;
    const d = new Date(s);
    d.setDate(d.getDate() + 1);
    let count = 0;
    while (d <= e) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };

  const getAgeDaysSignal = (ageDaysRaw: unknown, blink: boolean) => {
    const n = Number(ageDaysRaw);
    if (!Number.isFinite(n)) return { borderClass: 'border-warning', backgroundColor: '#ffffff' };
    if (n === 1) return { borderClass: 'border-success', backgroundColor: '#d1e7dd' };
    if (n === 2) return { borderClass: 'border-primary', backgroundColor: '#cfe2ff' };
    if (n === 3) return { borderClass: 'border-warning', backgroundColor: blink ? '#fd7e14' : '#ffffff' };
    if (n >= 4) return { borderClass: 'border-danger', backgroundColor: blink ? '#dc3545' : '#ffffff' };
    return { borderClass: 'border-warning', backgroundColor: '#ffffff' };
  };

  const cleanObsText = (s?: string) => {
    if (!isPresent(s)) return '';
    const t = String(s).trim();
    return t.replace(/^obs[:\-\s]+/i, '').trim();
  };

  const formatTelefoneBr = (raw?: string): string | null => {
    if (!isPresent(raw)) return null;
    const s = String(raw);

    const formatDigits = (digitsRaw: string): string | null => {
      let digits = digitsRaw.replace(/\D/g, '');
      if (!digits) return null;

      if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
        digits = digits.slice(2);
      }

      if (digits.length === 11) {
        const ddd = digits.slice(0, 2);
        const nine = digits.slice(2);
        return `(${ddd}) ${nine.slice(0, 1)}.${nine.slice(1, 5)}-${nine.slice(5, 9)}`;
      }

      if (digits.length === 10) {
        const ddd = digits.slice(0, 2);
        const rest = digits.slice(2);
        return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
      }

      if (digits.length === 9) {
        return `${digits.slice(0, 1)}.${digits.slice(1, 5)}-${digits.slice(5, 9)}`;
      }

      if (digits.length === 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
      }

      return digits;
    };

    const candidates = s.match(/\d{8,13}/g) ?? [];
    const formatted = new Map<string, string>();
    for (const c of candidates) {
      const f = formatDigits(c);
      if (!f) continue;
      const key = f.replace(/\D/g, '');
      formatted.set(key, f);
    }

    if (formatted.size === 0) {
      const f = formatDigits(s);
      if (f) return f;
      return null;
    }

    return Array.from(formatted.values()).join(' / ');
  };

  const formatPosicao = (p?: string | null): string => {
    if (!isPresent(p ?? undefined)) return '-';
    const raw = String(p).trim();
    const upper = raw.toUpperCase();
    const labels: Record<string, string> = {
      L: 'Liberado',
      M: 'Montada',
      P: 'Pendente',
    };
    const labelFromCode = labels[upper];
    if (labelFromCode) return labelFromCode;
    const first = upper[0];
    if (first && labels[first]) return labels[first];
    const labelFromText = Object.values(labels).find(v => v.toUpperCase() === upper);
    if (labelFromText) return labelFromText;
    return raw;
  };

  const formatTipoEntrega = (t?: string | null): string => {
    if (!isPresent(t ?? undefined)) return '-';
    const raw = String(t).trim();
    const upper = raw.toUpperCase();
    const labels: Record<string, string> = {
      EF: 'Entrega Futura',
      RP: 'Retira Posterior',
      EN: 'Entrega',
    };
    if (labels[upper]) return labels[upper];
    const token = upper.split(/[\s-]+/)[0];
    if (token && labels[token]) return labels[token];
    const labelFromText = Object.values(labels).find(v => v.toUpperCase() === upper);
    if (labelFromText) return labelFromText;
    return raw;
  };



  const statusTextoAtual = (): string => {
    const base = statusLabelAtual ?? (() => {
      const n = Number(pedido?.statusPedido ?? -1);
      return Number.isFinite(n) && STATUS_LABELS[n as keyof typeof STATUS_LABELS] ? STATUS_LABELS[n as keyof typeof STATUS_LABELS] : '-';
    })();
    return base;
  };

  const bloquearPorSeparacao = (permitirSeparado: boolean = false): boolean => {
    const s = statusTextoAtual();
    if (s === 'Separando' || (!permitirSeparado && s === 'Separado')) {
      setTriagemBlockMsg(`Este pedido está em status "${s}". Solicite ao separador que cancele a separação para continuar.`);
      setShowTriagemBlockModal(true);
      return true;
    }
    return false;
  };

  const getStatusLabel = (statusPedido: number): string => {
    const n = Number(statusPedido);
    if (!Number.isFinite(n)) return '-';
    return STATUS_LABELS[n as keyof typeof STATUS_LABELS] ?? '-';
  };

  const handleValidarCepCliente = async () => {
    if (!pedido.codCli) {
      setMessageModal({
        show: true,
        title: 'Atenção',
        content: 'Código do cliente não disponível.',
        isError: true
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/gestlog/endereco-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codcliente: pedido.codCli })
      });
      const data = await res.json();
      if (data.rows && data.rows.length > 0) {
        const row = data.rows[0];
        setHasValidatedAddress(true);
        setAddressData({
          enderEnt: row.ENDERENT,
          numeroEnt: row.NUMEROENT,
          bairroEnt: row.BAIRROENT,
          municEnt: row.MUNICENT,
          cepEnt: row.CEPENT
        });
        
        if (row.CEPENT) {
          try {
            const cepClean = String(row.CEPENT).replace(/\D/g, '');
            if (cepClean.length === 8) {
              const viaCepRes = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
              const viaCepData = await viaCepRes.json();
              if (!viaCepData.erro) {
                setValidatedCepData(viaCepData);
              } else {
                setValidatedCepData(null);
              }
            } else {
              setValidatedCepData(null);
            }
          } catch (e) {
            console.error("Erro ao validar CEP", e);
          }
        } else {
          setValidatedCepData(null);
        }

        setMessageModal({
          show: true,
          title: 'Sucesso',
          content: 'Endereço atualizado com sucesso!',
          isError: false
        });
      } else {
        setHasValidatedAddress(true);
        setValidatedCepData(null);
        setMessageModal({
          show: true,
          title: 'Atenção',
          content: 'Endereço não encontrado para este cliente.',
          isError: true
        });
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao buscar endereço';
      setMessageModal({
        show: true,
        title: 'Erro',
        content: msg,
        isError: true
      });
    } finally {
      setLoading(false);
    }
  };

  

  const refreshLogs = React.useCallback(() => {
    const num = Number(pedido?.pedido);
    if (!Number.isFinite(num)) return;
    const parseLabel = (s?: string | null): string | null => {
      if (!s) return null;
      const t = s.trim();
      if (!t) return null;
      const codeStr = t.includes('__') ? t.split('__')[0].trim() : t;
      const n = parseInt(codeStr, 10);
      if (!Number.isFinite(n)) return null;
      const idx = Math.max(0, Math.min(25, n));
      return STATUS_LABELS[idx] ?? null;
    };
    buscarLogs(num)
      .then((r) => {
        const lbl = parseLabel(r.ULTIMASITUACAOCFAT ?? null);
        setStatusLabelAtual(lbl);
      })
      .catch(() => {
        setStatusLabelAtual(null);
      });
  }, [pedido?.pedido]);

  React.useEffect(() => {
    if (show) {
      refreshLogs();
    }
  }, [show, refreshLogs]);

  const loggedOnceRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!show) { loggedOnceRef.current = null; setShowIncluirRotaModal(false); return; }
    const num = Number(pedido?.pedido);
    if (!Number.isFinite(num)) return;
    const id = String(num);
    if (loggedOnceRef.current === id) return;
    loggedOnceRef.current = id;
    const usuario = (() => {
      try {
        const raw = localStorage.getItem('usuarioLogado');
        if (!raw) return 'APP';
        const obj = JSON.parse(raw);
        const nome = (obj?.usuario ?? '').toString().trim();
        return nome || 'APP';
      } catch { return 'APP'; }
    })();
    const current = typeof pedido?.statusPedido === 'number' && Number.isFinite(pedido.statusPedido) ? pedido.statusPedido : 1;
    const toLog = current === 0 ? 1 : current;
    atualizarStatusPedido({ numped: num, status: toLog, usuario }).catch(() => void 0);
  }, [show, pedido?.pedido, pedido?.statusPedido]);



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

  const fromScaledToString = (scaled: bigint): string => {
    const neg = scaled < 0n;
    const abs = neg ? -scaled : scaled;
    const intPart = abs / SCALE;
    let fracPart = (abs % SCALE).toString().padStart(6, '0');
    fracPart = fracPart.replace(/0+$/, '');
    const base = fracPart.length ? `${intPart.toString()}.${fracPart}` : intPart.toString();
    return neg ? `-${base}` : base;
  };

  const formatQuantidade = (quantidade?: number | string): string => {
    const qScaled = toScaled(quantidade);
    if (qScaled == null) return '-';
    return fromScaledToString(qScaled);
  };

  // removido: buildPrintText (não utilizado)

  // removido: formatEmbalagem (não utilizado)

  // removido: calcQuantidadeTotal (não utilizado após uso de QT_TOTAL)

  return (
    <>
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 1100, backdropFilter: 'blur(5px)' }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1140 }}>
        <div className="modal-dialog modal-fullscreen modal-dialog-scrollable modal-dialog-centered">
          <div className="modal-content">
            {loading && (
              <div className="position-absolute w-100 h-100" style={{ inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 1060, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="text-center">
                  <div className="spinner-border text-danger" role="status" style={{ width: '2rem', height: '2rem' }}>
                    <span className="visually-hidden">Carregando...</span>
                  </div>
                  <div className="mt-2" style={{ fontSize: '0.8rem', color: '#dc3545' }}>Processando...</div>
                </div>
              </div>
            )}
            <div className="modal-header py-1 d-flex flex-wrap align-items-center gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                onClick={() => {
                  if (bloquearPorSeparacao()) return;
                  const filialRetira = String(pedido.codFilialRetira ?? '').trim();
                  if (filialRetira === '1') {
                    setMessageModal({
                      show: true,
                      title: 'Atenção',
                      content: `Filial retira é ${filialRetira}, selecione uma outra opção.`,
                      isError: true
                    });
                    return;
                  }
                  setConfirmSep(true);
                }}
              >
                <BoxArrowRight size={14} /> Separar
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                onClick={() => {
                  if (bloquearPorSeparacao()) return;
                  setConfirmCorte(true);
                }}
              >
                <Scissors size={14} /> Cortar
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                onClick={() => {
                  const hasValidCep = hasValidatedAddress && validatedCepData && !validatedCepData.erro;
                  if (!pedido.log3 && !hasValidCep) {
                    setMessageModal({
                      show: true,
                      title: 'Atenção',
                      content: 'É necessário inserir a localização de entrega antes de imprimir o mapa.',
                      isError: true
                    });
                    return;
                  }
                  if (pedido.log3?.trim() === 'Entregar no Endereço de Cadastro' && !hasValidCep) {
                    setMessageModal({
                      show: true,
                      title: 'Atenção',
                      content: 'É necessário validar o CEP do cliente antes de imprimir o mapa.',
                      isError: true
                    });
                    return;
                  }
                  const usuario = (() => {
                    try {
                      const raw = localStorage.getItem('usuarioLogado');
                      if (!raw) return 'APP';
                      const obj = JSON.parse(raw);
                      const nome = (obj?.usuario ?? '').toString().trim();
                      return nome || 'APP';
                    } catch { return 'APP'; }
                  })();
                  setPrintUser(usuario);
                  setPrintAt(new Date());
                  setShowPrintModal(true);
                }}
              >
                <Printer size={14} /> Imprimir Mapa
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                onClick={async () => {
                  try {
                    const num = Number(pedido?.pedido);
                    if (!Number.isFinite(num)) return;
                    const r = await buscarLogs(num);
                    const raw = (r.LOG1 ?? '').toString();
                    const linhas = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
                    document.dispatchEvent(new CustomEvent('abrirLogsPedido', { detail: { obs: (r.ULTIMASITUACAOCFAT ?? '') as string, linhas } }));
                  } catch {
                    document.dispatchEvent(new CustomEvent('abrirLogsPedido', { detail: { obs: 'Erro ao buscar', linhas: [] } }));
                  }
                }}
              >
                <FileText size={14} /> Logs
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                onClick={async () => {
                  if (bloquearPorSeparacao()) return;
                  const usuario = (() => {
                    try {
                      const raw = localStorage.getItem('usuarioLogado');
                      if (!raw) return 'APP';
                      const obj = JSON.parse(raw);
                      const nome = (obj?.usuario ?? '').toString().trim();
                      return nome || 'APP';
                    } catch { return 'APP'; }
                  })();
                  setLoading(true);
                  try {
                    await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 1, usuario });
                    onStatusUpdated?.();
                  } finally {
                    setLoading(false);
                    onClose();
                  }
                }}
              >
                <ClipboardCheck size={14} /> Triagem
              </button>
              <button
                type="button"
                className="btn btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                style={{ fontSize: '0.7rem', lineHeight: 1.1, backgroundColor: '#fd7e14', borderColor: '#fd7e14', color: '#fff' }}
                onClick={() => setShowTelaGeralRotas(true)}
              >
                <Signpost2 size={14} /> Roterização
              </button>
              {showIncluirRotaModal ? (
                <div className="ms-auto d-flex align-items-center" style={{ gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                    style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                    onClick={() => setShowIncluirRotaModal(false)}
                  >
                    <ArrowLeft size={14} /> Voltar
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                    style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                    onClick={onClose}
                  >
                    <X size={14} /> Fechar
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-close ms-auto" onClick={onClose}></button>
              )}
            </div>
            <div className="modal-body" style={{ padding: '0.75rem' }}>
              {showIncluirRotaModal ? (
                <RotasPedidosModal
                  show={showIncluirRotaModal}
                  embedded
                  onClose={() => setShowIncluirRotaModal(false)}
                  pedido={pedido}
                  outrosPedidos={outrosPedidos}
                  abrirPedido={abrirPedido}
                  loading={loading}
                  statusTextoAtual={statusTextoAtual()}
                  getStatusLabel={getStatusLabel}
                  formatQuantidade={formatQuantidade}
                  pendentesInventario={pendentesInventario}
                  addressData={addressData}
                  hasValidatedAddress={hasValidatedAddress}
                  validatedCepData={validatedCepData}
                  bloquearPorSeparacao={bloquearPorSeparacao}
                  onValidarCepCliente={handleValidarCepCliente}
                  onAbrirValidarCepObservacao={() => setShowValidarCepModal(true)}
                  onPegarLocalizacao={() => setConfirmPegarLocalizacao(true)}
                  onInserirLocalizacao={() => setShowLocationModal(true)}
                  onInventariar={(it) => {
                    setInventoryItem(it);
                    setShowInventoryModal(true);
                  }}
                />
              ) : (
                <div className="mb-1" style={{ fontSize: '0.72rem' }}>
                  <div className="card shadow-lg" style={{ border: '1px solid rgba(0,0,0,0.175)' }}>
                    <div className="card-header py-1" style={{ fontSize: '0.8rem' }}>
                      <strong>TV8</strong> {pedido.pedido}
                    </div>
                    <div className="card-body py-2">
                    {showColetaFilialBlockCard && (
                      <div className="card border-danger mb-2" style={{ fontSize: '0.75rem' }}>
                        <div className="card-header bg-danger text-white py-1 d-flex align-items-center justify-content-between">
                          <strong>Atenção</strong>
                          <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={() => setShowColetaFilialBlockCard(false)}></button>
                        </div>
                        <div className="card-body py-1 px-2">
                          {coletaFilialBlockMsg}
                        </div>
                      </div>
                    )}
                    <div className="d-flex flex-wrap align-items-center w-100 mb-2" style={{ gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-info btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0 }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 9, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><Calendar3 size={14} /> Dia Específico</button>
                      <button
                        type="button"
                        className="btn btn-warning btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0 }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 10, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><HourglassSplit size={14} /> Aguar. Fornec.</button>
                      <button
                        type="button"
                        className="btn btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ backgroundColor: '#6f42c1', color: '#fff', fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0 }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 11, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><Layers size={14} /> Fracionado</button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0 }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 12, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><Alarm size={14} /> Hora Expecífica</button>
                      <button
                        type="button"
                        className="btn btn-warning btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0 }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 4, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><Signpost2 size={14} /> Aguardar Rota</button>
                      <button
                        type="button"
                        className="btn btn-dark btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0 }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 15, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><CashCoin size={14} /> Só Faturar</button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0 }}
                        onClick={async () => {
                          const filialRetiraNum = Number(pedido.codFilialRetira ?? NaN);
                          if (Number.isFinite(filialRetiraNum) && filialRetiraNum === 3) {
                            setColetaFilialBlockMsg('Coleta bloqueada: este pedido está com Filial Retira 3. Para coletar, a Filial Retira deve ser 1.');
                            setShowColetaFilialBlockCard(true);
                            return;
                          }
                          setShowColetaFilialBlockCard(false);
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            const r = await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 17, usuario });
                            if (!r?.success) throw new Error('Falha ao atualizar status especial');
                            setStatusLabelAtual('Coleta');
                            onStatusUpdated?.();
                            onClose();
                          } catch {
                            try {
                              const r2 = await atualizarStatusPedido({ numped: Number(pedido.pedido), status: 17, usuario });
                              if (!r2?.success) throw new Error('Falha ao atualizar status');
                              setStatusLabelAtual('Coleta');
                              onStatusUpdated?.();
                              onClose();
                            } catch {
                              setTriagemBlockMsg('Falha ao atualizar para Coleta. Tente novamente.');
                              setShowTriagemBlockModal(true);
                            }
                          } finally {
                            setLoading(false);
                          }
                        }}
                      ><BoxSeam size={14} /> Coletar</button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0 }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 20, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><Send size={14} /> Enviar p/ Retira</button>
                      <button
                        type="button"
                        className="btn btn-warning btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0 }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 23, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><StarFill size={14} /> Prioridade</button>
                      <button
                        type="button"
                        className="btn btn-info btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0, color: 'white' }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 24, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><Calendar3Week size={14} /> Entrega Futura</button>
                      <button
                        type="button"
                        className="btn btn-info btn-sm d-inline-flex align-items-center gap-1 py-1 px-2 flex-grow-1"
                        style={{ fontSize: '0.68rem', lineHeight: 1.1, flexBasis: 0, color: 'white' }}
                        onClick={async () => {
                          if (bloquearPorSeparacao()) return;
                          const usuario = (() => {
                            try {
                              const raw = localStorage.getItem('usuarioLogado');
                              if (!raw) return 'APP';
                              const obj = JSON.parse(raw);
                              const nome = (obj?.usuario ?? '').toString().trim();
                              return nome || 'APP';
                            } catch { return 'APP'; }
                          })();
                          setLoading(true);
                          try {
                            await atualizarStatusEspecial({ numped: Number(pedido.pedido), status: 25, usuario });
                            onStatusUpdated?.();
                          } finally {
                            setLoading(false);
                            onClose();
                          }
                        }}
                      ><ArrowRepeat size={14} /> Retira Posterior</button>
                    </div>
                    <div className="mb-2" style={{ fontSize: '0.72rem' }}>
                      <div className="row g-1">
                        <div className="col-12">
                          <div className="d-flex align-items-center" style={{ fontSize: '0.8rem', marginBottom: '2px' }}>
                            <strong className="me-1">Cliente:</strong> <span className="text-muted me-2 text-truncate" style={{ maxWidth: '300px' }}>{pedido.cliente ?? '-'}</span> 
                            <span className="text-muted mx-1">|</span>
                            <strong className="me-1">Cód:</strong> <span className="text-muted">{pedido.codCli ?? '-'}</span>
                          </div>
                        </div>
                        <div className="col-md-6" style={{ borderRight: '1px solid #dee2e6' }}>
                          <div className="mb-0"><strong>Data:</strong> <span className="text-muted ms-1">{formatDateBR(pedido.data)}</span></div>
                          <div className="mb-0 text-truncate"><strong>Entrega/Retira:</strong> <span className="text-muted ms-1">{formatTipoEntrega(pedido.tipoEntrega)}</span></div>
                          <div className="mb-0"><strong>Posição:</strong> <span className="text-muted ms-1">{formatPosicao(pedido.posicao)}</span></div>
                          <div className="mb-0 text-truncate"><strong>Cobrança:</strong> <span className="text-muted ms-1">{pedido.cobranca ?? '-'}</span></div>
                          <div className="mb-0"><strong>Frete:</strong> <span className="text-muted ms-1">{pedido.vlFrete != null ? `R$ ${pedido.vlFrete.toFixed(2).replace('.', ',')}` : '-'}</span></div>
                        </div>
                        <div className="col-md-6 ps-2">
                          {(() => {
                            const sig = getAgeDaysSignal(pedido.ageDays, blinkAgeDays);
                            return (
                              <div
                                className={`p-2 border rounded ${sig.borderClass}`}
                                style={{ backgroundColor: sig.backgroundColor, transition: 'background-color 150ms' }}
                              >
                                <div className="mb-0"><strong>Filial Venda:</strong> <span className="ms-1 text-dark">{pedido.codFilial ?? '-'}</span></div>
                                {pedido.codFilialRetira && (
                                  <div className="mb-0"><strong>Filial Retira:</strong> <span className="ms-1 text-dark">{pedido.codFilialRetira}</span></div>
                                )}
                                <div className="mb-0 text-truncate"><strong>Vendedor(a):</strong> <span className="ms-1 text-dark">{pedido.vendedor ?? '-'}</span></div>
                                <div className="mb-0 text-truncate">
                                  <strong>Status:</strong> <span className="ms-1 text-dark">{statusLabelAtual ?? (() => {
                                    const n = Number(pedido?.statusPedido ?? -1);
                                    return Number.isFinite(n) && STATUS_LABELS[n as keyof typeof STATUS_LABELS] ? STATUS_LABELS[n as keyof typeof STATUS_LABELS] : '-';
                                  })()}</span>
                                </div>
                                <hr className="my-2" />
                                <div className="mb-0">
                                  <strong>Dias úteis após a Compra:</strong>{' '}
                                  <span className="ms-1 fw-bold text-dark">{Number.isFinite(pedido.ageDays) ? pedido.ageDays : '-'}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <h6 className="mb-0" style={{ fontSize: '0.8rem' }}>Itens ({pedido.items.length})</h6>
                      {pedidoVinculoRota.found ? (
                        <div
                          className="border rounded px-2 py-1"
                          style={{ backgroundColor: '#fd7e14', color: '#fff', fontSize: '0.68rem', lineHeight: 1.15, maxWidth: 'min(820px, 70vw)' }}
                        >
                          <div className="d-flex flex-wrap align-items-center" style={{ gap: '6px' }}>
                            <span className="fw-semibold">
                              {(() => {
                                const id = pedidoVinculoRota.rota?.idRota;
                                const desc = String(pedidoVinculoRota.rota?.descricaoRota ?? '').trim();
                                if (desc) return `Adicionado na ${desc}`;
                                if (typeof id === 'number' && Number.isFinite(id)) return `Adicionado na Rota ${id}`;
                                return 'Já em Rota';
                              })()}
                            </span>
                            <span style={{ opacity: 0.85 }}>|</span>
                            <span>Data: {pedidoVinculoRota.rota?.dataRota ? formatDateBR(pedidoVinculoRota.rota.dataRota) : '-'}</span>
                            <span style={{ opacity: 0.85 }}>|</span>
                            <span>{getTurnoLabel(String(pedidoVinculoRota.rota?.turnoSeparacao ?? ''))}</span>
                            <span style={{ opacity: 0.85 }}>|</span>
                            <span className="text-truncate" style={{ maxWidth: '260px' }}>
                              Motorista: {String(pedidoVinculoRota.rota?.motoristaNome ?? '').trim() || '-'}{pedidoVinculoRota.rota?.codMotorista != null ? ` (${pedidoVinculoRota.rota.codMotorista})` : ''}
                            </span>
                            <span style={{ opacity: 0.85 }}>|</span>
                            <span className="text-truncate" style={{ maxWidth: '280px' }}>
                              Veículo: {String(pedidoVinculoRota.rota?.veiculoDescricao ?? '').trim() || '-'}{String(pedidoVinculoRota.rota?.veiculoPlaca ?? '').trim() ? ` (${String(pedidoVinculoRota.rota?.veiculoPlaca ?? '').trim()})` : ''}{pedidoVinculoRota.rota?.codVeiculo != null ? ` (${pedidoVinculoRota.rota.codVeiculo})` : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-success btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                          style={{ fontSize: '0.68rem', lineHeight: 1.1 }}
                          onClick={() => {
                            if (bloquearPorSeparacao()) return;
                            setShowIncluirRotaModal(true);
                          }}
                          disabled={pedidoVinculoRota.loading}
                        >
                          <PlusCircle size={14} /> Incluir em Rota
                        </button>
                      )}
                    </div>
                    <div className="table-responsive">
                      <table className="mb-0 w-100" style={{ fontSize: '0.68rem', lineHeight: 1.2, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '12%', border: 0 }}>Cod. Produto</th>
                            <th style={{ width: '28%', border: 0 }}>Produto</th>
                            <th style={{ width: '15%', border: 0 }}>Código de Barras</th>
                            <th style={{ width: '10%', border: 0 }}>Múltiplo</th>
                            <th style={{ width: '10%', border: 0 }}>Qtd</th>
                            <th style={{ width: '10%', border: 0 }}>Qtd Total</th>
                            <th style={{ width: '15%', border: 0 }}>P/ Inventariar?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pedido.items.map((it, idx) => (
                            <tr key={`item-${idx}`}>
                              <td style={{ width: '12%', border: 0 }}>{it.codProd ?? '-'}</td>
                              <td style={{ width: '28%', border: 0 }}>{it.descricao || '-'}</td>
                              <td style={{ width: '15%', border: 0 }}>{it.codigoDeBarras ?? '-'}</td>
                              <td style={{ width: '10%', border: 0 }}>{it.multiplo ?? '-'}</td>
                              <td style={{ width: '10%', border: 0 }}>{formatQuantidade(it.quantidade)}</td>
                              <td style={{ width: '10%', border: 0 }}>{it.qtTotal ?? '-'}</td>
                              <td style={{ width: '15%' }}>
                                {it.codProd != null && pendentesInventario.includes(it.codProd) ? (
                                  <span className="text-muted" style={{ fontSize: '0.65rem', fontStyle: 'italic' }}>Em inventário</span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm py-0 px-1"
                                    style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    title="Inventariar"
                                    onClick={() => {
                                      setInventoryItem(it);
                                      setShowInventoryModal(true);
                                    }}
                                  >
                                    <ClipboardPlus size={12} />
                                    Inventariar
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <hr className="my-2 mx-3" />

                  <div className="px-3 pb-2">
                    <div className="mb-1" style={{ fontSize: '0.8rem' }}><strong>Observações</strong></div>
                    <div style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
                      <div className="row g-1">
                        {isPresent(pedido.obs) && (
                          <div className="col-md-12 mb-1">{cleanObsText(pedido.obs)}</div>
                        )}
                        {isPresent(pedido.obs1) && (
                          <div className="col-md-12 mb-1">{cleanObsText(pedido.obs1)}</div>
                        )}
                        {isPresent(pedido.obs2) && (
                          <div className="col-md-12 mb-1">{cleanObsText(pedido.obs2)}</div>
                        )}
                        {isPresent(pedido.obsEntrega1) && (
                          <div className="col-md-12 mb-1">{cleanObsText(pedido.obsEntrega1)}</div>
                        )}
                        {isPresent(pedido.obsEntrega2) && (
                          <div className="col-md-12 mb-1">{cleanObsText(pedido.obsEntrega2)}</div>
                        )}
                        {isPresent(pedido.obsEntrega3) && (
                          <div className="col-md-12 mb-1">{cleanObsText(pedido.obsEntrega3)}</div>
                        )}
                        {!hasObs && !hasObsEntrega && (
                          <div className="col-md-12"><span className="text-muted">Sem observações.</span></div>
                        )}
                        <div className="col-md-12 mt-1">
                          <div style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
                            <strong>Contato do Cliente:</strong>{' '}
                            {(() => {
                              const f = formatTelefoneBr(pedido.telEnt);
                              if (!isPresent(f ?? undefined)) return <span className="text-muted">-</span>;
                              return (
                                <span className="card border-warning d-inline-block align-middle">
                                  <span className="card-body py-1 px-2 d-inline-block" style={{ backgroundColor: 'rgba(253, 126, 20, 0.12)' }}>
                                    {f}
                                  </span>
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="my-2 mx-3" />

                  <div className="px-3 pb-2">
                    <div className="d-flex justify-content-between align-items-center mb-2" style={{ fontSize: '0.8rem' }}>
                      <div className="d-flex align-items-center gap-2">
                        <span><strong>Localização de Entrega</strong></span>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-info btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                          disabled={Number(pedido.statusPedido) === 18 && pedido.log3?.trim() !== 'Entregar no Endereço de Cadastro'}
                          style={{ fontSize: '0.68rem', lineHeight: 1.1 }}
                          onClick={handleValidarCepCliente}
                        >
                          <Search size={14} /> Validar Cep Cliente
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                          disabled={Number(pedido.statusPedido) === 18}
                          style={{ fontSize: '0.68rem', lineHeight: 1.1 }}
                          onClick={() => {
                            if (bloquearPorSeparacao(true)) return;
                            setShowValidarCepModal(true);
                          }}
                        >
                          <ChatLeftText size={14} /> Validar cep Observação
                        </button>
                        <button
                          type="button"
                          className="btn btn-warning btn-sm d-inline-flex align-items-center gap-1 py-1 px-2"
                          disabled={Number(pedido.statusPedido) === 18 || statusLabelAtual === 'Pegar Localização'}
                          style={{ fontSize: '0.68rem', lineHeight: 1.1 }}
                          onClick={() => {
                            if (bloquearPorSeparacao()) return;
                            setConfirmPegarLocalizacao(true);
                          }}
                        ><GeoAlt size={14} /> Pegar Localização</button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
                      {hasValidatedAddress ? (
                        <div className="row g-2">
                          <div className="col-6" style={{ borderRight: '1px solid #dee2e6' }}>
                            {validatedCepData ? (
                              <div>
                                <div className="text-success mb-1" style={{ fontWeight: 'bold' }}>CEP Consultado (ViaCEP):</div>
                                <div>{validatedCepData.logradouro}{validatedCepData.complemento ? ` - ${validatedCepData.complemento}` : ''}</div>
                                <div>{validatedCepData.bairro ? `${validatedCepData.bairro} - ` : ''}{validatedCepData.localidade}{validatedCepData.uf ? `/${validatedCepData.uf}` : ''}</div>
                                <div><strong>CEP:</strong> {validatedCepData.cep}</div>
                              </div>
                            ) : (
                              <div className="text-muted">
                                <em>Sem dados de validação externa (CEP não encontrado ou inválido).</em>
                              </div>
                            )}
                          </div>
                          <div className="col-6">
                            <div>
                              <div className="text-muted mb-1" style={{ fontWeight: 'bold' }}>CEP de Cadastro (Interno):</div>
                              <div>{(addressData.enderEnt || '').trim() || '-'}, {(addressData.numeroEnt || '').trim() || '-'}</div>
                              <div>{(addressData.bairroEnt || '').trim() || '-'} - {(addressData.municEnt || '').trim() || '-'}</div>
                              <div><strong>CEP:</strong> {addressData.cepEnt || '-'}</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        (() => {
                          const locStr = pedido.log3 || null;
                          if (!locStr) return <span className="text-muted">Nenhuma localização cadastrada.</span>;

                          try {
                            if (locStr.startsWith('{')) {
                              const parsed = JSON.parse(locStr);
                              const address = parsed.address || '';
                              const num = parsed.number ? `, ${parsed.number}` : '';
                              const comp = parsed.complement ? ` - ${parsed.complement}` : '';
                              const fullAddress = `${address}${num}${comp}`;

                              if (address.startsWith('http')) {
                                return (
                                  <div>
                                    <a href={address} target="_blank" rel="noopener noreferrer">Link do Mapa</a>
                                    <span>{num}{comp}</span>
                                  </div>
                                );
                              }
                              return <span>{fullAddress}</span>;
                            }
                          } catch {
                            void 0;
                          }

                          if (locStr.startsWith('http')) {
                            return <a href={locStr} target="_blank" rel="noopener noreferrer">{locStr}</a>;
                          }
                          return <span>{locStr}</span>;
                        })()
                      )}
                    </div>
                  </div>

                  <hr className="my-2 mx-3" />

                  <div className="px-3 pb-2">
                    <div className="py-1 px-2 mb-2" style={{ fontSize: '0.8rem', backgroundColor: '#ffe8cc', color: '#5c3d0b', border: '1px solid #ffc078', borderRadius: 6 }}>
                      <strong>Outros pedidos em aberto do mesmo cliente</strong>
                    </div>
                    {Array.isArray(outrosPedidos) && outrosPedidos.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm mb-0" style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '10%' }}>TV8</th>
                              <th style={{ width: '22%' }}>Cliente</th>
                              <th style={{ width: '14%' }}>Bairro</th>
                              <th style={{ width: '12%' }}>Data</th>
                              <th style={{ width: '8%' }}>Dias úteis</th>
                              <th style={{ width: '8%' }}>Itens</th>
                              <th style={{ width: '10%' }}>Posição</th>
                              <th style={{ width: '10%' }}>Retira</th>
                              <th style={{ width: '14%' }}>Status</th>
                              <th style={{ width: '10%' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {outrosPedidos.map((op, idx) => (
                              <tr key={`outro-${op.pedido}-${idx}`}>
                                <td>{op.pedido}</td>
                                <td>{op.cliente}</td>
                                <td>{op.bairroEnt ?? '-'}</td>
                                <td>{op.normalizedDate ? op.normalizedDate.toLocaleDateString('pt-BR') : '-'}</td>
                                <td>{op.normalizedDate ? calcBusinessDays(op.normalizedDate) ?? '-' : '-'}</td>
                                <td>{op.itens}</td>
                                <td>{formatPosicao(op.posicao)}</td>
                                <td>{op.codFilialRetira ?? '-'}</td>
                                <td>
                                  {(() => {
                                    const n = Number(op.statusPedido);
                                    return Number.isFinite(n) && STATUS_LABELS[n as keyof typeof STATUS_LABELS]
                                      ? STATUS_LABELS[n as keyof typeof STATUS_LABELS]
                                      : '-';
                                  })()}
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm py-0 px-2"
                                    style={{ fontSize: '0.62rem', lineHeight: 1 }}
                                    onClick={() => {
                                      const num = Number(op.pedido);
                                      if (!Number.isFinite(num)) return;
                                      if (typeof abrirPedido === 'function') {
                                        abrirPedido(num);
                                      }
                                    }}
                                  >
                                    Visualizar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.7rem' }}>Nenhum outro pedido em aberto para este cliente.</span>
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>
            
          </div>
        </div>
      </div>
    </div>

    <ConfirmarEnvioModal
      show={confirmSep}
      onClose={() => setConfirmSep(false)}
      pedido={pedido}
      onStatusUpdated={onStatusUpdated}
      zIndex={1150}
    />
    <ConfirmarPegarLocalizacaoModal
      show={confirmPegarLocalizacao}
      onClose={() => setConfirmPegarLocalizacao(false)}
      pedido={pedido}
      onStatusUpdated={() => {
        refreshLogs();
        onStatusUpdated?.();
      }}
      zIndex={1150}
    />

    {showTriagemBlockModal && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1140 }}>
        <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1145 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header py-1">
                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Atenção</h5>
                <button type="button" className="btn-close" onClick={() => setShowTriagemBlockModal(false)}></button>
              </div>
              <div className="modal-body" style={{ fontSize: '0.8rem' }}>
                <p className="mb-0">{triagemBlockMsg}</p>
              </div>
              <div className="modal-footer py-1">
                <button
                  type="button"
                  className="btn btn-primary btn-sm py-1 px-2"
                  style={{ fontSize: '0.72rem', lineHeight: 1.1 }}
                  onClick={() => setShowTriagemBlockModal(false)}
                >OK</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    {confirmCorte && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1120 }}>
        <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1130 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header py-1">
                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Confirmar corte</h5>
                <button type="button" className="btn-close" onClick={() => setConfirmCorte(false)}></button>
              </div>
              <div className="modal-body" style={{ fontSize: '0.8rem' }}>
                <div><strong>Pedido:</strong> {pedido.pedido}</div>
                <div><strong>Cliente:</strong> {pedido.cliente}</div>
                <div><strong>Bairro:</strong> {pedido.bairroEnt ?? '-'}</div>
                <div><strong>Itens:</strong> {pedido.items.length}</div>
                <div className="mt-2">Deseja realizar o corte?</div>
                <div className="mt-2">
                  <label htmlFor="motivo-corte" className="form-label" style={{ fontSize: '0.8rem' }}>Motivo do corte</label>
                  <textarea
                    id="motivo-corte"
                    className="form-control"
                    rows={3}
                    value={corteMotivo}
                    onChange={(e) => setCorteMotivo(e.target.value)}
                    style={{ fontSize: '0.8rem' }}
                  />
                  <div className="alert alert-warning mt-2 py-1 px-2 mb-0" style={{ fontSize: '0.75rem' }}>
                    O motivo do corte deve ter no mínimo 10 caracteres.
                  </div>
                </div>
              </div>
              <div className="modal-footer py-1">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm py-1 px-2"
                  style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                  onClick={() => setConfirmCorte(false)}
                >
                  Não
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm py-1 px-2 ms-2"
                  style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                  disabled={!corteMotivo || corteMotivo.trim().length < 10}
                  onClick={async () => {
                    const usuario = (() => {
                      try {
                        const raw = localStorage.getItem('usuarioLogado');
                        if (!raw) return 'APP';
                        const obj = JSON.parse(raw);
                        const nome = (obj?.usuario ?? '').toString().trim();
                        return nome || 'APP';
                      } catch { return 'APP'; }
                    })();
                    setLoading(true);
                    try {
                      await atualizarStatusPedido({ numped: Number(pedido.pedido), status: 13, usuario, motivoCorte: corteMotivo });
                      onStatusUpdated?.();
                      setCorteMotivo('');
                      onClose();
                    } finally {
                      setLoading(false);
                      setConfirmCorte(false);
                    }
                  }}
                >
                  Sim
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}


    <MapaExpedicaoModal
      show={showPrintModal}
      onClose={() => setShowPrintModal(false)}
      pedido={{ ...pedido, ...addressData }}
      outrosPedidos={outrosPedidos}
      printAt={printAt}
      printUser={printUser}
    />
    {showInventoryModal && inventoryItem && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1150 }}>
        <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1160 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header py-1">
                <h5 className="modal-title" style={{ fontSize: '0.9rem' }}>Confirmar Inventário</h5>
                <button type="button" className="btn-close" onClick={() => setShowInventoryModal(false)}></button>
              </div>
              <div className="modal-body" style={{ fontSize: '0.8rem' }}>
                <div className="mb-2"><strong>Deseja inventariar este produto?</strong></div>
                <div className="card p-2 bg-light">
                  <div><strong>Cod. Produto:</strong> {inventoryItem.codProd ?? '-'}</div>
                  <div><strong>Produto:</strong> {inventoryItem.descricao}</div>
                  <div><strong>Cód. Barras:</strong> {inventoryItem.codigoDeBarras ?? '-'}</div>
                  <div><strong>Múltiplo:</strong> {inventoryItem.multiplo ?? '-'}</div>
                  <div><strong>Qtd:</strong> {formatQuantidade(inventoryItem.quantidade)}</div>
                  <div><strong>Qtd Total:</strong> {inventoryItem.qtTotal ?? '-'}</div>
                </div>
              </div>
              <div className="modal-footer py-1">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm py-1 px-2"
                  style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                  onClick={() => setShowInventoryModal(false)}
                >
                  Não
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm py-1 px-2 ms-2"
                  style={{ fontSize: '0.7rem', lineHeight: 1.1 }}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const raw = localStorage.getItem('usuarioLogado');
                      let nomeUsuario = 'APP';
                      if (raw) {
                        try {
                          const obj = JSON.parse(raw);
                          nomeUsuario = (obj?.usuario ?? '').toString().trim() || 'APP';
                        } catch {
                          void 0;
                        }
                      }

                      const valMatricula = matricula ? parseInt(matricula, 10) : null;

                      const payload = {
                        codProd: inventoryItem.codProd,
                        descricao: inventoryItem.descricao,
                        codAuxiliar: inventoryItem.codigoDeBarras,
                        codUsurContagem: Number.isFinite(valMatricula) ? valMatricula : null,
                        nomeUsuarioContagem: nomeUsuario
                      };

                      const response = await fetch('/api/gestlog/inventario/adicionar-pendente', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });

                      if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        throw new Error(errData.message || 'Erro ao adicionar inventário');
                      }
                      
                      // Sucesso opcional: mostrar mensagem de sucesso
                      setMessageModal({
                         show: true,
                         title: 'Sucesso',
                         content: 'Produto enviado para inventário com sucesso.',
                         isError: false
                      });
                      
                      checkPendencias();

                    } catch (error) {
                      console.error(error);
                      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
                      setMessageModal({
                        show: true,
                        title: 'Atenção',
                        content: msg,
                        isError: true
                      });
                    } finally {
                      setLoading(false);
                      setShowInventoryModal(false);
                    }
                  }}
                >
                  Sim
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    {showLocationModal && (
      <LocalizacaoEntregaModal
        show={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        pedido={pedido}
        onStatusUpdated={onStatusUpdated}
        autoUpdateStatus18={false}
      />
    )}
    {showValidarCepModal && (
      <ValidarCepModal
        show={showValidarCepModal}
        onClose={() => setShowValidarCepModal(false)}
        pedido={pedido}
        onStatusUpdated={onStatusUpdated}
        onAddressUpdated={(addr) => {
          setValidatedCepData({
            cep: addr.cep,
            logradouro: addr.logradouro,
            complemento: addr.complemento,
            bairro: addr.bairro || '',
            localidade: addr.cidade || '',
            uf: addr.uf || '',
            erro: false
          });
          setHasValidatedAddress(true);
        }}
      />
    )}
    {messageModal.show && (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1400 }}>
        <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1410 }}>
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
      </div>
    )}

    <TelaGeralRotas
      show={showTelaGeralRotas}
      onClose={() => setShowTelaGeralRotas(false)}
    />
    </>
  );
};

export default VisualizarPedidoModal;
