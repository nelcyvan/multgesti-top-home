import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DuplicataRow } from "../../services/gestfin/BuscarDuplicatas";
import { atualizarJuros } from "../../services/gestfin/AtualizarJuros";

interface ModalJurosDuplicataProps {
  isOpen: boolean;
  onClose: () => void;
  duplicata: DuplicataRow | null;
  valorOfx?: number | string | null;
  resumoOfx?: {
    ID_IMPORTACAO_OFX?: number | string | null;
    DATA_TRANSACAO?: string | null;
    VALOR_TRANSACAO?: number | string | null;
    HISTORICO?: string | null;
  } | null;
  onSuccess?: (novoJuros: number) => void;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    let s = v.replace(/[^0-9.,-]/g, "").trim();
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
      // pt-BR: '.' como milhar e ',' como decimal
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else if (hasComma && !hasDot) {
      // Apenas vírgula: trata como decimal
      s = s.replace(/,/g, ".");
    } else if (!hasComma && hasDot) {
      // Apenas ponto: trata como decimal; se houver múltiplos pontos, mantém apenas o último
      const parts = s.split('.');
      if (parts.length > 2) {
        s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
      }
      // Se apenas um ponto, deixa como está
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  try {
    return Number(v ?? 0);
  } catch {
    return 0;
  }
}

function formatarBRL(n: number): string {
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    const f = (Math.round(n * 100) / 100).toFixed(2);
    const br = f.replace(".", ",");
    return `R$ ${br}`;
  }
}

const formatISODateToBR = (iso?: string | null): string | null => {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
};

const toSingleLine = (value?: string | null) => {
  if (!value) return "-";
  return value
    .replace(/\s*-\s*/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const ModalJurosDuplicata: React.FC<ModalJurosDuplicataProps> = ({ isOpen, onClose, duplicata, valorOfx, resumoOfx, onSuccess }) => {
  if (!isOpen || !duplicata) return null;

  const jurosAtual = useMemo(() => toNumber(duplicata.JUROS), [duplicata]);
  const descontoAtual = useMemo(() => toNumber(duplicata.DESCONTOFIN), [duplicata]);
  const valorDuplicata = useMemo(() => toNumber(duplicata?.VALOR ?? 0), [duplicata]);
  const valorOfxNum = useMemo(() => toNumber((resumoOfx?.VALOR_TRANSACAO ?? valorOfx) ?? 0), [resumoOfx, valorOfx]);
  const valorTransacaoAbs = useMemo(() => Math.abs(valorOfxNum), [valorOfxNum]);
  const diffAbsoluta = useMemo(() => {
    const d = Math.abs(valorTransacaoAbs - valorDuplicata);
    return Math.round(d * 100) / 100;
  }, [valorTransacaoAbs, valorDuplicata]);
  const [jurosInput, setJurosInput] = useState<string>(jurosAtual.toString());
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAplicar = async () => {
    setErrorMsg(null);
    const valor = toNumber(jurosInput);
    if (valor < 0) {
      setErrorMsg("Juros não pode ser negativo.");
      return;
    }
    setSaving(true);
    try {
      await atualizarJuros({ recnum: Number(duplicata.RECNUM), juros: valor });
      onSuccess?.(valor);
      onClose();
    } catch (e: any) {
      setErrorMsg(String(e?.message || e || "Falha ao atualizar juros"));
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2095, position: "fixed", inset: 0 }} onClick={onClose} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", position: "fixed", inset: 0, zIndex: 2100 }}>
        <div className="modal-dialog modal-md modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Atualizar Juros</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
              {/* Resumo OFX no padrão da imagem */}
              <div className="mb-2">
                <span className="badge bg-secondary">Resumo do Lançamento (OFX)</span>
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
                      <span className={toNumber(resumoOfx?.VALOR_TRANSACAO ?? valorOfxNum) < 0 ? 'text-danger' : 'text-success'}>
                        {formatarBRL(valorOfxNum)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Histórico OFX:</strong></td>
                    <td style={{ whiteSpace: 'nowrap', wordBreak: 'normal' }}>{toSingleLine(resumoOfx?.HISTORICO ?? null)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Resumo da Duplicata com cálculo de diferença e juros */}
              <div className="mb-2">
                <span className="badge bg-secondary">Duplicata Selecionada</span>
              </div>
              <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.65rem" }}>
                <tbody>
                  <tr>
                    <td><strong>Valor:</strong></td>
                    <td className="text-end">{formatarBRL(valorDuplicata)}</td>
                  </tr>
                  <tr>
                    <td><strong>Juros:</strong></td>
                    <td className="text-end">{formatarBRL(jurosAtual)}</td>
                  </tr>
                  <tr>
                    <td><strong>Desconto:</strong></td>
                    <td className="text-end">{formatarBRL(descontoAtual)}</td>
                  </tr>
                  <tr>
                    <td><strong>Diferença (Trans. - Duplicata):</strong></td>
                    <td className="text-end">{formatarBRL(diffAbsoluta)}</td>
                  </tr>
                  <tr>
                    <td><strong>RECNUM:</strong></td>
                    <td>{duplicata.RECNUM}</td>
                  </tr>
                  <tr>
                    <td><strong>Duplicata:</strong></td>
                    <td>{duplicata.DUPLIC ?? "-"}</td>
                  </tr>
                  <tr>
                    <td><strong>Fornecedor:</strong></td>
                    <td>{duplicata.FORNECEDOR ?? "-"}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mb-3">
                <label className="form-label">Novo Juros</label>
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-control form-control-sm"
                    style={{ fontSize: "0.7rem", height: "28px" }}
                    value={jurosInput}
                    onChange={(e) => {
                      // Permite apenas dígitos, vírgula e ponto; normaliza múltiplos separadores
                      const raw = e.target.value;
                      const cleaned = raw.replace(/[^0-9.,-]/g, "");
                      setJurosInput(cleaned);
                    }}
                    placeholder="Ex.: 10,50"
                  />
                  <button
                    className="btn btn-primary btn-sm py-1 px-2"
                    type="button"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={handleAplicar}
                    disabled={saving}
                  >
                    {saving ? "Aplicando..." : "Aplicar"}
                  </button>
                </div>
                {errorMsg && (
                  <div className="alert alert-warning mt-2 mb-0 py-1" style={{ fontSize: "0.7rem" }}>
                    {errorMsg}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onClose}>Fechar</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
};

export default ModalJurosDuplicata;