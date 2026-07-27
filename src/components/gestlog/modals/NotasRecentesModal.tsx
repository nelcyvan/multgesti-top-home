import React from 'react';
import {
  ArrowClockwise,
  BoxSeam,
  CashCoin,
  CashStack,
  Check2Circle,
  CheckCircleFill,
  ClipboardCheck,
  FileEarmarkText,
  PencilSquare,
  Printer,
  XCircle,
} from 'react-bootstrap-icons';

type NotasRow = {
  NUMNOTA: number;
  DTSAIDA: string | Date;
  CODCLI: number;
  CLIENTE: string;
  TV7: number;
  TV8: number;
  ID_LOTE_PEDIDO?: number | string | null;
  CODPROD: number;
  DESCRICAO: string;
  CODAUXILIAR?: string;
  QT: number;
  NOME: string;
  CODFILIALRETIRA?: number;
  TIPOENTREGA: string;
  SITDOC: string;
  VALOR_DINHEIRO?: number | string | null;
  VLDESPACHO?: number | string | null;
  VLTOTAL?: number | string | null;
};

type NotaGroup = {
  NUMNOTA: number;
  DTSAIDA: string | Date;
  CODCLI: number;
  CLIENTE: string;
  TV7: number;
  TV8: number;
  ID_LOTE_PEDIDO?: number | string | null;
  NOME: string;
  CODFILIALRETIRA?: number;
  TIPOENTREGA: string;
  SITDOC: string;
  VALOR_DINHEIRO?: number | string | null;
  VLTOTAL?: number | string | null;
  items: Array<{ CODPROD: number; DESCRICAO: string; CODAUXILIAR?: string; QT: number }>;
};

type SangriaLoteRow = {
  ID_LOTE: number;
  CODFILIAL: string | number;
  NUMPED_TV7: number;
  NUMNOTA: number;
  CODCLI: number;
  CLIENTE: string;
  VL_DINHEIRO: number | string | null;
  DATA_HORA: string | Date;
  CODUSUR: number;
  NOME: string;
};

type SangriaPrintSnapshot = {
  idLote: string;
  codfilial: string;
  saldoConciliadoTxt: string;
  saldoAvulsoTxt: string;
  saldoFundoCaixaTxt: string;
  fundoProximoLoteTxt: string;
  totalLoteTxt: string;
  dataHoraExecucaoTxt: string;
  rows: SangriaLoteRow[];
};

type AvulsoLancRow = {
  ID_LOTE: number;
  CODFILIAL: string | number;
  NUMPED_TV7: number | null;
  NUMPED_TV8: number | null;
  CODCLI: number | null;
  VL_DINHEIRO_AVULSO: number | string | null;
  DATA_HORA: string | Date;
  CODUSUR: number | null;
};

type PedidoTv8Row = {
  PEDIDO_TV7: number;
  PEDIDO_TV8: number;
  DATA: string;
  CODCLI: number;
  CLIENTE: string;
  VLTOTAL: number | string | null;
};

export type AvulsoNovoLancamentoModalProps = {
  show: boolean;
  onClose: () => void;
  idLote: number | string | null;
  codfilial?: string | number | null;
  onSuccess?: () => void;
  zIndexBase?: number;
};

type Props = {
  show: boolean;
  onClose: () => void;
};

function resolveBaseApi(): string {
  const meta = import.meta as unknown as { env?: Record<string, unknown> };
  const rawEnv = meta?.env?.VITE_API_URL;
  const env = typeof rawEnv === 'string' ? rawEnv : undefined;
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  if (env && typeof env === 'string') {
    const trimmed = env.replace(/\/+$/, '');
    const isEnvHttp = /^http:\/\//i.test(trimmed);
    if (isHttps && isEnvHttp) return '/api';
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return '/api';
}

function truncateEnd(value: string, maxLen: number): string {
  const text = String(value ?? '').trim();
  if (text.length <= maxLen) return text;
  if (maxLen <= 3) return '.'.repeat(Math.max(0, maxLen));
  return `${text.slice(0, maxLen - 3).trimEnd()}...`;
}

export function AvulsoNovoLancamentoModal({ show, onClose, idLote, codfilial, onSuccess, zIndexBase }: AvulsoNovoLancamentoModalProps) {
  const [avulsoPedidoTv8, setAvulsoPedidoTv8] = React.useState('');
  const [avulsoPedidoTv8Loading, setAvulsoPedidoTv8Loading] = React.useState(false);
  const [avulsoPedidoTv8Err, setAvulsoPedidoTv8Err] = React.useState<string | null>(null);
  const [avulsoPedidoTv8Row, setAvulsoPedidoTv8Row] = React.useState<PedidoTv8Row | null>(null);
  const [avulsoValor, setAvulsoValor] = React.useState('');
  const [avulsoLoading, setAvulsoLoading] = React.useState(false);
  const [avulsoErr, setAvulsoErr] = React.useState<string | null>(null);

  const modalZ = typeof zIndexBase === 'number' && Number.isFinite(zIndexBase) ? zIndexBase : 1090;
  const backdropZ = modalZ - 5;

  const idLoteNum = React.useMemo(() => {
    const n = idLote == null ? NaN : Number(String(idLote).trim());
    return Number.isFinite(n) ? n : NaN;
  }, [idLote]);

  const parseMoney = React.useCallback((v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const raw = String(v).trim();
    if (!raw) return null;
    const s = raw.replace(/[^\d.,-]/g, '');
    if (!s) return null;
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }, []);

  const fmtBRL = React.useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  const getMatriculaUsuario = React.useCallback((): number | null => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('usuarioLogado') : null;
      const u = raw ? JSON.parse(raw) : {};
      const c = u?.matricula ?? u?.MATRICULA ?? u?.codusur ?? u?.CODUSUR ?? null;
      const n = c != null ? Number(String(c).trim()) : null;
      return n && Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }, []);

  const buscarPedidoTv8 = React.useCallback(async () => {
    const tv8 = String(avulsoPedidoTv8 || '').replace(/\D+/g, '').trim();
    if (!tv8) {
      setAvulsoPedidoTv8Err('Informe o número do pedido TV8.');
      setAvulsoPedidoTv8Row(null);
      return;
    }
    setAvulsoPedidoTv8Loading(true);
    setAvulsoPedidoTv8Err(null);
    setAvulsoPedidoTv8Row(null);
    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestlog/avulso/buscar-pedido-tv8`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numped_tv8: Number(tv8) }),
      });

      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data: unknown = isJson ? await resp.json() : { message: await resp.text() };
      if (!resp.ok) {
        const messageRaw =
          data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined;
        const m = typeof messageRaw === 'string' ? messageRaw : 'Falha ao buscar pedido TV8';
        throw new Error(m);
      }

      const rowRaw = data && typeof data === 'object' && 'row' in data ? (data as { row?: unknown }).row : null;
      if (!rowRaw || typeof rowRaw !== 'object') throw new Error('Pedido TV8 não encontrado.');
      setAvulsoPedidoTv8Row(rowRaw as PedidoTv8Row);
    } catch (e: unknown) {
      setAvulsoPedidoTv8Row(null);
      setAvulsoPedidoTv8Err(e instanceof Error ? e.message : String(e || 'Falha ao buscar pedido TV8'));
    } finally {
      setAvulsoPedidoTv8Loading(false);
    }
  }, [avulsoPedidoTv8]);

  const lancarSaldoAvulso = React.useCallback(async () => {
    if (!Number.isFinite(idLoteNum) || idLoteNum <= 0) {
      setAvulsoErr('Não foi possível obter o ID do lote (maior que zero).');
      return;
    }

    if (!avulsoPedidoTv8Row) {
      setAvulsoErr('Pesquise um pedido TV8 válido antes de lançar.');
      return;
    }

    const codusur = getMatriculaUsuario();
    if (!codusur) {
      setAvulsoErr('Não foi possível obter a matrícula do usuário logado.');
      return;
    }

    const valorN = parseMoney(avulsoValor);
    if (valorN == null || valorN <= 0) {
      setAvulsoErr('Informe um valor avulso maior que zero.');
      return;
    }

    setAvulsoLoading(true);
    setAvulsoErr(null);
    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestlog/gestao-sangria-lotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idLote: idLoteNum,
          codcli: avulsoPedidoTv8Row?.CODCLI ?? 0,
          codusur,
          numpedTv7: avulsoPedidoTv8Row?.PEDIDO_TV7 ?? 0,
          numpedTv8: avulsoPedidoTv8Row?.PEDIDO_TV8 ?? 0,
          novoValorParaSerAtualizado: valorN,
          consultar_lote: 'atualizar_saldo_avulso',
          codfilial: codfilial == null ? null : String(codfilial).trim() ? String(codfilial).trim() : null,
        }),
      });

      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data: unknown = isJson ? await resp.json() : { message: await resp.text() };
      if (!resp.ok) {
        const messageRaw =
          data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined;
        const m = typeof messageRaw === 'string' ? messageRaw : 'Falha ao lançar saldo avulso';
        throw new Error(m);
      }

      setAvulsoPedidoTv8('');
      setAvulsoPedidoTv8Err(null);
      setAvulsoPedidoTv8Row(null);
      setAvulsoValor('');
      onClose();
      onSuccess?.();
    } catch (e: unknown) {
      setAvulsoErr(e instanceof Error ? e.message : String(e || 'Falha ao lançar saldo avulso'));
    } finally {
      setAvulsoLoading(false);
    }
  }, [avulsoPedidoTv8Row, avulsoValor, codfilial, getMatriculaUsuario, idLoteNum, onClose, onSuccess, parseMoney]);

  React.useEffect(() => {
    if (!show) return;
    setAvulsoPedidoTv8('');
    setAvulsoPedidoTv8Loading(false);
    setAvulsoPedidoTv8Err(null);
    setAvulsoPedidoTv8Row(null);
    setAvulsoValor('');
    setAvulsoLoading(false);
    setAvulsoErr(null);
  }, [show]);

  if (!show) return null;

  return (
    <>
      <div
        className="modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.35)',
          zIndex: backdropZ,
          backdropFilter: 'blur(2px)',
        }}
      ></div>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: modalZ }}>
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }}>
          <div className="modal-content">
            <div className="modal-header py-1">
              <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                <FileEarmarkText size={14} />
                <span>Novo Lançamento</span>
              </h6>
              <button
                type="button"
                className="btn-close"
                aria-label="Fechar"
                title="Fechar"
                onClick={onClose}
                disabled={avulsoLoading}
              ></button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.74rem' }}>
              <label className="form-label mb-1" style={{ fontSize: '0.62rem' }}>Pedido (TV8)</label>
              <div className="d-flex align-items-center gap-2">
                <input
                  className="form-control form-control-sm"
                  style={{ fontSize: '0.74rem', height: '30px' }}
                  placeholder="Digite o número do pedido TV8"
                  value={avulsoPedidoTv8}
                  onChange={(e) => {
                    const next = String(e.currentTarget.value || '').replace(/\D+/g, '');
                    setAvulsoPedidoTv8(next);
                    setAvulsoPedidoTv8Err(null);
                    setAvulsoPedidoTv8Row(null);
                    setAvulsoErr(null);
                  }}
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  disabled={avulsoLoading}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm py-1 px-2"
                  style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '92px' }}
                  onClick={buscarPedidoTv8}
                  disabled={avulsoLoading || avulsoPedidoTv8Loading || !String(avulsoPedidoTv8 || '').trim()}
                >
                  <ArrowClockwise className="me-1" size={12} />
                  {avulsoPedidoTv8Loading ? 'Pesquisando...' : 'Pesquisar'}
                </button>
              </div>
              {avulsoPedidoTv8Err && (
                <div className="alert alert-danger py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                  {avulsoPedidoTv8Err}
                </div>
              )}
              {avulsoPedidoTv8Row && (
                <div className="border rounded px-2 py-1 bg-light mt-2">
                  <div className="d-flex flex-wrap align-items-center gap-2" style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                    <span>TV7: {avulsoPedidoTv8Row.PEDIDO_TV7}</span>
                    <span className="text-muted">•</span>
                    <span>TV8: {avulsoPedidoTv8Row.PEDIDO_TV8}</span>
                    <span className="text-muted">•</span>
                    <span>Data: {avulsoPedidoTv8Row.DATA || '-'}</span>
                  </div>
                  <div className="mt-1" style={{ fontSize: '0.7rem' }}>
                    <span className="text-muted">Cliente:</span> <span style={{ fontWeight: 700 }}>{avulsoPedidoTv8Row.CLIENTE}</span>{' '}
                    <span className="text-muted">({avulsoPedidoTv8Row.CODCLI})</span>
                  </div>
                  <div className="mt-1" style={{ fontSize: '0.7rem' }}>
                    <span className="text-muted">Total:</span>{' '}
                    <span style={{ fontWeight: 800 }}>{fmtBRL.format(parseMoney(avulsoPedidoTv8Row.VLTOTAL) ?? 0)}</span>
                  </div>
                </div>
              )}
              <hr className="my-2" />
              <label className="form-label mb-1" style={{ fontSize: '0.62rem' }}>Valor avulso</label>
              <input
                className="form-control form-control-sm"
                style={{ fontSize: '0.74rem', height: '30px' }}
                placeholder="Ex: 10,00"
                value={avulsoValor}
                onChange={(e) => {
                  setAvulsoValor(e.currentTarget.value);
                  setAvulsoErr(null);
                }}
                inputMode="decimal"
                disabled={avulsoLoading}
              />
              {avulsoErr && (
                <div className="alert alert-danger py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                  {avulsoErr}
                </div>
              )}
            </div>
            <div className="modal-footer py-1">
              <button
                className="btn btn-secondary btn-sm py-1 px-2"
                style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                onClick={onClose}
                disabled={avulsoLoading}
              >
                <XCircle className="me-1" size={12} />
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-sm py-1 px-2"
                style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '92px' }}
                onClick={lancarSaldoAvulso}
                disabled={
                  avulsoLoading ||
                  avulsoPedidoTv8Loading ||
                  !Number.isFinite(idLoteNum) ||
                  idLoteNum <= 0 ||
                  !avulsoPedidoTv8Row ||
                  !String(avulsoValor || '').trim()
                }
              >
                {avulsoLoading ? 'Lançando...' : 'Lançar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const NotasRecentesModal: React.FC<Props> = ({ show, onClose }) => {
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<NotasRow[]>([]);
  const [saldoDinheiro, setSaldoDinheiro] = React.useState<number | null>(null);
  const [saldoAvulso, setSaldoAvulso] = React.useState<number | null>(null);
  const [saldoFundoCaixa, setSaldoFundoCaixa] = React.useState<number>(0);
  const [idLoteSaldo, setIdLoteSaldo] = React.useState<string | null>(null);
  const [confirmNfe, setConfirmNfe] = React.useState<number | null>(null);
  const [editNfe, setEditNfe] = React.useState<number | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editMsg, setEditMsg] = React.useState<string | null>(null);
  const [editErr, setEditErr] = React.useState<string | null>(null);
  const [editTipoEntrega, setEditTipoEntrega] = React.useState<'' | 'EN' | 'RP'>('');
  const [editValorDinheiro, setEditValorDinheiro] = React.useState<string>('');
  const [showConfirmarEntregaResumo, setShowConfirmarEntregaResumo] = React.useState(false);
  const [confirmarEntregaValorAvulso, setConfirmarEntregaValorAvulso] = React.useState<string>('');
  const [showAvulsoModal, setShowAvulsoModal] = React.useState(false);
  const [showAvulsoNovoLancamentoModal, setShowAvulsoNovoLancamentoModal] = React.useState(false);
  const [avulsoRows, setAvulsoRows] = React.useState<AvulsoLancRow[]>([]);
  const [avulsoListLoading, setAvulsoListLoading] = React.useState(false);
  const [avulsoListErr, setAvulsoListErr] = React.useState<string | null>(null);
  const [avulsoMsg, setAvulsoMsg] = React.useState<string | null>(null);
  const [showSangriaModal, setShowSangriaModal] = React.useState(false);
  const [sangriaTab, setSangriaTab] = React.useState<'conciliado' | 'avulso'>('conciliado');
  const [showPrintResumo, setShowPrintResumo] = React.useState(false);
  const [confirmLoading, setConfirmLoading] = React.useState(false);
  const [confirmMsg, setConfirmMsg] = React.useState<string | null>(null);
  const [confirmErr, setConfirmErr] = React.useState<string | null>(null);
  const [sitdocMarcadas, setSitdocMarcadas] = React.useState<Set<number>>(new Set());
  const [dinheiroRecebidoByNota, setDinheiroRecebidoByNota] = React.useState<Record<number, string>>({});
  const [semDinheiroByNota, setSemDinheiroByNota] = React.useState<Record<number, boolean>>({});
  const [tipoEntregaEfByNota, setTipoEntregaEfByNota] = React.useState<Record<number, '' | 'EN' | 'RP'>>({});
  const [sangriaLoading, setSangriaLoading] = React.useState(false);
  const [sangriaExecLoading, setSangriaExecLoading] = React.useState(false);
  const [sangriaErr, setSangriaErr] = React.useState<string | null>(null);
  const [sangriaMsg, setSangriaMsg] = React.useState<string | null>(null);
  const [sangriaRows, setSangriaRows] = React.useState<SangriaLoteRow[]>([]);
  const [showConfirmSangria, setShowConfirmSangria] = React.useState(false);
  const [novoFundoCaixa, setNovoFundoCaixa] = React.useState<string>('');
  const [sangriaPodeImprimir, setSangriaPodeImprimir] = React.useState(false);
  const [sangriaPrintSnapshot, setSangriaPrintSnapshot] = React.useState<SangriaPrintSnapshot | null>(null);
  const [showSangriaDocumento, setShowSangriaDocumento] = React.useState(false);
  const sangriaDocIframeRef = React.useRef<HTMLIFrameElement | null>(null);

  const toYmd = React.useCallback((d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const parseMoney = React.useCallback((v: unknown): number | null => {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const raw = String(v).trim();
    if (!raw) return null;
    const s = raw.replace(/[^\d.,-]/g, '');
    if (!s) return null;
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }, []);

  const formatMoneyInput = React.useCallback((n: number | null | undefined): string => {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
    return v.toFixed(2).replace('.', ',');
  }, []);

  const fmtBRL = React.useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);
  const fmtDataHora = React.useCallback((value: string | Date): string => {
    const dt = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value ?? '-');
    const tz = 'America/Sao_Paulo';
    const data = dt.toLocaleDateString('pt-BR', { timeZone: tz });
    const hora = dt.toLocaleTimeString('pt-BR', { hour12: false, timeZone: tz });
    return `${data} - ${hora}`;
  }, []);

  const buildSangriaHtml = React.useCallback((snap: SangriaPrintSnapshot): string => {
    const escapeHtml = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const rowsHtml = snap.rows
      .map((r) => {
        const dataHoraTxt = fmtDataHora(r.DATA_HORA);
        return `
          <tr>
            <td>${escapeHtml(r.NUMNOTA)}</td>
            <td>${escapeHtml(r.NUMPED_TV7)}</td>
            <td>${escapeHtml(r.CODCLI)}</td>
            <td>${escapeHtml(r.CLIENTE)}</td>
            <td style="text-align:right;">${escapeHtml(fmtBRL.format(parseMoney(r.VL_DINHEIRO) ?? 0))}</td>
            <td>${escapeHtml(dataHoraTxt)}</td>
            <td>${escapeHtml(r.CODUSUR)}</td>
            <td>${escapeHtml(r.NOME)}</td>
          </tr>
        `;
      })
      .join('');

    return `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Sangria - Lote ${escapeHtml(snap.idLote)}</title>
          <style>
            @page { margin: 12mm; }
            body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
            h1 { font-size: 16px; margin: 0 0 8px; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin: 8px 0 12px; }
            .meta div { padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; }
            .label { font-size: 11px; color: #444; }
            .value { font-size: 13px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
            th { background: #f3f4f6; text-align: left; }
            .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 24px; }
            .line { border-top: 1px solid #111; padding-top: 6px; text-align: center; }
            .muted { color: #444; font-size: 11px; }
          </style>
        </head>
        <body>
          <h1>Comprovante de Sangria</h1>
          <div class="meta">
            <div><div class="label">Lote</div><div class="value">${escapeHtml(snap.idLote)}</div></div>
            <div><div class="label">Filial</div><div class="value">${escapeHtml(snap.codfilial || '-')}</div></div>
            <div><div class="label">Saldo conciliado</div><div class="value">${escapeHtml(snap.saldoConciliadoTxt)}</div></div>
            <div><div class="label">Saldo avulso</div><div class="value">${escapeHtml(snap.saldoAvulsoTxt)}</div></div>
            <div><div class="label">Fundo de caixa (lote atual)</div><div class="value">${escapeHtml(snap.saldoFundoCaixaTxt)}</div></div>
            <div><div class="label">Fundo de caixa (próximo lote)</div><div class="value">${escapeHtml(snap.fundoProximoLoteTxt)}</div></div>
            <div><div class="label">Total do lote</div><div class="value">${escapeHtml(snap.totalLoteTxt)}</div></div>
            <div><div class="label">Data/Hora execução</div><div class="value">${escapeHtml(snap.dataHoraExecucaoTxt)}</div></div>
            <div><div class="label">Registros</div><div class="value">${escapeHtml(snap.rows.length)}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:70px;">NF-e</th>
                <th style="width:70px;">TV7</th>
                <th style="width:70px;">Cod Cli</th>
                <th>Cliente</th>
                <th style="width:110px;">R$ Dinheiro</th>
                <th style="width:140px;">Data/Hora</th>
                <th style="width:70px;">RCA</th>
                <th style="width:160px;">Nome</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="8" class="muted">Nenhum registro.</td></tr>`}
            </tbody>
          </table>

          <div class="sign">
            <div>
              <div class="line">Assinatura do responsável</div>
              <div class="muted">Nome / Matrícula</div>
            </div>
            <div>
              <div class="line">Assinatura do conferente</div>
              <div class="muted">Nome / Matrícula</div>
            </div>
          </div>
        </body>
      </html>`;
  }, [fmtBRL, fmtDataHora, parseMoney]);

  const imprimirSangria = React.useCallback(() => {
    const iframe = sangriaDocIframeRef.current;
    const w = iframe?.contentWindow;
    if (!w) return;
    try {
      w.focus();
      w.print();
    } catch {
      return;
    }
  }, []);

  const sangriaDocumentoHtml = React.useMemo(() => {
    if (!sangriaPrintSnapshot) return '';
    return buildSangriaHtml(sangriaPrintSnapshot);
  }, [buildSangriaHtml, sangriaPrintSnapshot]);

  const [dataInicio, setDataInicio] = React.useState<string>('');
  const [dataFim, setDataFim] = React.useState<string>('');
  const dataInicioRef = React.useRef<string>('');
  const dataFimRef = React.useRef<string>('');
  const [tipoEntregaFiltro, setTipoEntregaFiltro] = React.useState<'RP' | 'EN_EF'>('EN_EF');
  const tipoEntregaFiltroRef = React.useRef<'RP' | 'EN_EF'>('EN_EF');

  const [q, setQ] = React.useState('');

  const setDataInicioSafe = React.useCallback((v: string) => {
    dataInicioRef.current = v;
    setDataInicio(v);
  }, []);

  const setDataFimSafe = React.useCallback((v: string) => {
    dataFimRef.current = v;
    setDataFim(v);
  }, []);

  const setTipoEntregaFiltroSafe = React.useCallback((v: 'RP' | 'EN_EF') => {
    tipoEntregaFiltroRef.current = v;
    setTipoEntregaFiltro(v);
  }, []);

  const fetchNotas = React.useCallback(async () => {
    const di = dataInicioRef.current;
    const df = dataFimRef.current;
    const te = tipoEntregaFiltroRef.current;
    if (!di || !df) {
      setErro('Informe data inicial e data final');
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const baseApi = resolveBaseApi();
      const qsParams = new URLSearchParams();
      qsParams.set('dataInicio', di);
      qsParams.set('dataFim', df);
      if (te === 'RP') {
        qsParams.set('tiposEntrega', 'RP');
      }
      const qs = qsParams.toString();
      const resp = await fetch(`${baseApi}/gestlog/notas-recentes?${qs}`);
      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data: unknown = isJson ? await resp.json() : { message: await resp.text() };

      if (!resp.ok) {
        const messageRaw =
          data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined;
        const detalheRaw =
          data && typeof data === 'object' && 'detalhe' in data ? (data as { detalhe?: unknown }).detalhe : undefined;
        const detalheTxt =
          detalheRaw && typeof detalheRaw === 'object' ? JSON.stringify(detalheRaw) : detalheRaw != null ? String(detalheRaw) : '';
        const msg = typeof messageRaw === 'string' ? messageRaw : 'Falha ao carregar notas';
        throw new Error(detalheTxt ? `${msg} (${detalheTxt})` : msg);
      }

      const rowsRaw =
        data && typeof data === 'object' && 'rows' in data ? (data as { rows?: unknown }).rows : undefined;
      const arr = Array.isArray(rowsRaw) ? (rowsRaw as NotasRow[]) : [];
      setRows(arr);
      const saldoRaw =
        data && typeof data === 'object' && 'VL_SALDO_DINHEIRO' in data
          ? (data as { VL_SALDO_DINHEIRO?: unknown }).VL_SALDO_DINHEIRO
          : null;
      setSaldoDinheiro(parseMoney(saldoRaw));
      const saldoAvulsoRaw =
        data && typeof data === 'object' && 'VL_SALDO_DINHEIRO_AVULSO' in data
          ? (data as { VL_SALDO_DINHEIRO_AVULSO?: unknown }).VL_SALDO_DINHEIRO_AVULSO
          : null;
      setSaldoAvulso(parseMoney(saldoAvulsoRaw));
      const saldoFundoCxRaw =
        data && typeof data === 'object' && 'VL_SALDO_FUNDO_CX' in data
          ? (data as { VL_SALDO_FUNDO_CX?: unknown }).VL_SALDO_FUNDO_CX
          : null;
      setSaldoFundoCaixa(parseMoney(saldoFundoCxRaw) ?? 0);
      const idLoteRaw =
        data && typeof data === 'object' && 'ID_LOTE' in data ? (data as { ID_LOTE?: unknown }).ID_LOTE : null;
      const idLoteTxt = idLoteRaw == null ? null : String(idLoteRaw).trim();
      setIdLoteSaldo(idLoteTxt ? idLoteTxt : null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : String(e || 'Falha ao carregar notas'));
    } finally {
      setLoading(false);
    }
  }, [parseMoney]);

  const getMatriculaUsuario = React.useCallback((): number | null => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('usuarioLogado') : null;
      const u = raw ? JSON.parse(raw) : {};
      const c = u?.matricula ?? u?.MATRICULA ?? u?.codusur ?? u?.CODUSUR ?? null;
      const n = c != null ? Number(String(c).trim()) : null;
      return n && Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }, []);

  const consultarLoteSangria = React.useCallback(async () => {
    const idLoteNum = Number(idLoteSaldo);
    if (!Number.isFinite(idLoteNum) || idLoteNum <= 0) {
      setSangriaRows([]);
      setSangriaErr('Não foi possível obter o ID do lote (maior que zero).');
      return;
    }

    setSangriaLoading(true);
    setSangriaErr(null);
    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestlog/gestao-sangria-lotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idLote: idLoteNum, consultar_lote: 'consultar_lote' }),
      });

      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data: unknown = isJson ? await resp.json() : { message: await resp.text() };

      if (!resp.ok) {
        const messageRaw =
          data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined;
        const m = typeof messageRaw === 'string' ? messageRaw : 'Falha ao consultar lote';
        throw new Error(m);
      }

      const rowsRaw = data && typeof data === 'object' && 'rows' in data ? (data as { rows?: unknown }).rows : undefined;
      const arr = Array.isArray(rowsRaw) ? (rowsRaw as SangriaLoteRow[]) : [];
      setSangriaRows(arr);
    } catch (e: unknown) {
      setSangriaRows([]);
      setSangriaErr(e instanceof Error ? e.message : String(e || 'Falha ao consultar lote'));
    } finally {
      setSangriaLoading(false);
    }
  }, [idLoteSaldo]);

  const executarSangria = React.useCallback(async (vlSaldoFundoCx?: number | null): Promise<boolean> => {
    const idLoteNum = Number(idLoteSaldo);
    if (!Number.isFinite(idLoteNum) || idLoteNum <= 0) {
      setSangriaErr('Não foi possível obter o ID do lote (maior que zero).');
      return false;
    }

    const matricula = getMatriculaUsuario();
    if (!matricula) {
      setSangriaErr('Não foi possível obter a matrícula do usuário logado.');
      return false;
    }

    const codfilialRaw = sangriaRows?.[0]?.CODFILIAL ?? null;
    const codfilialTxt = codfilialRaw == null ? null : String(codfilialRaw).trim();

    setSangriaExecLoading(true);
    setSangriaErr(null);
    setSangriaMsg(null);
    try {
      const baseApi = resolveBaseApi();
      const nowIso = new Date().toISOString();
      const resp = await fetch(`${baseApi}/gestlog/gestao-sangria-lotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idLote: idLoteNum,
          codusurSangria: matricula,
          codusurUltAtual: matricula,
          dataHoraSangria: nowIso,
          dataHoraUltAtual: nowIso,
          codfilial: codfilialTxt || undefined,
          vlSaldoFundoCx: vlSaldoFundoCx == null ? undefined : vlSaldoFundoCx,
        }),
      });

      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data: unknown = isJson ? await resp.json() : { message: await resp.text() };

      if (!resp.ok) {
        const messageRaw =
          data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined;
        const m = typeof messageRaw === 'string' ? messageRaw : 'Falha ao executar sangria';
        throw new Error(m);
      }

      const novoIdLoteRaw =
        data && typeof data === 'object' && 'novoIdLote' in data ? (data as { novoIdLote?: unknown }).novoIdLote : null;
      const novoIdLoteTxt = novoIdLoteRaw == null ? null : String(novoIdLoteRaw).trim();
      setSangriaMsg(novoIdLoteTxt ? `Sangria realizada. Novo lote: ${novoIdLoteTxt}.` : 'Sangria realizada.');
      if (novoIdLoteTxt) setIdLoteSaldo(novoIdLoteTxt);
      fetchNotas();
      return true;
    } catch (e: unknown) {
      setSangriaErr(e instanceof Error ? e.message : String(e || 'Falha ao executar sangria'));
      return false;
    } finally {
      setSangriaExecLoading(false);
    }
  }, [idLoteSaldo, getMatriculaUsuario, sangriaRows, fetchNotas]);

  const confirmarEExecutarSangria = React.useCallback(async () => {
    const idLoteTxt = idLoteSaldo == null ? '' : String(idLoteSaldo).trim();
    if (!idLoteTxt) {
      setShowConfirmSangria(false);
      return;
    }

    const fundoCxRawTxt = String(novoFundoCaixa || '').trim();
    const fundoCxN = parseMoney(fundoCxRawTxt);
    if (fundoCxRawTxt && fundoCxN == null) {
      setSangriaErr('Informe um valor válido para o fundo de caixa do próximo lote.');
      return;
    }
    if (fundoCxN != null && fundoCxN < 0) {
      setSangriaErr('O fundo de caixa do próximo lote deve ser maior ou igual a zero.');
      return;
    }
    const fundoCxFinal = fundoCxN ?? 0;

    const saldoConciliadoTxt = saldoDinheiro == null ? '-' : fmtBRL.format(saldoDinheiro);
    const saldoAvulsoTxt = saldoAvulso == null ? '-' : fmtBRL.format(saldoAvulso);
    const totalLoteTxt = fmtBRL.format((saldoDinheiro ?? 0) + (saldoAvulso ?? 0));
    const codfilial = sangriaRows?.[0]?.CODFILIAL == null ? '' : String(sangriaRows[0].CODFILIAL).trim();
    const dataHoraExecucaoTxt = fmtDataHora(new Date());

    setShowConfirmSangria(false);
    setSangriaPodeImprimir(false);
    setSangriaPrintSnapshot({
      idLote: idLoteTxt,
      codfilial,
      saldoConciliadoTxt,
      saldoAvulsoTxt,
      saldoFundoCaixaTxt,
      fundoProximoLoteTxt: fmtBRL.format(fundoCxFinal),
      totalLoteTxt,
      dataHoraExecucaoTxt,
      rows: [...sangriaRows],
    });

    const ok = await executarSangria(fundoCxFinal);
    setSangriaPodeImprimir(ok);
    if (!ok) setSangriaPrintSnapshot(null);
    if (ok) setShowSangriaDocumento(true);
  }, [idLoteSaldo, novoFundoCaixa, parseMoney, saldoDinheiro, fmtBRL, saldoAvulso, sangriaRows, fmtDataHora, executarSangria]);

  const consultarLancamentosAvulso = React.useCallback(async () => {
    const idLoteNum = Number(idLoteSaldo);
    if (!Number.isFinite(idLoteNum) || idLoteNum <= 0) {
      setAvulsoRows([]);
      setAvulsoListErr('Não foi possível obter o ID do lote (maior que zero).');
      return;
    }

    setAvulsoListLoading(true);
    setAvulsoListErr(null);
    try {
      const baseApi = resolveBaseApi();
      const resp = await fetch(`${baseApi}/gestlog/gestao-sangria-lotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idLote: idLoteNum, codfilial: '3', consultar_lote: 'listar_avulsos' }),
      });

      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data: unknown = isJson ? await resp.json() : { message: await resp.text() };
      if (!resp.ok) {
        const messageRaw =
          data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined;
        const m = typeof messageRaw === 'string' ? messageRaw : 'Falha ao listar lançamentos avulsos';
        throw new Error(m);
      }

      const rowsRaw = data && typeof data === 'object' && 'rows' in data ? (data as { rows?: unknown }).rows : undefined;
      const arr = Array.isArray(rowsRaw) ? (rowsRaw as AvulsoLancRow[]) : [];
      setAvulsoRows(arr);
    } catch (e: unknown) {
      setAvulsoRows([]);
      setAvulsoListErr(e instanceof Error ? e.message : String(e || 'Falha ao listar lançamentos avulsos'));
    } finally {
      setAvulsoListLoading(false);
    }
  }, [idLoteSaldo]);

  React.useEffect(() => {
    if (!show) return;
    const today = new Date();
    const fim = toYmd(today);
    const inicio = toYmd(new Date(today.getFullYear(), today.getMonth(), 1));
    setDataInicioSafe(inicio);
    setDataFimSafe(fim);
    setTipoEntregaFiltroSafe('EN_EF');
    setConfirmMsg(null);
    setConfirmErr(null);
    fetchNotas();
  }, [show, toYmd, setDataInicioSafe, setDataFimSafe, setTipoEntregaFiltroSafe, fetchNotas]);

  React.useEffect(() => {
    if (!showAvulsoModal) return;
    setShowAvulsoNovoLancamentoModal(false);
    setAvulsoMsg(null);
    setAvulsoRows([]);
    setAvulsoListErr(null);
    setAvulsoListLoading(false);
    consultarLancamentosAvulso();
  }, [showAvulsoModal, consultarLancamentosAvulso]);

  React.useEffect(() => {
    if (confirmNfe != null) return;
    setShowConfirmarEntregaResumo(false);
    setConfirmarEntregaValorAvulso('');
  }, [confirmNfe]);

  React.useEffect(() => {
    if (!showSangriaModal) return;
    setSangriaMsg(null);
    setSangriaErr(null);
    setSangriaTab('conciliado');
    consultarLoteSangria();
    consultarLancamentosAvulso();
  }, [showSangriaModal, idLoteSaldo, consultarLoteSangria, consultarLancamentosAvulso]);

  React.useEffect(() => {
    if (showSangriaModal) return;
    setSangriaRows([]);
    setSangriaErr(null);
    setSangriaMsg(null);
    setSangriaLoading(false);
    setSangriaExecLoading(false);
    setShowConfirmSangria(false);
    setNovoFundoCaixa('');
    setSangriaPodeImprimir(false);
    setSangriaPrintSnapshot(null);
    setShowSangriaDocumento(false);
  }, [showSangriaModal]);

  const norm = React.useCallback((v: unknown) => String(v ?? '').trim().toLowerCase(), []);
  const onlyDigits = React.useCallback((v: string) => String(v || '').replace(/\D+/g, ''), []);

  const parsedQuery = React.useMemo(() => {
    const raw = String(q || '').trim();
    const tokens = raw.match(/"[^"]*"|\S+/g) || [];

    const terms: string[] = [];
    const filters: {
      status?: 'CONF' | 'PEND';
      tipoEntrega?: string;
      filialRetira?: string;
      rca?: string;
      numNota?: string;
      tv7?: string;
      tv8?: string;
      codCli?: string;
      cliente?: string;
      valorNfeCents?: number;
    } = {};

    const unquote = (s: string) => {
      const t = s.trim();
      if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return t.slice(1, -1);
      return t;
    };

    for (const tk of tokens) {
      const idx = tk.indexOf(':');
      if (idx <= 0) {
        const rawToken = unquote(tk);
        const tokenTrim = rawToken.trim();
        const looksLikeMoney =
          (tokenTrim.includes(',') || tokenTrim.includes('.')) &&
          /\d/.test(tokenTrim) &&
          /[.,]\d{1,2}$/.test(tokenTrim);
        if (looksLikeMoney) {
          const n = parseMoney(tokenTrim);
          if (n != null) {
            filters.valorNfeCents = Math.round(n * 100);
            continue;
          }
        }

        const v = norm(tokenTrim);
        if (v) terms.push(v);
        continue;
      }

      const key = norm(tk.slice(0, idx));
      const valRaw = unquote(tk.slice(idx + 1));
      const val = valRaw.trim();
      if (!val) continue;

      if (key === 'status' || key === 'sitdoc') {
        const v = norm(val);
        if (v.startsWith('p')) filters.status = 'PEND';
        else if (v.startsWith('c') || v.startsWith('s')) filters.status = 'CONF';
        continue;
      }
      if (key === 'tipo' || key === 'tipoentrega' || key === 'tp') {
        filters.tipoEntrega = val;
        continue;
      }
      if (key === 'filial' || key === 'filialretira' || key === 'retira') {
        const d = onlyDigits(val);
        if (d) filters.filialRetira = d;
        continue;
      }
      if (key === 'rca' || key === 'vendedor' || key === 'nome') {
        filters.rca = val;
        continue;
      }
      if (key === 'nfe' || key === 'nf' || key === 'nota' || key === 'numnota') {
        const d = onlyDigits(val);
        if (d) filters.numNota = d;
        continue;
      }
      if (key === 'tv8' || key === 'numped') {
        const d = onlyDigits(val);
        if (d) filters.tv8 = d;
        continue;
      }
      if (key === 'tv7' || key === 'numpedentfut') {
        const d = onlyDigits(val);
        if (d) filters.tv7 = d;
        continue;
      }
      if (key === 'codcli') {
        const d = onlyDigits(val);
        if (d) filters.codCli = d;
        continue;
      }
      if (key === 'cliente') {
        filters.cliente = val;
        continue;
      }
      if (key === 'valor' || key === 'vltotal' || key === 'total' || key === 'valornfe' || key === 'valor_nfe') {
        const n = parseMoney(val);
        if (n != null) filters.valorNfeCents = Math.round(n * 100);
        continue;
      }

      const v = norm(unquote(tk));
      if (v) terms.push(v);
    }

    return { terms, filters };
  }, [q, norm, onlyDigits, parseMoney]);

  const groups = React.useMemo(() => {
    const map = new Map<number, NotaGroup>();
    for (const r of rows) {
      const key = Number(r.NUMNOTA);
      if (!map.has(key)) {
        map.set(key, {
          NUMNOTA: key,
          DTSAIDA: r.DTSAIDA,
          CODCLI: Number(r.CODCLI),
          CLIENTE: String(r.CLIENTE || ''),
          TV7: Number(r.TV7),
          TV8: Number(r.TV8),
          ID_LOTE_PEDIDO: r.ID_LOTE_PEDIDO ?? null,
          NOME: String(r.NOME || ''),
          CODFILIALRETIRA: r.CODFILIALRETIRA != null ? Number(r.CODFILIALRETIRA) : undefined,
          TIPOENTREGA: String(r.TIPOENTREGA || ''),
          SITDOC: String(r.SITDOC || ''),
          VALOR_DINHEIRO: r.VALOR_DINHEIRO ?? r.VLDESPACHO ?? null,
          VLTOTAL: r.VLTOTAL ?? null,
          items: [],
        });
      }
      const g = map.get(key)!;
      if (g.ID_LOTE_PEDIDO == null) {
        g.ID_LOTE_PEDIDO = r.ID_LOTE_PEDIDO ?? null;
      }
      if (g.VALOR_DINHEIRO == null) {
        g.VALOR_DINHEIRO = r.VALOR_DINHEIRO ?? r.VLDESPACHO ?? null;
      }
      if (g.VLTOTAL == null) {
        g.VLTOTAL = r.VLTOTAL ?? null;
      }
      g.items.push({ CODPROD: Number(r.CODPROD), DESCRICAO: String(r.DESCRICAO || ''), CODAUXILIAR: r.CODAUXILIAR, QT: Number(r.QT) });
    }
    return Array.from(map.values()).sort((a, b) => b.NUMNOTA - a.NUMNOTA);
  }, [rows]);

  React.useEffect(() => {
    if (editNfe == null) return;
    setEditMsg(null);
    setEditErr(null);
    setEditLoading(false);
    const gSel = groups.find((g) => g.NUMNOTA === editNfe);
    if (!gSel) {
      setEditTipoEntrega('');
      setEditValorDinheiro('');
      return;
    }
    const tipoRaw = String(gSel.TIPOENTREGA ?? '').trim().toUpperCase();
    const tipo: '' | 'EN' | 'RP' = tipoRaw === 'EN' || tipoRaw === 'RP' ? tipoRaw : '';
    setEditTipoEntrega(tipo);
    const v = parseMoney(gSel.VALOR_DINHEIRO);
    setEditValorDinheiro(
      v == null
        ? ''
        : v.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
    );
  }, [editNfe, groups, parseMoney]);

  type FilteredGroup = NotaGroup & { itemsFiltrados?: NotaGroup['items'] };

  const filteredGroups = React.useMemo(() => {
    const { terms, filters } = parsedQuery;
    const hasTerms = terms.length > 0;

    const filtered: FilteredGroup[] = [];

    for (const g of groups) {
      const confirmado = g.SITDOC === 'S' || sitdocMarcadas.has(g.NUMNOTA);

      if (filters.status === 'CONF' && !confirmado) continue;
      if (filters.status === 'PEND' && confirmado) continue;

      if (filters.tipoEntrega && norm(g.TIPOENTREGA) !== norm(filters.tipoEntrega)) continue;
      if (filters.filialRetira && onlyDigits(String(g.CODFILIALRETIRA ?? '')) !== filters.filialRetira) continue;
      if (filters.rca && !norm(g.NOME).includes(norm(filters.rca))) continue;

      if (filters.numNota && String(g.NUMNOTA) !== filters.numNota) continue;
      if (filters.tv8 && String(g.TV8) !== filters.tv8) continue;
      if (filters.tv7 && String(g.TV7) !== filters.tv7) continue;
      if (filters.codCli && String(g.CODCLI) !== filters.codCli) continue;
      if (filters.cliente && !norm(g.CLIENTE).includes(norm(filters.cliente))) continue;
      if (filters.valorNfeCents != null) {
        const v = parseMoney(g.VLTOTAL);
        const cents = v == null ? null : Math.round(v * 100);
        if (cents == null || cents !== filters.valorNfeCents) continue;
      }

      if (!hasTerms) {
        filtered.push(g);
        continue;
      }

      const header = [
        g.NUMNOTA,
        g.DTSAIDA,
        g.CODCLI,
        g.CLIENTE,
        g.TV7,
        g.TV8,
        g.NOME,
        g.CODFILIALRETIRA,
        g.TIPOENTREGA,
        g.SITDOC,
      ]
        .map((x) => norm(x))
        .join(' | ');

      const headerOk = terms.every((t) => header.includes(t));

      if (headerOk) {
        filtered.push(g);
        continue;
      }

      const itemsFiltrados = g.items.filter((it) => {
        const txt = [it.CODPROD, it.DESCRICAO, it.CODAUXILIAR, it.QT].map((x) => norm(x)).join(' | ');
        return terms.every((t) => txt.includes(t));
      });

      if (itemsFiltrados.length > 0) {
        filtered.push({ ...g, itemsFiltrados });
      } else {
        const groupOk = terms.every((t) => {
          if (header.includes(t)) return true;
          return g.items.some((it) => {
            const txt = [it.CODPROD, it.DESCRICAO, it.CODAUXILIAR, it.QT].map((x) => norm(x)).join(' | ');
            return txt.includes(t);
          });
        });
        if (!groupOk) continue;
        filtered.push(g);
      }
    }

    return filtered;
  }, [
    groups,
    sitdocMarcadas,
    norm,
    onlyDigits,
    parseMoney,
    parsedQuery,
  ]);

  const totalItensVisiveis = React.useMemo(
    () => filteredGroups.reduce((acc, g) => acc + (g.itemsFiltrados ? g.itemsFiltrados.length : g.items.length), 0),
    [filteredGroups]
  );
  const confirmadosCount = React.useMemo(() => filteredGroups.filter((g) => g.SITDOC === 'S' || sitdocMarcadas.has(g.NUMNOTA)).length, [filteredGroups, sitdocMarcadas]);
  const pendentesCount = React.useMemo(() => filteredGroups.filter((g) => !(g.SITDOC === 'S' || sitdocMarcadas.has(g.NUMNOTA))).length, [filteredGroups, sitdocMarcadas]);
  const totalNfeValor = React.useMemo(
    () => filteredGroups.reduce((acc, g) => acc + (parseMoney(g.VLTOTAL) ?? 0), 0),
    [filteredGroups, parseMoney]
  );

  const imprimirPedidos = React.useCallback(() => {
    const escapeHtml = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const fmtYmdToBr = (ymd: string): string => {
      const s = String(ymd || '').trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return s;
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return s;
      const dt = new Date(y, mo - 1, d);
      if (Number.isNaN(dt.getTime())) return s;
      return dt.toLocaleDateString('pt-BR');
    };

    const metaQueryTxt = q.trim() ? q.trim() : '-';
    const metaTipoEntregaTxt = tipoEntregaFiltro === 'RP' ? 'Retira Posterior' : 'Entrega/Entrega Futura';
    const dataInicioTxt = dataInicio ? fmtYmdToBr(dataInicio) : '-';
    const dataFimTxt = dataFim ? fmtYmdToBr(dataFim) : '-';

    const confirmados = filteredGroups.filter((g) => g.SITDOC === 'S' || sitdocMarcadas.has(g.NUMNOTA));
    const nfeListTxt = confirmados.map((g) => String(g.NUMNOTA)).join(', ') || '-';

    const pedidosRows = confirmados
      .map((g) => {
        const itensVisiveis = g.itemsFiltrados ? g.itemsFiltrados : g.items;
        const itensCount = itensVisiveis.length;
        const qtTotal = itensVisiveis.reduce((acc, it) => acc + (Number(it.QT) || 0), 0);
        const valorDinheiro = parseMoney(g.VALOR_DINHEIRO);
        return {
          NUMNOTA: g.NUMNOTA,
          TV8: g.TV8,
          CODCLI: g.CODCLI,
          CLIENTE: g.CLIENTE,
          ID_LOTE_PEDIDO: g.ID_LOTE_PEDIDO ?? '-',
          TIPOENTREGA: g.TIPOENTREGA ?? '-',
          NOME: g.NOME ?? '-',
          itensCount,
          qtTotal,
          valorDinheiroTxt: valorDinheiro != null ? fmtBRL.format(valorDinheiro) : '-',
        };
      })
      .sort((a, b) => {
        if (a.ID_LOTE_PEDIDO !== b.ID_LOTE_PEDIDO) return String(a.ID_LOTE_PEDIDO).localeCompare(String(b.ID_LOTE_PEDIDO));
        return Number(a.NUMNOTA) - Number(b.NUMNOTA);
      });

    const totalPedidos = pedidosRows.length;
    const totalItensConfirmados = pedidosRows.reduce((acc, r) => acc + r.itensCount, 0);
    const totalQtConfirmados = pedidosRows.reduce((acc, r) => acc + r.qtTotal, 0);
    const totalDinheiroConfirmados = pedidosRows.reduce((acc, r) => acc + (parseMoney(r.valorDinheiroTxt) ?? 0), 0);

    const pedidosHtml = pedidosRows
      .map(
        (r) => `
          <tr>
            <td style="width:70px;">${escapeHtml(r.NUMNOTA)}</td>
            <td style="width:65px;">${escapeHtml(r.TV8)}</td>
            <td>${escapeHtml(`(${r.CODCLI}) ${r.CLIENTE}`)}</td>
            <td style="width:70px;">${escapeHtml(r.ID_LOTE_PEDIDO)}</td>
            <td style="width:60px;">${escapeHtml(r.TIPOENTREGA)}</td>
            <td style="width:55px; text-align:right;">${escapeHtml(r.itensCount)}</td>
            <td style="width:55px; text-align:right;">${escapeHtml(r.qtTotal)}</td>
            <td style="width:90px; text-align:right;">${escapeHtml(r.valorDinheiroTxt)}</td>
            <td style="width:120px;">${escapeHtml(truncateEnd(String(r.NOME || '-'), 22))}</td>
          </tr>
        `
      )
      .join('');

    const resumoByProd = new Map<
      string,
      { CODPROD: number; DESCRICAO: string; CODAUXILIAR?: string; QT_TOTAL: number }
    >();

    for (const g of confirmados) {
      const itensVisiveis = g.itemsFiltrados ? g.itemsFiltrados : g.items;
      for (const it of itensVisiveis) {
        const codprod = Number(it.CODPROD);
        const descricao = String(it.DESCRICAO || '').trim();
        const codaux = it.CODAUXILIAR ? String(it.CODAUXILIAR).trim() : '';
        const key = `${codprod}__${codaux}__${descricao}`;
        const prev = resumoByProd.get(key);
        const qt = Number(it.QT) || 0;
        if (prev) {
          prev.QT_TOTAL += qt;
        } else {
          resumoByProd.set(key, { CODPROD: codprod, DESCRICAO: descricao, CODAUXILIAR: codaux || undefined, QT_TOTAL: qt });
        }
      }
    }

    const resumoRows = Array.from(resumoByProd.values()).sort((a, b) => {
      if (a.CODPROD !== b.CODPROD) return a.CODPROD - b.CODPROD;
      const da = a.DESCRICAO.toLowerCase();
      const db = b.DESCRICAO.toLowerCase();
      if (da < db) return -1;
      if (da > db) return 1;
      return String(a.CODAUXILIAR || '').localeCompare(String(b.CODAUXILIAR || ''));
    });

    const resumoHtml = resumoRows
      .map(
        (r) => `
          <tr>
            <td style="width:80px;">${escapeHtml(r.CODPROD)}</td>
            <td>${escapeHtml(r.DESCRICAO)}</td>
            <td style="width:160px;">${escapeHtml(r.CODAUXILIAR || '-')}</td>
            <td style="width:60px; text-align:right;">${escapeHtml(r.QT_TOTAL)}</td>
          </tr>
        `
      )
      .join('');

    const totalResumoQt = resumoRows.reduce((acc, r) => acc + (Number(r.QT_TOTAL) || 0), 0);
    const sectionPedidos = pedidosRows.length
      ? `
        <div class="sectionTitle">Resumo por pedidos (confirmados)</div>
        <table>
          <thead>
            <tr>
              <th style="width:70px;">NF-e</th>
              <th style="width:65px;">TV8</th>
              <th>Cliente</th>
              <th style="width:70px;">Lote</th>
              <th style="width:60px;">Tipo</th>
              <th style="width:55px; text-align:right;">Itens</th>
              <th style="width:55px; text-align:right;">Qt</th>
              <th style="width:90px; text-align:right;">R$</th>
              <th style="width:120px;">Vendedor</th>
            </tr>
          </thead>
          <tbody>
            ${pedidosHtml}
            <tr>
              <td colspan="5" style="text-align:right;"><strong>Totais</strong></td>
              <td style="text-align:right;"><strong>${escapeHtml(totalItensConfirmados)}</strong></td>
              <td style="text-align:right;"><strong>${escapeHtml(totalQtConfirmados)}</strong></td>
              <td style="text-align:right;"><strong>${escapeHtml(fmtBRL.format(totalDinheiroConfirmados))}</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      `
      : `<div class="muted">Sem pedidos confirmados para imprimir.</div>`;

    const sectionProdutosPorPedido = confirmados.length
      ? `
        <div class="sectionTitle">Resumo de produtos por pedido</div>
        ${confirmados
          .map((g) => {
            const itensVisiveis = g.itemsFiltrados ? g.itemsFiltrados : g.items;
            const resumoMap = new Map<string, { CODPROD: number; DESCRICAO: string; CODAUXILIAR?: string; QT_TOTAL: number }>();
            for (const it of itensVisiveis) {
              const codprod = Number(it.CODPROD);
              const descricao = String(it.DESCRICAO || '').trim();
              const codaux = it.CODAUXILIAR ? String(it.CODAUXILIAR).trim() : '';
              const key = `${codprod}__${codaux}__${descricao}`;
              const prev = resumoMap.get(key);
              const qt = Number(it.QT) || 0;
              if (prev) prev.QT_TOTAL += qt;
              else resumoMap.set(key, { CODPROD: codprod, DESCRICAO: descricao, CODAUXILIAR: codaux || undefined, QT_TOTAL: qt });
            }
            const rows = Array.from(resumoMap.values()).sort((a, b) => {
              if (a.CODPROD !== b.CODPROD) return a.CODPROD - b.CODPROD;
              const da = a.DESCRICAO.toLowerCase();
              const db = b.DESCRICAO.toLowerCase();
              if (da < db) return -1;
              if (da > db) return 1;
              return String(a.CODAUXILIAR || '').localeCompare(String(b.CODAUXILIAR || ''));
            });
            const rowsHtml = rows
              .map(
                (r) => `
                  <tr>
                    <td style="width:80px;">${escapeHtml(r.CODPROD)}</td>
                    <td>${escapeHtml(r.DESCRICAO)}</td>
                    <td style="width:160px;">${escapeHtml(r.CODAUXILIAR || '-')}</td>
                    <td style="width:60px; text-align:right;">${escapeHtml(r.QT_TOTAL)}</td>
                  </tr>
                `
              )
              .join('');
            const totalQt = rows.reduce((acc, r) => acc + (Number(r.QT_TOTAL) || 0), 0);
            return `
              <div class="pedidoBox">
                <div class="pedidoTitle">
                  NF-e ${escapeHtml(g.NUMNOTA)} | TV8 ${escapeHtml(g.TV8)} | Lote ${escapeHtml(g.ID_LOTE_PEDIDO ?? '-')}
                </div>
                <div class="pedidoSub">
                  Cliente: (${escapeHtml(g.CODCLI)}) ${escapeHtml(truncateEnd(String(g.CLIENTE || '-'), 72))} | Vendedor(a): ${escapeHtml(truncateEnd(String(g.NOME || '-'), 28))}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th style="width:80px;">Cod Prod</th>
                      <th>Descrição</th>
                      <th style="width:160px;">Código de Barras</th>
                      <th style="width:60px; text-align:right;">Qt</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml || `<tr><td colspan="4" class="muted">Sem itens.</td></tr>`}
                    <tr>
                      <td colspan="3" style="text-align:right;"><strong>Total</strong></td>
                      <td style="text-align:right;"><strong>${escapeHtml(totalQt)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          })
          .join('')}
      `
      : '';

    const sectionProdutos = resumoRows.length
      ? `
        <div class="sectionTitle">Resumo por produto</div>
        <table>
          <thead>
            <tr>
              <th style="width:80px;">Cod Prod</th>
              <th>Descrição</th>
              <th style="width:160px;">Código de Barras</th>
              <th style="width:60px; text-align:right;">Qt</th>
            </tr>
          </thead>
          <tbody>
            ${resumoHtml}
            <tr>
              <td colspan="3" style="text-align:right;"><strong>Total</strong></td>
              <td style="text-align:right;"><strong>${escapeHtml(totalResumoQt)}</strong></td>
            </tr>
          </tbody>
        </table>
      `
      : '';

    const cardsHtml = `${sectionPedidos}${sectionProdutosPorPedido}${sectionProdutos}`;

    const html = `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Notas Fiscais Recentes - Impressão</title>
          <style>
            @page { size: A4 landscape; margin: 6mm; }
            body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 9.5px; line-height: 1.1; }
            h1 { font-size: 11px; margin: 0 0 2px; }
            .metaCard { border: 1px solid #000; border-radius: 4px; padding: 3px 5px; margin: 2px 0 4px; }
            .metaGrid { display: flex; flex-wrap: wrap; gap: 2px 8px; align-items: baseline; }
            .metaItem { white-space: nowrap; }
            .metaLabel { font-size: 8px; color: #000; font-weight: 700; }
            .metaValue { font-size: 9px; font-weight: 700; }
            .metaSep { color: #000; }
            .sectionTitle { font-size: 9.5px; font-weight: 800; margin: 4px 0 2px; }
            .pedidoBox { border: 1px solid #000; border-radius: 4px; padding: 3px 5px; margin: 4px 0; page-break-inside: avoid; }
            .pedidoTitle { font-size: 9.5px; font-weight: 800; margin: 0 0 1px; }
            .pedidoSub { font-size: 8.5px; margin: 0 0 3px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 2px 3px; vertical-align: top; }
            th { background: #fff; text-align: left; }
            .muted { color: #000; font-size: 8.5px; }
            .nfeList { font-size: 8.5px; word-break: break-word; margin: 2px 0 4px; }
          </style>
        </head>
        <body>
          <h1>Relatório de pedidos confirmados • Resumo por pedido e produto</h1>
          <div class="metaCard">
            <div class="metaGrid">
              <span class="metaItem"><span class="metaLabel">Período:</span> <span class="metaValue">${escapeHtml(dataInicioTxt)} até ${escapeHtml(dataFimTxt)}</span></span>
              <span class="metaSep">|</span>
              <span class="metaItem"><span class="metaLabel">Tipo entrega:</span> <span class="metaValue">${escapeHtml(metaTipoEntregaTxt)}</span></span>
              <span class="metaSep">|</span>
              <span class="metaItem"><span class="metaLabel">Pesquisa:</span> <span class="metaValue">${escapeHtml(metaQueryTxt)}</span></span>
              <span class="metaSep">|</span>
              <span class="metaItem"><span class="metaLabel">Pedidos:</span> <span class="metaValue">${escapeHtml(totalPedidos)}</span></span>
              <span class="metaSep">|</span>
              <span class="metaItem"><span class="metaLabel">Itens:</span> <span class="metaValue">${escapeHtml(totalItensConfirmados)}</span></span>
              <span class="metaSep">|</span>
              <span class="metaItem"><span class="metaLabel">Qt:</span> <span class="metaValue">${escapeHtml(totalQtConfirmados)}</span></span>
              <span class="metaSep">|</span>
              <span class="metaItem"><span class="metaLabel">Produtos:</span> <span class="metaValue">${escapeHtml(resumoRows.length)}</span></span>
              <span class="metaSep">|</span>
              <span class="metaItem"><span class="metaLabel">Qt total:</span> <span class="metaValue">${escapeHtml(totalResumoQt)}</span></span>
            </div>
          </div>
          <div class="nfeList"><strong>NF-e confirmadas:</strong> ${escapeHtml(nfeListTxt)}</div>

          ${cardsHtml}
        </body>
      </html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.setAttribute('aria-hidden', 'true');

    const cleanup = () => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    iframe.onload = () => {
      const w = iframe.contentWindow;
      if (!w) {
        cleanup();
        return;
      }

      const afterPrint = () => {
        w.removeEventListener('afterprint', afterPrint);
        cleanup();
      };
      w.addEventListener('afterprint', afterPrint);

      setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch {
          cleanup();
        }
      }, 50);

      setTimeout(() => cleanup(), 60000);
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  }, [dataFim, dataInicio, filteredGroups, fmtBRL, parseMoney, q, sitdocMarcadas, tipoEntregaFiltro]);

  const abrirConfirmacao = React.useCallback((numNota: number) => {
    setConfirmErr(null);
    setConfirmMsg(null);
    setShowConfirmarEntregaResumo(false);
    setConfirmarEntregaValorAvulso('');
    setDinheiroRecebidoByNota((prev) => ({ ...prev, [numNota]: '' }));
    setSemDinheiroByNota((prev) => ({ ...prev, [numNota]: false }));
    setTipoEntregaEfByNota((prev) => ({ ...prev, [numNota]: '' }));
    setConfirmNfe(numNota);
  }, []);

  const abrirEdicao = React.useCallback((numNota: number) => {
    setEditLoading(false);
    setEditMsg(null);
    setEditErr(null);
    setEditTipoEntrega('');
    setEditValorDinheiro('');
    setEditNfe(numNota);
  }, []);

  const handleEditarEntrega = React.useCallback(async () => {
    if (editNfe == null) return;
    const gSel = groups.find((g) => g.NUMNOTA === editNfe);
    if (!gSel) {
      setEditErr('NF-e não encontrada');
      return;
    }

    const codusurUltAtual = getMatriculaUsuario();
    if (!codusurUltAtual || !Number.isFinite(codusurUltAtual) || codusurUltAtual <= 0) {
      setEditErr('Não foi possível obter a matrícula do usuário logado.');
      return;
    }

    if (editTipoEntrega !== 'EN' && editTipoEntrega !== 'RP') {
      setEditErr('Selecione o tipo de entrega (Entrega ou Retirada).');
      return;
    }

    const valorDespacho = parseMoney(editValorDinheiro);
    if (valorDespacho == null || valorDespacho < 0) {
      setEditErr('Informe o valor em dinheiro (maior ou igual a zero).');
      return;
    }

    const valorAnterior = parseMoney(gSel.VALOR_DINHEIRO) ?? 0;
    const deltaValor = valorDespacho - valorAnterior;
    const idLotePedido = gSel.ID_LOTE_PEDIDO == null ? NaN : Number(String(gSel.ID_LOTE_PEDIDO).trim());
    const idLoteAberto = idLoteSaldo == null ? NaN : Number(String(idLoteSaldo).trim());
    const idLoteNumber = Number.isFinite(idLotePedido) && idLotePedido > 0 ? idLotePedido : valorDespacho > 0 ? idLoteAberto : NaN;
    const precisaLote = deltaValor !== 0;
    if (precisaLote && (!Number.isFinite(idLoteNumber) || idLoteNumber <= 0)) {
      setEditErr('Não foi possível obter o ID do lote para atualizar o valor em dinheiro desta NF-e.');
      return;
    }

    setEditLoading(true);
    setEditErr(null);
    setEditMsg(null);
    try {
      const baseApi = resolveBaseApi();

      const resp = await fetch(`${baseApi}/gestlog/editar-entrega`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numNota: Number(gSel.NUMNOTA),
          numPedidoTv8: Number(gSel.TV8),
          NUMPED_TV8: Number(gSel.TV8),
          ID_LOTE: precisaLote ? idLoteNumber : undefined,
          valorDespacho,
          codusurUltAtual,
          p_novo_tipo_entrega_ou_retira: editTipoEntrega,
          novoTipoEntregaOuRetira: editTipoEntrega,
        }),
      });
      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data: unknown = isJson ? await resp.json() : { message: await resp.text() };
      if (!resp.ok) {
        const messageRaw =
          data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined;
        const m = typeof messageRaw === 'string' ? messageRaw : 'Falha ao editar entrega';
        throw new Error(m);
      }
      setEditMsg('Atualização realizada com sucesso.');
      fetchNotas();
    } catch (e: unknown) {
      setEditErr(e instanceof Error ? e.message : String(e));
    } finally {
      setEditLoading(false);
    }
  }, [editNfe, groups, editTipoEntrega, editValorDinheiro, getMatriculaUsuario, idLoteSaldo, parseMoney, fetchNotas]);

  const handleConfirmarEntrega = React.useCallback(async () => {
    if (confirmNfe == null) return;
    const gSel = groups.find((g) => g.NUMNOTA === confirmNfe);
    if (!gSel) {
      setConfirmErr('NF-e não encontrada');
      return;
    }
    const tipoEntregaRaw = String(gSel.TIPOENTREGA ?? '').trim().toUpperCase();
    const isEfOrEn = tipoEntregaRaw === 'EF' || tipoEntregaRaw === 'EN';
    const tipoEntregaEf = tipoEntregaEfByNota[gSel.NUMNOTA] ?? '';
    const valorRecebidoRaw = dinheiroRecebidoByNota[gSel.NUMNOTA] ?? '';
    const semDinheiro = Boolean(semDinheiroByNota[gSel.NUMNOTA]);
    const valorRecebido = parseMoney(valorRecebidoRaw);
    const respostaOk = semDinheiro || (valorRecebido != null && valorRecebido > 0);
    if (!respostaOk) {
      setConfirmErr('Informe o valor recebido em dinheiro (maior que zero) ou marque "Sem dinheiro".');
      return;
    }
    if (isEfOrEn && (tipoEntregaEf !== 'EN' && tipoEntregaEf !== 'RP')) {
      setConfirmErr('Selecione o tipo de entrega (Entrega ou Retirada).');
      return;
    }
    setConfirmLoading(true);
    setConfirmErr(null);
    setConfirmMsg(null);
    try {
      const baseApi = resolveBaseApi();
      let codusurUltAtual: number | null = null;
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('usuarioLogado') : null;
        const u = raw ? JSON.parse(raw) : {};
        const c = u?.matricula ?? u?.MATRICULA ?? u?.codusur ?? u?.CODUSUR ?? null;
        codusurUltAtual = c != null ? Number(String(c).trim()) : null;
      } catch {
        codusurUltAtual = null;
      }
      if (!codusurUltAtual || !Number.isFinite(codusurUltAtual) || codusurUltAtual <= 0) {
        setConfirmErr('Não foi possível obter a matrícula do usuário logado.');
        return;
      }
      const idLoteNumber = Number(idLoteSaldo ?? gSel.ID_LOTE_PEDIDO);
      if (!Number.isFinite(idLoteNumber) || idLoteNumber <= 0) {
        setConfirmErr('Não foi possível obter o ID do lote (maior que zero).');
        return;
      }
      const valorDespacho = semDinheiro ? 0 : Number(valorRecebido);
      const resp = await fetch(`${baseApi}/gestlog/marcar-sitdoc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numNota: Number(gSel.NUMNOTA),
          numPedidoTv8: Number(gSel.TV8),
          NUMPED_TV8: Number(gSel.TV8),
          ID_LOTE: idLoteNumber,
          valorDespacho,
          semDinheiro,
          codusurUltAtual,
          p_tipo_anterior_entrega_ou_retira: isEfOrEn ? tipoEntregaRaw : undefined,
          p_novo_tipo_entrega_ou_retira: isEfOrEn ? tipoEntregaEf : undefined,
        }),
      });
      const ct = resp.headers.get('content-type') || '';
      const isJson = ct.toLowerCase().includes('application/json');
      const data: unknown = isJson ? await resp.json() : { message: await resp.text() };
      if (!resp.ok) {
        const messageRaw =
          data && typeof data === 'object' && 'message' in data ? (data as { message?: unknown }).message : undefined;
        const m = typeof messageRaw === 'string' ? messageRaw : 'Falha ao confirmar entrega';
        throw new Error(m);
      }
      const rowsAffectedRaw =
        data && typeof data === 'object' && 'rowsAffected' in data ? (data as { rowsAffected?: unknown }).rowsAffected : undefined;
      const rowsAffected = Number(rowsAffectedRaw ?? 0);
      const rowsAffectedSaldoRaw =
        data && typeof data === 'object' && 'rowsAffectedSaldo' in data
          ? (data as { rowsAffectedSaldo?: unknown }).rowsAffectedSaldo
          : undefined;
      const rowsAffectedSaldo = Number(rowsAffectedSaldoRaw ?? 0);
      const rowsAffectedLoteRaw =
        data && typeof data === 'object' && 'rowsAffectedLote' in data
          ? (data as { rowsAffectedLote?: unknown }).rowsAffectedLote
          : undefined;
      const rowsAffectedLote = Number(rowsAffectedLoteRaw ?? 0);
      if (!rowsAffected || rowsAffected <= 0) {
        throw new Error('Falha ao confirmar entrega: NF-e não localizada para atualização do SITDOC.');
      }
      setConfirmMsg(
        `Entrega confirmada. NF atualizada: ${rowsAffected}. Saldo dinheiro atualizado: ${rowsAffectedSaldo}. Registro do lote: ${rowsAffectedLote}.`
      );
      setSitdocMarcadas((prev) => {
        const s = new Set(prev);
        s.add(gSel.NUMNOTA);
        return s;
      });
      fetchNotas();
      setTimeout(() => setConfirmNfe(null), 800);
    } catch (e: unknown) {
      setConfirmErr(e instanceof Error ? e.message : String(e));
    } finally {
      setConfirmLoading(false);
    }
  }, [confirmNfe, groups, fetchNotas, dinheiroRecebidoByNota, semDinheiroByNota, tipoEntregaEfByNota, parseMoney, idLoteSaldo]);

  if (!show) return null;

  const saldoDinheiroTxt = saldoDinheiro == null ? '-' : fmtBRL.format(saldoDinheiro);
  const saldoAvulsoTxt = saldoAvulso == null ? '-' : fmtBRL.format(saldoAvulso);
  const saldoFundoCaixaTxt = fmtBRL.format(saldoFundoCaixa);
  const totalNfeValorTxt = fmtBRL.format(totalNfeValor);
  const hasSaldoAvulso = (saldoAvulso ?? 0) > 0;
  const idLoteSaldoTxt = idLoteSaldo == null ? '-' : idLoteSaldo;
  const confirmGroup = confirmNfe != null ? groups.find((g) => g.NUMNOTA === confirmNfe) : null;
  const idLotePedidoTxt = confirmGroup?.ID_LOTE_PEDIDO == null ? '-' : String(confirmGroup.ID_LOTE_PEDIDO);

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 1055, backdropFilter: 'blur(5px)' }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
        <div className="modal-dialog modal-fullscreen">
          <div className="modal-content">
            <div className="modal-header py-1">
              <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                <ClipboardCheck size={14} />
                <span>Conciliar Entregas • Notas Fiscais Recentes</span>
              </h6>
              <div className="ms-auto d-flex align-items-center gap-2">
                <div className="card text-bg-danger" style={{ minWidth: '210px' }}>
                  <div className="card-body p-1 d-flex align-items-center justify-content-between" style={{ lineHeight: 1.1 }}>
                    <span className="d-flex align-items-center" style={{ fontSize: '0.62rem', opacity: 0.95 }}>
                      <FileEarmarkText className="me-1" size={12} />
                      <CashStack className="me-1" size={12} />
                      R$ Total NF-e:
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{totalNfeValorTxt}</span>
                  </div>
                </div>
                <div className="card text-bg-danger" style={{ minWidth: '190px' }}>
                  <div className="card-body p-1 d-flex align-items-center justify-content-between" style={{ lineHeight: 1.1 }}>
                    <span className="d-flex align-items-center" style={{ fontSize: '0.62rem', opacity: 0.95 }}>
                      <CashStack className="me-1" size={12} />
                      R$ Saldo Conciliado:
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{saldoDinheiroTxt}</span>
                  </div>
                </div>
                <div className="card text-bg-secondary" style={{ minWidth: '220px' }}>
                  <div className="card-body p-1" style={{ lineHeight: 1.1 }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="d-flex align-items-center" style={{ fontSize: '0.62rem', opacity: 0.95 }}>
                        <CashStack className="me-1" size={12} />
                        R$ Saldo Avulso:
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{saldoAvulsoTxt}</span>
                    </div>
                  </div>
                </div>
                <div className="card text-bg-info" style={{ minWidth: '230px' }}>
                  <div className="card-body p-1" style={{ lineHeight: 1.1 }}>
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="d-flex align-items-center" style={{ fontSize: '0.62rem', opacity: 0.95 }}>
                        <CashStack className="me-1" size={12} />
                        Fundo de Caixa
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{saldoFundoCaixaTxt}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm py-1 px-2"
                  style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }}
                  onClick={() => setShowAvulsoModal(true)}
                >
                  <FileEarmarkText className="me-1" size={12} />
                  Avulso
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm py-1 px-2"
                  style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }}
                  onClick={() => setShowSangriaModal(true)}
                >
                  <CashCoin className="me-1" size={12} />
                  Sangria
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm py-1 px-2"
                  style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }}
                  onClick={() => setShowPrintResumo(true)}
                  disabled={confirmadosCount === 0}
                >
                  <Printer className="me-1" size={12} />
                  Imprimir
                </button>
                <div className="card text-bg-dark" style={{ minWidth: '120px' }}>
                  <div className="card-body p-1 d-flex align-items-center justify-content-between" style={{ lineHeight: 1.1 }}>
                    <span className="d-flex align-items-center" style={{ fontSize: '0.62rem', opacity: 0.95 }}>
                      <BoxSeam className="me-1" size={12} />
                      Lote:
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{idLoteSaldoTxt}</span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={onClose}></button>
              </div>
            </div>
            <div className="modal-body" style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column' }}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="badge bg-primary">NF-e: {filteredGroups.length}</span>
                <span className="badge bg-secondary">Itens: {totalItensVisiveis}</span>
                <span className="badge bg-success">Confirmados: {confirmadosCount}</span>
                <span className="badge bg-warning text-dark">Pendentes: {pendentesCount}</span>
                {loading && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                {erro && <span className="badge bg-danger">{erro}</span>}
                <span className="ms-auto text-muted">De</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ fontSize: '0.62rem', height: '24px', maxWidth: '160px' }}
                  value={dataInicio}
                  onChange={(e) => setDataInicioSafe(e.currentTarget.value)}
                  aria-label="Data início"
                />
                <span className="text-muted">até</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ fontSize: '0.62rem', height: '24px', maxWidth: '160px' }}
                  value={dataFim}
                  onChange={(e) => setDataFimSafe(e.currentTarget.value)}
                  aria-label="Data fim"
                />
                <select
                  className="form-select form-select-sm"
                  style={{ fontSize: '0.62rem', height: '24px', maxWidth: '220px' }}
                  value={tipoEntregaFiltro}
                  onChange={(e) => setTipoEntregaFiltroSafe(e.currentTarget.value === 'RP' ? 'RP' : 'EN_EF')}
                  aria-label="Tipo entrega"
                >
                  <option value="EN_EF">Entrega/Entrega Futura</option>
                  <option value="RP">Retira Posterior</option>
                </select>
                <input
                  className="form-control form-control-sm"
                  style={{ fontSize: '0.62rem', height: '24px', maxWidth: '420px' }}
                  value={q}
                  onChange={(e) => setQ(e.currentTarget.value)}
                  placeholder='Pesquisa avançada'
                  aria-label="Pesquisa avançada"
                />
                {!loading && (
                  <button
                    className="btn btn-primary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                    onClick={fetchNotas}
                    disabled={!dataInicio || !dataFim}
                  >
                    <ArrowClockwise className="me-1" size={12} />
                    Atualizar
                  </button>
                )}
              </div>
              <div className="flex-grow-1" style={{ overflowY: 'auto' }}>
                {groups.length === 0 && !loading ? (
                  <span className="text-muted">Sem notas no período selecionado</span>
                ) : filteredGroups.length === 0 && !loading ? (
                  <span className="text-muted">Sem resultados para o filtro informado</span>
                ) : (
                  <div className="d-flex flex-column" style={{ gap: '8px' }}>
                    {filteredGroups.map((g) => {
                      const itensVisiveis = g.itemsFiltrados ? g.itemsFiltrados : g.items;
                      const itensFiltradosAtivo = Boolean(g.itemsFiltrados);
                      const valorDespachoN = parseMoney(g.VALOR_DINHEIRO);
                      const valorDespachoTxt = valorDespachoN == null ? '-' : fmtBRL.format(valorDespachoN);
                      const valorTotalNfeN = parseMoney(g.VLTOTAL);
                      const valorTotalNfeTxt = valorTotalNfeN == null ? '-' : fmtBRL.format(valorTotalNfeN);
                      const confirmado = g.SITDOC === 'S' || sitdocMarcadas.has(g.NUMNOTA);
                      const showLoteCard =
                        confirmado &&
                        valorDespachoN != null &&
                        valorDespachoN > 0 &&
                        g.ID_LOTE_PEDIDO != null &&
                        String(g.ID_LOTE_PEDIDO).trim() !== '';
                      return (
                      <div
                        key={`nfe-${g.NUMNOTA}`}
                        className={`card ${g.SITDOC === 'S' ? 'border-success bg-success-subtle' : ''}`}
                      >
                        <div
                          className={`card-header py-1 d-flex align-items-center ${g.SITDOC === 'S' ? 'text-bg-success' : ''}`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          <strong className="d-flex align-items-center">
                            <FileEarmarkText className="me-1" size={12} />
                            NF-e: {g.NUMNOTA}
                          </strong>
                          <span className="mx-2">|</span>
                          <span className={`${g.SITDOC === 'S' ? 'text-white' : 'text-muted'}`}>Saída: {typeof g.DTSAIDA === 'string' ? g.DTSAIDA : new Date(g.DTSAIDA).toLocaleDateString('pt-BR')}</span>
                          <span className="mx-2">|</span>
                          <span title={`(${g.CODCLI}) ${g.CLIENTE}`}>Cliente: ({g.CODCLI}) {truncateEnd(g.CLIENTE, 28)}</span>
                          <span className="mx-2">|</span>
                          <span>TV7: {g.TV7}</span>
                          <span className="mx-2">|</span>
                          <span>TV8: {g.TV8}</span>
                          <span className="mx-2">|</span>
                          <span>Lote: {g.ID_LOTE_PEDIDO ?? '-'}</span>
                          <span className="mx-2">|</span>
                          <span>Filial Retira: {g.CODFILIALRETIRA ?? '-'}</span>
                          <span className="mx-2">|</span>
                          <span>Tipo Entrega: {g.TIPOENTREGA ?? '-'}</span>
                          <span className="mx-2">|</span>
                          <div className="card text-bg-danger" style={{ minWidth: '170px' }}>
                            <div className="card-body p-1" style={{ lineHeight: 1.1 }}>
                              <div className="d-flex align-items-center justify-content-between" style={{ gap: '8px' }}>
                                <span className="d-flex align-items-center" style={{ fontSize: '0.62rem', opacity: 0.95 }}>
                                  <FileEarmarkText className="me-1" size={12} />
                                  <CashStack className="me-1" size={12} />
                                  R$ Total NF-e:
                                </span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{valorTotalNfeTxt}</span>
                              </div>
                            </div>
                          </div>
                          <span className={`ms-auto ${g.SITDOC === 'S' ? 'text-white' : 'text-muted'}`}>Vendedor(a): {g.NOME}</span>
                        </div>
                        <div className="card-body py-1" style={{ fontSize: '0.68rem' }}>
                          {itensFiltradosAtivo && (
                            <div className="mb-1">
                              <span className="badge bg-info text-dark">Itens filtrados: {itensVisiveis.length} / {g.items.length}</span>
                            </div>
                          )}
                          <div className="table-responsive">
                            <table className="table table-sm">
                              <thead>
                                <tr>
                                  <th style={{ width: '90px' }}>Cod Prod</th>
                                  <th>Descrição</th>
                                  <th style={{ width: '160px' }}>Código de Barras</th>
                                  <th style={{ width: '90px' }}>Qt</th>
                                </tr>
                              </thead>
                              <tbody>
                                {itensVisiveis.map((it, idx) => (
                                  <tr key={`item-${g.NUMNOTA}-${idx}`}>
                                    <td>{it.CODPROD}</td>
                                    <td>{it.DESCRICAO}</td>
                                    <td>{it.CODAUXILIAR || '-'}</td>
                                    <td>{it.QT}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="card-footer py-1 d-flex align-items-center" style={{ fontSize: '0.68rem' }}>
                          <span>Total itens: {itensVisiveis.length}</span>
                        {confirmado ? (
                          <span className="badge bg-success ms-2">Confirmado</span>
                        ) : (
                          <span className="badge bg-warning text-dark ms-2">Pendente</span>
                        )}
                          <div className="ms-auto d-flex align-items-center gap-2">
                            {confirmado && (
                              <div className="card text-bg-danger" style={{ minWidth: '150px' }}>
                                <div className="card-body p-1" style={{ lineHeight: 1.1 }}>
                                  <div className="d-flex align-items-center justify-content-between" style={{ gap: '8px' }}>
                                    <span className="d-flex align-items-center" style={{ fontSize: '0.62rem', opacity: 0.95 }}>
                                      <CashCoin className="me-1" size={12} />
                                      R$ em Dinheiro:
                                    </span>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{valorDespachoTxt}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {showLoteCard && (
                              <div className="card text-bg-dark" style={{ minWidth: '120px' }}>
                                <div className="card-body p-1" style={{ lineHeight: 1.1 }}>
                                  <div className="d-flex align-items-center justify-content-between" style={{ gap: '8px' }}>
                                    <span className="d-flex align-items-center" style={{ fontSize: '0.62rem', opacity: 0.95 }}>
                                      <BoxSeam className="me-1" size={12} />
                                      Lote:
                                    </span>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{String(g.ID_LOTE_PEDIDO)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {confirmado && (
                              <button
                                className="btn btn-outline-primary btn-sm py-1 px-2"
                                style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                                onClick={() => abrirEdicao(g.NUMNOTA)}
                              >
                                <PencilSquare className="me-1" size={12} />
                                Editar
                              </button>
                            )}
                            <button
                              className="btn btn-success btn-sm py-1 px-2"
                              style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                              onClick={() => abrirConfirmacao(g.NUMNOTA)}
                              disabled={confirmado}
                            >
                              <Check2Circle className="me-1" size={12} />
                              {confirmado ? 'Confirmado' : 'Confirmar Entrega'}
                            </button>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer py-1">
              <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1, minWidth: '84px' }} onClick={onClose}>
                <XCircle className="me-1" size={12} />
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
      {confirmNfe != null && (
        <>
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 1065, backdropFilter: 'blur(5px)' }}></div>
        <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1070 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header py-1">
                <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                  <Check2Circle size={14} />
                  <span>Confirmar Entrega</span>
                </h6>
                <div className="ms-auto d-flex align-items-center gap-2">
                  <span className="badge bg-dark" style={{ fontSize: '0.62rem' }}>Lote (Pedido): {idLotePedidoTxt}</span>
                  <span className="badge bg-secondary" style={{ fontSize: '0.62rem' }}>Lote (Saldo): {idLoteSaldoTxt}</span>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setConfirmNfe(null)}></button>
                </div>
              </div>
              <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                {(() => {
                  const gSel = groups.find((g) => g.NUMNOTA === confirmNfe);
                  if (!gSel) return <span>NF-e {String(confirmNfe)} não encontrada.</span>;
                  const tipoEntregaRaw = String(gSel.TIPOENTREGA ?? '').trim().toUpperCase();
                  const isEfOrEn = tipoEntregaRaw === 'EF' || tipoEntregaRaw === 'EN';
                  const tipoEntregaEf = tipoEntregaEfByNota[gSel.NUMNOTA] ?? '';
                  const tipoEntregaEfOk = !isEfOrEn || (tipoEntregaEf === 'EN' || tipoEntregaEf === 'RP');
                  const valorRecebidoRaw = dinheiroRecebidoByNota[gSel.NUMNOTA] ?? '';
                  const semDinheiro = Boolean(semDinheiroByNota[gSel.NUMNOTA]);
                  const valorRecebido = parseMoney(valorRecebidoRaw);
                  const respostaOk = semDinheiro || (valorRecebido != null && valorRecebido > 0);
                  const valorDespachoN = semDinheiro ? 0 : (valorRecebido ?? parseMoney(gSel.VALOR_DINHEIRO));
                  const valorDespachoTxt = valorDespachoN == null ? '-' : fmtBRL.format(valorDespachoN);
                  return (
                    <div>
                      <div className="row g-2">
                        <div className="col-6 col-lg-4">
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>NF-e</div>
                            <div style={{ fontWeight: 700 }}>{gSel.NUMNOTA}</div>
                          </div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>Pedido (TV8)</div>
                            <div style={{ fontWeight: 700 }}>{gSel.TV8}</div>
                          </div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>TV7</div>
                            <div style={{ fontWeight: 700 }}>{gSel.TV7}</div>
                          </div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>Lote</div>
                            <div style={{ fontWeight: 700 }}>{gSel.ID_LOTE_PEDIDO ?? '-'}</div>
                          </div>
                        </div>
                        <div className="col-12 col-lg-8">
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>Cliente</div>
                            <div style={{ fontWeight: 700 }}>{gSel.CLIENTE} ({gSel.CODCLI})</div>
                          </div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>Saída</div>
                            <div style={{ fontWeight: 700 }}>{typeof gSel.DTSAIDA === 'string' ? gSel.DTSAIDA : new Date(gSel.DTSAIDA).toLocaleDateString('pt-BR')}</div>
                          </div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>Retira</div>
                            <div style={{ fontWeight: 700 }}>{gSel.CODFILIALRETIRA ?? '-'}</div>
                          </div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>RCA</div>
                            <div style={{ fontWeight: 700 }}>{gSel.NOME}</div>
                          </div>
                        </div>
                        <div className="col-6 col-lg-4">
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>Itens</div>
                            <div style={{ fontWeight: 700 }}>{gSel.items.length}</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="row g-2 align-items-end">
                          <div className={isEfOrEn ? 'col-12 col-md-3' : 'col-12 col-md-4'}>
                            <div className="card text-bg-danger">
                              <div className="card-body p-2">
                                <div className="text-white-50 d-flex align-items-center" style={{ fontSize: '0.62rem' }}>
                                  <CashCoin className="me-1" size={12} />
                                  R$ Recebido:
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, lineHeight: 1.1 }}>{valorDespachoTxt}</div>
                              </div>
                            </div>
                          </div>
                          {isEfOrEn && (
                            <div className="col-12 col-md-3">
                              <label className="form-label mb-1" style={{ fontSize: '0.62rem' }}>Tipo EN/RP</label>
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '0.74rem', height: '30px' }}
                                value={tipoEntregaEf}
                                onChange={(e) => {
                                  const raw = e.currentTarget.value;
                                  const v: '' | 'EN' | 'RP' = raw === 'EN' || raw === 'RP' ? raw : '';
                                  setTipoEntregaEfByNota((prev) => ({ ...prev, [gSel.NUMNOTA]: v }));
                                }}
                                disabled={confirmLoading}
                              >
                                <option value="">Selecione...</option>
                                <option value="EN">Entrega</option>
                                <option value="RP">Retirada</option>
                              </select>
                            </div>
                          )}
                          <div className={isEfOrEn ? 'col-12 col-md-4' : 'col-12 col-md-5'}>
                            <label className="form-label mb-1" style={{ fontSize: '0.62rem' }}>Valor recebido em dinheiro</label>
                            <input
                              className="form-control form-control-sm"
                              style={{ fontSize: '0.74rem', height: '30px' }}
                              placeholder="Ex: 10,00"
                              value={valorRecebidoRaw}
                              onChange={(e) => {
                                const nextValue = e.currentTarget.value;
                                setDinheiroRecebidoByNota((prev) => ({ ...prev, [gSel.NUMNOTA]: nextValue }));
                              }}
                              disabled={semDinheiro || confirmLoading}
                              inputMode="decimal"
                            />
                          </div>
                          <div className={isEfOrEn ? 'col-12 col-md-2' : 'col-12 col-md-3'}>
                            <div className="form-check mt-3 mt-md-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`sem-dinheiro-${gSel.NUMNOTA}`}
                                checked={semDinheiro}
                                onChange={(e) => {
                                  const checked = e.currentTarget.checked;
                                  setSemDinheiroByNota((prev) => ({ ...prev, [gSel.NUMNOTA]: checked }));
                                  if (checked) {
                                    setDinheiroRecebidoByNota((prev) => ({ ...prev, [gSel.NUMNOTA]: '' }));
                                  }
                                }}
                                disabled={confirmLoading}
                              />
                              <label className="form-check-label" htmlFor={`sem-dinheiro-${gSel.NUMNOTA}`}>
                                Sem dinheiro
                              </label>
                            </div>
                          </div>
                          {!tipoEntregaEfOk && (
                            <div className="col-12">
                              <div className="alert alert-warning py-1 mb-0" style={{ fontSize: '0.68rem' }}>
                                Selecione o tipo de entrega (Entrega ou Retirada).
                              </div>
                            </div>
                          )}
                          {!respostaOk && (
                            <div className="col-12">
                              <div className="alert alert-warning py-1 mb-0" style={{ fontSize: '0.68rem' }}>
                                Preencha o valor recebido (maior que zero) ou marque “Sem dinheiro”.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <hr />
                      <div className="table-responsive" style={{ maxHeight: '220px' }}>
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th style={{ width: '90px' }}>Cod Prod</th>
                              <th>Descrição</th>
                              <th style={{ width: '160px' }}>Código de Barras</th>
                              <th style={{ width: '90px' }}>Qt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gSel.items.map((it, idx) => (
                              <tr key={`sel-item-${gSel.NUMNOTA}-${idx}`}>
                                <td>{it.CODPROD}</td>
                                <td>{it.DESCRICAO}</td>
                                <td>{it.CODAUXILIAR || '-'}</td>
                                <td>{it.QT}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-2">
                        <div className="alert alert-light border py-1" style={{ fontSize: '0.74rem' }}>
                          Confirma a entrega desta NF-e para atualizar o SITDOC?
                        </div>
                        {confirmErr && (
                          <div className="alert alert-danger py-1" style={{ fontSize: '0.74rem' }}>{confirmErr}</div>
                        )}
                        {confirmMsg && (
                          <div className="alert alert-success py-1" style={{ fontSize: '0.74rem' }}>{confirmMsg}</div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer py-1">
                {hasSaldoAvulso && (
                  <div className="me-auto d-flex align-items-center" style={{ fontSize: '0.68rem', fontWeight: 800 }}>
                    <CashStack className="me-1" size={12} />
                    <span className="text-muted me-1">R$ Saldo Avulso:</span>
                    <span>{saldoAvulsoTxt}</span>
                  </div>
                )}
                <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1 }} onClick={() => setConfirmNfe(null)} disabled={confirmLoading}>
                  <XCircle className="me-1" size={12} />
                  Cancelar
                </button>
                <button
                  className="btn btn-success btn-sm py-1 px-2"
                  style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                  onClick={() => setShowConfirmarEntregaResumo(true)}
                  disabled={
                    confirmLoading ||
                    (() => {
                      const gSel = groups.find((g) => g.NUMNOTA === confirmNfe);
                      if (!gSel) return true;
                      const tipoEntregaRaw = String(gSel.TIPOENTREGA ?? '').trim().toUpperCase();
                      const isEfOrEn = tipoEntregaRaw === 'EF' || tipoEntregaRaw === 'EN';
                      const tipoEntregaEf = tipoEntregaEfByNota[gSel.NUMNOTA] ?? '';
                      if (isEfOrEn && (tipoEntregaEf !== 'EN' && tipoEntregaEf !== 'RP')) return true;
                      const semDinheiro = Boolean(semDinheiroByNota[gSel.NUMNOTA]);
                      const valorRecebido = parseMoney(dinheiroRecebidoByNota[gSel.NUMNOTA] ?? '');
                      return !(semDinheiro || (valorRecebido != null && valorRecebido > 0));
                    })()
                  }
                >
                  <CheckCircleFill className="me-1" size={12} />
                  {confirmLoading ? 'Confirmando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
        {showConfirmarEntregaResumo && (
          <>
            <div
              className="modal-backdrop"
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.35)',
                zIndex: 1075,
                backdropFilter: 'blur(2px)',
              }}
            ></div>
            <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1080 }}>
              <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '620px' }}>
                <div className="modal-content">
                  <div className="modal-header py-1">
                    <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                      <Check2Circle size={14} />
                      <span>Resumo do pedido a confirmar</span>
                    </h6>
                    <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowConfirmarEntregaResumo(false)}></button>
                  </div>
                  <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                    {(() => {
                      const gSel = groups.find((g) => g.NUMNOTA === confirmNfe);
                      if (!gSel) return <span>NF-e {String(confirmNfe)} não encontrada.</span>;
                      const valorRecebidoRaw = dinheiroRecebidoByNota[gSel.NUMNOTA] ?? '';
                      const semDinheiro = Boolean(semDinheiroByNota[gSel.NUMNOTA]);
                      const valorRecebido = parseMoney(valorRecebidoRaw);
                      const valorDespachoN = semDinheiro ? 0 : (valorRecebido ?? parseMoney(gSel.VALOR_DINHEIRO));
                      const valorDespachoTxt = valorDespachoN == null ? '-' : fmtBRL.format(valorDespachoN);

                      return (
                        <>
                          <div className="border rounded px-2 py-1 bg-light">
                            <div className="d-flex flex-wrap align-items-center gap-2" style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                              <span>NF-e: {gSel.NUMNOTA}</span>
                              <span className="text-muted">•</span>
                              <span>TV8: {gSel.TV8}</span>
                              <span className="text-muted">•</span>
                              <span>TV7: {gSel.TV7}</span>
                            </div>
                            <div className="mt-1" style={{ fontSize: '0.7rem' }}>
                              <span className="text-muted">Cliente:</span> <span style={{ fontWeight: 700 }}>{gSel.CLIENTE}</span> <span className="text-muted">({gSel.CODCLI})</span>
                            </div>
                          </div>

                          <div className="mt-2 d-flex align-items-center justify-content-between border rounded px-2 py-1 bg-danger text-white">
                            <span className="d-flex align-items-center" style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                              <CashCoin className="me-1" size={12} />
                              R$ Recebido
                            </span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 900 }}>{valorDespachoTxt}</span>
                          </div>

                          {hasSaldoAvulso && (
                            <div className="mt-2">
                              <div className="d-flex align-items-center justify-content-between border rounded px-2 py-1 bg-light">
                                <span className="d-flex align-items-center" style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                                  <CashStack className="me-1" size={12} />
                                  R$ Saldo Avulso
                                </span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 900 }}>{saldoAvulsoTxt}</span>
                              </div>
                              <div className="mt-2">
                                <label className="form-label mb-1" style={{ fontSize: '0.62rem' }}>Valor avulso</label>
                                <input
                                  className="form-control form-control-sm"
                                  style={{ fontSize: '0.74rem', height: '30px' }}
                                  placeholder="Ex: 10,00"
                                  value={confirmarEntregaValorAvulso}
                                  onChange={(e) => setConfirmarEntregaValorAvulso(e.currentTarget.value)}
                                  inputMode="decimal"
                                  disabled={confirmLoading}
                                />
                              </div>
                            </div>
                          )}

                          <div className="alert alert-light border py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                            Confirma a entrega desta NF-e para atualizar o SITDOC?
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="modal-footer py-1">
                    <button
                      className="btn btn-secondary btn-sm py-1 px-2"
                      style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                      onClick={() => setShowConfirmarEntregaResumo(false)}
                      disabled={confirmLoading}
                    >
                      <XCircle className="me-1" size={12} />
                      Cancelar
                    </button>
                    <button
                      className="btn btn-success btn-sm py-1 px-2"
                      style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                      onClick={() => {
                        setShowConfirmarEntregaResumo(false);
                        handleConfirmarEntrega();
                      }}
                      disabled={confirmLoading}
                    >
                      <CheckCircleFill className="me-1" size={12} />
                      Confirmar
                    </button>
                    {hasSaldoAvulso && (
                      <button
                        className="btn btn-outline-primary btn-sm py-1 px-2"
                        style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                        onClick={() => {
                          setShowConfirmarEntregaResumo(false);
                          handleConfirmarEntrega();
                        }}
                        disabled={confirmLoading || !String(confirmarEntregaValorAvulso || '').trim()}
                      >
                        <CashStack className="me-1" size={12} />
                        Confirmar com saldo avulso
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        </>
      )}
      {editNfe != null && (
        <>
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              zIndex: 1075,
              backdropFilter: 'blur(2px)',
            }}
          ></div>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1080 }}>
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '920px' }}>
              <div className="modal-content">
                <div className="modal-header py-1">
                  <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                    <PencilSquare size={14} />
                    <span>Editar • Resumo da NF-e</span>
                  </h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setEditNfe(null)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                  {(() => {
                    const gSel = groups.find((g) => g.NUMNOTA === editNfe);
                    if (!gSel) return <span>NF-e {String(editNfe)} não encontrada.</span>;
                    const valorEditN = parseMoney(editValorDinheiro);
                    const valorEditTxt = valorEditN == null ? '-' : fmtBRL.format(valorEditN);
                    return (
                      <>
                        <div className="border rounded px-2 py-1 bg-light">
                          <div className="d-flex flex-wrap align-items-center gap-2" style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                            <span>NF-e: {gSel.NUMNOTA}</span>
                            <span className="text-muted">•</span>
                            <span>TV8: {gSel.TV8}</span>
                            <span className="text-muted">•</span>
                            <span>TV7: {gSel.TV7}</span>
                            <span className="text-muted">•</span>
                            <span>Lote: {gSel.ID_LOTE_PEDIDO ?? '-'}</span>
                          </div>
                          <div className="mt-1" style={{ fontSize: '0.7rem' }}>
                            <span className="text-muted">Cliente:</span>{' '}
                            <span style={{ fontWeight: 700 }}>{gSel.CLIENTE}</span>{' '}
                            <span className="text-muted">({gSel.CODCLI})</span>
                          </div>
                          <div className="mt-1 d-flex flex-wrap gap-2" style={{ fontSize: '0.7rem' }}>
                            <span>
                              <span className="text-muted">Saída:</span>{' '}
                              <span style={{ fontWeight: 700 }}>
                                {typeof gSel.DTSAIDA === 'string' ? gSel.DTSAIDA : new Date(gSel.DTSAIDA).toLocaleDateString('pt-BR')}
                              </span>
                            </span>
                            <span className="text-muted">•</span>
                            <span>
                              <span className="text-muted">Filial Retira:</span>{' '}
                              <span style={{ fontWeight: 700 }}>{gSel.CODFILIALRETIRA ?? '-'}</span>
                            </span>
                            <span className="text-muted">•</span>
                            <span>
                              <span className="text-muted">Tipo Entrega:</span>{' '}
                              <span style={{ fontWeight: 700 }}>{gSel.TIPOENTREGA ?? '-'}</span>
                            </span>
                            <span className="text-muted">•</span>
                            <span>
                              <span className="text-muted">Vendedor(a):</span>{' '}
                              <span style={{ fontWeight: 700 }}>{gSel.NOME}</span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className="row g-2 align-items-end">
                            <div className="col-12 col-md-4">
                              <label className="form-label mb-1" style={{ fontSize: '0.62rem' }}>Tipo EN/RP</label>
                              <select
                                className="form-select form-select-sm"
                                style={{ fontSize: '0.74rem', height: '30px' }}
                                value={editTipoEntrega}
                                onChange={(e) => {
                                  const raw = e.currentTarget.value;
                                  const v: '' | 'EN' | 'RP' = raw === 'EN' || raw === 'RP' ? raw : '';
                                  setEditTipoEntrega(v);
                                }}
                                disabled={editLoading}
                              >
                                <option value="">Selecione...</option>
                                <option value="EN">Entrega</option>
                                <option value="RP">Retirada</option>
                              </select>
                            </div>
                            <div className="col-12 col-md-4">
                              <label className="form-label mb-1" style={{ fontSize: '0.62rem' }}>Valor em dinheiro</label>
                              <input
                                className="form-control form-control-sm"
                                style={{ fontSize: '0.74rem', height: '30px' }}
                                placeholder="Ex: 10,00"
                                value={editValorDinheiro}
                                onChange={(e) => setEditValorDinheiro(e.currentTarget.value)}
                                disabled={editLoading}
                                inputMode="decimal"
                              />
                            </div>
                            <div className="col-12 col-md-4">
                              <div className="card text-bg-danger">
                                <div className="card-body p-2">
                                  <div className="text-white-50 d-flex align-items-center" style={{ fontSize: '0.62rem' }}>
                                    <CashCoin className="me-1" size={12} />
                                    R$ Dinheiro:
                                  </div>
                                  <div style={{ fontSize: '0.9rem', fontWeight: 800, lineHeight: 1.1 }}>{valorEditTxt}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {editErr && (
                            <div className="alert alert-danger py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>{editErr}</div>
                          )}
                          {editMsg && (
                            <div className="alert alert-success py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>{editMsg}</div>
                          )}
                        </div>

                        <div className="table-responsive mt-2" style={{ maxHeight: '360px' }}>
                          <table className="table table-sm table-striped mb-0">
                            <thead>
                              <tr>
                                <th style={{ width: '90px' }}>Cod Prod</th>
                                <th>Descrição</th>
                                <th style={{ width: '160px' }}>Código de Barras</th>
                                <th style={{ width: '90px' }}>Qt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {gSel.items.map((it, idx) => (
                                <tr key={`edit-resumo-item-${gSel.NUMNOTA}-${idx}`}>
                                  <td>{it.CODPROD}</td>
                                  <td>{it.DESCRICAO}</td>
                                  <td>{it.CODAUXILIAR || '-'}</td>
                                  <td>{it.QT}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="modal-footer py-1">
                  <button className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: '0.62rem', lineHeight: 1.1 }} onClick={() => setEditNfe(null)} disabled={editLoading}>
                    <XCircle className="me-1" size={12} />
                    Fechar
                  </button>
                  <button
                    className="btn btn-primary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                    onClick={handleEditarEntrega}
                    disabled={editLoading || (editTipoEntrega !== 'EN' && editTipoEntrega !== 'RP') || (parseMoney(editValorDinheiro) == null || (parseMoney(editValorDinheiro) ?? 0) < 0)}
                  >
                    <PencilSquare className="me-1" size={12} />
                    {editLoading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showPrintResumo && (
        <>
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              zIndex: 1075,
              backdropFilter: 'blur(2px)',
            }}
          ></div>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1080 }}>
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '920px' }}>
              <div className="modal-content">
                <div className="modal-header py-1">
                  <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                    <Printer size={14} />
                    <span>Resumo da Impressão</span>
                  </h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowPrintResumo(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="badge bg-primary">NF-e: {filteredGroups.length}</span>
                    <span className="badge bg-secondary">Itens: {totalItensVisiveis}</span>
                    <span className="badge bg-success">Confirmados: {confirmadosCount}</span>
                    <span className="badge bg-warning text-dark">Pendentes: {pendentesCount}</span>
                  </div>

                  <div className="mt-2 d-flex align-items-center gap-2 flex-wrap">
                    <span className="badge bg-light text-dark border">Período: {dataInicio || '-'} até {dataFim || '-'}</span>
                    <span className="badge bg-light text-dark border">Tipo: {tipoEntregaFiltro === 'RP' ? 'Retira Posterior' : 'Entrega/Entrega Futura'}</span>
                    <span className="badge bg-light text-dark border">Pesquisa: {q.trim() ? q.trim() : '-'}</span>
                  </div>

                  <div className="table-responsive mt-2" style={{ maxHeight: '360px' }}>
                    <table className="table table-sm table-striped mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: '90px' }}>NF-e</th>
                          <th style={{ width: '90px' }}>TV8</th>
                          <th>Cliente</th>
                          <th style={{ width: '90px' }}>Itens</th>
                          <th style={{ width: '120px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {confirmadosCount === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-muted">Sem pedidos confirmados para imprimir.</td>
                          </tr>
                        ) : (
                          (() => {
                            const confirmados = filteredGroups.filter((g) => g.SITDOC === 'S' || sitdocMarcadas.has(g.NUMNOTA));
                            return (
                              <>
                                {confirmados.map((g) => {
                                  const itensVisiveis = g.itemsFiltrados ? g.itemsFiltrados : g.items;
                                  return (
                                    <tr key={`print-resumo-conf-${g.NUMNOTA}`}>
                                      <td>{g.NUMNOTA}</td>
                                      <td>{g.TV8}</td>
                                      <td title={`(${g.CODCLI}) ${g.CLIENTE}`}>({g.CODCLI}) {truncateEnd(g.CLIENTE, 56)}</td>
                                      <td>{itensVisiveis.length}</td>
                                      <td><span className="badge bg-success">Confirmado</span></td>
                                    </tr>
                                  );
                                })}
                              </>
                            );
                          })()
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-muted mt-2" style={{ fontSize: '0.68rem' }}>
                    A impressão considera apenas os pedidos confirmados (SITDOC “S”) e/ou já marcados nesta tela.
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button
                    className="btn btn-secondary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                    onClick={() => setShowPrintResumo(false)}
                  >
                    <XCircle className="me-1" size={12} />
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                    onClick={() => {
                      setShowPrintResumo(false);
                      imprimirPedidos();
                    }}
                    disabled={confirmadosCount === 0}
                  >
                    <Printer className="me-1" size={12} />
                    Imprimir agora
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showAvulsoModal && (
        <>
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              zIndex: 1075,
              backdropFilter: 'blur(2px)',
            }}
          ></div>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1080 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '980px' }}>
              <div className="modal-content">
                <div className="modal-header py-1">
                  <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                    <FileEarmarkText size={14} />
                    <span>Avulso</span>
                  </h6>
                  <div className="ms-auto d-flex align-items-center gap-2">
                    {avulsoListLoading && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm py-1 px-2"
                      style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                      onClick={() => {
                        setAvulsoMsg(null);
                        setShowAvulsoNovoLancamentoModal(true);
                      }}
                      disabled={avulsoListLoading}
                    >
                      Novo Lançamento
                    </button>
                    <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowAvulsoModal(false)}></button>
                  </div>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                  <div className="d-flex align-items-center justify-content-between border rounded px-2 py-1 bg-light">
                    <span className="d-flex align-items-center" style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                      <CashStack className="me-1" size={12} />
                      Saldo Avulso
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{saldoAvulsoTxt}</span>
                  </div>

                  {avulsoListErr && (
                    <div className="alert alert-danger py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                      {avulsoListErr}
                    </div>
                  )}
                  {avulsoMsg && (
                    <div className="alert alert-success py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                      {avulsoMsg}
                    </div>
                  )}

                  <div className="table-responsive mt-2" style={{ maxHeight: '360px' }}>
                    <table className="table table-sm table-striped mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: '90px' }}>Lote</th>
                          <th style={{ width: '70px' }}>Filial</th>
                          <th style={{ width: '90px' }}>TV7</th>
                          <th style={{ width: '90px' }}>TV8</th>
                          <th style={{ width: '90px' }}>Cod Cli</th>
                          <th style={{ width: '140px' }}>R$ Avulso</th>
                          <th style={{ width: '160px' }}>Data/Hora</th>
                          <th style={{ width: '80px' }}>RCA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {avulsoRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-muted">Nenhum lançamento avulso para este lote.</td>
                          </tr>
                        ) : (
                          avulsoRows.map((r, idx) => (
                            <tr key={`avulso-${r.ID_LOTE}-${idx}`}>
                              <td>{r.ID_LOTE}</td>
                              <td>{r.CODFILIAL}</td>
                              <td>{r.NUMPED_TV7 ?? '-'}</td>
                              <td>{r.NUMPED_TV8 ?? '-'}</td>
                              <td>{r.CODCLI ?? '-'}</td>
                              <td>{fmtBRL.format(parseMoney(r.VL_DINHEIRO_AVULSO) ?? 0)}</td>
                              <td>{fmtDataHora(r.DATA_HORA)}</td>
                              <td>{r.CODUSUR ?? '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer py-1">
                  <button
                    className="btn btn-secondary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                    onClick={() => setShowAvulsoModal(false)}
                    disabled={avulsoListLoading}
                  >
                    <XCircle className="me-1" size={12} />
                    Voltar
                  </button>
                </div>
              </div>
            </div>
          </div>
          {showAvulsoNovoLancamentoModal && (
            <AvulsoNovoLancamentoModal
              show={showAvulsoNovoLancamentoModal}
              onClose={() => setShowAvulsoNovoLancamentoModal(false)}
              idLote={idLoteSaldo}
              codfilial={3}
              onSuccess={() => {
                setAvulsoMsg('Saldo avulso atualizado.');
                fetchNotas();
                consultarLancamentosAvulso();
              }}
            />
          )}
        </>
      )}
      {showSangriaModal && (
        <>
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 1065, backdropFilter: 'blur(5px)' }}></div>
          <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1070 }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header py-1">
                  <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                    <CashStack size={14} />
                    <span>Sangria</span>
                  </h6>
                  <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowSangriaModal(false)}></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                  <div className="d-flex align-items-center gap-2">
                    <div className="border rounded px-2 py-1 bg-light">
                      <div className="text-muted" style={{ fontSize: '0.6rem' }}>Lote</div>
                      <div className="d-flex align-items-center" style={{ fontWeight: 800 }}>
                        <BoxSeam className="me-1" size={12} />
                        {idLoteSaldoTxt}
                      </div>
                    </div>
                    <div className="border rounded px-2 py-1 bg-danger text-white">
                      <div className="text-white-50" style={{ fontSize: '0.6rem' }}>Saldo conciliado</div>
                      <div className="d-flex align-items-center" style={{ fontWeight: 800 }}>
                        <CashStack className="me-1" size={12} />
                        {saldoDinheiroTxt}
                      </div>
                    </div>
                    <div className="border rounded px-2 py-1 bg-secondary text-white">
                      <div className="text-white-50" style={{ fontSize: '0.6rem' }}>Saldo avulso</div>
                      <div className="d-flex align-items-center" style={{ fontWeight: 800 }}>
                        <CashStack className="me-1" size={12} />
                        {saldoAvulsoTxt}
                      </div>
                    </div>
                    <div className="border rounded px-2 py-1 bg-info text-white">
                      <div className="text-white-50" style={{ fontSize: '0.6rem' }}>Fundo de caixa</div>
                      <div className="d-flex align-items-center" style={{ fontWeight: 800 }}>
                        <CashStack className="me-1" size={12} />
                        {saldoFundoCaixaTxt}
                      </div>
                    </div>
                    <div className="ms-auto d-flex align-items-center gap-2">
                      {(sangriaLoading || sangriaExecLoading || avulsoListLoading) && (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      )}
                      <span className="badge bg-secondary">
                        Registros: {sangriaTab === 'avulso' ? avulsoRows.length : sangriaRows.length}
                      </span>
                      <span className="badge bg-dark">
                        Total lote:{' '}
                        {fmtBRL.format((saldoDinheiro ?? 0) + (saldoAvulso ?? 0))}
                      </span>
                    </div>
                  </div>

                  <div className="nav nav-tabs mt-2" role="tablist">
                    <button
                      className={`nav-link ${sangriaTab === 'conciliado' ? 'active' : ''}`}
                      type="button"
                      role="tab"
                      aria-selected={sangriaTab === 'conciliado'}
                      onClick={() => setSangriaTab('conciliado')}
                      style={{ fontSize: '0.74rem' }}
                    >
                      Saldo conciliado
                    </button>
                    <button
                      className={`nav-link ${sangriaTab === 'avulso' ? 'active' : ''}`}
                      type="button"
                      role="tab"
                      aria-selected={sangriaTab === 'avulso'}
                      onClick={() => setSangriaTab('avulso')}
                      style={{ fontSize: '0.74rem' }}
                    >
                      Avulsos
                    </button>
                  </div>

                  {sangriaErr && (
                    <div className="alert alert-danger py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                      {sangriaErr}
                    </div>
                  )}
                  {sangriaTab === 'avulso' && avulsoListErr && (
                    <div className="alert alert-danger py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                      {avulsoListErr}
                    </div>
                  )}
                  {sangriaMsg && (
                    <div className="alert alert-success py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                      {sangriaMsg}
                    </div>
                  )}

                  {sangriaTab === 'conciliado' ? (
                    <div className="table-responsive mt-2" style={{ maxHeight: '320px' }}>
                      <table className="table table-sm table-striped mb-0">
                        <thead>
                          <tr>
                            <th style={{ width: '90px' }}>NF-e</th>
                            <th style={{ width: '90px' }}>TV7</th>
                            <th style={{ width: '90px' }}>Cod Cli</th>
                            <th>Cliente</th>
                            <th style={{ width: '130px' }}>R$ Dinheiro</th>
                            <th style={{ width: '150px' }}>Data/Hora</th>
                            <th style={{ width: '90px' }}>RCA</th>
                            <th style={{ width: '160px' }}>Nome</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sangriaRows.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="text-muted">
                                Nenhum registro encontrado para este lote.
                              </td>
                            </tr>
                          ) : (
                            sangriaRows.map((r, idx) => (
                              <tr key={`sangria-${r.ID_LOTE}-${r.NUMNOTA}-${idx}`}>
                                <td>{r.NUMNOTA}</td>
                                <td>{r.NUMPED_TV7}</td>
                                <td>{r.CODCLI}</td>
                                <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                                  {r.CLIENTE}
                                </td>
                                <td>{fmtBRL.format(parseMoney(r.VL_DINHEIRO) ?? 0)}</td>
                                <td>{fmtDataHora(r.DATA_HORA)}</td>
                                <td>{r.CODUSUR}</td>
                                <td>{r.NOME}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="table-responsive mt-2" style={{ maxHeight: '320px' }}>
                      <table className="table table-sm table-striped mb-0">
                        <thead>
                          <tr>
                            <th style={{ width: '90px' }}>TV7</th>
                            <th style={{ width: '90px' }}>TV8</th>
                            <th style={{ width: '90px' }}>Cod Cli</th>
                            <th style={{ width: '130px' }}>R$ Avulso</th>
                            <th style={{ width: '150px' }}>Data/Hora</th>
                            <th style={{ width: '90px' }}>RCA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {avulsoRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-muted">
                                Nenhum lançamento avulso encontrado para este lote.
                              </td>
                            </tr>
                          ) : (
                            avulsoRows.map((r, idx) => (
                              <tr key={`avulso-${r.ID_LOTE}-${r.NUMPED_TV8 ?? 'x'}-${idx}`}>
                                <td>{r.NUMPED_TV7 ?? '-'}</td>
                                <td>{r.NUMPED_TV8 ?? '-'}</td>
                                <td>{r.CODCLI ?? '-'}</td>
                                <td>{fmtBRL.format(parseMoney(r.VL_DINHEIRO_AVULSO) ?? 0)}</td>
                                <td>{fmtDataHora(r.DATA_HORA)}</td>
                                <td>{r.CODUSUR ?? '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="modal-footer py-1">
                  <button
                    className="btn btn-outline-secondary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                    onClick={() => {
                      consultarLoteSangria();
                      consultarLancamentosAvulso();
                    }}
                    disabled={sangriaLoading || sangriaExecLoading || avulsoListLoading}
                  >
                    <ArrowClockwise className="me-1" size={12} />
                    {sangriaLoading || avulsoListLoading ? 'Atualizando...' : 'Atualizar'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                    onClick={() => {
                      setSangriaPodeImprimir(false);
                      setSangriaPrintSnapshot(null);
                      setSangriaErr(null);
                      setNovoFundoCaixa(formatMoneyInput(saldoFundoCaixa));
                      setShowConfirmSangria(true);
                    }}
                    disabled={sangriaLoading || sangriaExecLoading || !idLoteSaldo}
                  >
                    <CashCoin className="me-1" size={12} />
                    {sangriaExecLoading ? 'Executando...' : 'Executar Sangria'}
                  </button>
                  {sangriaPodeImprimir && sangriaPrintSnapshot && (
                    <button
                      className="btn btn-primary btn-sm py-1 px-2"
                      style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                      onClick={() => setShowSangriaDocumento(true)}
                      disabled={sangriaLoading || sangriaExecLoading}
                    >
                      <Printer className="me-1" size={12} />
                      Imprimir sangria
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm py-1 px-2"
                    style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                    onClick={() => setShowSangriaModal(false)}
                  >
                    <XCircle className="me-1" size={12} />
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
          {showConfirmSangria && (
            <>
              <div
                className="modal-backdrop"
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  zIndex: 1075,
                  backdropFilter: 'blur(2px)',
                }}
              ></div>
              <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1080 }}>
                <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }}>
                  <div className="modal-content">
                    <div className="modal-header py-1">
                      <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                        <CashCoin size={14} />
                        <span>Confirmar Sangria</span>
                      </h6>
                      <button type="button" className="btn-close" aria-label="Fechar" title="Fechar" onClick={() => setShowConfirmSangria(false)}></button>
                    </div>
                    <div className="modal-body" style={{ fontSize: '0.74rem' }}>
                      <div className="alert alert-warning py-1 mb-2" style={{ fontSize: '0.74rem' }}>
                        Confirma executar a sangria do lote <strong>{idLoteSaldoTxt}</strong>?
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="badge bg-danger">Saldo conciliado: {saldoDinheiroTxt}</span>
                        <span className="badge bg-secondary">Saldo avulso: {saldoAvulsoTxt}</span>
                        <span className="badge bg-info text-dark">Fundo de caixa: {saldoFundoCaixaTxt}</span>
                        <span className="badge bg-dark">Registros: {sangriaRows.length}</span>
                        <span className="badge bg-secondary">
                          Total lote:{' '}
                          {fmtBRL.format((saldoDinheiro ?? 0) + (saldoAvulso ?? 0))}
                        </span>
                      </div>
                      {sangriaErr && (
                        <div className="alert alert-danger py-1 mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                          {sangriaErr}
                        </div>
                      )}
                      <div className="mt-2">
                        <label className="form-label mb-1" style={{ fontSize: '0.62rem' }}>
                          Fundo de caixa do próximo lote
                        </label>
                        <input
                          className="form-control form-control-sm"
                          style={{ fontSize: '0.74rem', height: '30px', maxWidth: '220px' }}
                          placeholder="Ex: 50,00"
                          value={novoFundoCaixa}
                          onChange={(e) => {
                            setNovoFundoCaixa(e.currentTarget.value);
                            setSangriaErr(null);
                          }}
                          inputMode="decimal"
                          disabled={sangriaExecLoading}
                        />
                        <div className="text-muted mt-1" style={{ fontSize: '0.68rem' }}>
                          Esse valor será gravado no próximo lote como fundo de caixa.
                        </div>
                      </div>
                      <div className="text-muted mt-2" style={{ fontSize: '0.68rem' }}>
                        Após confirmar e executar, o botão “Imprimir sangria” ficará disponível para impressão e assinatura.
                      </div>
                    </div>
                    <div className="modal-footer py-1">
                      <button
                        className="btn btn-secondary btn-sm py-1 px-2"
                        style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                        onClick={() => setShowConfirmSangria(false)}
                        disabled={sangriaExecLoading}
                      >
                        <XCircle className="me-1" size={12} />
                        Cancelar
                      </button>
                      <button
                        className="btn btn-danger btn-sm py-1 px-2"
                        style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                        onClick={confirmarEExecutarSangria}
                        disabled={sangriaExecLoading || sangriaLoading || !idLoteSaldo}
                      >
                        <CashCoin className="me-1" size={12} />
                        {sangriaExecLoading ? 'Executando...' : 'Confirmar e Executar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {showSangriaDocumento && sangriaPrintSnapshot && (
            <>
              <div
                className="modal-backdrop"
                style={{
                  position: 'fixed',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  zIndex: 1085,
                  backdropFilter: 'blur(2px)',
                }}
              ></div>
              <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1090 }}>
                <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '1100px' }}>
                  <div className="modal-content">
                    <div className="modal-header py-1">
                      <h6 className="modal-title d-flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                        <Printer size={14} />
                        <span>Documento da Sangria • Lote {sangriaPrintSnapshot.idLote}</span>
                      </h6>
                      <button
                        type="button"
                        className="btn-close"
                        aria-label="Fechar"
                        title="Fechar"
                        onClick={() => setShowSangriaDocumento(false)}
                      ></button>
                    </div>
                    <div className="modal-body p-0" style={{ background: '#f3f4f6' }}>
                      <iframe
                        ref={sangriaDocIframeRef}
                        title="Documento da sangria"
                        style={{ width: '100%', height: '70vh', border: 0, background: '#fff' }}
                        srcDoc={sangriaDocumentoHtml}
                      />
                    </div>
                    <div className="modal-footer py-1">
                      <button
                        className="btn btn-secondary btn-sm py-1 px-2"
                        style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                        onClick={() => setShowSangriaDocumento(false)}
                      >
                        <XCircle className="me-1" size={12} />
                        Fechar
                      </button>
                      <button
                        className="btn btn-primary btn-sm py-1 px-2"
                        style={{ fontSize: '0.62rem', lineHeight: 1.1 }}
                        onClick={imprimirSangria}
                      >
                        <Printer className="me-1" size={12} />
                        Imprimir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default NotasRecentesModal;
