import React from 'react';
import { ArrowClockwise, Calendar3, Gear } from 'react-bootstrap-icons';
import NovaRotaModal, { type NovaRotaModalMsg } from '../roterizacao/modals/NovaRotaModal';
import { RotasCardModal } from '../roterizacao/modals/RotasPedidosModal';
import SelecionarMotoristaModal from '../roterizacao/modals/SelecionarMotoristaModal';
import SelecionarVeiculoModal from '../roterizacao/modals/SelecionarVeiculoModal';

type TelaGeralRotasProps = {
  show: boolean;
  onClose: () => void;
};

type RotaRow = {
  ID_ROTA: number;
  DESCRICAO_ROTA: string;
  BAIRRO_ROTA_1: string;
  BAIRRO_ROTA_2: string;
  BAIRRO_ROTA_3: string;
  BAIRRO_ROTA_4: string;
  BAIRRO_ROTA_5: string;
  COD_MOTORISTA: number | null;
  COD_VEICULO: number | null;
  MOTORISTA_NOME: string;
  VEICULO_DESCRICAO: string;
  VEICULO_PLACA: string;
  VEICULO_CAPACIDADE_CIMENTO: number | null;
  DATA_ROTA: string;
  TURNO_SEPARACAO: string;
};

type PedidoResumo = {
  numped: number;
  cliente: string;
  codcli: number | null;
  posicao: string;
  statusDescricao: string;
  statusLog: string;
  separadorPedido: string;
  dataAdd: string;
  itens: number;
  prioridade: boolean;
  separado: boolean;
  coleta: boolean;
  localizacao: boolean;
  fatura: boolean;
  corte: boolean;
  envMessejana: boolean;
  rotaStatus: boolean;
  produtos: Array<{ descricao: string; qt: number }>;
};

const formatDateBR = (d: string | Date) => {
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return String(d);
  }
};

const getTurnoLabel = (t: string) => {
  const code = (t || '').trim() || '-';
  if (code === 'M') return 'Manhã';
  if (code === 'T') return 'Tarde';
  if (code === '-') return 'Sem turno';
  return code;
};

const TelaGeralRotas: React.FC<TelaGeralRotasProps> = ({ show, onClose }) => {
  const [dataBusca, setDataBusca] = React.useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rotas, setRotas] = React.useState<RotaRow[]>([]);
  const [pedidosByRota, setPedidosByRota] = React.useState<Record<number, PedidoResumo[]>>({});
  const [activeTurno, setActiveTurno] = React.useState<string>('M');
  const [novaRotaOpen, setNovaRotaOpen] = React.useState(false);
  const [rotasCardOpen, setRotasCardOpen] = React.useState(false);
  const [novaRotaSubmitting, setNovaRotaSubmitting] = React.useState(false);
  const [novaRotaMsg, setNovaRotaMsg] = React.useState<NovaRotaModalMsg>(null);
  const [novaRotaDescricao, setNovaRotaDescricao] = React.useState('');
  const [novaRotaBairro1, setNovaRotaBairro1] = React.useState('');
  const [novaRotaBairro2, setNovaRotaBairro2] = React.useState('');
  const [novaRotaBairro3, setNovaRotaBairro3] = React.useState('');
  const [novaRotaBairro4, setNovaRotaBairro4] = React.useState('');
  const [novaRotaBairro5, setNovaRotaBairro5] = React.useState('');
  const [novaRotaCodMotorista, setNovaRotaCodMotorista] = React.useState<string>('');
  const [novaRotaMotoristaLabel, setNovaRotaMotoristaLabel] = React.useState<string>('');
  const [novaRotaMotoristaModalOpen, setNovaRotaMotoristaModalOpen] = React.useState(false);
  const [novaRotaCodVeiculo, setNovaRotaCodVeiculo] = React.useState<string>('');
  const [novaRotaVeiculoLabel, setNovaRotaVeiculoLabel] = React.useState<string>('');
  const [novaRotaVeiculoModalOpen, setNovaRotaVeiculoModalOpen] = React.useState(false);
  const [novaRotaDataRota, setNovaRotaDataRota] = React.useState<string>('');
  const [novaRotaTurnoSeparacao, setNovaRotaTurnoSeparacao] = React.useState<string>('');
  const [novaRotaCodUsurCriacao, setNovaRotaCodUsurCriacao] = React.useState<string>('');

  const getStr = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

  const getTurnoFromRow = (row: Partial<RotaRow>) => {
    const out = getStr((row as Record<string, unknown>)?.TURNO_SEPARACAO).trim();
    return out || '-';
  };

  const getBairros = (row: Partial<RotaRow>) => {
    const parts = [
      getStr((row as Record<string, unknown>)?.BAIRRO_ROTA_1),
      getStr((row as Record<string, unknown>)?.BAIRRO_ROTA_2),
      getStr((row as Record<string, unknown>)?.BAIRRO_ROTA_3),
      getStr((row as Record<string, unknown>)?.BAIRRO_ROTA_4),
      getStr((row as Record<string, unknown>)?.BAIRRO_ROTA_5),
    ].map(s => s.trim()).filter(Boolean);
    return parts.length ? parts.join(' • ') : '-';
  };

  const getBadges = (p: PedidoResumo) => {
    const list: Array<{ label: string; className: string }> = [];
    if (p.rotaStatus) list.push({ label: 'Rota', className: 'badge text-bg-secondary' });
    if (p.corte) list.push({ label: 'Corte', className: 'badge text-bg-primary' });
    if (p.separado) list.push({ label: 'Separado', className: 'badge text-bg-primary' });
    if (p.coleta) list.push({ label: 'Coleta', className: 'badge text-bg-primary' });
    if (p.localizacao) list.push({ label: 'Localização', className: 'badge text-bg-primary' });
    if (p.fatura) list.push({ label: 'Fatura', className: 'badge text-bg-primary' });
    if (p.envMessejana) list.push({ label: 'Env. Messejana', className: 'badge text-bg-primary' });
    if (p.prioridade) list.push({ label: 'Prioridade', className: 'badge text-bg-primary' });
    return list;
  };

  const getRotaBadges = (pedidos: PedidoResumo[]) => {
    const agg: PedidoResumo = {
      numped: 0,
      cliente: '',
      codcli: null,
      posicao: '',
      statusDescricao: '',
      statusLog: '',
      separadorPedido: '',
      dataAdd: '',
      itens: 0,
      prioridade: false,
      separado: false,
      coleta: false,
      localizacao: false,
      fatura: false,
      corte: false,
      envMessejana: false,
      rotaStatus: false,
      produtos: [],
    };
    for (const p of pedidos) {
      if (p.prioridade) agg.prioridade = true;
      if (p.separado) agg.separado = true;
      if (p.coleta) agg.coleta = true;
      if (p.localizacao) agg.localizacao = true;
      if (p.fatura) agg.fatura = true;
      if (p.corte) agg.corte = true;
      if (p.envMessejana) agg.envMessejana = true;
      if (p.rotaStatus) agg.rotaStatus = true;
    }
    return getBadges(agg);
  };

  const fetchRotas = React.useCallback(async (data: string) => {
    setError(null);
    if (!data) {
      setRotas([]);
      setPedidosByRota({});
      return;
    }
    setLoading(true);
    const getStr = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
    const getNum = (v: unknown) => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const isYes = (v: unknown) => String(v ?? '').trim().toUpperCase() === 'S';
    const getTurnoFromRow = (row: Partial<RotaRow>) => {
      const out = getStr((row as Record<string, unknown>)?.TURNO_SEPARACAO).trim();
      return out || '-';
    };
    try {
      const qs = new URLSearchParams({ dataRota: data });
      const res = await fetch(`/api/gestlog/rotas?${qs.toString()}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const t = typeof body?.message === 'string' ? body.message : 'Falha ao listar rotas';
        throw new Error(t);
      }
      const fullRows = Array.isArray(body?.rows) ? (body.rows as Array<Record<string, unknown>>) : [];

      const rotasMap = new Map<number, RotaRow>();
      const pedidosGrouped: Record<number, Record<number, PedidoResumo>> = {};

      for (const row of fullRows) {
        const idRota = getNum(row?.id_rota);
        if (idRota == null) continue;

        if (!rotasMap.has(idRota)) {
          rotasMap.set(idRota, {
            ID_ROTA: idRota,
            DESCRICAO_ROTA: getStr(row?.descricao_rota),
            BAIRRO_ROTA_1: getStr(row?.bairro1),
            BAIRRO_ROTA_2: getStr(row?.bairro2),
            BAIRRO_ROTA_3: getStr(row?.bairro3),
            BAIRRO_ROTA_4: getStr(row?.bairro4),
            BAIRRO_ROTA_5: getStr(row?.bairro5),
            COD_MOTORISTA: getNum(row?.cod_motorista),
            COD_VEICULO: getNum(row?.cod_veiculo),
            MOTORISTA_NOME: getStr(row?.motorista_nome),
            VEICULO_DESCRICAO: getStr(row?.veiculo_descricao),
            VEICULO_PLACA: getStr(row?.veiculo_placa),
            VEICULO_CAPACIDADE_CIMENTO: getNum(row?.veiculo_capacidade_cimento),
            DATA_ROTA: getStr(row?.data_rota),
            TURNO_SEPARACAO: getStr(row?.turno_separacao),
          });
        }

        const numped = getNum(row?.numped);
        if (numped == null || numped === 0) continue;

        const cliente = getStr(row?.cliente);
        const codcli = getNum(row?.codcli);
        const posicao = getStr(row?.posicao);
        const statusDescricao = getStr(row?.status_descricao);
        const statusLog = row?.status_log != null ? getStr(row?.status_log) : '';
        const separadorPedido = getStr(row?.separador_pedido);
        const dataAdd = getStr(row?.data_rota);
        const descProd = getStr(row?.descricao_produto).trim();
        const qtRaw = row?.qt;
        const qt = typeof qtRaw === 'number' ? qtRaw : Number(qtRaw);
        const prioridade = isYes(row?.prioridade);
        const separado = isYes(row?.separado);
        const coleta = isYes(row?.coleta);
        const localizacao = isYes(row?.localizacao);
        const fatura = isYes(row?.fatura);
        const corte = isYes(row?.corte);
        const envMessejana = isYes(row?.env_messejana);
        const rotaStatus = isYes(row?.rota_status);

        if (!pedidosGrouped[idRota]) pedidosGrouped[idRota] = {};
        const existing = pedidosGrouped[idRota][numped];
        if (!existing) {
          pedidosGrouped[idRota][numped] = {
            numped,
            cliente,
            codcli,
            posicao,
            statusDescricao,
            statusLog,
            separadorPedido,
            dataAdd,
            itens: 1,
            prioridade,
            separado,
            coleta,
            localizacao,
            fatura,
            corte,
            envMessejana,
            rotaStatus,
            produtos: descProd && Number.isFinite(qt) ? [{ descricao: descProd, qt }] : (descProd ? [{ descricao: descProd, qt: Number.isFinite(qt) ? qt : 0 }] : []),
          };
        } else {
          existing.itens += 1;
          if (existing.codcli == null && codcli != null) existing.codcli = codcli;
          if (!existing.dataAdd && dataAdd) existing.dataAdd = dataAdd;
          if (!existing.posicao && posicao) existing.posicao = posicao;
          if (!existing.statusDescricao && statusDescricao) existing.statusDescricao = statusDescricao;
          if (!existing.statusLog && statusLog) existing.statusLog = statusLog;
          if (!existing.separadorPedido && separadorPedido) existing.separadorPedido = separadorPedido;
          if (!existing.prioridade && prioridade) existing.prioridade = true;
          if (!existing.separado && separado) existing.separado = true;
          if (!existing.coleta && coleta) existing.coleta = true;
          if (!existing.localizacao && localizacao) existing.localizacao = true;
          if (!existing.fatura && fatura) existing.fatura = true;
          if (!existing.corte && corte) existing.corte = true;
          if (!existing.envMessejana && envMessejana) existing.envMessejana = true;
          if (!existing.rotaStatus && rotaStatus) existing.rotaStatus = true;
          if (descProd) {
            const exists = existing.produtos.some(pp => pp.descricao === descProd);
            if (!exists) {
              existing.produtos.push({ descricao: descProd, qt: Number.isFinite(qt) ? qt : 0 });
            } else {
              if (Number.isFinite(qt)) {
                const idx = existing.produtos.findIndex(pp => pp.descricao === descProd);
                if (idx >= 0) existing.produtos[idx] = { descricao: descProd, qt: existing.produtos[idx].qt + qt };
              }
            }
          }
        }
      }

      const pedidosListByRota: Record<number, PedidoResumo[]> = {};
      for (const k of Object.keys(pedidosGrouped)) {
        const id = Number(k);
        if (!Number.isFinite(id)) continue;
        const perPedido = pedidosGrouped[id] || {};
        pedidosListByRota[id] = Object.values(perPedido).sort((a, b) => b.numped - a.numped);
      }

      const rotasList = Array.from(rotasMap.values()).sort((a, b) => a.ID_ROTA - b.ID_ROTA);
      setRotas(rotasList);
      setPedidosByRota(pedidosListByRota);

      const turnos = new Set(rotasList.map(r => getTurnoFromRow(r)));
      const prefer = turnos.has('M') ? 'M' : (turnos.has('T') ? 'T' : (turnos.values().next().value || '-'));
      setActiveTurno((prev) => (prev ? prev : prefer));
    } catch (e) {
      const t = e instanceof Error ? e.message : 'Erro ao comunicar com o servidor.';
      setError(t);
      setRotas([]);
      setPedidosByRota({});
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmitNovaRota = React.useCallback(async () => {
    setNovaRotaMsg(null);
    const codUsurNum = Number(novaRotaCodUsurCriacao);
    if (!novaRotaDescricao.trim()) {
      setNovaRotaMsg({ type: 'error', text: 'Informe a descrição da rota.' });
      return;
    }
    if (!Number.isFinite(codUsurNum)) {
      setNovaRotaMsg({ type: 'error', text: 'Informe a matrícula (numérica).' });
      return;
    }
    const bairros = [novaRotaBairro1, novaRotaBairro2, novaRotaBairro3, novaRotaBairro4, novaRotaBairro5].map(b => b.trim()).filter(b => b.length);
    const payload = {
      descricaoRota: novaRotaDescricao.trim(),
      bairros,
      codMotorista: novaRotaCodMotorista.trim() ? Number(novaRotaCodMotorista) : null,
      codVeiculo: novaRotaCodVeiculo.trim() ? Number(novaRotaCodVeiculo) : null,
      dataRota: novaRotaDataRota || null,
      codUsurCriacao: codUsurNum,
      turnoSeparacao: (novaRotaTurnoSeparacao || '').trim().toUpperCase(),
    };
    setNovaRotaSubmitting(true);
    try {
      const res = await fetch('/api/gestlog/rotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const t = typeof data?.message === 'string' ? data.message : 'Falha ao criar rota';
        setNovaRotaMsg({ type: 'error', text: t });
        return;
      }
      const data = await res.json().catch(() => ({}));
      setNovaRotaMsg({ type: 'success', text: `Rota criada: ID ${data?.idRota ?? ''}`.trim() });
      setNovaRotaDescricao('');
      setNovaRotaBairro1(''); setNovaRotaBairro2(''); setNovaRotaBairro3(''); setNovaRotaBairro4(''); setNovaRotaBairro5('');
      setNovaRotaCodMotorista(''); setNovaRotaCodVeiculo('');
      setNovaRotaMotoristaLabel(''); setNovaRotaVeiculoLabel('');
      setNovaRotaTurnoSeparacao('');
      const dataToRefresh = novaRotaDataRota || dataBusca;
      if (dataToRefresh) {
        setDataBusca(dataToRefresh);
        await fetchRotas(dataToRefresh);
      }
      setNovaRotaDataRota('');
    } catch {
      setNovaRotaMsg({ type: 'error', text: 'Erro ao comunicar com o servidor.' });
    } finally {
      setNovaRotaSubmitting(false);
    }
  }, [
    dataBusca,
    fetchRotas,
    novaRotaBairro1,
    novaRotaBairro2,
    novaRotaBairro3,
    novaRotaBairro4,
    novaRotaBairro5,
    novaRotaCodMotorista,
    novaRotaCodUsurCriacao,
    novaRotaCodVeiculo,
    novaRotaDataRota,
    novaRotaDescricao,
    novaRotaTurnoSeparacao,
  ]);

  React.useEffect(() => {
    if (!show) return;
    void fetchRotas(dataBusca);
  }, [show, dataBusca, fetchRotas]);

  if (!show) return null;

  const turnos = Array.from(new Set(rotas.map(r => getTurnoFromRow(r)))).sort((a, b) => {
    const rank = (v: string) => (v === 'M' ? 0 : v === 'T' ? 1 : v === '-' ? 99 : 50);
    return rank(a) - rank(b);
  });
  const rotasFiltradas = rotas.filter(r => getTurnoFromRow(r) === activeTurno);

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 5000 }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 5010 }}>
        <div className="modal-dialog modal-fullscreen" role="document">
          <div className="modal-content" style={{ position: 'relative' }}>
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: '0.95rem' }}>Roterização</h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ padding: '0.75rem' }}>
              <div className="d-flex align-items-end justify-content-between gap-2 mb-2">
                <div style={{ flex: 1, maxWidth: 260 }}>
                  <label className="form-label mb-1 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                    <Calendar3 size={12} /> Data
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={dataBusca}
                    onChange={(e) => setDataBusca(e.target.value)}
                  />
                </div>
                <div className="d-flex align-items-end" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm py-0 px-2 d-inline-flex align-items-center"
                    style={{ height: 30 }}
                    onClick={() => void fetchRotas(dataBusca)}
                    disabled={loading || !dataBusca}
                    title="Atualizar"
                  >
                    <ArrowClockwise size={12} className="me-1" /> Atualizar
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm py-0 px-2 d-inline-flex align-items-center"
                    style={{ height: 30 }}
                    onClick={() => {
                      setRotasCardOpen(true);
                    }}
                    title="Gerir Rotas"
                  >
                    <Gear size={12} className="me-1" /> Gerir Rotas
                  </button>
                </div>
              </div>

              {turnos.length > 0 && (
                <ul className="nav nav-tabs mb-2">
                  {turnos.map((t) => (
                    <li className="nav-item" key={`turno-tab-${t}`}>
                      <button
                        type="button"
                        className={`nav-link ${activeTurno === t ? 'active' : ''}`}
                        onClick={() => setActiveTurno(t)}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        {getTurnoLabel(t)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <div className="alert alert-danger py-2" role="alert" style={{ fontSize: '0.8rem' }}>
                  {error}
                </div>
              )}

              {loading ? (
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>Carregando rotas...</div>
              ) : rotasFiltradas.length === 0 ? (
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>Nenhuma rota encontrada.</div>
              ) : (
                <div className="d-flex flex-column" style={{ gap: 10 }}>
                  {rotasFiltradas.map((row, idx) => {
                    const idRota = row.ID_ROTA;
                    const descricaoRota = String(row.DESCRICAO_ROTA || '').trim() || '-';
                    const dataRotaStr = String(row.DATA_ROTA || '').trim() || '-';
                    const bairrosRota = getBairros(row);
                    const motoristaNome = String(row.MOTORISTA_NOME || '').trim();
                    const veiculoDescricao = String(row.VEICULO_DESCRICAO || '').trim();
                    const veiculoPlaca = String(row.VEICULO_PLACA || '').trim();
                    const capCimento = row.VEICULO_CAPACIDADE_CIMENTO;
                    const turno = getTurnoFromRow(row);
                    const pedidos = Array.isArray(pedidosByRota[idRota]) ? pedidosByRota[idRota] : [];
                    const veiculoTexto = veiculoDescricao
                      ? (veiculoPlaca ? `${veiculoDescricao} (${veiculoPlaca})` : veiculoDescricao)
                      : (veiculoPlaca || '-');
                    const motoristaTexto = motoristaNome || (row.COD_MOTORISTA ?? '-');

                    return (
                      <div key={`rota-geral-${idRota || idx}`} className="card" style={{ border: '1px solid rgba(0,0,0,0.175)' }}>
                        <div className="card-body py-2 px-2" style={{ fontSize: '0.74rem' }}>
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div style={{ minWidth: 0 }}>
                              <div className="d-flex flex-wrap align-items-center" style={{ gap: 6 }}>
                                <span className="badge text-bg-secondary" style={{ fontSize: '0.68rem' }}>ID {idRota}</span>
                                {capCimento != null && (
                                  <span className="badge text-bg-primary" style={{ fontSize: '0.68rem' }}>Capacidade Cimento: {capCimento}</span>
                                )}
                                <div className="border rounded px-2 py-1" style={{ backgroundColor: '#fd7e14', color: '#fff', fontSize: '0.68rem', lineHeight: 1 }}>
                                  {formatDateBR(dataRotaStr)}
                                </div>
                                <span className="badge text-bg-light" style={{ fontSize: '0.68rem' }}>{getTurnoLabel(turno)}</span>
                              </div>
                              <div className="fw-semibold text-truncate" style={{ maxWidth: '100%', fontSize: '0.85rem' }}>
                                {descricaoRota}
                              </div>
                              <div className="mt-1" style={{ fontSize: '0.7rem' }}>
                                <span className="me-1" style={{ fontWeight: 600 }}>Bairros da Rota:</span>
                              </div>
                              <div className="mt-1 border border-warning rounded bg-warning text-dark px-2 py-1 lh-sm" title={bairrosRota}>
                                <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{bairrosRota}</span>
                              </div>

                              <div className="mt-1" style={{ fontSize: '0.7rem' }}>
                                <span className="me-1" style={{ fontWeight: 600 }}>Status Auxiliar:</span>
                              </div>
                              <div className="mt-1 border rounded bg-light px-2 py-1 lh-sm">
                                <div className="d-flex flex-wrap align-items-center" style={{ gap: 4 }}>
                                  {getRotaBadges(pedidos).length > 0 ? (
                                    getRotaBadges(pedidos).map((b) => (
                                      <span key={`rota-${idRota}-badge-${b.label}`} className={b.className} style={{ fontSize: '0.64rem' }}>
                                        {b.label}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                                Motorista: {motoristaTexto} | Veículo: {veiculoTexto}
                              </div>
                            </div>
                            <div className="text-muted text-nowrap" style={{ fontSize: '0.72rem' }}>
                              Pedidos: {pedidos.length}
                            </div>
                          </div>

                          {pedidos.length > 0 && (
                            <div className="mt-2 border rounded" style={{ overflowX: 'auto' }}>
                              <table className="table table-sm mb-0" style={{ fontSize: '0.68rem', lineHeight: 1.2 }}>
                                <thead className="table-light">
                                  <tr>
                                    <th style={{ width: 120 }}>Pedido</th>
                                    <th>Cliente</th>
                                    <th style={{ width: 90 }}>Posição</th>
                                    <th style={{ width: 140 }}>Status</th>
                                    <th style={{ width: 150 }}>Separador</th>
                                    <th>Produtos</th>
                                    <th style={{ width: 110 }}>Data Rota</th>
                                    <th style={{ width: 70 }}>Itens</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pedidos.map((p) => {
                                    return (
                                      <tr key={`rota-${idRota}-p-${p.numped}`}>
                                        <td>{p.numped}</td>
                                        <td className="text-truncate" style={{ maxWidth: 420 }}>
                                          {p.codcli != null ? `${p.codcli} - ` : ''}{p.cliente || '-'}
                                        </td>
                                        <td>{p.posicao || '-'}</td>
                                        <td className="text-truncate" style={{ maxWidth: 220 }}>
                                          {p.statusDescricao || '-'}
                                          {p.statusLog ? (
                                            <span className="ms-1 text-muted">({p.statusLog})</span>
                                          ) : null}
                                        </td>
                                        <td className="text-truncate" style={{ maxWidth: 200 }}>{p.separadorPedido || '-'}</td>
                                        <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>
                                          {p.produtos && p.produtos.length > 0 ? (
                                            <table className="table table-borderless table-sm mb-0" style={{ fontSize: '0.66rem', lineHeight: 1.15 }}>
                                              <tbody>
                                                {p.produtos.map((it, idx) => (
                                                  <tr key={`p-${p.numped}-prod-${idx}`}>
                                                    <td className="text-end pe-2" style={{ width: 1, paddingTop: 2, paddingBottom: 2 }}>
                                                      {Number.isFinite(it.qt) ? it.qt : '-'}
                                                    </td>
                                                    <td style={{ paddingTop: 2, paddingBottom: 2 }}>
                                                      {it.descricao}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          ) : (
                                            <span className="text-muted">-</span>
                                          )}
                                        </td>
                                        <td>{p.dataAdd ? formatDateBR(p.dataAdd) : '-'}</td>
                                        <td>{p.itens}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <RotasCardModal
              show={rotasCardOpen}
              onClose={() => {
                setRotasCardOpen(false);
                void fetchRotas(dataBusca);
              }}
              dataInicial={dataBusca}
              zIndexBase={6000}
            />

            <NovaRotaModal
              open={novaRotaOpen}
              setOpen={setNovaRotaOpen}
              submitting={novaRotaSubmitting}
              msg={novaRotaMsg}
              setMsg={setNovaRotaMsg}
              descricao={novaRotaDescricao}
              setDescricao={setNovaRotaDescricao}
              bairro1={novaRotaBairro1}
              setBairro1={setNovaRotaBairro1}
              bairro2={novaRotaBairro2}
              setBairro2={setNovaRotaBairro2}
              bairro3={novaRotaBairro3}
              setBairro3={setNovaRotaBairro3}
              bairro4={novaRotaBairro4}
              setBairro4={setNovaRotaBairro4}
              bairro5={novaRotaBairro5}
              setBairro5={setNovaRotaBairro5}
              codMotorista={novaRotaCodMotorista}
              motoristaLabel={novaRotaMotoristaLabel}
              setMotoristaModalOpen={setNovaRotaMotoristaModalOpen}
              codVeiculo={novaRotaCodVeiculo}
              veiculoLabel={novaRotaVeiculoLabel}
              setVeiculoModalOpen={setNovaRotaVeiculoModalOpen}
              dataRota={novaRotaDataRota}
              setDataRota={setNovaRotaDataRota}
              turnoSeparacao={novaRotaTurnoSeparacao}
              setTurnoSeparacao={setNovaRotaTurnoSeparacao}
              codUsurCriacao={novaRotaCodUsurCriacao}
              setCodUsurCriacao={setNovaRotaCodUsurCriacao}
              onSubmit={onSubmitNovaRota}
            />

            <SelecionarVeiculoModal
              show={novaRotaVeiculoModalOpen}
              onClose={() => setNovaRotaVeiculoModalOpen(false)}
              onSelect={(v) => {
                setNovaRotaCodVeiculo(String(v.id));
                setNovaRotaVeiculoLabel(String(v.descricao || '').trim());
              }}
            />
            <SelecionarMotoristaModal
              show={novaRotaMotoristaModalOpen}
              onClose={() => setNovaRotaMotoristaModalOpen(false)}
              onSelect={(m) => {
                setNovaRotaCodMotorista(String(m.id));
                setNovaRotaMotoristaLabel(String(m.nome || '').trim());
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelaGeralRotas;
