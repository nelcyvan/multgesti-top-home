import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buscarLancamentosParciais, type LancamentoParcialRow } from "../../services/gestfin/BuscarLancamentosParciais";
import { inserirLancamentoParcial } from "../../services/gestfin/InserirLancamentoParcial";
import type { DuplicataRow } from "../../services/gestfin/BuscarDuplicatas";

interface ModalLancamentosParciaisProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  idImportacaoOFX?: number | null;
  valorOfx?: number | string | null;
  resumoOfx?: {
    ID_IMPORTACAO_OFX?: number | string | null;
    DATA_TRANSACAO?: string | null;
    VALOR_TRANSACAO?: number | string | null;
    HISTORICO?: string | null;
  } | null;
  duplicata?: DuplicataRow | null;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    // Tratar casos onde o backend envia aspas como separador decimal (ex.: 100"00)
    const s0 = v.replace(/"/g, ",");
    let s = s0.replace(/[^0-9.,-]/g, "").trim();
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else if (hasComma && !hasDot) {
      s = s.replace(/,/g, ".");
    } else if (!hasComma && hasDot) {
      const parts = s.split('.');
      if (parts.length > 2) {
        s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
      }
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

function formatISODateToBR(iso?: string | null): string | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function toSingleLine(value?: string | null) {
  if (!value) return "-";
  return value
    .replace(/\s*-\s*/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSignBRL(n: number): string {
  const abs = Math.abs(n);
  const s = formatarBRL(abs);
  return n < 0 ? `-${s}` : s;
}

function displayPtBr(s?: string | null): string {
  const t = (s ?? '').toString().trim();
  if (!t) return '0,00';
  // Normaliza casos com aspas como separador decimal e força vírgula como decimal
  const normalized = t.replace(/"/g, ',');
  if (normalized.includes(',')) return normalized;
  if (normalized.includes('.')) return normalized.replace(/\./g, ',');
  return normalized;
}

// função fmtOrZero removida por não ser mais utilizada

const ModalLancamentosParciais: React.FC<ModalLancamentosParciaisProps> = ({ isOpen, onClose, onSuccess, idImportacaoOFX, valorOfx, resumoOfx, duplicata }) => {
  const [rows, setRows] = useState<LancamentoParcialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);

  useEffect(() => {
    if (!isOpen || !idImportacaoOFX) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    buscarLancamentosParciais(Number(idImportacaoOFX))
      .then((data) => { if (mounted) setRows(data); })
      .catch((e) => { if (mounted) setError(String(e?.message || e)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [isOpen, idImportacaoOFX]);

  // Cálculo de diferença entre Transação e Duplicata (considerando juros e desconto)
  const valorOfxNum = useMemo(() => toNumber((resumoOfx?.VALOR_TRANSACAO ?? valorOfx) ?? 0), [resumoOfx, valorOfx]);
  const jurosAtual = useMemo(() => toNumber(duplicata?.JUROS ?? 0), [duplicata]);
  const descontoAtual = useMemo(() => toNumber(duplicata?.DESCONTOFIN ?? 0), [duplicata]);
  const valorDuplicata = useMemo(() => toNumber(duplicata?.VALOR ?? 0), [duplicata]);

  const centsTransacao = Math.abs(Math.round(valorOfxNum * 100));
  const centsDuplicata = Math.abs(Math.round(valorDuplicata * 100));
  const centsJuros = Math.abs(Math.round(jurosAtual * 100));
  const centsDesconto = Math.abs(Math.round(descontoAtual * 100));

  // Valor líquido da duplicata considerando juros e desconto (sempre positivado)
  const centsDuplicataLiquida = Math.max(0, centsDuplicata + centsJuros - centsDesconto);
  const diffCentavos = Math.abs(centsTransacao - centsDuplicataLiquida);

  if (!isOpen) return null;

  const handleVincular = async () => {
    try {
      setSuccessMsg(null);
      setError(null);
      const idImportacaoOFX = resumoOfx?.ID_IMPORTACAO_OFX;
      if (!duplicata?.RECNUM || !idImportacaoOFX) {
        setError("Selecione uma duplicata e garanta o ID da transação OFX.");
        return;
      }

      const rawUser = localStorage.getItem('usuarioLogado');
      if (!rawUser) {
        setError('Usuário não identificado. Faça login novamente.');
        return;
      }
      let codusurBind: number | null = null;
      try {
        const usuario = JSON.parse(rawUser);
        const c = usuario?.codusur ?? usuario?.CODUSUR ?? usuario?.matricula ?? usuario?.MATRICULA ?? null;
        codusurBind = c != null ? Number(String(c).trim()) : null;
      } catch {
        codusurBind = null;
      }
      if (!codusurBind || !Number.isFinite(codusurBind) || codusurBind <= 0) {
        setError('Código do usuário (CODUSUR) inválido.');
        return;
      }

      const recnumBind = Number(duplicata.RECNUM);
      const idOfxBind = Number(idImportacaoOFX);
      if (!Number.isFinite(recnumBind) || recnumBind <= 0) {
        setError('RECNUM da duplicata inválido.');
        return;
      }
      if (!Number.isFinite(idOfxBind) || idOfxBind <= 0) {
        setError('ID da transação OFX inválido.');
        return;
      }

      // Positivar valor da transação (apenas para cálculo de validação)
      const transacaoPositiva = Math.abs(toNumber((resumoOfx?.VALOR_TRANSACAO ?? valorOfx) ?? 0));

      // Soma das vinculações parciais já registradas: Valor + Juros - Desconto
      const totalParciais = rows.reduce((acc, r) => {
        const v = typeof r.VALOR_NUM === 'number' ? r.VALOR_NUM : toNumber(r.VALOR_FORMATADO);
        const j = typeof r.JUROS_NUM === 'number' ? r.JUROS_NUM : toNumber(r.JUROS);
        const d = typeof r.DESCONTOFIN_NUM === 'number' ? r.DESCONTOFIN_NUM : toNumber(r.DESCONTOFIN);
        return acc + (v + j - d);
      }, 0);

      const restante = Math.max(0, transacaoPositiva - totalParciais);

      // Valor líquido da duplicata selecionada: Valor + Juros - Desconto
      const valorDup = toNumber(duplicata?.VALOR ?? 0);
      const jurosDup = toNumber(duplicata?.JUROS ?? 0);
      const descDup = toNumber(duplicata?.DESCONTOFIN ?? 0);
      const valorLiquidoDuplicata = Math.max(0, valorDup + jurosDup - descDup);

      const excedenteCentavos = Math.round((valorLiquidoDuplicata - restante) * 100);
      const toleranciaCentavos = 10;
      if (excedenteCentavos > toleranciaCentavos) {
        setError(`Vinculação não permitida: valor da duplicata (${formatarBRL(valorLiquidoDuplicata)}) excede o restante (${formatarBRL(restante)}).`);
        return;
      }

      setVinculando(true);

      // Inserir vinculação parcial conforme solicitado
      const rowsAffected = await inserirLancamentoParcial({
        idOfx: idOfxBind,
        recnum: recnumBind,
        codUsurVinculacao: codusurBind,
        valor: valorDup,
        historico: duplicata?.HISTORICO ?? null,
        fornecedor: duplicata?.FORNECEDOR ?? null,
        numNota: duplicata?.NUMNOTA ?? null,
        juros: jurosDup,
      });

      if (rowsAffected <= 0) {
        throw new Error('Nenhum registro inserido');
      }

      // Recarregar a lista de lançamentos parciais (não necessário exibir aqui pois vamos fechar)
      try {
        setLoading(true);
        await buscarLancamentosParciais(idOfxBind);
      } finally {
        setLoading(false);
      }

      // Resetar mensagem, fechar este modal e notificar sucesso ao pai
      setSuccessMsg(null);
      if (typeof onClose === 'function') onClose();
      if (typeof onSuccess === 'function') onSuccess();
    } catch (e: any) {
      setError(String(e?.message || 'Falha ao vincular'));
    } finally {
      setVinculando(false);
    }
  };

  const content = (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2095, position: "fixed", inset: 0 }} onClick={onClose} />
      <div className="modal fade show" role="dialog" aria-modal="true" style={{ display: "block", position: "fixed", inset: 0, zIndex: 2100 }}>
        <div className="modal-dialog modal-md modal-dialog-centered" role="document" style={{ maxWidth: "30vw" }}>
          <div className="modal-content">
            <div className="modal-header py-2">
              <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Vinculação Parcial</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
              <div className="mb-2 d-flex justify-content-between align-items-center">
                <span className="badge bg-secondary">Resumo do Lançamento (OFX)</span>
                {loading && <span className="text-muted">Carregando...</span>}
              </div>
              <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.65rem" }}>
                <tbody>
                  <tr>
                    <td><strong>ID Importação OFX:</strong></td>
                    <td>{resumoOfx?.ID_IMPORTACAO_OFX ?? idImportacaoOFX ?? '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Dt. Trans.:</strong></td>
                    <td>{formatISODateToBR(resumoOfx?.DATA_TRANSACAO) ?? '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Valor Transação:</strong></td>
                    <td className="text-end">
                      <span className={valorOfxNum < 0 ? 'text-danger' : 'text-success'}>
                        {formatSignBRL(valorOfxNum)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Histórico OFX:</strong></td>
                    <td style={{ whiteSpace: 'nowrap', wordBreak: 'normal' }}>{toSingleLine(resumoOfx?.HISTORICO ?? null)}</td>
                  </tr>
                </tbody>
              </table>

              {duplicata && (
                <div className={`alert ${diffCentavos > 1 ? 'alert-warning' : 'alert-success'} mt-2 mb-2`} style={{ fontSize: "0.7rem" }}>
                  <strong>⚠️ Atenção:</strong> Existe diferença entre o valor da transação ({formatSignBRL(valorOfxNum)}) e o valor da duplicata (considerando juros e desconto) ({formatarBRL(centsDuplicataLiquida / 100)}).
                </div>
              )}

              {successMsg && (
                <div className="alert alert-success mt-2 mb-2 py-1" style={{ fontSize: "0.7rem" }}>{successMsg}</div>
              )}
              {error && (
                <div className="alert alert-warning mt-2 mb-2 py-1" style={{ fontSize: "0.7rem" }}>{error}</div>
              )}

              <div className="mb-2">
                <span className="badge bg-secondary">Lançamentos Parciais (OFX)</span>
              </div>

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
                  {rows.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted">Nenhum lançamento parcial encontrado.</td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.RECNUM}>
                      <td className="text-center">{r.RECNUM}</td>
                      <td>{r.FORNECEDOR ?? '-'}</td>
                      <td className="text-end">{displayPtBr(r.VALOR_FORMATADO)}</td>
                      <td className="text-end">{displayPtBr(r.JUROS)}</td>
                      <td className="text-end">{displayPtBr(r.DESCONTOFIN)}</td>
                      <td>{r.NUMNOTA ?? '-'}</td>
                      <td className="text-wrap text-break" style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.HISTORICO ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {duplicata && (
                <>
                  <div className="mb-2 mt-2">
                    <span className="badge bg-secondary">Duplicata Selecionada</span>
                  </div>
                  <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.65rem" }}>
                    <tbody>
                      <tr>
                        <td><strong>RECNUM:</strong></td>
                        <td>{duplicata.RECNUM ?? '-'}</td>
                      </tr>
                      <tr>
                        <td><strong>Duplicata:</strong></td>
                        <td>{duplicata.DUPLIC ?? '-'}</td>
                      </tr>
                      <tr>
                        <td><strong>Fornecedor:</strong></td>
                        <td style={{ whiteSpace: 'nowrap', wordBreak: 'normal' }}>{toSingleLine(duplicata.FORNECEDOR ?? '-')}</td>
                      </tr>
                      <tr>
                        <td><strong>Valor:</strong></td>
                        <td className="text-end">{formatarBRL(toNumber(duplicata.VALOR ?? 0))}</td>
                      </tr>
                      <tr>
                        <td><strong>Juros:</strong></td>
                        <td className="text-end">{formatarBRL(toNumber(duplicata.JUROS ?? 0))}</td>
                      </tr>
                      <tr>
                        <td><strong>Desconto:</strong></td>
                        <td className="text-end">{formatarBRL(toNumber(duplicata.DESCONTOFIN ?? 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="modal-footer py-2" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onClose}>Fechar</button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2 ms-2"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={handleVincular}
                disabled={!duplicata?.RECNUM || !resumoOfx?.ID_IMPORTACAO_OFX || vinculando}
                title={!duplicata?.RECNUM || !resumoOfx?.ID_IMPORTACAO_OFX ? 'Selecione uma duplicata e garanta o ID OFX' : ''}
              >
                {vinculando ? 'Vinculando...' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
};

export default ModalLancamentosParciais;