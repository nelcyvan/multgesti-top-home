import React, { useEffect, useState, useMemo } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { PersonX, Cart4, BarChartLine } from "react-bootstrap-icons";
import TopBar from "../../components/TopBar";
import ClientesSemVendaModal from "../gestpro/components/modals/ClientesSemVendaModal";
import PedidosEmAbertoModal from "./PedidosEmAbertoModal";
import { buscarPedidosPorPeriodo, type PedidoGestLOG } from "../../services/gestlog/BuscarPedidosPorPeriodo";

// --- Interfaces e Tipos Auxiliares ---

export interface PedidoGroup {
    pedido: number;
    data: string;
    matriculaRca: number;
    tipoEntrega: string;
    cliente: string;
  codFilial: string;
  codFilialRetira: string;
  codCli: number;
  cobranca: string;
  vendedor: string;
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
  statusPedido: string; // pode vir como string ou number no JSON, vamos tratar
  ultimoStatusRaw: string;
}

// --- Componentes Auxiliares (Copiados de PedidosParaAnaliseModal.tsx) ---

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

// --- Funções Auxiliares de Formatação e Cálculo ---

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
  
  return { status: raw, log: '-', user: '-' };
};

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

// --- Componente de Card (Adaptado sem botões) ---

export const PedidoCard: React.FC<{ g: PedidoGroup }> = ({ g }) => {
  return (
    <div className="card shadow-sm mb-3">
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

        {/* Rodapé do Header: Observações (sem botões) */}
        <div className="mt-1 pt-1 border-top border-white border-opacity-25 d-flex justify-content-between align-items-center" style={{ fontSize: '0.68rem' }}>
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
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ 
  label: string; 
  value: string; 
  color: string; 
  actionLabel?: string;
  actionColor?: string;
  onAction?: () => void;
}> = ({ label, value, color, actionLabel, actionColor, onAction }) => {
    // Determine bootstrap text color class
    let textColorClass = `text-${color}`;
    
    // Determine button class
    const btnClass = actionColor ? `btn-outline-${actionColor}` : `btn-outline-${color}`;
    
    return (
      <div className="col-12 col-md-2">
        <div className="card border-0 bg-light h-100">
          <div className="card-body p-2 d-flex flex-column">
            <small className="text-muted">{label}</small>
            <h4 className={`${textColorClass} mt-1 mb-2`}>{value}</h4>
            {actionLabel && (
              <button 
                className={`btn ${btnClass} btn-gestpro mt-auto`} 
                type="button"
                onClick={onAction}
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    );
};

// --- Componente Principal ---

type ActiveTab = 'indicadores' | 'pedidos' | 'clientes';

const Gestvendas: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('indicadores');
  const [filtroMatricula, setFiltroMatricula] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('usuarioLogado');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && u.matricula) {
          setFiltroMatricula(Number(u.matricula));
        }
      }
    } catch (err) {
      console.error('Erro ao ler usuarioLogado', err);
    }
  }, []);

  const [pedidosRaw, setPedidosRaw] = useState<PedidoGestLOG[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPedidos = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dataFim = `${yyyy}-${mm}-${dd}`;

      const response = await buscarPedidosPorPeriodo({
        dataInicio: '2025-01-01',
        dataFim: dataFim,
        filiais: ['1'],
        tiposEntrega: ['EN', 'EF', 'RP'],
        posicoesPedido: ['L', 'P', 'M'],
        filiaisRetira: ['1', '3']
      });
      setPedidosRaw(response.rows);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar pedidos");
    } finally {
      setLoading(false);
    }
  };

  // useEffect(() => {
  //   fetchPedidos();
  // }, []);

  const groupedPedidos = useMemo(() => {
    const map = new Map<number, PedidoGroup>();
    pedidosRaw.forEach(r => {
      const key = r.NUMERO_DO_PEDIDO_TV8;
      const existing = map.get(key);
      const d = parseDateFlexible(r.DATA);
      const age = businessDaysSince(d);

      if (!existing) {
        map.set(key, {
          pedido: key,
          data: r.DATA,
          matriculaRca: Number(r.MATRICULA_RCA || 0),
          tipoEntrega: r.TIPOENTREGA,
          cliente: r.CLIENTE,
          codFilial: r.CODFILIAL,
          codFilialRetira: r.CODFILIALRETIRA || '',
          codCli: r.CODCLI,
          cobranca: r.COBRANCA,
          vendedor: r.VENDEDOR,
          bairroEnt: r.BAIRROENT || '',
          enderEnt: r.ENDERENT || '',
          numeroEnt: r.NUMEROENT || '',
          municEnt: r.MUNICENT || '',
          posicao: r.POSICAO,
          obs: r.OBS || '',
          obs1: r.OBS1,
          obs2: r.OBS2,
          obsEntrega1: r.OBSENTREGA1,
          obsEntrega2: r.OBSENTREGA2,
          obsEntrega3: r.OBSENTREGA3,
          vlFrete: r.VLFRETE || 0,
          items: [{
            codProd: r.CODPROD,
            descricao: r.DESCRICAO,
            quantidade: r.QUANTIDADE_ITEM_PEDIDO,
            codigoDeBarras: r.CODIGO_DE_BARRAS || '',
            multiplo: r.MULTIPLO,
            embalagem: r.EMBALAGEM,
            qtTotal: (r as any).QT_TOTAL || '' // Ajuste caso QT_TOTAL não esteja tipado
          }],
          ageDays: age,
          normalizedDate: d,
          statusPedido: String(r.STATUS_DESCRICAO || r.POSICAO), // Adaptação pois STATUS_PEDIDO pode não existir ou ser diferente
          ultimoStatusRaw: (r as any).ULTIMASITUACAOCFAT || 'Aguardando Visualização'
        });
      } else {
        existing.items.push({
          codProd: r.CODPROD,
          descricao: r.DESCRICAO,
          quantidade: r.QUANTIDADE_ITEM_PEDIDO,
          codigoDeBarras: r.CODIGO_DE_BARRAS || '',
          multiplo: r.MULTIPLO,
          embalagem: r.EMBALAGEM,
          qtTotal: (r as any).QT_TOTAL || ''
        });
        existing.ageDays = Math.max(existing.ageDays, age);
      }
    });
    return Array.from(map.values())
      .filter(g => filtroMatricula ? g.matriculaRca === filtroMatricula : true)
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [pedidosRaw, filtroMatricula]);

  return (
    <div
      className="d-flex flex-column"
      style={{
        fontFamily: "'Poppins', sans-serif",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#f8f9fa",
      }}
    >
      <TopBar 
        title="GestVENDAS" 
        titleClassName="text-primary" 
        showBack={true} 
        backLink="/dashboard"
      >
        <button 
          className={`btn btn-link p-0 ms-4 ${activeTab === 'indicadores' ? 'text-primary opacity-100' : 'text-muted opacity-50'}`}
          onClick={() => setActiveTab('indicadores')}
          title="Indicadores Comerciais"
          style={{ lineHeight: 0 }}
        >
          <BarChartLine size={32} />
        </button>
        <button 
          className={`btn btn-link p-0 ms-4 ${activeTab === 'pedidos' ? 'text-primary opacity-100' : 'text-muted opacity-50'}`}
          onClick={() => {
            setActiveTab('pedidos');
            fetchPedidos();
          }}
          title="Pedidos em Aberto"
          style={{ lineHeight: 0 }}
        >
          <Cart4 size={32} />
        </button>
        <button 
          className={`btn btn-link p-0 ms-4 ${activeTab === 'clientes' ? 'text-danger opacity-100' : 'text-danger opacity-50'}`}
          onClick={() => setActiveTab('clientes')}
          title="Clientes sem Venda"
          style={{ lineHeight: 0 }}
        >
          <PersonX size={32} />
        </button>
      </TopBar>

      <div className="w-100" style={{ height: '6px', background: 'linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0))', flexShrink: 0 }}></div>

      <div className="flex-grow-1 d-flex flex-column overflow-hidden position-relative">
        {activeTab === 'indicadores' && (
          <div className="container-fluid py-4 overflow-auto h-100">
            <div className="row g-4 align-items-stretch">
              <div className="col-12">
                <div className="card shadow-sm h-100">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Indicadores Comerciais</h5>
                  </div>
                  <div className="card-body">
                    {/* Mês Atual */}
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">Mês Atual</h6>
                        <span className="badge bg-primary">Janeiro De 2026</span>
                    </div>
                    <div className="row g-2">
                        <SummaryCard label="R$ Faturamento Líquido" value="R$ 0,00" color="success" actionLabel="Acessar" actionColor="success" />
                        <SummaryCard label="R$ Devolução" value="R$ 0,00" color="danger" actionLabel="Acessar" actionColor="danger" />
                        <SummaryCard label="Liquidez" value="R$ 0,00" color="info" actionLabel="Detalhar" />
                        <SummaryCard label="Frete" value="R$ 0,00" color="info" actionLabel="Detalhar" />
                        <SummaryCard label="Total em Aberto" value="R$ 0,00" color="dark" actionLabel="Detalhar" />
                        <SummaryCard label="Carteira em aberto" value="R$ 0,00" color="dark" actionLabel="Detalhar" />
                    </div>

                    <hr className="my-3" />

                    {/* Mês Anterior */}
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="mb-0">Mês Anterior</h6>
                        <span className="badge bg-secondary">Dezembro De 2025</span>
                    </div>
                    <div className="row g-2">
                        <SummaryCard label="Liquidez" value="R$ 0,00" color="secondary" actionLabel="Detalhar" />
                        <SummaryCard label="Frete" value="R$ 0,00" color="secondary" actionLabel="Detalhar" />
                        <SummaryCard label="Total em Aberto" value="R$ 0,00" color="secondary" actionLabel="Detalhar" />
                        <SummaryCard label="Carteira em aberto" value="R$ 0,00" color="secondary" actionLabel="Detalhar" />
                    </div>

                    <hr className="my-3" />

                    {/* Faturamento 111 (Diário) */}
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0">Faturamento 111 (Diário)</h6>
                    </div>
                    <div className="row g-2">
                        <SummaryCard label="Venda Líquida" value="R$ 0,00" color="success" />
                        <SummaryCard label="Devolução" value="R$ 0,00" color="danger" />
                        <SummaryCard label="Nº Notas Faturadas" value="0" color="info" />
                        <SummaryCard label="Ticket Médio" value="R$ 0,00" color="warning" />
                    </div>

                    <div className="mt-4">
                      <div className="alert alert-light border">
                        <div className="d-flex align-items-center">
                          <span className="me-2">🛠️</span>
                          <div>
                            <strong>Observação:</strong> Indicadores e relatórios serão integrados à API do GestPRO.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
            <PedidosEmAbertoModal 
              embedded={true}
              pedidos={groupedPedidos}
              loading={loading}
              error={error}
            />
        )}

        {activeTab === 'clientes' && (
            <ClientesSemVendaModal 
              embedded={true}
            />
        )}
      </div>
    </div>
  );
};

export default Gestvendas;
