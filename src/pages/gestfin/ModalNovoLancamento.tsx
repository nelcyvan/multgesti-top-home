import React, { useEffect, useState } from "react";
import {
  criarNovoLancamento,
  buscarProximoRecnum,
  buscarContas,
  buscarFornecedores,
  type NovoLancamentoPayload,
  type ContaItem,
  type FornecedorItem,
} from "../../services/gestfin/NovoLancamento";
import { atualizarLancamento, type AtualizarLancamentoPayload } from "../../services/gestfin/AtualizarLancamento";
import BuscarContaModal from "./BuscarContaModal";
import BuscarFornecedorModal from "./BuscarFornecedorModal";
import { type DuplicataRow } from "../../services/gestfin/BuscarDuplicatas";

interface ModalNovoLancamentoProps {
  isOpen: boolean;
  onClose: () => void;
  nomeFunc?: string;
  onSuccess?: (recnum?: number) => void;
  mode?: "create" | "update";
  prefillFromDuplicata?: DuplicataRow | null;
  defaultCodFilial?: number;
}

const ModalNovoLancamento: React.FC<ModalNovoLancamentoProps> = ({ isOpen, onClose, nomeFunc: nomeFuncProp, onSuccess, mode = "create", prefillFromDuplicata, defaultCodFilial }) => {
  const [form, setForm] = useState<NovoLancamentoPayload & { ecNumPrinc?: number | null }>({
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
    tipoParceiro: "",
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
  });
  const [erro, setErro] = useState<string>("");
  const [salvando, setSalvando] = useState<boolean>(false);
  const [sucesso, setSucesso] = useState<string>("");
  const [recnumLoading, setRecnumLoading] = useState<boolean>(false);
  const [showBuscaConta, setShowBuscaConta] = useState<boolean>(false);
  const [showBuscaFornec, setShowBuscaFornec] = useState<boolean>(false);
  const [nomeConta, setNomeConta] = useState<string>("");
  const [nomeFornec, setNomeFornec] = useState<string>("");
  const [termConta, setTermConta] = useState<string>("");
  const [termFornec, setTermFornec] = useState<string>("");
  const [loadingBuscaConta, setLoadingBuscaConta] = useState<boolean>(false);
  const [loadingBuscaFornec, setLoadingBuscaFornec] = useState<boolean>(false);
  const [resultadosContas, setResultadosContas] = useState<ContaItem[]>([]);
  const [resultadosFornecs, setResultadosFornecs] = useState<FornecedorItem[]>([]);

  const brToISO = (br?: string): string => {
    if (!br) return "";
    const [dd, mm, yyyy] = String(br).split("/");
    if (dd && mm && yyyy) return `${yyyy}-${mm}-${dd}`;
    return "";
  };

  const moedaBRLToNumber = (val?: unknown): number => {
    if (val == null) return 0;
    const s = String(val);
    const clean = s.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(/,/g, ".");
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : 0;
  };

  useEffect(() => {
    if (!isOpen) {
      // Ao fechar, volta os inputs ao padrão de início
      setErro("");
      setSucesso("");
      setSalvando(false);
      setNomeConta("");
      setNomeFornec("");
      setTermConta("");
      setTermFornec("");
      setResultadosContas([]);
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
        tipoParceiro: "",
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
      });
    } else {
      // Ao abrir, define nome do usuário e ajusta conforme modo
      if (mode === "update" && prefillFromDuplicata) {
        const d = prefillFromDuplicata;
        setNomeConta(d.CONTA || "");
        setNomeFornec(d.FORNECEDOR || "");
        const codFornecNum = Number(d.CODFORNEC || 0);
        const fornecName = String(d.FORNECEDOR ?? "").trim();
        const tipoParceiroComputed = codFornecNum > 0 && fornecName !== "-" ? "F" : "O";
        const tiposervicoComputed = tipoParceiroComputed === "F" ? "20" : "99";
        setForm((prev: any) => ({
          ...prev,
          recnum: Number(d.RECNUM),
          recNumPrinc: Number(d.RECNUM),
          codConta: Number(d.CODCONTA || 0),
          codFornec: tipoParceiroComputed === "F" ? codFornecNum : 0,
          historico: String(d.HISTORICO || ""),
          duplic: String(d.DUPLIC || prev.duplic || "1"),
          valor: moedaBRLToNumber(d.VALOR),
          dtLancBind: brToISO(d.DTLANC),
          dtCompetenciaBind: brToISO(d.DTLANC),
          dtVencBind: brToISO(d.DTVENC),
          dtEmissaoBind: brToISO(d.DTEMISSAO),
          codFilial: defaultCodFilial && defaultCodFilial > 0 ? Number(defaultCodFilial) : 0,
          indice: prev.indice || "A",
          tipoLanc: prev.tipoLanc || "",
          tipoParceiro: tipoParceiroComputed,
          nomeFunc: nomeFuncProp || "",
          historico2: prev.historico2 || "",
          moeda: prev.moeda || "R",
          nfServicoBind: d.NUMNOTA && Number(d.NUMNOTA) > 0 ? "N" : "SN",
          numNotaBind: d.NUMNOTA && Number(d.NUMNOTA) > 0 ? Number(d.NUMNOTA) : 0,
          parcela: prev.parcela ?? 1,
          utilizouRateioConta: prev.utilizouRateioConta || "N",
          prcRateioUtilizado: prev.prcRateioUtilizado ?? 100,
          tiposervico: tiposervicoComputed,
        }));
      } else {
        // Modo create: limpa campos de data e define nome do usuário
        setForm((prev: any) => ({
          ...prev,
          dtLancBind: "",
          dtCompetenciaBind: "",
          dtVencBind: "",
          dtEmissaoBind: "",
          recnum: 0,
          recNumPrinc: null,
          nomeFunc: nomeFuncProp || "",
        }));
      }
    }
  }, [isOpen]);

  // Ao abrir, buscar e reservar o próximo RECNUM (SELECT ... FOR UPDATE + incremento)
  useEffect(() => {
    const fetchRecnum = async () => {
      if (!isOpen) return;
      if (mode === "update") return; // no update, manter RECNUM existente
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
  }, [isOpen, mode]);

  // Datas iniciam em branco; usuário deve selecionar manualmente

  const setVal = (k: keyof (NovoLancamentoPayload & { ecNumPrinc?: number | null }), v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  const onSubmit = async () => {
    setErro("");
    setSucesso("");

    // Mapeia chaves -> labels para mensagem de erro amigável
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
    if (!form.codFilial || Number(form.codFilial) === 0) missing.push("codFilial");
    if (!String(form.tipoLanc || "").trim()) missing.push("tipoLanc");
    if (!String(form.tipoParceiro || "").trim()) missing.push("tipoParceiro");
    if (!String(form.tiposervico || "").trim()) missing.push("tiposervico");
    // Tipo de Nota é obrigatório (exceto o Número Nota quando "Sem Nota")
    if (!String(form.nfServicoBind || "").trim()) missing.push("nfServicoBind");
    // Condicionais
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

    // Ajustes para backend:
    // - nfServicoBind: coluna aceita apenas 'S' ou 'N'. Quando 'Sem Nota' (internamente 'SN'), enviar 'N'.
    // - numNotaBind: quando 'Sem Nota', enviar 0.
    // - Datas: enviar no formato DD/MM/YYYY.
    const toDDMMYYYY = (iso: string): string => {
      if (!iso) return "";
      // esperado iso no formato YYYY-MM-DD
      const [y, m, d] = iso.split("-");
      if (y && m && d) return `${d}/${m}/${y}`;
      return iso;
    };

    // Para create: backend espera apenas 'S' ou 'N'. Quando 'SN', enviar 'N'.
    const nfServicoForCreate: "S" | "N" = form.nfServicoBind === "S" ? "S" : "N";
    const numNotaForCreate = form.nfServicoBind === "SN" ? 0 : (form.numNotaBind ? Number(form.numNotaBind) : 0);

    // Para update: o payload aceita 'S' | 'N' | 'SN' | '0' | undefined
    const nfServicoForUpdate: "S" | "N" | "SN" | "0" | undefined = (() => {
      const raw = form.nfServicoBind as any;
      if (raw === "S" || raw === "N" || raw === "SN" || raw === "0") return raw;
      return undefined;
    })();
    const numNotaForUpdate = (nfServicoForUpdate === "SN" || nfServicoForUpdate === "0") ? 0 : (form.numNotaBind ? Number(form.numNotaBind) : 0);

    const payload: NovoLancamentoPayload = {
      recnum: Number(form.recnum),
      codConta: Number(form.codConta),
      codFornec: Number(form.codFornec || 0),
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
      nfServicoBind: nfServicoForCreate,
      numNotaBind: numNotaForCreate,
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
    };

    try {
      setSalvando(true);
      if (mode === "update") {
        const payloadUpd: AtualizarLancamentoPayload = {
          recnum: Number(form.recnum),
          codConta: Number(form.codConta),
          codFornec: Number(form.codFornec || 0) || null,
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
          nfServicoBind: nfServicoForUpdate,
          numNotaBind: numNotaForUpdate,
          codRotinaAlt: "MULTGEST",
          parcela: Number(form.parcela ?? 1),
          vlrUtilizadoAdiantFornec: Number(form.vlrUtilizadoAdiantFornec ?? 0),
          lacreDigConecSocial: form.lacreDigConecSocial ?? null,
          tiposervico: String(form.tiposervico ?? "99"),
          opcaoPagamentoIpva: form.opcaoPagamentoIpva ?? null,
          utilizouRateioConta: String(form.utilizouRateioConta ?? "N") as "S" | "N",
          prcRateioUtilizado: Number(form.prcRateioUtilizado ?? 100),
          reinFEventor4040: form.reinFEventor4040 ?? null,
        };
        const resp = await atualizarLancamento(payloadUpd);
        if (!resp.ok || resp.rowsAffected <= 0) {
          throw new Error("Atualização não aplicada.");
        }
        setSucesso(`Lançamento atualizado. RECNUM: ${form.recnum}`);
        onClose();
        if (typeof onSuccess === "function") onSuccess(Number(form.recnum));
      } else {
        const resp = await criarNovoLancamento(payload);
        setSucesso(`Lançamento salvo. RECNUM: ${resp?.recnum ?? "-"}`);
        if (resp?.recnum) {
          setForm((prev) => ({ ...prev, recnum: Number(resp.recnum), recNumPrinc: Number(resp.recnum) }));
          onClose();
          if (typeof onSuccess === "function") onSuccess(Number(resp.recnum));
        }
      }
    } catch (e: any) {
      setErro(e?.message || (mode === "update" ? "Falha ao atualizar lançamento" : "Falha ao salvar lançamento"));
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  const handleBuscarConta = () => {
    setErro("");
    setSucesso("");
    setTermConta("");
    setResultadosContas([]);
    setShowBuscaConta(true);
  };

  const handleBuscarFornecedor = () => {
    setErro("");
    setSucesso("");
    setTermFornec("");
    setResultadosFornecs([]);
    setShowBuscaFornec(true);
  };

  const executarBuscaContas = async () => {
    setLoadingBuscaConta(true);
    try {
      const termo = termConta.trim();
      const dados = await buscarContas({ nomeConta: termo, codigoConta: termo });
      setResultadosContas(dados);
    } catch (e: any) {
      setErro(e?.message || "Falha na busca de contas");
    } finally {
      setLoadingBuscaConta(false);
    }
  };

  const executarBuscaFornecs = async () => {
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
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2995 }} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", zIndex: 3000 }}>
        <div className="modal-dialog modal-dialog-centered" role="document" style={{ maxWidth: "720px" }}>
          <div className="modal-content" style={{ fontSize: "0.75rem" }}>
            <div className="modal-header">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>{mode === "update" ? "Atualizar Lançamento" : "Novo Lançamento"}</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, "--input-font-size": "0.7rem" } as React.CSSProperties}>
              {erro && <div className="alert alert-danger">{erro}</div>}
              {sucesso && <div className="alert alert-success">{sucesso}</div>}

              <div className="row g-2">
                {/* 1: RECNUM */}
                <div className="col-12 col-md-3">
                  <label className="form-label">Recnum</label>
                  <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.recnum || ""} placeholder={recnumLoading ? "Carregando..." : ""} readOnly />
                </div>
                {/* 2: EC NUM PRINC */}
                <div className="col-12 col-md-3">
                  <label className="form-label">Rec. Princ.</label>
                  <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={(form.recNumPrinc ?? form.recnum) || ""} placeholder={recnumLoading ? "Carregando..." : ""} readOnly />
                </div>
                {/* 3: Cod Filial */}
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
                {/* 4: Tipo Lanç */}
                <div className="col-12 col-md-3">
                  <label className="form-label">Tipo Lanç.</label>
                  <select className="form-select form-select-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.tipoLanc} onChange={(e) => setVal("tipoLanc", e.target.value)} required>
                    <option value="">Selecione</option>
                    <option value="C">Confirmado</option>
                    <option value="P">Provisão</option>
                  </select>
                </div>
                {/* 5: Tipo Serviço */}
                <div className="col-12 col-md-6">
                  <label className="form-label">Tipo Serviço</label>
                  <select className="form-select form-select-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.tiposervico ?? "99"} onChange={(e) => setVal("tiposervico", e.target.value)} required>
                    <option value="">Selecione</option>
                    <option value="20">20 - Pgto Fornecedor</option>
                    <option value="30">30 - Pgto Salários</option>
                    <option value="22">22 - Pgto Tributos</option>
                    <option value="99">99 - Outros Pgtos</option>
                  </select>
                </div>
                {/* 6: Cod Conta + Buscar */}
                <div className="col-12 col-md-6">
                  <label className="form-label">Cod. Conta</label>
                  <div className="input-group input-group-sm">
                    <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} placeholder="Selecione" value={form.codConta || ""} onChange={(e) => { setVal("codConta", Number(e.target.value || "0")); if (!e.target.value) setNomeConta(""); }} required />
                    <button className="btn btn-outline-primary btn-sm py-1 px-2" type="button" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={handleBuscarConta}>Buscar</button>
                  </div>
                  {nomeConta && <small className="text-muted d-block mt-1 text-truncate" title={nomeConta}>{nomeConta}</small>}
                </div>
                {/* 7: Tipo Parceiro */}
                <div className="col-12 col-md-6">
                  <label className="form-label">Tipo Parceiro</label>
                  <select className="form-select form-select-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.tipoParceiro} onChange={(e) => { const novoTipo = e.target.value; setVal("tipoParceiro", novoTipo); if (novoTipo !== "F") { setVal("codFornec", 0); setNomeFornec(""); } }} required>
                    <option value="">Selecione</option>
                    <option value="F">Fornecedor</option>
                    <option value="C">Cliente</option>
                    <option value="R">RCA</option>
                    <option value="M">Motorista</option>
                    <option value="O">Outro</option>
                  </select>
                </div>
                {/* 8: Cod Fornec + Buscar (condicional) */}
                {form.tipoParceiro === "F" && (
                  <div className="col-12 col-md-6">
                    <label className="form-label">Cod. Fornec</label>
                    <div className="input-group input-group-sm">
                      <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} placeholder="Selecione" value={form.codFornec || ""} onChange={(e) => { setVal("codFornec", Number(e.target.value || "0")); if (!e.target.value) setNomeFornec(""); }} required />
                      <button className="btn btn-outline-primary btn-sm py-1 px-2" type="button" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={handleBuscarFornecedor}>Buscar</button>
                    </div>
                    {nomeFornec && <small className="text-muted d-block mt-1 text-truncate" title={nomeFornec}>{nomeFornec}</small>}
                  </div>
                )}
                {/* 9: Histórico */}
                <div className="col-12">
                  <label className="form-label">Histórico</label>
                  <input type="text" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} placeholder="Selecione" value={form.historico} onChange={(e) => setVal("historico", e.target.value)} required />
                </div>
                {/* 10-13: Datas */}
                <div className="col-12 col-md-3">
                  <label className="form-label">Dt. Lançamento</label>
                  <input type="date" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.dtLancBind} onChange={(e) => setVal("dtLancBind", e.target.value)} required />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Dt. Vencimento</label>
                  <input type="date" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.dtVencBind} onChange={(e) => setVal("dtVencBind", e.target.value)} required />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Dt. Competência</label>
                  <input type="date" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.dtCompetenciaBind} onChange={(e) => setVal("dtCompetenciaBind", e.target.value)} required />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Dt. Emissão</label>
                  <input type="date" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} value={form.dtEmissaoBind} onChange={(e) => setVal("dtEmissaoBind", e.target.value)} required />
                </div>
                {/* 13: Valor */}
                <div className="col-12 col-md-3">
                  <label className="form-label">Valor</label>
                  <input type="number" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} placeholder="Selecione" value={form.valor || ""} onChange={(e) => setVal("valor", Number(e.target.value || "0"))} required />
                </div>
                {/* 14: NF Serviço */}
                <div className="col-12 col-md-3">
                  <label className="form-label">Tipo de Nota</label>
                  <select
                    className="form-select form-select-sm"
                    style={{ fontSize: "0.7rem", height: "28px" }}
                    value={form.nfServicoBind ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVal("nfServicoBind", val);
                      // Quando 'Sem Nota' (SN) selecionado, zera Número Nota
                      if (val !== "N" && val !== "S") setVal("numNotaBind", 0);
                    }}
                    required
                  >
                    <option value="">Selecione</option>
                    <option value="N">NF-e</option>
                    <option value="S">NF-s</option>
                    <option value="SN">Sem Nota</option>
                  </select>
                </div>
                {/* 15: Número Nota (condicional) */}
                {(form.nfServicoBind === "N" || form.nfServicoBind === "S") && (
                  <div className="col-12 col-md-3">
                    <label className="form-label">Número Nota</label>
                    <input type="text" className="form-control form-control-sm" style={{ fontSize: "0.7rem", height: "28px" }} placeholder="Selecione" value={form.numNotaBind ?? ""} onChange={(e) => setVal("numNotaBind", e.target.value ? Number(e.target.value) : 0)} required />
                  </div>
                )}

                {/* Duplicata hidden com valor padrão '1' */}

                {/* Moeda oculta: default 'R' */}

                {/* Campos implícitos: rotina cad/alt, parcela, rateio ocultos */}

                {/* Campos padrão não visíveis: vlrUtilizadoAdiantFornec=0, prcRateioUtilizado=100, lacreDigConecSocial=0 */}

                {/* Campos implícitos: IPVA e Reinf ocultos */}
              </div>
            </div>

            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onClose}>Fechar</button>
              <button type="button" className="btn btn-primary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onSubmit} disabled={salvando}>
                {salvando ? (mode === "update" ? "Atualizando..." : "Salvando...") : (mode === "update" ? "Atualizar" : "Salvar")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Busca de Contas (componente) */}
      <BuscarContaModal
        isOpen={showBuscaConta}
        term={termConta}
        onTermChange={setTermConta}
        onBuscar={executarBuscaContas}
        loading={loadingBuscaConta}
        resultados={resultadosContas}
        onSelect={(it) => {
          setForm((prev) => ({ ...prev, codConta: Number(it.CODCONTA) }));
          setNomeConta(it.CONTA);
          setShowBuscaConta(false);
        }}
        onClose={() => setShowBuscaConta(false)}
      />

      {/* Modal de Busca de Fornecedores (componente) */}
      <BuscarFornecedorModal
        isOpen={showBuscaFornec}
        term={termFornec}
        onTermChange={setTermFornec}
        onBuscar={executarBuscaFornecs}
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

export default ModalNovoLancamento;