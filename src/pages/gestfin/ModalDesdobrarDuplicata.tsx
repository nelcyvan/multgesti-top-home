import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { type DuplicataRow } from "../../services/gestfin/BuscarDuplicatas";
import { desdobrarParcela } from "../../services/gestfin/DesdobrarDuplicata";

interface ModalDesdobrarDuplicataProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  duplicata: DuplicataRow | null;
  valorOfx?: number | string | null;
}

const toNumber = (val: unknown): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const s = String(val).replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
};

const formatarValor = (valor: unknown) => {
  const v = toNumber(valor);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
};

const formatarData = (val: unknown) => {
  if (val === null || val === undefined) return "-";
  const s = String(val);
  // from YYYY-MM-DD to DD/MM/YYYY
  const m = s.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
  }
  return s || "-";
};

const ModalDesdobrarDuplicata: React.FC<ModalDesdobrarDuplicataProps> = ({ isOpen, onClose, onSuccess, duplicata, valorOfx }) => {
  if (!isOpen || !duplicata) return null;

  const valorDuplicata = useMemo(() => toNumber(duplicata?.VALOR ?? 0), [duplicata]);
  const valorOfxNum = useMemo(() => toNumber(valorOfx ?? 0), [valorOfx]);
  const valorOfxCalc = useMemo(() => Math.abs(valorOfxNum), [valorOfxNum]);
  const [parcelas, setParcelas] = useState<{
    valor: number;
    vencimento: string;
    usuario: string;
    codUsuario?: number | null;
    dataDesdobramento: string;
    recnum?: string | number | null;
    status?: "pending" | "ok" | "error";
    errorMsg?: string | null;
  }[]>([]);
  const [valorParcelaInput, setValorParcelaInput] = useState<string>("");
  const [vencimentoParcelaInput, setVencimentoParcelaInput] = useState<string>("");

  const usuarioNome = useMemo(() => {
    try {
      const raw = localStorage.getItem("usuarioLogado");
      if (!raw) return "-";
      const obj = JSON.parse(raw);
      return obj?.usuario?.usuario ?? obj?.usuario ?? "-";
    } catch {
      return "-";
    }
  }, []);

  const codFuncUsur = useMemo(() => {
    try {
      const raw = localStorage.getItem("usuarioLogado");
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const rawCod =
        obj?.usuario?.matricula ??
        obj?.matricula ??
        obj?.usuario?.codusur ??
        obj?.codusur ??
        null;
      if (rawCod == null) return null;
      const num =
        typeof rawCod === "string"
          ? Number(String(rawCod).replace(/\D+/g, ""))
          : Number(rawCod);
      return Number.isFinite(num) ? num : null;
    } catch {
      return null;
    }
  }, []);

  const totalParcelas = useMemo(() => parcelas.reduce((acc, p) => acc + (Number(p?.valor) || 0), 0), [parcelas]);
  const restante = Math.max(0, valorDuplicata - totalParcelas);

  const toCents = (n: number) => Math.round(n * 100);
  const podeConfirmar = toCents(totalParcelas) === toCents(valorDuplicata) && parcelas.length > 0;

  const handleAdicionarParcela = () => {
    const valor = toNumber(valorParcelaInput);
    if (valor <= 0) return;
    if (!vencimentoParcelaInput) return;
    // Não permitir ultrapassar o total
    if (toCents(totalParcelas + valor) > toCents(valorDuplicata)) return;
    const hoje = new Date();
    const yyyy = String(hoje.getFullYear());
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const dd = String(hoje.getDate()).padStart(2, "0");
    const dataHoje = `${yyyy}-${mm}-${dd}`;
    setParcelas((prev) => [
      ...prev,
      {
        valor,
        vencimento: vencimentoParcelaInput,
        usuario: usuarioNome,
        codUsuario: codFuncUsur ?? null,
        dataDesdobramento: dataHoje,
        recnum: null,
      },
    ]);
    setValorParcelaInput("");
    setVencimentoParcelaInput("");
  };

  const handleRemoverParcela = (index: number) => {
    setParcelas((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmar = () => {
    if (!podeConfirmar) return;
    // Processa cada parcela sequencialmente, atualizando a linha conforme resultado
    (async () => {
      try {
        let allOk = true;
        for (let i = 0; i < parcelas.length; i++) {
          const p = parcelas[i];
          // marca como pendente visualmente
          setParcelas((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], status: "pending", errorMsg: null };
            return next;
          });

          try {
            const payload = {
              recNumAtual: Number(duplicata?.RECNUM),
              duplic: String(i + 1),
              valor: Number(p.valor),
              dtVenc: String(p.vencimento), // YYYY-MM-DD
              nomeFunc: String(p.usuario || usuarioNome),
              dtDesd: String(p.dataDesdobramento), // YYYY-MM-DD
              codFunc: codFuncUsur ?? undefined,
              finalizar: i === parcelas.length - 1,
            };
            const resp = await desdobrarParcela(payload);
            const novoRecnum = Number(resp?.recnumReserva ?? 0);
            // sucesso: marca ok e atualiza recnum
            setParcelas((prev) => {
              const next = [...prev];
              next[i] = { ...next[i], status: "ok", recnum: novoRecnum || prev[i].recnum };
              return next;
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Falha ao desdobrar";
            setParcelas((prev) => {
              const next = [...prev];
              next[i] = { ...next[i], status: "error", errorMsg: msg };
              return next;
            });
            allOk = false;
          }
        }
        // Se todas processadas com sucesso, fecha o modal e notifica o pai
        if (allOk) {
          try { onClose?.(); } catch {}
          try { onSuccess?.(); } catch {}
        }
      } finally {
        // Mantém controle no fluxo acima
      }
    })();
  };

  const content = (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 2095, position: "fixed", inset: 0 }}
        onClick={onClose}
      />
      <div
        className="modal fade show"
        role="dialog"
        aria-modal="true"
        style={{ display: "block", position: "fixed", inset: 0, zIndex: 2100 }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Desdobrar Duplicata</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
              <div className="mb-2">
                <span className="badge bg-secondary">Resumo da Duplicata Selecionada</span>
              </div>
              {(() => {
                const campos = [
                  { label: "Recnum Atual", value: duplicata.RECNUM ?? "-" },
                  { label: "Vencimento", value: duplicata.DTVENC || "-" },
                  { label: "Valor", value: formatarValor(duplicata.VALOR) },
                  { label: "Fornecedor", value: duplicata.FORNECEDOR || "-" },
                  { label: "Cód. Fornecedor", value: duplicata.CODFORNEC ?? "-" },
                  { label: "Conta", value: duplicata.CONTA || duplicata.CODCONTA || "-" },
                  { label: "Cód. Conta", value: duplicata.CODCONTA ?? "-" },
                  { label: "Histórico", value: duplicata.HISTORICO || "-" },
                  { label: "Duplicata", value: duplicata.DUPLIC || "-" },
                  { label: "Nº Nota", value: duplicata.NUMNOTA ?? "-" },
                  { label: "Juros", value: formatarValor(duplicata.JUROS) },
                  { label: "Desconto", value: formatarValor(duplicata.DESCONTOFIN) },
                  { label: "Dt. Lanç.", value: duplicata.DTLANC || "-" },
                  { label: "Dt. Emissão", value: duplicata.DTEMISSAO || "-" },
                ];
                return (
                  <div className="row row-cols-2 row-cols-md-3 row-cols-xl-4 g-2 mb-2">
                    {campos.map((item, idx) => (
                      <div key={idx} className="col">
                        <div className="border rounded p-2 small">
                          <div className="text-muted">{item.label}:</div>
                          <div
                            className="fw-semibold"
                            style={{ whiteSpace: item.label === "Histórico" ? "normal" : undefined, wordBreak: item.label === "Histórico" ? "break-word" : undefined }}
                          >
                            {String(item.value) || "-"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Área de desdobramento */}
              <div className="mt-3">
                <div className="d-flex align-items-start mb-2">
                  <span className="badge bg-info me-2">Desdobramento</span>
                  <div className="d-flex flex-column">
                    <span className="text-muted">Valor da duplicata: {formatarValor(valorDuplicata)}</span>
                    <span className="text-muted">Valor OFX: {formatarValor(valorOfxNum)}</span>
                  </div>
                </div>
                {toCents(valorDuplicata) !== toCents(valorOfxCalc) && (
                  <div className="alert alert-warning py-1 px-2" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
                    Atenção: diferença entre os valores é de {formatarValor(Math.abs(valorDuplicata - valorOfxCalc))}.
                  </div>
                )}
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-2">
                    <label className="form-label">Vencimento da parcela</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={vencimentoParcelaInput}
                      onChange={(e) => setVencimentoParcelaInput(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label mb-0">Valor da parcela</label>
                      <div className="small text-muted text-nowrap">
                        Prévia: {formatarValor(toNumber(valorParcelaInput))} • Restante: {formatarValor(restante)}
                      </div>
                    </div>
                    <div className="input-group input-group-sm">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="0,00"
                        value={valorParcelaInput}
                        onChange={(e) => setValorParcelaInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm py-1 px-2"
                        style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                        onClick={handleAdicionarParcela}
                        disabled={
                          toCents(restante) <= 0 ||
                          toNumber(valorParcelaInput) <= 0 ||
                          toCents(totalParcelas + toNumber(valorParcelaInput)) > toCents(valorDuplicata) ||
                          !vencimentoParcelaInput
                        }
                      >
                        {toNumber(valorParcelaInput) > 0
                          ? `Adicionar ${formatarValor(toNumber(valorParcelaInput))}`
                          : "Adicionar parcela"}
                      </button>
                    </div>
                  </div>
                </div>

                {parcelas.length > 0 && (
                  <div className="mt-3">
                    <div className="d-flex align-items-center mb-2">
                      <span className="badge bg-secondary me-2">Parcelas adicionadas</span>
                      <span className="small text-muted">{parcelas.length} itens • Total: {formatarValor(totalParcelas)}</span>
                    </div>
                    <div className="table-responsive" style={{ maxHeight: 200 }}>
                      <table className="table table-sm table-striped table-hover" style={{ fontSize: "0.7rem" }}>
                        <thead className="table-light" style={{ position: "sticky", top: 0 }}>
                          <tr>
                            <th>Duplic</th>
                            <th>Recnum</th>
                            <th>Usuário</th>
                            <th>Cód. Usuário</th>
                            <th>Dt. Desdob.</th>
                            <th>Dt. Venc.</th>
                            <th className="text-end">Valor</th>
                            <th className="text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parcelas.map((p, i) => {
                            const rowClass = p.status === "ok" ? "table-success" : p.status === "error" ? "table-danger" : undefined;
                            return (
                            <tr key={`${i}-${p.usuario}-${p.dataDesdobramento}-${p.vencimento}-${p.valor}`} className={rowClass} title={p.errorMsg || ""}>
                              <td>{i + 1}</td>
                              <td>{p.recnum ?? ""}</td>
                              <td>{p.usuario}</td>
                              <td>{p.codUsuario ?? (codFuncUsur ?? "")}</td>
                              <td>{formatarData(p.dataDesdobramento)}</td>
                              <td>{formatarData(p.vencimento)}</td>
                              <td className="text-end">{formatarValor(p.valor)}</td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm py-1 px-2"
                                  style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                                  onClick={() => handleRemoverParcela(i)}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="small mt-2">
                      {podeConfirmar ? (
                        <span className="text-success">Total igual ao valor da duplicata. Pronto para confirmar.</span>
                      ) : (
                        <span className="text-warning">Adicione parcelas até o total ficar igual.</span>
                      )}
                      {parcelas.some(p => p.status === "pending") && (
                        <div className="mt-2 text-warning">Processando parcelas...</div>
                      )}
                      {parcelas.some(p => p.status === "error") && (
                        <div className="mt-2 text-danger">Algumas parcelas falharam. Passe o mouse na linha para ver detalhes.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={handleConfirmar}
                disabled={!podeConfirmar}
                title={!podeConfirmar ? "Necessário total igual ao valor da duplicata." : ""}
              >
                Confirmar Conciliação
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
};

export default ModalDesdobrarDuplicata;