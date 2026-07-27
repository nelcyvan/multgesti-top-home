// /home/multgesti/src/pages/ofxconcilia/OfxConcilia.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import TopBar from "../../components/TopBar";
import { AvulsoNovoLancamentoModal } from "../../components/gestlog/modals/NotasRecentesModal";
import { 
  House,
  Truck, 
  CashCoin, 
  FileEarmarkText, 
  Wallet2, 
  ClipboardCheck, 
  FileEarmarkRuled,
  CalendarRange,
  Search,
  Check2Circle,
  ListUl,
  XLg
} from "react-bootstrap-icons";
import Logistica from "./Logistica";
import VendasCarteira from "./VendasEmAbertoAreceber";
import Dashboard from "./Dashboard";
import ContasApagar from "./ContasApagar";
import { getDateRange, DATE_RANGE_OPTIONS } from "./.ts/logistica/DateHelpers";

const OfxConcilia: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<string>("Dashboard");
  const topBarLabelStyle: React.CSSProperties = { fontSize: "0.60rem", lineHeight: 1, marginTop: "2px", textAlign: "center" };

  const resolveBaseApi = useCallback((): string => {
    const env = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
    let baseApi = "/api";
    if (env && typeof env === "string") {
      const trimmed = env.replace(/\/$/, "");
      baseApi = trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
    }
    return baseApi;
  }, []);

  const SangriaLotesFinalizados: React.FC = () => {
    const [dataInicio, setDataInicio] = useState<string>(() => getDateRange("currentMonth").start);
    const [dataFim, setDataFim] = useState<string>(() => getDateRange("currentMonth").end);
    const [selectedDateRange, setSelectedDateRange] = useState<string>("currentMonth");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const [rows, setRows] = useState<any[]>([]);
    const [showConciliar, setShowConciliar] = useState(false);
    const [conciliarLoteId, setConciliarLoteId] = useState<number | null>(null);
    const [conciliarTab, setConciliarTab] = useState<"lote" | "avulso">("lote");
    const [conciliarCodfilial, setConciliarCodfilial] = useState<string | null>(null);
    const [selectedLotesMap, setSelectedLotesMap] = useState<Record<string, true>>({});
    const [showAvancado, setShowAvancado] = useState(false);
    const [avancadoRows, setAvancadoRows] = useState<any[]>([]);
    const [loadingConciliar, setLoadingConciliar] = useState(false);
    const [errorConciliar, setErrorConciliar] = useState<string>("");
    const [rowsConciliar, setRowsConciliar] = useState<any[]>([]);
    const [loadingAvulsos, setLoadingAvulsos] = useState(false);
    const [errorAvulsos, setErrorAvulsos] = useState<string>("");
    const [rowsAvulsos, setRowsAvulsos] = useState<any[]>([]);
    const [showAvulsoNovoLancamentoModal, setShowAvulsoNovoLancamentoModal] = useState(false);
    const [somenteConciliados, setSomenteConciliados] = useState(false);
    const [showConfirmConciliarItem, setShowConfirmConciliarItem] = useState(false);
    const [confirmConciliarItem, setConfirmConciliarItem] = useState<any | null>(null);

    function formatDateTimeBR(value: any) {
      if (!value) return "-";
      const d = new Date(value);
      if (!Number.isFinite(d.getTime())) return String(value);
      return d.toLocaleString("pt-BR");
    }

    function formatMoneyBR(value: any) {
      const n = Number(value ?? 0);
      return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    const totalValor = useMemo(() => {
      return (rows || []).reduce((acc, r) => acc + Number(r?.VL_SALDO_DINHEIRO ?? 0), 0);
    }, [rows]);

    const totalValorAvulso = useMemo(() => {
      return (rows || []).reduce((acc, r) => acc + Number(r?.VL_SALDO_DINHEIRO_AVULSO ?? 0), 0);
    }, [rows]);

    const totalValorGeral = useMemo(() => {
      return totalValor + totalValorAvulso;
    }, [totalValor, totalValorAvulso]);

    const totalConciliar = useMemo(() => {
      return (rowsConciliar || []).reduce((acc, r) => acc + Number(r?.VL_DINHEIRO ?? 0), 0);
    }, [rowsConciliar]);

    const totalAvulsos = useMemo(() => {
      return (rowsAvulsos || []).reduce((acc, r) => acc + Number(r?.VL_DINHEIRO_AVULSO ?? 0), 0);
    }, [rowsAvulsos]);

    const totalConciliarGeral = useMemo(() => {
      return totalConciliar + totalAvulsos;
    }, [totalConciliar, totalAvulsos]);

    const conciliarLoteRow = useMemo(() => {
      if (!conciliarLoteId) return null;
      return (rows || []).find((r) => Number(r?.ID_LOTE) === Number(conciliarLoteId)) ?? null;
    }, [rows, conciliarLoteId]);

    const fundoCaixaConciliarTxt = useMemo(() => {
      if (!conciliarLoteRow) return "-";
      return formatMoneyBR(conciliarLoteRow?.VL_SALDO_FUNDO_CX);
    }, [conciliarLoteRow]);

    const selectedLotes = useMemo(() => {
      return (rows || []).filter((r) => {
        const id = Number(r?.ID_LOTE);
        if (!Number.isFinite(id)) return false;
        return Boolean(selectedLotesMap[String(id)]);
      });
    }, [rows, selectedLotesMap]);

    const selectedCount = selectedLotes.length;

    const avancadoTotals = useMemo(() => {
      const saldo = (avancadoRows || []).reduce((acc, r) => acc + (Number(r?.VL_SALDO_DINHEIRO ?? 0) || 0), 0);
      const avulso = (avancadoRows || []).reduce((acc, r) => acc + (Number(r?.VL_SALDO_DINHEIRO_AVULSO ?? 0) || 0), 0);
      const totalLotes = (avancadoRows || []).reduce((acc, r) => acc + (Number(r?.TOTAL_DINHEIRO ?? 0) || 0), 0);
      return { saldo, avulso, geral: saldo + avulso, totalLotes };
    }, [avancadoRows]);

    useEffect(() => {
      setSelectedLotesMap((prev) => {
        const next: Record<string, true> = {};
        for (const r of rows || []) {
          const id = Number(r?.ID_LOTE);
          if (!Number.isFinite(id)) continue;
          const key = String(id);
          if (prev[key]) next[key] = true;
        }
        return next;
      });
    }, [rows]);

    const handleDateRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setSelectedDateRange(value);
      const { start, end } = getDateRange(value);
      setDataInicio(start);
      setDataFim(end);
    };

    const buscar = useCallback(async () => {
      setLoading(true);
      setError("");
      try {
        const baseApi = resolveBaseApi();
        const resp = await fetch(`${baseApi}/gestlog/sangria-lotes/finalizados`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataInicio, dataFim }),
        });

        const ct = resp.headers.get("content-type") || "";
        const isJson = ct.toLowerCase().includes("application/json");
        const payload = isJson ? await resp.json() : { message: await resp.text() };

        if (!resp.ok) {
          throw new Error(payload?.message || `Erro ${resp.status}`);
        }

        const nextRows = Array.isArray(payload?.rows) ? payload.rows : [];
        nextRows.sort((a: any, b: any) => (Number(a?.ID_LOTE ?? 0) || 0) - (Number(b?.ID_LOTE ?? 0) || 0));
        setRows(nextRows);
      } catch (e: any) {
        setRows([]);
        setError(e?.message || "Erro ao buscar lotes finalizados");
      } finally {
        setLoading(false);
      }
    }, [dataInicio, dataFim, resolveBaseApi]);

    useEffect(() => {
      buscar();
    }, [buscar]);

    const listarAvulsosDoLote = useCallback(async (idLote: number, codfilial?: string | number | null) => {
      setLoadingAvulsos(true);
      setErrorAvulsos("");
      setRowsAvulsos([]);
      try {
        const baseApi = resolveBaseApi();
        const resp = await fetch(`${baseApi}/gestlog/gestao-sangria-lotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idLote,
            consultar_lote: "listar_avulsos",
            codfilial: codfilial == null ? null : String(codfilial).trim() ? String(codfilial).trim() : null,
          }),
        });

        const ct = resp.headers.get("content-type") || "";
        const isJson = ct.toLowerCase().includes("application/json");
        const payload = isJson ? await resp.json() : { message: await resp.text() };

        if (!resp.ok) {
          throw new Error(payload?.message || `Erro ${resp.status}`);
        }

        setRowsAvulsos(Array.isArray(payload?.rows) ? payload.rows : []);
      } catch (e: any) {
        setErrorAvulsos(e?.message || "Erro ao listar avulsos do lote");
      } finally {
        setLoadingAvulsos(false);
      }
    }, [resolveBaseApi]);

    const abrirConciliar = useCallback(async (idLote: number, codfilial?: string | number | null) => {
      const codfilialTxt = codfilial == null ? null : String(codfilial).trim() ? String(codfilial).trim() : null;
      setConciliarLoteId(idLote);
      setShowConciliar(true);
      setConciliarTab("lote");
      setConciliarCodfilial(codfilialTxt);
      setShowAvulsoNovoLancamentoModal(false);
      setLoadingConciliar(true);
      setErrorConciliar("");
      setRowsConciliar([]);
      setErrorAvulsos("");
      setRowsAvulsos([]);
      listarAvulsosDoLote(idLote, codfilialTxt);
      try {
        const baseApi = resolveBaseApi();
        const resp = await fetch(`${baseApi}/gestlog/gestao-sangria-lotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idLote, consultar_lote: "consultar_lote", somenteConciliados }),
        });

        const ct = resp.headers.get("content-type") || "";
        const isJson = ct.toLowerCase().includes("application/json");
        const payload = isJson ? await resp.json() : { message: await resp.text() };

        if (!resp.ok) {
          throw new Error(payload?.message || `Erro ${resp.status}`);
        }

        setRowsConciliar(Array.isArray(payload?.rows) ? payload.rows : []);
      } catch (e: any) {
        setErrorConciliar(e?.message || "Erro ao consultar lote");
      } finally {
        setLoadingConciliar(false);
      }
    }, [listarAvulsosDoLote, resolveBaseApi, somenteConciliados]);

    const keyConciliacaoItem = useCallback((row: any) => {
      const idLoteFromRow = Number(row?.ID_LOTE);
      const idLote = Number.isFinite(idLoteFromRow) && idLoteFromRow > 0 ? idLoteFromRow : Number(conciliarLoteId);
      const numnota = Number(row?.NUMNOTA);
      const numpedTv8 = Number(row?.NUMPED_TV8);
      if (!Number.isFinite(idLote) || idLote <= 0) return null;
      if (!Number.isFinite(numnota) || numnota <= 0) return null;
      if (!Number.isFinite(numpedTv8) || numpedTv8 <= 0) return null;
      return `${idLote}|${numnota}|${numpedTv8}`;
    }, [conciliarLoteId]);

    const conciliarItem = useCallback(async (row: any) => {
      const idLoteFromRow = Number(row?.ID_LOTE);
      const idLote = Number.isFinite(idLoteFromRow) && idLoteFromRow > 0 ? idLoteFromRow : Number(conciliarLoteId);
      const numnota = Number(row?.NUMNOTA);
      const numpedTv8 = Number(row?.NUMPED_TV8);
      const key = keyConciliacaoItem(row);
      if (!key) return;
      setLoadingConciliar(true);
      setErrorConciliar("");
      try {
        const codusurConciliacao = (() => {
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
        })();
        if (!codusurConciliacao) {
          throw new Error("Não foi possível identificar o usuário logado (CODUSUR) para conciliação");
        }

        const baseApi = resolveBaseApi();
        const rowId = String(row?.ROW_ID ?? row?.ROWID ?? row?.rowId ?? "").trim();
        const resp = await fetch(`${baseApi}/gestlog/sangria-lotes/conciliar-item`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idLote,
            numnota,
            numped_tv8: numpedTv8,
            codusurConciliacao,
            rowId,
            ID_LOTE: idLote,
            NUMNOTA: numnota,
            NUMPED_TV8: numpedTv8,
          }),
        });

        const ct = resp.headers.get("content-type") || "";
        const isJson = ct.toLowerCase().includes("application/json");
        const payload = isJson ? await resp.json() : { message: await resp.text() };

        if (!resp.ok) {
          throw new Error(payload?.message || `Erro ${resp.status}`);
        }

        setRowsConciliar((prev) =>
          (prev || []).map((r) =>
            keyConciliacaoItem(r) === key
              ? { ...r, CONCILIADO: "S", CODUSUR_CONCILIACAO: codusurConciliacao, DATA_HORA_CONCILIACAO: new Date().toISOString() }
              : r
          )
        );
      } catch (e: any) {
        setErrorConciliar(e?.message || "Erro ao conciliar item");
      } finally {
        setLoadingConciliar(false);
      }
    }, [conciliarLoteId, keyConciliacaoItem, resolveBaseApi]);

    const abrirConfirmacaoConciliarItem = useCallback((row: any) => {
      setConfirmConciliarItem(row ?? null);
      setShowConfirmConciliarItem(true);
    }, []);

    const toggleSelecionarLote = useCallback((idLote: number, checked: boolean) => {
      const key = String(idLote);
      setSelectedLotesMap((prev) => {
        const next = { ...prev };
        if (checked) next[key] = true;
        else delete next[key];
        return next;
      });
    }, []);

    const limparSelecao = useCallback(() => {
      setSelectedLotesMap({});
    }, []);

    const abrirAvancado = useCallback(() => {
      if (selectedLotes.length < 2) return;
      setAvancadoRows(selectedLotes.map((r) => ({ ...r })));
      setShowAvancado(true);
    }, [selectedLotes]);

    const gerarDocumentoGeral = useCallback(() => {
      const escapeHtml = (val: any) => {
        const s = String(val ?? "");
        return s
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      };

      const now = new Date();
      const periodo = `${dataInicio || "-"} até ${dataFim || "-"}`;
      const titulo = "Relatório Geral - Lotes com Sangria Finalizada";
      const rowsHtml = (avancadoRows || [])
        .map((r: any) => {
          const id = escapeHtml(r?.ID_LOTE ?? "-");
          const filial = escapeHtml(r?.CODFILIAL ?? "-");
          const dataSangria = escapeHtml(formatDateTimeBR(r?.DATA_HORA_SANGRIA));
          const usuario = escapeHtml(r?.NOME_SANGRIA ?? "-");
          const saldo = Number(r?.VL_SALDO_DINHEIRO ?? 0) || 0;
          const avulso = Number(r?.VL_SALDO_DINHEIRO_AVULSO ?? 0) || 0;
          const totalGeral = saldo + avulso;
          const totalLotes = Number(r?.TOTAL_DINHEIRO ?? 0) || 0;
          const registros = escapeHtml(Number(r?.QTD_REGISTROS ?? 0) || 0);
          const duplicatas = escapeHtml(r?.DUPLICATAS_CONCILIADAS_TOTAL ?? "-");

          return `
            <div class="card">
              <div class="card-header">
                <div class="title">Lote ${id} · Filial ${filial}</div>
                <div class="badges">
                  <span class="badge">Saldo: ${escapeHtml(formatMoneyBR(saldo))}</span>
                  <span class="badge">Avulso: ${escapeHtml(formatMoneyBR(avulso))}</span>
                  <span class="badge badge-primary">Total: ${escapeHtml(formatMoneyBR(totalGeral))}</span>
                </div>
              </div>
              <table class="kv">
                <tr><td class="k">Data sangria</td><td class="v">${dataSangria}</td></tr>
                <tr><td class="k">Usuário</td><td class="v">${usuario}</td></tr>
                <tr><td class="k">Total (lotes)</td><td class="v">${escapeHtml(formatMoneyBR(totalLotes))}</td></tr>
                <tr><td class="k">Registros</td><td class="v">${registros}</td></tr>
                <tr><td class="k">Duplicatas</td><td class="v">${duplicatas}</td></tr>
              </table>
            </div>
          `;
        })
        .join("\n");

      const htmlContent = `
        <!doctype html>
        <html lang="pt-BR">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${escapeHtml(titulo)}</title>
            <style>
              * { box-sizing: border-box; }
              body { font-family: Arial, sans-serif; margin: 18px; color: #111; }
              .header { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
              .header .h1 { font-size: 16px; font-weight: 700; }
              .meta { font-size: 12px; color: #555; display: flex; flex-wrap: wrap; gap: 10px; }
              .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 12px 0 14px; }
              .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px; }
              .box .k { font-size: 11px; color: #666; margin-bottom: 6px; }
              .box .v { font-size: 14px; font-weight: 700; }
              .cards { display: flex; flex-direction: column; gap: 10px; }
              .card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; page-break-inside: avoid; }
              .card-header { padding: 10px; background: #f8f9fa; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
              .title { font-size: 13px; font-weight: 700; }
              .badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
              .badge { border: 1px solid #e5e7eb; background: #fff; padding: 3px 7px; border-radius: 999px; font-size: 12px; }
              .badge-primary { background: #0d6efd; border-color: #0d6efd; color: #fff; }
              table.kv { width: 100%; border-collapse: collapse; }
              table.kv td { padding: 8px 10px; border-top: 1px solid #f0f0f0; font-size: 12px; vertical-align: top; }
              table.kv td.k { width: 170px; color: #666; }
              @media print {
                body { margin: 10mm; }
                .card { break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="h1">${escapeHtml(titulo)}</div>
              <div class="meta">
                <div><strong>Período:</strong> ${escapeHtml(periodo)}</div>
                <div><strong>Gerado em:</strong> ${escapeHtml(now.toLocaleString("pt-BR"))}</div>
                <div><strong>Quantidade de lotes:</strong> ${escapeHtml((avancadoRows || []).length)}</div>
              </div>
            </div>

            <div class="summary">
              <div class="box"><div class="k">Total saldos</div><div class="v">${escapeHtml(formatMoneyBR(avancadoTotals.saldo))}</div></div>
              <div class="box"><div class="k">Total avulso</div><div class="v">${escapeHtml(formatMoneyBR(avancadoTotals.avulso))}</div></div>
              <div class="box"><div class="k">Total geral</div><div class="v">${escapeHtml(formatMoneyBR(avancadoTotals.geral))}</div></div>
              <div class="box"><div class="k">Total (lotes)</div><div class="v">${escapeHtml(formatMoneyBR(avancadoTotals.totalLotes))}</div></div>
            </div>

            <div class="cards">
              ${rowsHtml || `<div class="box"><div class="k">Aviso</div><div class="v">Nenhum lote selecionado</div></div>`}
            </div>

            <script>
              window.onload = function() {
                setTimeout(function() { window.print(); }, 400);
              };
            </script>
          </body>
        </html>
      `;

      const printWindow = window.open("", "_blank", "width=1000,height=800");
      if (!printWindow) return;
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }, [avancadoRows, avancadoTotals, dataFim, dataInicio]);

    const confirmarConciliacaoItem = useCallback(async () => {
      if (!confirmConciliarItem) return;
      await conciliarItem(confirmConciliarItem);
      setShowConfirmConciliarItem(false);
      setConfirmConciliarItem(null);
    }, [conciliarItem, confirmConciliarItem]);

    return (
      <div className="p-2 h-100 d-flex flex-column" style={{ fontSize: "0.85rem" }}>
        <div className="card shadow-sm mb-2">
          <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center">
            <div className="fw-bold d-inline-flex align-items-center" style={{ gap: "8px" }}>
              <CashCoin size={18} className="text-success" />
              <span>Lotes com sangria finalizada</span>
            </div>
            <div className="text-muted small">
              <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                <Check2Circle size={14} className="text-success" />
                <span>Total (c/ avulso):</span>
              </span>{" "}
              <span className="fw-bold">{formatMoneyBR(totalValorGeral)}</span>
            </div>
          </div>
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label small mb-0">Período</label>
                <select className="form-select form-select-sm" value={selectedDateRange} onChange={handleDateRangeChange}>
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-0">Início</label>
                <input className="form-control form-control-sm" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label small mb-0">Fim</label>
                <input className="form-control form-control-sm" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
              <div className="col-md-auto">
                <button className="btn btn-primary btn-sm" onClick={buscar} disabled={loading}>
                  <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                    {loading ? null : <Search size={14} />}
                    <span>{loading ? "Buscando..." : "Buscar"}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="alert alert-danger py-2">{error}</div>
        ) : null}

        <div className="card shadow-sm flex-grow-1 overflow-hidden">
          <div className="card-body p-0 h-100">
            <div className="table-responsive h-100" style={{ overflowY: "auto" }}>
              <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.82rem" }}>
                <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                  <tr>
                    <th className="ps-4 text-center" style={{ width: "90px" }}>
                      <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                        <ListUl size={12} className="text-secondary" />
                        <span>Lote</span>
                      </span>
                    </th>
                    <th className="text-center" style={{ width: "90px" }}>Filial</th>
                    <th style={{ width: "190px" }}>
                      <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                        <CalendarRange size={12} className="text-secondary" />
                        <span>Data sangria</span>
                      </span>
                    </th>
                    <th>Usuário</th>
                    <th className="text-end" style={{ width: "160px" }}>Saldo</th>
                    <th className="text-end" style={{ width: "160px" }}>Avulso</th>
                    <th className="text-end" style={{ width: "170px" }}>Total (c/ avulso)</th>
                    <th className="text-end" style={{ width: "160px" }}>Total (lotes)</th>
                    <th className="text-center" style={{ width: "110px" }}>Registros</th>
                    <th className="text-center" style={{ width: "110px" }}>Duplicatas</th>
                    <th style={{ width: "120px" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="text-center py-4 text-muted">Carregando...</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-4 text-muted">Nenhum lote encontrado no período.</td>
                    </tr>
                  ) : (
                    rows.map((r, idx) => (
                      <tr
                        key={`${r?.ID_LOTE ?? "lote"}-${idx}`}
                        className={
                          (() => {
                            const total = Number(r?.DUPLICATAS_TOTAL ?? 0) || 0;
                            const pendentes = Number(r?.DUPLICATAS_PENDENTES ?? 0) || 0;
                            const conciliadas = Math.max(0, total - pendentes);
                            if (total > 0 && pendentes <= 0) return "table-success";
                            if (total > 0 && conciliadas > 0) return "table-warning";
                            return "";
                          })()
                        }
                      >
                        <td className="fw-bold ps-4 text-center">{r?.ID_LOTE ?? "-"}</td>
                        <td className="text-center">{r?.CODFILIAL ?? "-"}</td>
                        <td>{formatDateTimeBR(r?.DATA_HORA_SANGRIA)}</td>
                        <td className="text-truncate" style={{ maxWidth: 420 }} title={r?.NOME_SANGRIA ?? ""}>
                          {r?.NOME_SANGRIA ?? "-"}
                        </td>
                        <td className="text-end">{formatMoneyBR(r?.VL_SALDO_DINHEIRO)}</td>
                        <td className="text-end">{formatMoneyBR(r?.VL_SALDO_DINHEIRO_AVULSO)}</td>
                        <td className="text-end">
                          {formatMoneyBR((Number(r?.VL_SALDO_DINHEIRO ?? 0) || 0) + (Number(r?.VL_SALDO_DINHEIRO_AVULSO ?? 0) || 0))}
                        </td>
                        <td className="text-end">{formatMoneyBR(r?.TOTAL_DINHEIRO)}</td>
                        <td className="text-center">{Number(r?.QTD_REGISTROS ?? 0) || 0}</td>
                        <td className="text-center">
                          {String(
                            r?.DUPLICATAS_CONCILIADAS_TOTAL ??
                              `${Math.max(0, (Number(r?.DUPLICATAS_TOTAL ?? 0) || 0) - (Number(r?.DUPLICATAS_PENDENTES ?? 0) || 0))}/${Number(r?.DUPLICATAS_TOTAL ?? 0) || 0}`
                          )}
                        </td>
                        <td>
                          <div className="d-flex align-items-center justify-content-end" style={{ gap: "10px" }}>
                            <input
                              className="form-check-input m-0"
                              type="checkbox"
                              title="Seleção avançada"
                              checked={Boolean(selectedLotesMap[String(Number(r?.ID_LOTE))])}
                              onChange={(e) => {
                                const id = Number(r?.ID_LOTE);
                                if (!Number.isFinite(id)) return;
                                toggleSelecionarLote(id, e.target.checked);
                              }}
                              disabled={!Number.isFinite(Number(r?.ID_LOTE))}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm py-1 px-2"
                              style={{ fontSize: "0.75rem", lineHeight: 1.1 }}
                              onClick={() => abrirConciliar(Number(r?.ID_LOTE), r?.CODFILIAL)}
                              disabled={!Number.isFinite(Number(r?.ID_LOTE))}
                            >
                              <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                                <Check2Circle size={14} />
                                <span>Conciliar</span>
                              </span>
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
          <div className="border-top bg-white px-2 py-2 d-flex align-items-center justify-content-between" style={{ fontSize: "0.8rem" }}>
            <div className="text-muted">
              Selecionados: <span className="fw-bold">{selectedCount}</span>
            </div>
            <div className="d-flex align-items-center" style={{ gap: "8px" }}>
              <button type="button" className="btn btn-outline-secondary btn-sm py-1 px-2" onClick={limparSelecao} disabled={selectedCount === 0}>
                Limpar
              </button>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm py-1 px-2"
                onClick={abrirAvancado}
                disabled={selectedCount < 2}
                title={selectedCount < 2 ? "Selecione 2 ou mais lotes" : "Aguardando desenvolvimento"}
              >
                Avançado
              </button>
            </div>
          </div>
        </div>

        {showAvancado && (
          <div>
            <div className="modal-backdrop fade show" style={{ zIndex: 3120, backgroundColor: "rgba(0,0,0,0.6)", position: "fixed", inset: 0 }} />
            <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3125, position: "fixed", inset: 0 }}>
              <div className="modal-dialog modal-fullscreen" role="document" style={{ margin: 0 }}>
                <div className="modal-content d-flex flex-column" style={{ fontSize: "0.95rem", height: "100vh", borderRadius: 0 }}>
                  <div className="modal-header py-2">
                    <div className="d-flex flex-column">
                      <h5 className="modal-title" style={{ fontSize: "1rem" }}>
                        Seleção avançada
                      </h5>
                      <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                        Lotes selecionados: <span className="fw-bold">{avancadoRows.length}</span>
                      </div>
                    </div>
                    <button type="button" className="btn-close" aria-label="Fechar" onClick={() => setShowAvancado(false)} />
                  </div>
                  <div className="modal-body p-0 flex-grow-1" style={{ overflow: "hidden", backgroundColor: "#f8f9fa" }}>
                    <div className="p-3">
                      <div className="alert alert-secondary mb-0" style={{ fontSize: "0.9rem" }}>
                        Aguardando desenvolvimento.
                      </div>
                    </div>
                    <div className="px-3 pb-2">
                      <div className="row g-2">
                        <div className="col-12 col-md-3">
                          <div className="border rounded bg-white p-2">
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>Total saldos</div>
                            <div className="fw-bold">{formatMoneyBR(avancadoTotals.saldo)}</div>
                          </div>
                        </div>
                        <div className="col-12 col-md-3">
                          <div className="border rounded bg-white p-2">
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>Total avulso</div>
                            <div className="fw-bold">{formatMoneyBR(avancadoTotals.avulso)}</div>
                          </div>
                        </div>
                        <div className="col-12 col-md-3">
                          <div className="border rounded bg-white p-2">
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>Total geral</div>
                            <div className="fw-bold">{formatMoneyBR(avancadoTotals.geral)}</div>
                          </div>
                        </div>
                        <div className="col-12 col-md-3">
                          <div className="border rounded bg-white p-2">
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>Total (lotes)</div>
                            <div className="fw-bold">{formatMoneyBR(avancadoTotals.totalLotes)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ height: "calc(100vh - 290px)", overflowY: "auto" }}>
                      <div className="px-3 pb-3 d-flex flex-column" style={{ gap: "10px" }}>
                        {avancadoRows.length === 0 ? (
                          <div className="text-center py-4 text-muted">Nenhum lote selecionado.</div>
                        ) : (
                          avancadoRows.map((r, idx) => {
                            const saldo = Number(r?.VL_SALDO_DINHEIRO ?? 0) || 0;
                            const avulso = Number(r?.VL_SALDO_DINHEIRO_AVULSO ?? 0) || 0;
                            const geral = saldo + avulso;
                            return (
                              <div key={`${r?.ID_LOTE ?? "lote"}-${idx}`} className="card shadow-sm border-0">
                                <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
                                  <div className="fw-bold" style={{ fontSize: "0.9rem" }}>
                                    Lote {r?.ID_LOTE ?? "-"} · Filial {r?.CODFILIAL ?? "-"}
                                  </div>
                                  <div className="d-flex align-items-center" style={{ gap: "8px", flexWrap: "wrap" }}>
                                    <span className="badge bg-light text-dark border">Saldo: {formatMoneyBR(saldo)}</span>
                                    <span className="badge bg-light text-dark border">Avulso: {formatMoneyBR(avulso)}</span>
                                    <span className="badge bg-primary">Total: {formatMoneyBR(geral)}</span>
                                  </div>
                                </div>
                                <div className="card-body p-2">
                                  <div className="table-responsive">
                                    <table className="table table-sm mb-0" style={{ fontSize: "0.82rem" }}>
                                      <tbody>
                                        <tr>
                                          <td className="text-muted" style={{ width: "180px" }}>Data sangria</td>
                                          <td>{formatDateTimeBR(r?.DATA_HORA_SANGRIA)}</td>
                                        </tr>
                                        <tr>
                                          <td className="text-muted">Usuário</td>
                                          <td>{r?.NOME_SANGRIA ?? "-"}</td>
                                        </tr>
                                        <tr>
                                          <td className="text-muted">Total (lotes)</td>
                                          <td>{formatMoneyBR(r?.TOTAL_DINHEIRO)}</td>
                                        </tr>
                                        <tr>
                                          <td className="text-muted">Registros</td>
                                          <td>{Number(r?.QTD_REGISTROS ?? 0) || 0}</td>
                                        </tr>
                                        <tr>
                                          <td className="text-muted">Duplicatas</td>
                                          <td>{String(r?.DUPLICATAS_CONCILIADAS_TOTAL ?? "-")}</td>
                                        </tr>
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
                  <div className="modal-footer py-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={gerarDocumentoGeral}
                      disabled={avancadoRows.length === 0}
                      title={avancadoRows.length === 0 ? "Nenhum lote selecionado" : "Gerar documento geral"}
                    >
                      <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                        <FileEarmarkText size={14} />
                        <span>Documento</span>
                      </span>
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAvancado(false)}>
                      <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                        <XLg size={14} />
                        <span>Fechar</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showConciliar && (
          <div>
            <div className="modal-backdrop fade show" style={{ zIndex: 3098, backgroundColor: "rgba(0,0,0,0.6)", position: "fixed", inset: 0 }} />
            <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3103, position: "fixed", inset: 0 }}>
              <div className="modal-dialog modal-fullscreen" role="document" style={{ margin: 0 }}>
                <div className="modal-content d-flex flex-column" style={{ fontSize: "0.95rem", height: "100vh", borderRadius: 0 }}>
                  <div className="modal-header py-2">
                    <div className="d-flex flex-column">
                      <h5 className="modal-title d-inline-flex align-items-center" style={{ fontSize: "1rem", gap: "8px" }}>
                        <Check2Circle size={18} className="text-primary" />
                        <span>Conciliar Lote</span>
                      </h5>
                      <div className="d-flex align-items-center mt-1" style={{ gap: "8px", flexWrap: "wrap" }}>
                        <div className="nav nav-pills" role="tablist" aria-label="Abas de conciliação">
                          <button
                            type="button"
                            className={`nav-link py-1 px-2 ${conciliarTab === "lote" ? "active" : ""}`}
                            style={{ fontSize: "0.78rem", lineHeight: 1.1 }}
                            onClick={() => setConciliarTab("lote")}
                            aria-current={conciliarTab === "lote" ? "page" : undefined}
                          >
                            Conciliar lote
                          </button>
                          <button
                            type="button"
                            className={`nav-link py-1 px-2 ${conciliarTab === "avulso" ? "active" : ""}`}
                            style={{ fontSize: "0.78rem", lineHeight: 1.1 }}
                            onClick={() => {
                              setConciliarTab("avulso");
                              if (conciliarLoteId) {
                                listarAvulsosDoLote(conciliarLoteId, conciliarCodfilial);
                              }
                            }}
                            disabled={!conciliarLoteId || loadingAvulsos}
                          >
                            Lançamentos avulso
                          </button>
                        </div>
                      </div>
                      <div className="d-flex align-items-center mt-1" style={{ gap: "6px", flexWrap: "wrap" }}>
                        <span className="badge bg-dark">
                          <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                            <FileEarmarkRuled size={12} />
                            <span>Lote:</span>
                            <span className="fw-bold">{conciliarLoteId ?? "-"}</span>
                          </span>
                        </span>
                        <span className="badge bg-secondary">
                          <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                            <Wallet2 size={12} />
                            <span>Total lote:</span>
                            <span className="fw-bold">{formatMoneyBR(totalConciliar)}</span>
                          </span>
                        </span>
                        <span className="badge bg-info text-dark">
                          <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                            <CashCoin size={12} />
                            <span>Avulso:</span>
                            <span className="fw-bold">{loadingAvulsos ? "..." : formatMoneyBR(totalAvulsos)}</span>
                          </span>
                        </span>
                        <span className="badge bg-danger">
                          <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                            <CashCoin size={12} />
                            <span>Fundo de caixa:</span>
                            <span className="fw-bold">{fundoCaixaConciliarTxt}</span>
                          </span>
                        </span>
                        <span className="badge bg-success">
                          <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                            <ClipboardCheck size={12} />
                            <span>Total geral:</span>
                            <span className="fw-bold">{loadingAvulsos ? "..." : formatMoneyBR(totalConciliarGeral)}</span>
                          </span>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Fechar"
                      onClick={() => {
                        setShowConciliar(false);
                        setConciliarLoteId(null);
                        setConciliarTab("lote");
                        setConciliarCodfilial(null);
                        setRowsConciliar([]);
                        setErrorConciliar("");
                        setRowsAvulsos([]);
                        setErrorAvulsos("");
                      }}
                    />
                  </div>

                  <div className="modal-body p-0 flex-grow-1" style={{ overflow: "hidden", backgroundColor: "#f8f9fa" }}>
                    {conciliarTab === "lote" ? (
                      loadingConciliar ? (
                        <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>
                      ) : errorConciliar ? (
                        <div className="p-3">
                          <div className="alert alert-danger mb-0">{errorConciliar}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="p-2 pb-0">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="somenteConciliados"
                                checked={somenteConciliados}
                                onChange={(e) => setSomenteConciliados(e.target.checked)}
                              />
                              <label className="form-check-label" htmlFor="somenteConciliados">
                                Somente conciliados
                              </label>
                            </div>
                          </div>
                          <div className="table-responsive" style={{ height: "calc(100vh - 140px)", overflowY: "auto" }}>
                            <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.82rem" }}>
                              <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                                <tr>
                                  <th className="ps-4" style={{ width: "195px" }}>
                                    <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                                      <CalendarRange size={12} className="text-secondary" />
                                      <span>Data/Hora</span>
                                    </span>
                                  </th>
                                  <th style={{ width: "110px" }}>Nota</th>
                                  <th style={{ width: "110px" }}>TV7</th>
                                  <th className="text-center" style={{ width: "140px" }}>Duplic</th>
                                  <th style={{ width: "110px" }}>TV8</th>
                                  <th style={{ width: "90px" }}>CodCli</th>
                                  <th>Cliente</th>
                                  <th className="text-start" style={{ width: "150px" }}>Dinheiro</th>
                                  <th className="text-center" style={{ width: "110px" }}>Conciliado</th>
                                  <th className="text-center" style={{ width: "90px" }}>RCA</th>
                                  <th style={{ width: "220px" }}>Nome</th>
                                  <th className="text-center" style={{ width: "120px" }}>Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rowsConciliar.length === 0 ? (
                                  <tr>
                                  <td colSpan={12} className="text-center py-4 text-muted">Nenhum registro para este lote.</td>
                                  </tr>
                                ) : (
                                  rowsConciliar.map((rr, idx) => (
                                    <tr key={`${rr?.ID_LOTE ?? "lote"}-${rr?.NUMNOTA ?? "nota"}-${idx}`}>
                                      <td className="ps-4">{formatDateTimeBR(rr?.DATA_HORA)}</td>
                                      <td>{rr?.NUMNOTA ?? "-"}</td>
                                      <td>{rr?.NUMPED_TV7 ?? "-"}</td>
                                      <td className="text-center text-truncate" style={{ maxWidth: 160 }} title={rr?.DUPLICATA ?? ""}>{rr?.DUPLICATA ?? "-"}</td>
                                      <td>{rr?.NUMPED_TV8 ?? "-"}</td>
                                      <td>{rr?.CODCLI ?? "-"}</td>
                                      <td className="text-truncate" style={{ maxWidth: 420 }} title={rr?.CLIENTE ?? ""}>{rr?.CLIENTE ?? "-"}</td>
                                      <td className="text-start">{formatMoneyBR(rr?.VL_DINHEIRO)}</td>
                                      <td className="text-center">
                                        <span className={`badge ${String(rr?.CONCILIADO ?? "N").toUpperCase() === "S" ? "bg-success" : "bg-secondary"}`}>
                                          {String(rr?.CONCILIADO ?? "N").toUpperCase() === "S" ? "Sim" : "Não"}
                                        </span>
                                      </td>
                                      <td className="text-center">{rr?.CODUSUR ?? "-"}</td>
                                      <td className="text-truncate" style={{ maxWidth: 260 }} title={rr?.NOME ?? ""}>{rr?.NOME ?? "-"}</td>
                                      <td className="text-center">
                                        <button
                                          type="button"
                                          className="btn btn-outline-primary btn-sm py-1 px-2"
                                          style={{ fontSize: "0.75rem", lineHeight: 1.1 }}
                                          onClick={() => abrirConfirmacaoConciliarItem(rr)}
                                          disabled={
                                            loadingConciliar ||
                                            !keyConciliacaoItem(rr) ||
                                            String(rr?.CONCILIADO ?? "N").toUpperCase() === "S"
                                          }
                                        >
                                          <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                                            <Check2Circle size={14} />
                                            <span>Conciliar</span>
                                          </span>
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    ) : (
                      loadingAvulsos ? (
                        <div className="text-center py-4"><div className="spinner-border text-primary" role="status" /></div>
                      ) : errorAvulsos ? (
                        <div className="p-3">
                          <div className="alert alert-danger mb-0">{errorAvulsos}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="px-3 pt-3 pb-2 text-muted d-flex align-items-center justify-content-between" style={{ fontSize: "0.85rem" }}>
                            <div>
                              Total avulso: <span className="fw-bold">{formatMoneyBR(totalAvulsos)}</span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm py-1 px-2"
                              style={{ fontSize: "0.78rem", lineHeight: 1.1 }}
                              onClick={() => setShowAvulsoNovoLancamentoModal(true)}
                              disabled={!conciliarLoteId}
                            >
                              <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                                <FileEarmarkText size={14} />
                                <span>Novo lançamento</span>
                              </span>
                            </button>
                          </div>
                          <div className="table-responsive" style={{ height: "calc(100vh - 140px)", overflowY: "auto" }}>
                            <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.82rem" }}>
                              <thead className="table-light position-sticky top-0" style={{ zIndex: 1 }}>
                                <tr>
                                  <th className="ps-4" style={{ width: "195px" }}>
                                    <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                                      <CalendarRange size={12} className="text-secondary" />
                                      <span>Data/Hora</span>
                                    </span>
                                  </th>
                                  <th style={{ width: "110px" }}>Filial</th>
                                  <th style={{ width: "120px" }}>TV7</th>
                                  <th style={{ width: "120px" }}>TV8</th>
                                  <th style={{ width: "110px" }}>CodCli</th>
                                  <th className="text-end" style={{ width: "160px" }}>Valor</th>
                                  <th className="text-center" style={{ width: "110px" }}>RCA</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rowsAvulsos.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="text-center py-4 text-muted">Nenhum lançamento avulso para este lote.</td>
                                  </tr>
                                ) : (
                                  rowsAvulsos.map((a, idx) => (
                                    <tr key={`${a?.ID_LOTE ?? "lote"}-${a?.NUMPED_TV8 ?? "tv8"}-${idx}`}>
                                      <td className="ps-4">{formatDateTimeBR(a?.DATA_HORA)}</td>
                                      <td>{a?.CODFILIAL ?? "-"}</td>
                                      <td>{a?.NUMPED_TV7 ?? "-"}</td>
                                      <td>{a?.NUMPED_TV8 ?? "-"}</td>
                                      <td>{a?.CODCLI ?? "-"}</td>
                                      <td className="text-end">{formatMoneyBR(a?.VL_DINHEIRO_AVULSO)}</td>
                                      <td className="text-center">{a?.CODUSUR ?? "-"}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="modal-footer py-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        if (!conciliarLoteId) return;
                        if (conciliarTab === "avulso") {
                          listarAvulsosDoLote(conciliarLoteId, conciliarCodfilial);
                        } else {
                          abrirConciliar(conciliarLoteId, conciliarCodfilial);
                        }
                      }}
                      disabled={(!conciliarLoteId) || (conciliarTab === "avulso" ? loadingAvulsos : loadingConciliar)}
                    >
                      <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                        <ListUl size={14} />
                        <span>{conciliarTab === "avulso" ? "Listar avulsos" : "Listar"}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowConciliar(false);
                        setConciliarLoteId(null);
                        setShowAvulsoNovoLancamentoModal(false);
                        setRowsConciliar([]);
                        setErrorConciliar("");
                      }}
                    >
                      <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                        <XLg size={14} />
                        <span>Fechar</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showConciliar && showAvulsoNovoLancamentoModal && (
          <AvulsoNovoLancamentoModal
            show={showAvulsoNovoLancamentoModal}
            onClose={() => setShowAvulsoNovoLancamentoModal(false)}
            idLote={conciliarLoteId}
            codfilial={conciliarCodfilial}
            zIndexBase={3120}
            onSuccess={() => {
              if (conciliarLoteId) {
                listarAvulsosDoLote(conciliarLoteId, conciliarCodfilial);
              }
              buscar();
            }}
          />
        )}

        {showConciliar && showConfirmConciliarItem && (
          <div>
            <div className="modal-backdrop fade show" style={{ zIndex: 3110, backgroundColor: "rgba(0,0,0,0.35)", position: "fixed", inset: 0 }} />
            <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3115, position: "fixed", inset: 0 }}>
              <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content" style={{ fontSize: "0.95rem" }}>
                  <div className="modal-header py-2">
                    <h5 className="modal-title d-inline-flex align-items-center" style={{ fontSize: "1rem", gap: "8px" }}>
                      <Check2Circle size={18} className="text-primary" />
                      <span>Confirmar Conciliação</span>
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Fechar"
                      onClick={() => {
                        setShowConfirmConciliarItem(false);
                        setConfirmConciliarItem(null);
                      }}
                      disabled={loadingConciliar}
                    />
                  </div>

                  <div className="modal-body">
                    <div className="mb-2 text-muted" style={{ fontSize: "0.9rem" }}>
                      Deseja conciliar esta linha?
                    </div>
                    <div className="border rounded bg-light p-2" style={{ fontSize: "0.9rem" }}>
                      <div className="row g-2">
                        <div className="col-6">
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>Data/Hora</div>
                          <div className="fw-bold">{formatDateTimeBR(confirmConciliarItem?.DATA_HORA)}</div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>Dinheiro</div>
                          <div className="fw-bold">{formatMoneyBR(confirmConciliarItem?.VL_DINHEIRO)}</div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>Nota</div>
                          <div className="fw-bold">{confirmConciliarItem?.NUMNOTA ?? "-"}</div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>Duplicata</div>
                          <div className="fw-bold">{confirmConciliarItem?.DUPLICATA ?? "-"}</div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>TV7</div>
                          <div className="fw-bold">{confirmConciliarItem?.NUMPED_TV7 ?? "-"}</div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>TV8</div>
                          <div className="fw-bold">{confirmConciliarItem?.NUMPED_TV8 ?? "-"}</div>
                        </div>
                        <div className="col-12">
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>Cliente</div>
                          <div className="fw-bold text-truncate" title={confirmConciliarItem?.CLIENTE ?? ""}>
                            {confirmConciliarItem?.CLIENTE ?? "-"}
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>RCA</div>
                          <div className="fw-bold">{confirmConciliarItem?.CODUSUR ?? "-"}</div>
                        </div>
                        <div className="col-6">
                          <div className="text-muted" style={{ fontSize: "0.75rem" }}>Nome</div>
                          <div className="fw-bold text-truncate" title={confirmConciliarItem?.NOME ?? ""}>
                            {confirmConciliarItem?.NOME ?? "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer py-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowConfirmConciliarItem(false);
                        setConfirmConciliarItem(null);
                      }}
                      disabled={loadingConciliar}
                    >
                      <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                        <XLg size={14} />
                        <span>Cancelar</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={confirmarConciliacaoItem}
                      disabled={
                        loadingConciliar ||
                        !confirmConciliarItem ||
                        !keyConciliacaoItem(confirmConciliarItem)
                      }
                    >
                      <span className="d-inline-flex align-items-center" style={{ gap: "6px" }}>
                        <Check2Circle size={14} />
                        <span>Confirmar</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  type MenuItem = {
    title: string;
    Icon: React.ComponentType<{ size?: number | string; className?: string }>;
    color: string;
    labelLines: [string, string?];
  };

  const menuItems: MenuItem[] = [
    { title: "Dashboard", Icon: House, color: "primary", labelLines: ["Dashboard"] },
    { title: "Logística", Icon: Truck, color: "primary", labelLines: ["Logística"] },
    { title: "Contas à Receber", Icon: CashCoin, color: "success", labelLines: ["Contas", "Receber"] },
    { title: "Contas à Pagar", Icon: FileEarmarkText, color: "danger", labelLines: ["Contas", "Pagar"] },
    { title: "Vendas Carteira", Icon: Wallet2, color: "warning", labelLines: ["Vendas", "Carteira"] },
    { title: "Auditoria", Icon: ClipboardCheck, color: "info", labelLines: ["Auditoria"] },
    { title: "Fiscal", Icon: FileEarmarkRuled, color: "dark", labelLines: ["Fiscal"] },
  ];

  const renderContent = () => {
    if (selectedItem === "Dashboard") {
      return <Dashboard />;
    }

    if (selectedItem === "Logística") {
      return <Logistica />;
    }

    if (selectedItem === "Contas à Pagar") {
      return <ContasApagar onClose={() => setSelectedItem("Dashboard")} />;
    }

    if (selectedItem === "Contas à Receber") {
      return <SangriaLotesFinalizados />;
    }

    if (selectedItem === "Vendas Carteira") {
      return <VendasCarteira />;
    }

    const item = menuItems.find(i => i.title === selectedItem);
    const SelectedIcon = item?.Icon;
    return (
      <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
        <div className={`text-${item?.color} mb-3`} style={{ fontSize: "3rem" }}>
          {SelectedIcon ? <SelectedIcon size={52} /> : null}
        </div>
        <h3>{selectedItem}</h3>
        <p>Conteúdo em desenvolvimento...</p>
      </div>
    );
  };

  return (
    <div
      className="d-flex flex-column"
      style={{
        fontFamily: "'Poppins', sans-serif",
        minHeight: "100vh",
        backgroundColor: "#f8f9fa",
      }}
    >
      {/* Header */}
      <TopBar
        title=""
        titleClassName="d-none"
        showBack={true}
        backLink="/dashboard"
      >
        <div className="d-flex flex-wrap align-items-center ms-0" style={{ columnGap: "1.15rem", rowGap: "0.75rem" }}>
          {menuItems.map((item) => {
            const active = selectedItem === item.title;
            const Icon = item.Icon;
            return (
              <div
                key={item.title}
                className="d-flex flex-column align-items-center"
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedItem(item.title)}
                title={item.title}
              >
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Icon size={28} className={active ? `text-${item.color}` : "text-secondary"} />
                </div>
                <div className="text-muted" style={topBarLabelStyle}>
                  <div>{item.labelLines[0]}</div>
                  {item.labelLines[1] ? <div>{item.labelLines[1]}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </TopBar>

      {/* Conteúdo */}
      <div className="d-flex flex-grow-1 overflow-hidden border-top">
        <div className="flex-grow-1 p-0 bg-light overflow-auto">
          <div className="card shadow-sm h-100 border-0 rounded-0">
            <div className="card-body p-0">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-top">
        <div className="container-fluid py-3 d-flex justify-content-between align-items-center">
          <span className="text-muted" style={{ fontSize: "0.85rem" }}>
            © 2026 GestFácil - Concilia
          </span>
          <a href="/dashboard" className="text-decoration-none">Voltar ao Dashboard</a>
        </div>
      </footer>
    </div>
  );
};

export default OfxConcilia;
