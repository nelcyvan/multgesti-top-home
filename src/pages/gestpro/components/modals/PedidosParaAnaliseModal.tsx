import React, { useEffect, useState, useMemo, useCallback } from 'react';
import "bootstrap/dist/css/bootstrap.min.css";
import TriagemModal from './TriagemModal';
import ColetaSeparadaStatus19Modal from './ColetaSeparadaStatus19Modal';

interface Props {
  onClose: () => void;
  initialOpen?: "coletaSeparada19" | null;
}

interface PedidoAnalise {
  DATA: string;
  CODCOB: string;
  CODFILIAL: string;
  CODFILIALRETIRA: string;
  CONDVENDA: number;
  POSICAO: string;
  NUMVIASMAPASEP: number;
  TIPOENTREGA: string;
  CODCLI: number;
  CLIENTE: string;
  NUMERO_DO_PEDIDO_TV8: number;
  NUMERO_DO_PEDIDO_TV7: number;
  CODPROD: number;
  DESCRICAO: string;
  CODIGO_DE_BARRAS: string;
  QUANTIDADE_ITEM_PEDIDO: number;
  ESTOQUE_ATUAL_LOJA: number;
  COBRANCA: string;
  OBS: string;
  OBS1?: string;
  OBS2?: string;
  OBSENTREGA1?: string;
  OBSENTREGA2?: string;
  OBSENTREGA3?: string;
  VENDEDOR: string;
  ENDERENT: string;
  NUMEROENT: string;
  BAIRROENT: string;
  MUNICENT: string;
  NUMNOTA: number;
  VLFRETE: number;
  NOME_EMITENTE?: string;
  DTINICIALSEP?: string | Date | null;
  EMITENTE_MAPA?: string;
  QT_TOTAL: string;
  STATUS_PEDIDO: string;
  ULTIMASITUACAOCFAT: string;
  MULTIPLO?: number;
  EMBALAGEM?: string;
}

export interface PedidoAnaliseGroup {
  pedido: number;
  data: string;
  tipoEntrega: string;
  cliente: string;
  codFilial: string;
  codFilialRetira: string;
  codCli: number;
  cobranca: string;
  vendedor: string;
  nomeEmitente?: string;
  dtInicialSep?: string | Date | null;
  emitenteMapa?: string;
  bairroEnt: string;
  enderEnt: string;
  numeroEnt: string;
  municEnt: string;
  posicao: string;
  obs: string;
  obs1?: string;
  obs2?: string;
  obsEntrega1?: string;
  obsEntrega2?: string;
  obsEntrega3?: string;
  vlFrete: number;
  items: {
    codProd: number;
    descricao: string;
    quantidade: number;
    codigoDeBarras: string;
    multiplo?: number;
    embalagem?: string;
    qtTotal: string;
  }[];
  ageDays: number;
  normalizedDate: Date | null;
  statusPedido: string;
  ultimoStatusRaw: string;
}

const resolveBaseApi = () => {
  const envRaw = import.meta.env?.VITE_API_URL as string | undefined;
  const isHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
  if (envRaw && typeof envRaw === "string") {
    const trimmed = envRaw.replace(/\/+$/, "");
    if (isHttps && /^http:\/\//i.test(trimmed)) return "/api";
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  return "/api";
};

// Componente HeaderField reutilizado
export const HeaderField: React.FC<{
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
  15: 'Só Faturar',
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

const formatStatusInfo = (raw?: string) => {
  if (!raw) return null;
  // Formato esperado: "1__20/01/2026 12:29_PCADMIN"
  // Regex: inicia com digitos, seguido de __, seguido de qualquer coisa (data), ultimo _ separando usuario
  const match = raw.match(/^(\d+)__(.*)_(.*)$/);
  
  if (match) {
    const code = parseInt(match[1], 10);
    const date = match[2];
    const user = match[3];
    const statusLabel = STATUS_LABELS[code] || 'Desconhecido';
    
    return {
      status: statusLabel,
      log: date,
      user: user
    };
  }
  
  // Fallback se não bater o regex
  return { status: raw, log: '-', user: '-' };
};

// Helpers de Data e Estilo
const parseDateFlexible = (v: unknown): Date | null => {
  if (v == null) return null;
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'string') {
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (br) {
      const day = parseInt(br[1], 10);
      const mon = parseInt(br[2], 10) - 1;
      const yr = parseInt(br[3], 10);
      const d2 = new Date(yr, mon, day);
      if (!isNaN(d2.getTime())) return new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
    }
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const yr = parseInt(iso[1], 10);
      const mon = parseInt(iso[2], 10) - 1;
      const day = parseInt(iso[3], 10);
      const d2 = new Date(yr, mon, day);
      if (!isNaN(d2.getTime())) return new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
    }
    const tmp = new Date(v);
    if (!isNaN(tmp.getTime())) return new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
  }
  return null;
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

const rowStyleByAge = (ageDays: number): React.CSSProperties => {
  if (ageDays > 5) return { backgroundColor: '#212529', color: '#fff' };
  if (ageDays === 5) return { backgroundColor: '#0d6efd', color: '#fff' };
  if (ageDays === 4) return { backgroundColor: '#6f42c1', color: '#fff' };
  if (ageDays === 3) return { backgroundColor: '#dc3545', color: '#fff' };
  if (ageDays >= 2) return { backgroundColor: '#ffc107', color: '#212529' };
  return { backgroundColor: '#198754', color: '#fff' };
};

const cardHeaderStyleByAge = (ageDays: number): React.CSSProperties => rowStyleByAge(ageDays);

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

const formatQuantidade = (quantidade?: number | string): string => {
  const qScaled = toScaled(quantidade);
  if (qScaled == null) return '-';
  return fromScaledToString(qScaled);
};

const formatDateTimeBR = (raw: unknown) => {
  if (!raw) return '-';
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString('pt-BR');
};

// Componente Card de Pedido
export const PedidoCard: React.FC<{
  g: PedidoAnaliseGroup;
  onTriagem: (g: PedidoAnaliseGroup) => void;
  showEmitenteInfo?: boolean;
}> = ({ g, onTriagem, showEmitenteInfo }) => {
  return (
    <div className="card shadow-sm">
      {/* Card Header com Estilo por Idade */}
      <div className="card-header py-1 px-2 position-relative" style={cardHeaderStyleByAge(g.ageDays)}>
        
        {/* Status no canto superior direito */}
        <div className="position-absolute top-0 end-0 p-1 d-flex flex-column align-items-end" style={{ gap: '2px', zIndex: 10 }}>
          {(() => {
            const info = formatStatusInfo(g.ultimoStatusRaw);
            if (info && info.status !== g.ultimoStatusRaw) {
                return (
                  <>
                    <span className="fw-bold text-white mb-0" style={{ fontSize: '0.75rem', lineHeight: 1, textAlign: 'right' }}>
                      Status: {info.status}
                    </span>
                    <span className="text-white mb-0" style={{ fontSize: '0.7rem', lineHeight: 1, textAlign: 'right' }}>
                      Log: {info.log}
                    </span>
                    <span className="text-white mb-0" style={{ fontSize: '0.7rem', lineHeight: 1, textAlign: 'right' }}>
                      Usuário: {info.user}
                    </span>
                  </>
                );
            }
            // Fallback
            return (
              <span
                className="fw-bold text-white mb-1"
                style={{ fontSize: '0.75rem', lineHeight: 1 }}
              >
                {g.ultimoStatusRaw || g.statusPedido || 'Aguardando Visualização'}
              </span>
            );
          })()}
        </div>

        {/* Informações do Pedido */}
        <div className="d-flex flex-wrap align-items-center" style={{ fontSize: '0.68rem', rowGap: '4px', paddingRight: 'clamp(0px, 20vw, 220px)' }}>
          <div className="d-flex flex-wrap align-items-center" style={{ minWidth: 0, rowGap: '4px' }}>
            <div className="d-flex flex-row align-items-stretch w-100" style={{ minWidth: 0, gap: '12px', flexWrap: 'wrap' }}>
              {/* Grupo 1: Data, Pedido, Tipo */}
              <div className="d-flex flex-column justify-content-start" style={{ gap: '2px', minWidth: '200px', flex: '1 1 200px', maxWidth: '100%' }}>
                <HeaderField label="Data:" value={g.data} />
                <HeaderField label="Pedido TV8:" value={g.pedido} />
                <HeaderField label="Entrega/Retira:" value={g.tipoEntrega} />
              </div>

              {/* Grupo 2: Cliente, Bairro */}
              <div className="d-flex flex-column justify-content-start" style={{ gap: '2px', minWidth: '280px', flex: '2 1 280px', maxWidth: '100%', borderLeft: '1px solid #dee2e6', paddingLeft: '12px' }}>
                <HeaderField label="Cód. Cliente:" value={g.codCli} />
                <HeaderField 
                  label="Cliente:" 
                  value={g.cliente} 
                  title={g.cliente} 
                  valueClassName="text-truncate" 
                  valueStyle={{ maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' }} 
                />
                <HeaderField 
                  label="Bairro:" 
                  value={g.bairroEnt} 
                  title={g.bairroEnt} 
                  valueClassName="text-truncate" 
                  valueStyle={{ maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' }} 
                />
              </div>

              {/* Grupo 3: Filial, Posição */}
              <div className="d-flex flex-column justify-content-start" style={{ gap: '2px', minWidth: '200px', flex: '1 1 200px', maxWidth: '100%', borderLeft: '1px solid #dee2e6', paddingLeft: '12px' }}>
                <HeaderField label="Filial:" value={g.codFilial} />
                <HeaderField label="Filial Retira:" value={g.codFilialRetira} />
                <HeaderField label="Posição:" value={g.posicao} />
              </div>

              {/* Grupo 4: Vendedor, Cobrança, Dias */}
              <div className="d-flex flex-column justify-content-start" style={{ gap: '2px', minWidth: '200px', flex: '1 1 200px', maxWidth: '100%', borderLeft: '1px solid #dee2e6', paddingLeft: '12px' }}>
                <HeaderField 
                  label="Vendedor(a):" 
                  value={g.vendedor} 
                  title={g.vendedor} 
                  valueClassName="text-truncate" 
                  valueStyle={{ maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' }} 
                />
                <HeaderField 
                  label="Cobrança:" 
                  value={g.cobranca} 
                  title={g.cobranca} 
                  valueClassName="text-truncate" 
                  valueStyle={{ maxWidth: '100%', display: 'inline-block', verticalAlign: 'bottom' }} 
                />
                <HeaderField label="Dias úteis:" value={g.ageDays} />
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Header: Observações e Ações */}
        <div className="mt-1 pt-1 border-top border-white border-opacity-25 d-flex justify-content-between align-items-center" style={{ fontSize: '0.68rem' }}>
          {/* Observações */}
          <div style={{ flex: 1, paddingRight: '10px' }}>
            {(() => {
              const obsList = [
                g.obs, g.obs1, g.obs2, g.obsEntrega1, g.obsEntrega2, g.obsEntrega3
              ].filter(o => o && o.trim().length > 0);
              
              if (obsList.length === 0) return null;
              
              return (
                <>
                  <span className="fw-bold text-white">Observações: </span>
                  <span className="text-white">{obsList.join(', ')}</span>
                </>
              );
            })()}
          </div>

          {/* Botão Triagem */}
          <button
            type="button"
            className="btn btn-sm btn-light py-0 px-2 fw-bold"
            style={{ fontSize: '0.65rem', height: '20px', lineHeight: 1, whiteSpace: 'nowrap' }}
            onClick={(e) => {
              e.stopPropagation();
              onTriagem(g);
            }}
          >
            Triagem
          </button>
        </div>
      </div>

      {/* Card Body - Tabela de Itens */}
      <div className="card-body p-1" style={{ fontSize: '0.68rem', maxHeight: '48vh', overflow: 'auto' }}>
        <table className="table table-sm mb-0" style={{ fontSize: '0.68rem' }}>
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Cod. Produto</th>
              <th style={{ width: '40%' }}>Produto</th>
              <th style={{ width: '20%' }}>Cód. Barras</th>
              <th style={{ width: '10%' }}>Múltiplo</th>
              <th style={{ width: '15%' }}>Qtd</th>
              <th style={{ width: '10%' }}>Qtd Total</th>
            </tr>
          </thead>
          <tbody>
            {g.items.map((it, idx) => (
              <tr key={`${g.pedido}-${idx}`}>
                <td>{it.codProd}</td>
                <td>{it.descricao}</td>
                <td>{it.codigoDeBarras}</td>
                <td>{it.multiplo || '-'}</td>
                <td>{formatQuantidade(it.quantidade)} {it.embalagem}</td>
                <td>{it.qtTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {showEmitenteInfo && (
          <div className="card bg-warning bg-opacity-25 border border-warning mt-2">
            <div className="card-body py-1 px-2" style={{ fontSize: '0.68rem' }}>
              <div className="d-flex flex-wrap gap-3">
                <div><span className="fw-semibold">Gerado por:</span> {g.nomeEmitente || '-'}</div>
                <div><span className="fw-semibold">Gerado em:</span> {formatDateTimeBR(g.dtInicialSep)}</div>
                <div><span className="fw-semibold">Emitente mapa:</span> {g.emitenteMapa || '-'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PedidosParaAnaliseModal: React.FC<Props> = ({ onClose, initialOpen }) => {
  const [pedidosRaw, setPedidosRaw] = useState<PedidoAnalise[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
  const [pedidoTriagem, setPedidoTriagem] = useState<PedidoAnaliseGroup | null>(null);
  const [showColetaSeparada19Modal, setShowColetaSeparada19Modal] = useState<boolean>(false);
  const [didAutoOpen, setDidAutoOpen] = useState<boolean>(false);

  const loadPedidos = useCallback(async (isAutoRefresh = false) => {
    if (!isAutoRefresh) {
      setLoading(true);
      setError(null);
    }
    
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dataFim = `${yyyy}-${mm}-${dd}`;
      const dataInicio = `2025-01-01`;

      const baseApi = resolveBaseApi();
      const response = await fetch(`${baseApi}/gestlog/buscar-pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filiais: [1],
          tiposEntrega: ['EF', 'EN', 'RP'],
          filiaisRetira: [1],
          posicoesPedido: ['P', 'L', 'M'],
          dataInicio: dataInicio,
          dataFim: dataFim
        })
      });

      if (!response.ok) throw new Error('Falha ao buscar pedidos');
      const data = await response.json();
      setPedidosRaw(data.rows || []);
      // Se sucesso no refresh, limpa erro anterior se houver
      if (isAutoRefresh) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      if (!isAutoRefresh) {
        setLoading(false);
        setHasLoadedOnce(true);
      }
    }
  }, []);

  useEffect(() => {
    loadPedidos(false);
    const interval = setInterval(() => {
      loadPedidos(true);
    }, 15000); // 15 segundos

    return () => clearInterval(interval);
  }, [loadPedidos]);

  const groupedPedidos = useMemo(() => {
    const map = new Map<number, PedidoAnaliseGroup>();
    pedidosRaw.forEach(r => {
      const key = r.NUMERO_DO_PEDIDO_TV8;
      const existing = map.get(key);
      const d = parseDateFlexible(r.DATA);
      const age = businessDaysSince(d);

      if (!existing) {
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
          nomeEmitente: r.NOME_EMITENTE,
          dtInicialSep: r.DTINICIALSEP,
          emitenteMapa: r.EMITENTE_MAPA,
          bairroEnt: r.BAIRROENT,
          enderEnt: r.ENDERENT,
          numeroEnt: r.NUMEROENT,
          municEnt: r.MUNICENT,
          posicao: r.POSICAO,
          obs: r.OBS,
          obs1: r.OBS1,
          obs2: r.OBS2,
          obsEntrega1: r.OBSENTREGA1,
          obsEntrega2: r.OBSENTREGA2,
          obsEntrega3: r.OBSENTREGA3,
          vlFrete: r.VLFRETE,
          items: [{
            codProd: r.CODPROD,
            descricao: r.DESCRICAO,
            quantidade: r.QUANTIDADE_ITEM_PEDIDO,
            codigoDeBarras: r.CODIGO_DE_BARRAS,
            multiplo: r.MULTIPLO,
            embalagem: r.EMBALAGEM,
            qtTotal: r.QT_TOTAL
          }],
          ageDays: age,
          normalizedDate: d,
          statusPedido: r.STATUS_PEDIDO,
          ultimoStatusRaw: r.ULTIMASITUACAOCFAT
        });
      } else {
        if (!existing.nomeEmitente && r.NOME_EMITENTE) existing.nomeEmitente = r.NOME_EMITENTE;
        if (!existing.emitenteMapa && r.EMITENTE_MAPA) existing.emitenteMapa = r.EMITENTE_MAPA;
        if (!existing.dtInicialSep && r.DTINICIALSEP) existing.dtInicialSep = r.DTINICIALSEP;
        existing.items.push({
          codProd: r.CODPROD,
          descricao: r.DESCRICAO,
          quantidade: r.QUANTIDADE_ITEM_PEDIDO,
          codigoDeBarras: r.CODIGO_DE_BARRAS,
          multiplo: r.MULTIPLO,
          embalagem: r.EMBALAGEM,
          qtTotal: r.QT_TOTAL
        });
        existing.ageDays = Math.max(existing.ageDays, age);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.ageDays - a.ageDays);
  }, [pedidosRaw]);

  const pedidosParaAnalise = useMemo(() => {
    return groupedPedidos.filter(g => {
      const codeRaw = g.ultimoStatusRaw ? parseInt(g.ultimoStatusRaw.split("__")[0], 10) : -1;
      const statusCode = Number.isFinite(codeRaw) ? codeRaw : -1;
      return statusCode === 0 || statusCode === 1 || g.statusPedido === "0" || g.statusPedido === "1";
    });
  }, [groupedPedidos]);

  const coletaSeparada19 = useMemo(() => {
    return groupedPedidos.filter(g => {
      const statusCode = g.ultimoStatusRaw ? parseInt(g.ultimoStatusRaw.split('__')[0], 10) : -1;
      return statusCode === 19 || g.statusPedido === '19';
    });
  }, [groupedPedidos]);
  
  useEffect(() => {
    if (didAutoOpen) return;
    if (initialOpen !== "coletaSeparada19") return;
    if (!hasLoadedOnce) return;
    if (loading || error) return;
    if (coletaSeparada19.length === 0) {
      setDidAutoOpen(true);
      return;
    }
    setShowColetaSeparada19Modal(true);
    setDidAutoOpen(true);
  }, [coletaSeparada19.length, didAutoOpen, error, hasLoadedOnce, initialOpen, loading]);

  if (initialOpen === "coletaSeparada19") {
    return (
      <div>
        {!hasLoadedOnce && loading && (
          <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
            <div className="modal-dialog modal-fullscreen">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Pedidos Coleta Separada (Status 19)</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close"></button>
                </div>
                <div className="modal-body bg-light d-flex align-items-center justify-content-center">
                  <div className="spinner-border" />
                </div>
              </div>
            </div>
          </div>
        )}

        {hasLoadedOnce && error && (
          <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}>
            <div className="modal-dialog modal-fullscreen">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Pedidos Coleta Separada (Status 19)</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close"></button>
                </div>
                <div className="modal-body bg-light">
                  <div className="alert alert-danger m-3">{error}</div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasLoadedOnce && !error && (
          <ColetaSeparadaStatus19Modal
            pedidos={coletaSeparada19}
            onClose={onClose}
            onTriagem={setPedidoTriagem}
            PedidoCardComponent={PedidoCard}
          />
        )}

        {pedidoTriagem && (
          <TriagemModal
            pedido={pedidoTriagem}
            onClose={() => setPedidoTriagem(null)}
            onSuccess={() => loadPedidos(true)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content">
          <div className="modal-header d-flex flex-column p-0">
            <div className="d-flex w-100 justify-content-between align-items-center p-3 border-bottom">
              <h5 className="modal-title m-0">Pedidos para Análise</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onClose} 
                aria-label="Close"
              ></button>
            </div>
          </div>
          <div className="modal-body bg-light">
            {loading && <div className="text-center mt-5"><div className="spinner-border" /></div>}
            
            {error && (
              <div className="alert alert-danger m-3">
                {error}
              </div>
            )}

            {!loading && !error && pedidosParaAnalise.length === 0 && (
              <div className="alert alert-info m-3 text-center">
                Nenhum pedido encontrado.
              </div>
            )}

            {!loading && !error && pedidosParaAnalise.length > 0 && (
              <div className="d-flex flex-column gap-2 p-3">
                {pedidosParaAnalise.map((g) => (
                  <PedidoCard key={g.pedido} g={g} onTriagem={setPedidoTriagem} />
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-sm btn-secondary py-0 px-2 fw-bold" 
              style={{ fontSize: '0.65rem', height: '20px', lineHeight: 1, whiteSpace: 'nowrap' }}
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
      {pedidoTriagem && (
        <TriagemModal
          pedido={pedidoTriagem}
          onClose={() => setPedidoTriagem(null)}
          onSuccess={() => loadPedidos(true)}
        />
      )}
      {showColetaSeparada19Modal && (
        <ColetaSeparadaStatus19Modal
          pedidos={coletaSeparada19}
          onClose={() => setShowColetaSeparada19Modal(false)}
          onTriagem={setPedidoTriagem}
          PedidoCardComponent={PedidoCard}
        />
      )}
    </div>
  );
};

export default PedidosParaAnaliseModal;
