import React, { useEffect, useMemo, useState } from "react";
import {
  criarAdiantamento,
  type AdiantamentoPayload,
  type AdiantamentoResponse,
} from "../../services/gestfin/Adiantamento";
import {
  buscarProximoRecnum,
  buscarFornecedores,
  type FornecedorItem,
} from "../../services/gestfin/NovoLancamento";
import BuscarFornecedorModal from "./BuscarFornecedorModal";
import { buscarLancamentosParciais, type LancamentoParcialRow } from "../../services/gestfin/BuscarLancamentosParciais";

interface ResumoOfx {
  ID_IMPORTACAO_OFX?: number | string | null;
  DATA_TRANSACAO?: string | null;
  VALOR_TRANSACAO?: number | string | null;
  HISTORICO?: string | null;
}

interface ModalAdiantamentoProps {
  isOpen: boolean;
  onClose: () => void;
  resumoOfx: ResumoOfx;
  nomeFunc?: string;
  onSuccess?: (recnum?: number, response?: AdiantamentoResponse) => void;
}

const ModalAdiantamento: React.FC<ModalAdiantamentoProps> = ({ isOpen, onClose, resumoOfx, nomeFunc: nomeFuncProp, onSuccess }) => {
  const toNumber = (val: unknown): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return val;
    let s = String(val).replace(/[^0-9.,-]/g, "").trim();
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else if (hasComma && !hasDot) {
      s = s.replace(/,/g, ".");
    } else if (!hasComma && hasDot) {
      // Se só há pontos, decidir se são milhares (pt-BR) ou decimal.
      // Caso clássico de milhares: grupos 1-3 dígitos seguidos de . e 3 dígitos (ex.: 9.000, 34.758)
      const isThousands = /^\d{1,3}(\.\d{3})+$/.test(s);
      if (isThousands) {
        s = s.replace(/\./g, ''); // remove separadores de milhar
      } else {
        // trata como decimal, mantendo apenas o último ponto como separador decimal
        const parts = s.split('.');
        if (parts.length > 2) {
          s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
        }
      }
    }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};


  // Exibe moeda pt-BR a partir de número ou string, sem símbolo
  const displayCurrency = (v?: number | string | null): string => {
    const n = typeof v === 'number' ? v : toNumber(v ?? 0);
    try {
      return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
    }
  };

  const formatarValor = (valor: number | string | null | undefined) => {
    const v = toNumber(valor ?? 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  };

  const formatISODateToBR = (iso?: string | null): string | null => {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
  };

  const toSingleLine = (v?: string | null) => String(v ?? "").replace(/\s+/g, " ").trim();

  const [form, setForm] = useState<AdiantamentoPayload & { ecNumPrinc?: number | null }>({
    recnum: 0,
    codConta: 0,
    codFornec: 0,
    historico: "",
    duplic: "1",
    valor: 0,
    dtVencBind: "",
    dtLancBind: "",
    dtCompetenciaBind: "",
    dtEmissaoBind: "",
    codFilial: 0,
    indice: "A",
    tipoLanc: "",
    tipoParceiro: "F",
    nomeFunc: "",
    historico2: "",
    moeda: "R",
    recNumPrinc: null,
    nfServicoBind: "",
    numNotaBind: null,
    codRotinaCad: "MULTGEST",
    codRotinaAlt: "MULTGEST",
    parcela: 1,
    vlrUtilizadoAdiantFornec: 0,
    lacreDigConecSocial: "0",
    tiposervico: "",
    opcaoPagamentoIpva: null,
    utilizouRateioConta: "N",
    prcRateioUtilizado: 100,
    reinFEventor4040: "N",
    ecNumPrinc: null,
    idImportacaoOFX: resumoOfx?.ID_IMPORTACAO_OFX ? Number(resumoOfx.ID_IMPORTACAO_OFX) : undefined,
  });
  const [erro, setErro] = useState<string>("");
  const [salvando, setSalvando] = useState<boolean>(false);
  const [sucesso, setSucesso] = useState<string>("");
  const [recnumLoading, setRecnumLoading] = useState<boolean>(false);
  const [showBuscaFornec, setShowBuscaFornec] = useState<boolean>(false);
  const [nomeFornec, setNomeFornec] = useState<string>("");
  const [termFornec, setTermFornec] = useState<string>("");
  const [loadingBuscaFornec, setLoadingBuscaFornec] = useState<boolean>(false);
  const [resultadosFornecs, setResultadosFornecs] = useState<FornecedorItem[]>([]);
  const [rowsParciais, setRowsParciais] = useState<LancamentoParcialRow[]>([]);
  const [loadingParciais, setLoadingParciais] = useState<boolean>(false);
  const [erroParciais, setErroParciais] = useState<string | null>(null);

  // Cálculo de totais e restante permitido considerando parciais (Valor + Juros - Desconto)
  const valorTransacaoPositivo = useMemo(() => Math.abs(toNumber(resumoOfx?.VALOR_TRANSACAO ?? 0)), [resumoOfx]);
  const totalParciais = useMemo(() => {
    return rowsParciais.reduce((acc, r) => {
      const v = typeof r.VALOR_NUM === 'number' ? r.VALOR_NUM : toNumber(r.VALOR_FORMATADO);
      const j = typeof r.JUROS_NUM === 'number' ? r.JUROS_NUM : toNumber(r.JUROS);
      const d = typeof r.DESCONTOFIN_NUM === 'number' ? r.DESCONTOFIN_NUM : toNumber(r.DESCONTOFIN);
      return acc + (v + j - d);
    }, 0);
  }, [rowsParciais]);
  const centsTransacao = useMemo(() => Math.abs(Math.round(valorTransacaoPositivo * 100)), [valorTransacaoPositivo]);
  const centsParciais = useMemo(() => Math.max(0, Math.round(totalParciais * 100)), [totalParciais]);
  const centsRestante = useMemo(() => Math.max(0, centsTransacao - centsParciais), [centsTransacao, centsParciais]);

  useEffect(() => {
    if (!isOpen) {
      setErro("");
      setSucesso("");
      setSalvando(false);
      setNomeFornec("");
      setTermFornec("");
      setResultadosFornecs([]);
      setForm({
        recnum: 0,
        codConta: 0,
        codFornec: 0,
        historico: "",
        duplic: "1",
        valor: 0,
        dtVencBind: "",
        dtLancBind: "",
        dtCompetenciaBind: "",
        dtEmissaoBind: "",
        codFilial: 0,
        indice: "A",
        tipoLanc: "",
        tipoParceiro: "F",
        nomeFunc: "",
        historico2: "",
        moeda: "R",
        recNumPrinc: null,
        nfServicoBind: "",
        numNotaBind: null,
        codRotinaCad: "MULTGEST",
        codRotinaAlt: "MULTGEST",
        parcela: 1,
        vlrUtilizadoAdiantFornec: 0,
        lacreDigConecSocial: "0",
        tiposervico: "",
        opcaoPagamentoIpva: null,
        utilizouRateioConta: "N",
        prcRateioUtilizado: 100,
        reinFEventor4040: "N",
        ecNumPrinc: null,
        idImportacaoOFX: resumoOfx?.ID_IMPORTACAO_OFX ? Number(resumoOfx.ID_IMPORTACAO_OFX) : undefined,
      });
    } else {
      setForm((prev: any) => ({
        ...prev,
        dtLancBind: "",
        dtCompetenciaBind: "",
        dtVencBind: "",
        dtEmissaoBind: "",
        recnum: 0,
        recNumPrinc: null,
        nomeFunc: nomeFuncProp || "",
        idImportacaoOFX: resumoOfx?.ID_IMPORTACAO_OFX ? Number(resumoOfx.ID_IMPORTACAO_OFX) : undefined,
      }));
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchRecnum = async () => {
      if (!isOpen) return;
      try {
        setRecnumLoading(true);
        const reservado = await buscarProximoRecnum();
        if (reservado && Number(reservado) > 0) {
          setForm((prev) => ({ ...prev, recnum: Number(reservado), recNumPrinc: Number(reservado) }));
        }
      } catch (e: any) {
        setErro(e?.message || "Falha ao obter RECNUM");
      } finally {
        setRecnumLoading(false);
      }
    };
    fetchRecnum();
  }, [isOpen]);

  // Buscar Lançamentos Parciais vinculados ao ID OFX
  useEffect(() => {
    if (!isOpen) {
      setRowsParciais([]);
      setErroParciais(null);
      return;
    }
    const idOfx = resumoOfx?.ID_IMPORTACAO_OFX;
    const idNum = idOfx != null ? Number(idOfx) : 0;
    if (!idNum || !Number.isFinite(idNum) || idNum <= 0) {
      setRowsParciais([]);
      setErroParciais(null);
      return;
    }

    let mounted = true;
    setLoadingParciais(true);
    setErroParciais(null);
    buscarLancamentosParciais(idNum)
      .then((rows) => { if (mounted) setRowsParciais(rows); })
      .catch((e) => { if (mounted) setErroParciais(String(e?.message || e)); })
      .finally(() => { if (mounted) setLoadingParciais(false); });

    return () => { mounted = false; };
  }, [isOpen, resumoOfx?.ID_IMPORTACAO_OFX]);

  // Prefill do campo Valor com o restante permitido (apenas se ainda não houver valor digitado)
  useEffect(() => {
    if (!isOpen) return;
    if (rowsParciais.length > 0) {
      const valorAtual = Number(form.valor || 0);
      const novoValor = centsRestante / 100;
      if (!valorAtual) {
        setForm((prev) => ({ ...prev, valor: novoValor }));
      }
    }
  }, [isOpen, rowsParciais, centsRestante]);

  const setVal = (k: keyof (AdiantamentoPayload & { ecNumPrinc?: number | null }), v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  const onSubmit = async () => {
    setErro("");
    setSucesso("");

    const labelMap: Record<string, string> = {
      recnum: "Recnum",
      recNumPrinc: "Rec. Princ.",
      codFilial: "Filial",
      tipoLanc: "Tipo Lanç.",
      codConta: "Cod. Conta",
      tipoParceiro: "Tipo Parceiro",
      codFornec: "Cod. Fornec",
      historico: "Histórico",
      dtLancBind: "Dt. Lançamento",
      dtVencBind: "Dt. Vencimento",
      dtCompetenciaBind: "Dt. Competência",
      dtEmissaoBind: "Dt. Emissão",
      valor: "Valor",
      tiposervico: "Tipo Serviço",
      nfServicoBind: "Tipo de Nota",
      numNotaBind: "Número Nota",
    };

    const missing: string[] = [];
    if (!form.recnum || Number(form.recnum) === 0) missing.push("recnum");
    if (!form.recNumPrinc || Number(form.recNumPrinc) === 0) missing.push("recNumPrinc");
    if (!form.codConta || Number(form.codConta) === 0) missing.push("codConta");
    if (!String(form.historico || "").trim()) missing.push("historico");
    if (!form.valor || Number(form.valor) === 0) missing.push("valor");
    if (!String(form.dtVencBind || "").trim()) missing.push("dtVencBind");
    if (!String(form.dtLancBind || "").trim()) missing.push("dtLancBind");
    if (!String(form.dtCompetenciaBind || "").trim()) missing.push("dtCompetenciaBind");
    if (!String(form.dtEmissaoBind || "").trim()) missing.push("dtEmissaoBind");
    
    // Validação dos parciais: Valor digitado deve ser exatamente o restante permitido
    if (rowsParciais.length > 0) {
      const valorDigitado = Math.max(0, Number(form.valor || 0));
      const centsDigitado = Math.round(valorDigitado * 100);
      if (centsDigitado !== centsRestante) {
        const fmt = (n: number) => {
          try { return (n/100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
          catch { return `R$ ${(n/100).toFixed(2).replace('.', ',')}`; }
        };
        setErro(
          `Valor inválido: total dos parciais (${fmt(centsParciais)}) + valor digitado (${fmt(centsDigitado)}) ` +
          `devem somar exatamente o valor da transação (${fmt(centsTransacao)}). ` +
          `Restante permitido: ${fmt(centsRestante)}.`
        );
        return;
      }
    }
    if (!form.codFilial || Number(form.codFilial) === 0) missing.push("codFilial");
    if (!String(form.tipoLanc || "").trim()) missing.push("tipoLanc");
    if (!String(form.tipoParceiro || "").trim()) missing.push("tipoParceiro");
    if (!String(form.tiposervico || "").trim()) missing.push("tiposervico");
    if (!String(form.nfServicoBind || "").trim()) missing.push("nfServicoBind");
    if ((form.nfServicoBind === "N" || form.nfServicoBind === "S") && (!form.numNotaBind || Number(form.numNotaBind) === 0)) {
      missing.push("numNotaBind");
    }
    if (form.tipoParceiro === "F" && (!form.codFornec || Number(form.codFornec) === 0)) {
      missing.push("codFornec");
    }
    if (missing.length) {
      const missingLabels = missing.map((k) => labelMap[k] || k);
      setErro(`Campos obrigatórios faltando: ${missingLabels.join(", ")}`);
      return;
    }

    const toDDMMYYYY = (iso: string): string => {
      if (!iso) return "";
      const [y, m, d] = iso.split("-");
      if (y && m && d) return `${d}/${m}/${y}`;
      return iso;
    };

    const nfServicoDB = form.nfServicoBind === "SN" ? "N" : String(form.nfServicoBind || "");
    const numNotaDB = form.nfServicoBind === "SN" ? 0 : (form.numNotaBind ? Number(form.numNotaBind) : 0);

    const payload: AdiantamentoPayload = {
      recnum: Number(form.recnum),
      codConta: Number(form.codConta),
      codFornec: Number(form.codFornec || 0),
      fornecedor: nomeFornec ? String(nomeFornec).slice(0, 100) : undefined,
      historico: String(form.historico),
      duplic: String(form.duplic),
      valor: Number(form.valor),
      dtVencBind: toDDMMYYYY(String(form.dtVencBind)),
      dtLancBind: toDDMMYYYY(String(form.dtLancBind)),
      dtCompetenciaBind: toDDMMYYYY(String(form.dtCompetenciaBind)),
      dtEmissaoBind: toDDMMYYYY(String(form.dtEmissaoBind)),
      codFilial: Number(form.codFilial),
      indice: String(form.indice),
      tipoLanc: String(form.tipoLanc),
      tipoParceiro: String(form.tipoParceiro),
      nomeFunc: form.nomeFunc || "",
      historico2: form.historico2 || "",
      moeda: String(form.moeda),
      recNumPrinc: form.recNumPrinc ? Number(form.recNumPrinc) : null,
      nfServicoBind: nfServicoDB,
      numNotaBind: numNotaDB,
      codRotinaCad: "MULTGEST",
      codRotinaAlt: "MULTGEST",
      parcela: Number(form.parcela ?? 1),
      vlrUtilizadoAdiantFornec: Number(form.vlrUtilizadoAdiantFornec ?? 0),
      lacreDigConecSocial: form.lacreDigConecSocial ?? null,
      tiposervico: String(form.tiposervico ?? "99"),
      opcaoPagamentoIpva: form.opcaoPagamentoIpva ?? null,
      utilizouRateioConta: String(form.utilizouRateioConta ?? "N"),
      prcRateioUtilizado: Number(form.prcRateioUtilizado ?? 100),
      reinFEventor4040: String(form.reinFEventor4040 ?? "N"),
      juros: 0,
      idImportacaoOFX: form.idImportacaoOFX,
      // Envia o codusur (matrícula) convertido para número
      codusurBind: (() => {
        try {
          const raw = typeof window !== "undefined" ? localStorage.getItem("usuarioLogado") : null;
          const usuario = raw ? JSON.parse(raw) : {};
          const m = Number(usuario?.matricula);
          return Number.isFinite(m) && m > 0 ? m : undefined;
        } catch {
          return undefined;
        }
      })(),
    };

    try {
      setSalvando(true);
      const resp = await criarAdiantamento(payload);
      setSucesso(`Adiantamento salvo. RECNUM: ${resp?.recnum ?? "-"}`);
      if (resp?.recnum) {
        setForm((prev) => ({ ...prev, recnum: Number(resp.recnum), recNumPrinc: Number(resp.recnum) }));
        onClose();
        if (typeof onSuccess === "function") onSuccess(Number(resp.recnum), resp);
      }
    } catch (e: any) {
      setErro(e?.message || "Falha ao salvar adiantamento");
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2995 }} />
      <div className="modal fade show" role="dialog" aria-modal="true" aria-labelledby="modalAdiantamentoTitulo" style={{ display: "block", zIndex: 3000 }}>
        <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "720px" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header">
              <h5 className="modal-title" id="modalAdiantamentoTitulo" style={{ fontSize: "0.9rem" }}>Adiantamento a Fornecedor</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>

            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, "--input-font-size": "0.7rem" } as React.CSSProperties}>
              {erro && <div className="alert alert-danger">{erro}</div>}
              {sucesso && <div className="alert alert-success">{sucesso}</div>}

              <div className="row mb-3">
                <div className="col-md-12">
                  <h6 className="text-success mb-3" style={{ fontSize: "0.8rem" }}>Resumo do Lançamento (OFX)</h6>
                </div>
              </div>

              <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.65rem" }}>
                <tbody>
                  <tr>
                    <td><strong>ID Importação OFX:</strong></td>
                    <td>{resumoOfx?.ID_IMPORTACAO_OFX ?? '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Dt. Trans.:</strong></td>
                    <td>{formatISODateToBR(resumoOfx?.DATA_TRANSACAO) ?? '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Valor Transação:</strong></td>
                    <td className="text-end">
                      <span className={toNumber(resumoOfx?.VALOR_TRANSACAO) < 0 ? 'text-danger' : 'text-success'}>
                        {formatarValor(resumoOfx?.VALOR_TRANSACAO)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Histórico OFX:</strong></td>
                    <td style={{ whiteSpace: 'nowrap', wordBreak: 'normal' }}>
                      {toSingleLine(resumoOfx?.HISTORICO ?? '')}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Lançamentos Parciais (OFX) */}
              <div className="mb-2 d-flex align-items-center justify-content-between">
                <span className="badge bg-secondary">Lançamentos Parciais (OFX)</span>
                {loadingParciais && <span className="text-muted" style={{ fontSize: "0.7rem" }}>Carregando...</span>}
              </div>
              {erroParciais && (
                <div className="alert alert-warning py-1" style={{ fontSize: "0.7rem" }}>{erroParciais}</div>
              )}
              <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.65rem" }}>
                <thead>
                  <tr>
                    <th className="text-center">RECNUM</th>
                    <th>Fornecedor</th>
                    <th className="text-end">Valor</th>
                    <th className="text-end">Juros</th>
                    <th className="text-end">Desc.</th>
                    <th>Num. Nota</th>
                    <th>Histórico</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsParciais.length === 0 && !loadingParciais && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted">Nenhum lançamento parcial encontrado.</td>
                    </tr>
                  )}
                  {rowsParciais.map((r) => (
                    <tr key={r.RECNUM}>
                      <td className="text-center">{r.RECNUM}</td>
                      <td>{r.FORNECEDOR ?? '-'}</td>
                      <td className="text-end">{displayCurrency(r.VALOR_NUM ?? r.VALOR_FORMATADO)}</td>
                      <td className="text-end">{displayCurrency(r.JUROS_NUM ?? r.JUROS)}</td>
                      <td className="text-end">{displayCurrency(r.DESCONTOFIN_NUM ?? r.DESCONTOFIN)}</td>
                      <td>{r.NUMNOTA ?? '-'}</td>
                      <td className="text-wrap text-break" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.HISTORICO ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Resumo dos parciais e restante permitido (alerta laranja) */}
              <div className="alert alert-warning py-2" style={{ fontSize: "0.7rem" }}>
                <div>Transação (OFX): {(() => { try { return (centsTransacao/100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch { return `R$ ${(centsTransacao/100).toFixed(2).replace('.', ',')}`; } })()}</div>
                <div>Total Parciais: {(() => { try { return (centsParciais/100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch { return `R$ ${(centsParciais/100).toFixed(2).replace('.', ',')}`; } })()}</div>
                <div>Restante Permitido: {(() => { try { return (centsRestante/100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch { return `R$ ${(centsRestante/100).toFixed(2).replace('.', ',')}`; } })()}</div>
                {rowsParciais.length > 0 && (
                  <div className="mt-1">O valor do adiantamento deve ser exatamente o restante permitido para que a soma (parciais + adiantamento) iguale a transação.</div>
                )}
              </div>

              {/* Formulário baseado em ModalNovoLancamento */}
              <div className="row g-2">
                <div className="col-12 col-md-3">
                  <label className="form-label">Recnum</label>
                  <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.recnum || ""} placeholder={recnumLoading ? "Carregando..." : ""} readOnly />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Rec. Princ.</label>
                  <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={(form.recNumPrinc ?? form.recnum) || ""} placeholder={recnumLoading ? "Carregando..." : ""} readOnly />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Filial</label>
                  <select className="form-select form-select-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.codFilial} onChange={(e) => setVal("codFilial", Number(e.target.value))} required>
                    <option value={0}>Selecione</option>
                    <option value={1}>Messejana</option>
                    <option value={2}>Horizonte</option>
                    <option value={3}>CD</option>
                    <option value={4}>Santa Maria</option>
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Tipo Lanç.</label>
                  <select className="form-select form-select-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.tipoLanc} onChange={(e) => setVal("tipoLanc", e.target.value)} required>
                    <option value="">Selecione</option>
                    <option value="C">Confirmado</option>
                    <option value="P">Provisão</option>
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Tipo Serviço</label>
                  <select
                    className="form-select form-select-sm"
                    style={{ fontSize: "0.7rem", height: "28px" }}
                    value={form.tiposervico ?? ""}
                    onChange={(e) => setVal("tiposervico", e.target.value)}
                    required
                  >
                    <option value="">Selecione</option>
                    <option value="20">20 - Pgto a Fonecedor</option>
                    <option value="99">99 - Outros Pgtos</option>
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Conta</label>
                  <select
                    className="form-select form-select-sm"
                    style={{ fontSize: "0.7rem", height: "28px" }}
                    value={Number(form.codConta ?? 0)}
                    onChange={(e) => setVal("codConta", Number(e.target.value || "0"))}
                    required
                  >
                    <option value={0}>Selecione</option>
                    <option value={250998}>Adiantamento à Fornec. Outros</option>
                    <option value={250999}>Adiantamento à Fornec. Compra de Mercadoria</option>
                  </select>
                </div>
                {/* Tipo Parceiro fixo: sempre Fornecedor (F). Campo oculto e valor padrão aplicado no estado. */}
                {form.tipoParceiro === "F" && (
                  <div className="col-12 col-md-6">
                    <label className="form-label">Cod. Fornec</label>
                    <div className="input-group input-group-sm">
                      <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} placeholder="Selecione" value={form.codFornec || ""} onChange={(e) => { setVal("codFornec", Number(e.target.value || "0")); if (!e.target.value) setNomeFornec(""); }} required />
                      <button className="btn btn-outline-primary btn-sm py-1 px-2" type="button" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={() => { setErro(""); setSucesso(""); setTermFornec(""); setResultadosFornecs([]); setShowBuscaFornec(true); }}>Buscar</button>
                    </div>
                    {nomeFornec && <small className="text-muted d-block mt-1 text-truncate" title={nomeFornec}>{nomeFornec}</small>}
                  </div>
                )}
                <div className="col-12 col-md-6">
                  <label className="form-label">Histórico</label>
                  <input type="text" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.historico} onChange={(e) => setVal("historico", e.target.value)} required />
                </div>
                {/* Campos padrão ocultos: Duplic, Parcela, Moeda, Índice */}
                <div className="col-12 col-md-3">
                  <label className="form-label">Dt. Lançamento</label>
                  <input type="date" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.dtLancBind || ""} onChange={(e) => setVal("dtLancBind", e.target.value)} required />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Dt. Vencimento</label>
                  <input type="date" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.dtVencBind || ""} onChange={(e) => setVal("dtVencBind", e.target.value)} required />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Dt. Competência</label>
                  <input type="date" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.dtCompetenciaBind || ""} onChange={(e) => setVal("dtCompetenciaBind", e.target.value)} required />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Dt. Emissão</label>
                  <input type="date" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.dtEmissaoBind || ""} onChange={(e) => setVal("dtEmissaoBind", e.target.value)} required />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Valor</label>
                  <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} placeholder="Selecione" value={form.valor || ""} onChange={(e) => setVal("valor", toNumber(e.target.value))} required />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Tipo de Nota</label>
                  <select className="form-select form-select-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.nfServicoBind || ""} onChange={(e) => setVal("nfServicoBind", e.target.value)} required>
                    <option value="">Selecione</option>
                    <option value="N">NF-e</option>
                    <option value="S">NF-s</option>
                    <option value="SN">Sem Nota</option>
                  </select>
                </div>
                {form.nfServicoBind !== "SN" && (
                  <div className="col-12 col-md-3">
                    <label className="form-label">Número Nota</label>
                    <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.numNotaBind ?? ""} onChange={(e) => setVal("numNotaBind", Number(e.target.value || "0"))} />
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-sm py-1 px-2" onClick={onClose} style={{ fontSize: "0.7rem", lineHeight: 1.1 }}>Fechar</button>
              <button type="button" className="btn btn-primary btn-sm py-1 px-2 d-inline-flex align-items-center" onClick={onSubmit} disabled={salvando} style={{ fontSize: "0.7rem", lineHeight: 1.1 }}>
                {salvando && (
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                )}
                {salvando ? "Salvando..." : "Salvar Adiantamento"}
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* Modal de Busca de Fornecedores */}
      <BuscarFornecedorModal
        isOpen={showBuscaFornec}
        term={termFornec}
        onTermChange={setTermFornec}
        onBuscar={async () => {
          setLoadingBuscaFornec(true);
          try {
            const termo = termFornec.trim();
            const dados = await buscarFornecedores({ nomeFornecedor: termo, codigoFornecedor: termo });
            setResultadosFornecs(dados);
          } catch (e: any) {
            setErro(e?.message || "Falha na busca de fornecedores");
          } finally {
            setLoadingBuscaFornec(false);
          }
        }}
        loading={loadingBuscaFornec}
        resultados={resultadosFornecs}
        onSelect={(it) => {
          setForm((prev) => ({ ...prev, codFornec: Number(it.CODFORNEC) }));
          setNomeFornec(it.FORNECEDOR);
          setShowBuscaFornec(false);
        }}
        onClose={() => setShowBuscaFornec(false)}
      />
    </>
  );
};

export default ModalAdiantamento;