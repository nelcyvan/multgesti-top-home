import React, { useState, useEffect } from 'react';
import { type LancamentosApagarRow } from "../../services/gestfin/BucarLancamentosApagar";
import { type DuplicataRow } from "../../services/gestfin/BuscarDuplicatas";
import BucarDuplicatas from "./BucarDuplicatas";
import ModalDesdobrarDuplicata from "./ModalDesdobrarDuplicata";
import ModalJurosDuplicata from "./ModalJurosDuplicata";
import ModalDescontoDuplicata from "./ModalDescontoDuplicata";
import ModalLancamentosParciais from "./ModalLancamentosParciais";
import ModalAdiantamento from "./ModalAdiantamento";
import { confirmarConciliacao } from "../../services/gestfin/Gestfin";

interface ConciliarModalProps {
  show: boolean;
  onHide: () => void;
  dadosLinha: LancamentosApagarRow | null;
  onSuccess?: () => void;
}

const ConciliarModal: React.FC<ConciliarModalProps> = ({ show, onHide, dadosLinha, onSuccess }) => {
  const [modalDuplicatasAberto, setModalDuplicatasAberto] = useState(false);
  const [duplicataSelecionada, setDuplicataSelecionada] = useState<DuplicataRow | null>(null);
  const [modalDesdobrarAberto, setModalDesdobrarAberto] = useState(false);
  const [modalJurosAberto, setModalJurosAberto] = useState(false);
  const [modalDescontoAberto, setModalDescontoAberto] = useState(false);
  const [modalParcialAberto, setModalParcialAberto] = useState(false);
  const [modalAdiantamentoAberto, setModalAdiantamentoAberto] = useState(false);
  const [modalCanceladoAberto, setModalCanceladoAberto] = useState(false);
  const [modalEstornoAberto, setModalEstornoAberto] = useState(false);
  const [duplicatasSuccessMsg, setDuplicatasSuccessMsg] = useState<string | null>(null);

  // Importante: Hooks devem ser chamados sempre na mesma ordem.
  // Não retornar antes dos hooks; controlar a renderização com flag.
  const visible = !!dadosLinha && show;

  // Conversão robusta para número (suporta pt-BR como "1.234,56" e ponto como decimal)
  const toNumber = (val: unknown): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return val;
    let s = String(val).replace(/[^0-9.,-]/g, "").trim();
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
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const formatarValor = (valor: number | string) => {
    const v = toNumber(valor);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(v || 0);
  };

  // Mesmo formato usado na tabela: ISO para DD/MM/YYYY
  const formatISODateToBR = (iso?: string): string | null => {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
  };

  // Removido: formatarData não é utilizada; usamos formatISODateToBR para datas





  // Força texto em uma única linha, removendo quebras internas e espaços múltiplos
  const toSingleLine = (v?: string) => String(v ?? "").replace(/\s+/g, " ").trim();

  const handleConciliar = async () => {
    try {
      if (!duplicataSelecionada || !dadosLinha) {
        window.alert('Selecione uma duplicata para conciliar.');
        return;
      }

      const rawUser = localStorage.getItem('usuarioLogado');
      if (!rawUser) {
        window.alert('Usuário não identificado. Faça login novamente.');
        return;
      }
      let codusurBind: number | null = null;
      try {
        const usuario = JSON.parse(rawUser);
        // Aceita diferentes chaves possíveis vindas do login: codusur ou matricula
        const c =
          usuario?.codusur ??
          usuario?.CODUSUR ??
          usuario?.matricula ??
          usuario?.MATRICULA ??
          null;
        codusurBind = c != null ? Number(String(c).trim()) : null;
      } catch {
        codusurBind = null;
      }
      if (!codusurBind || !Number.isFinite(codusurBind) || codusurBind <= 0) {
        window.alert('Código do usuário (CODUSUR) inválido.');
        return;
      }

      const recnumBind = Number(duplicataSelecionada.RECNUM);
      const idOfxBind = Number(dadosLinha.ID_IMPORTACAO_OFX);
      if (!Number.isFinite(recnumBind) || recnumBind <= 0) {
        window.alert('RECNUM da duplicata inválido.');
        return;
      }
      if (!Number.isFinite(idOfxBind) || idOfxBind <= 0) {
        window.alert('ID da transação OFX inválido.');
        return;
      }

      await confirmarConciliacao({ codusurBind, recnumBind, idOfxBind });
      setDuplicatasSuccessMsg('Conciliação confirmada com sucesso.');
      
      // Chama callback de sucesso para recarregar o modal pai
      if (onSuccess) {
        onSuccess();
      }
      
      handleClose();
    } catch (e: any) {
      console.error('Falha ao confirmar conciliação:', e);
      window.alert(String(e?.message || 'Falha ao confirmar conciliação'));
    }
  };

  const handleAbrirDuplicatas = () => {
    setTimeout(() => setModalDuplicatasAberto(true), 0);
  };

  const handleFecharDuplicatas = () => {
    setModalDuplicatasAberto(false);
    setDuplicatasSuccessMsg(null);
  };

  const handleBuscarDuplicatas = (params: { dataInicio: string; dataFinal: string; filial: string }) => {
    console.log("Buscar duplicatas com:", params, "| resumo:", dadosLinha);
    // TODO: integrar com serviço/endpoint de busca de duplicatas
  };

  const handleSelecionarDuplicata = (dup: DuplicataRow) => {
    // Aqui você pode implementar a lógica de seleção (ex.: vincular à conciliação)
    console.log('Duplicata selecionada:', dup);
    setDuplicataSelecionada(dup);
    setModalDuplicatasAberto(false);
  };

  const handleAbrirDesdobrar = () => {
    if (!duplicataSelecionada) return;
    // Abre no próximo tick para evitar conflitos de clique/backdrop
    setTimeout(() => setModalDesdobrarAberto(true), 0);
  };

  const handleAbrirJuros = () => {
    if (!duplicataSelecionada) return;
    setTimeout(() => setModalJurosAberto(true), 0);
  };

  const handleAbrirDesconto = () => {
    if (!duplicataSelecionada) return;
    setTimeout(() => setModalDescontoAberto(true), 0);
  };

  const handleAbrirParcial = () => {
    // abre modal de parciais baseado no ID_IMPORTACAO_OFX do resumo OFX
    if (!dadosLinha?.ID_IMPORTACAO_OFX) return;
    setTimeout(() => setModalParcialAberto(true), 0);
  };

  const handleAbrirAdiantamento = () => {
    if (!dadosLinha?.ID_IMPORTACAO_OFX) return;
    setTimeout(() => setModalAdiantamentoAberto(true), 0);
  };

  const handleAbrirCancelado = () => {
    if (!dadosLinha?.ID_IMPORTACAO_OFX) return;
    setTimeout(() => setModalCanceladoAberto(true), 0);
  };

  const handleAbrirEstorno = () => {
    if (!dadosLinha?.ID_IMPORTACAO_OFX) return;
    setTimeout(() => setModalEstornoAberto(true), 0);
  };

  const handleFecharDesdobrar = () => {
    setModalDesdobrarAberto(false);
  };

  const handleFecharJuros = () => {
    setModalJurosAberto(false);
  };

  const handleFecharDesconto = () => {
    setModalDescontoAberto(false);
  };

  const handleFecharParcial = () => {
    setModalParcialAberto(false);
  };

  const handleFecharAdiantamento = () => {
    setModalAdiantamentoAberto(false);
  };

  const handleFecharCancelado = () => {
    setModalCanceladoAberto(false);
  };

  const handleFecharEstorno = () => {
    setModalEstornoAberto(false);
  };

  // Callback ao concluir desdobramento com sucesso
  const handleDesdobramentoConcluido = () => {
    setModalDesdobrarAberto(false);
    // Reabre buscar duplicatas com os parâmetros pré-setados (ex.: últimas usadas)
    setModalDuplicatasAberto(true);
    setDuplicatasSuccessMsg("Desdobramento concluído com sucesso.");
    // BucarDuplicatas lerá initialBusca via props e executará auto-busca
  };

  // Resetar seleção ao fechar o modal principal
  useEffect(() => {
    if (!show) {
      setDuplicataSelecionada(null);
    }
  }, [show]);

  const handleClose = () => {
    setDuplicataSelecionada(null);
    onHide();
  };

  // Cálculo da diferença entre Valor Transação (OFX) e Valor da duplicata
  // Cálculo robusto em centavos para evitar erros de ponto flutuante
  const centsTransacao = Math.abs(Math.round(toNumber(dadosLinha?.VALOR_TRANSACAO ?? 0) * 100));
  const centsDuplicata = Math.abs(Math.round(toNumber(duplicataSelecionada?.VALOR ?? 0) * 100));
  const centsJuros = Math.abs(Math.round(toNumber(duplicataSelecionada?.JUROS ?? 0) * 100));
  const centsDesconto = Math.abs(Math.round(toNumber(duplicataSelecionada?.DESCONTOFIN ?? 0) * 100));
  // Regra dinâmica:
  // - Se Transação > Duplicata: juros somam e desconto subtrai
  // - Se Transação < Duplicata: juros subtraem e desconto subtrai
  const centsDuplicataLiquida = centsTransacao >= centsDuplicata
    ? Math.max(0, centsDuplicata + centsJuros - centsDesconto)
    : Math.max(0, centsDuplicata - centsJuros - centsDesconto);
  const diffCentavos = Math.abs(centsTransacao - centsDuplicataLiquida);
  const diffAbsoluta = diffCentavos / 100;
  const podeConfirmar = !!duplicataSelecionada && diffCentavos <= 1;

  // Alerta dinâmico: compara Transação contra Duplicata (se houver) ou Lançamento Interno
  //const valorInternoAbs = Math.abs(toNumber(dadosLinha?.VALOR_LANCAMENTO_INTERNO ?? 0));
  const valorComparacaoOriginal = duplicataSelecionada ? (centsDuplicataLiquida / 100) : toNumber(dadosLinha?.VALOR_LANCAMENTO_INTERNO ?? 0);
  const centsComparacaoAbs = Math.abs(Math.round(valorComparacaoOriginal * 100));
  const diffComparacaoCentavos = Math.abs(centsTransacao - centsComparacaoAbs);
  const labelComparacao = duplicataSelecionada ? 'valor da duplicata (considerando juros e desconto)' : 'valor do lançamento interno';

  return (
    <>
      {visible && (
        <div
          className="modal-backdrop fade show"
          style={{ zIndex: 1060 }}
          onClick={handleClose}
        ></div>
      )}
      {visible && (
        <div
          className={`modal fade ${visible ? 'show' : ''}`}
          role="dialog"
          aria-modal="true"
          style={{ display: 'block', zIndex: 1070 }}
        >
          <div className="modal-dialog modal-md modal-dialog-centered" role="document" style={{ maxWidth: "30vw" }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Conciliar Lançamento</h5>
                <button type="button" className="btn-close" onClick={handleClose}></button>
              </div>
            
            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
              <div className="row mb-3">
                <div className="col-md-12">
                  <h6 className="text-primary mb-3" style={{ fontSize: "0.8rem" }}>Resumo do Lançamento (OFX)</h6>
                </div>
              </div>

              <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.65rem" }}>
                <tbody>
                  <tr>
                    <td><strong>ID Importação OFX:</strong></td>
                    <td>{dadosLinha?.ID_IMPORTACAO_OFX ?? '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Dt. Trans.:</strong></td>
                    <td>{formatISODateToBR(dadosLinha?.DATA_TRANSACAO) ?? '-'}</td>
                  </tr>
                  <tr>
                    <td><strong>Valor Transação:</strong></td>
                    <td className="text-end">
                      <span className={toNumber(dadosLinha?.VALOR_TRANSACAO) < 0 ? 'text-danger' : 'text-success'}>
                        {formatarValor(dadosLinha?.VALOR_TRANSACAO)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Histórico OFX:</strong></td>
                    <td style={{ whiteSpace: 'nowrap', wordBreak: 'normal' }}>
                      {toSingleLine(dadosLinha?.HISTORICO)}
                    </td>
                  </tr>
              </tbody>
              </table>

              {/* Seção de diferenças/alertas */}
              {centsTransacao !== centsComparacaoAbs && (
                <div className="row mt-3">
                  <div className="col-md-12">
                    <div className={`alert ${diffComparacaoCentavos <= 1 ? 'alert-success' : 'alert-warning'}`}>
                      <strong>⚠️ Atenção:</strong> Existe diferença entre o valor da transação 
                      ({formatarValor(dadosLinha?.VALOR_TRANSACAO)}) e o {labelComparacao} 
                      ({formatarValor(valorComparacaoOriginal)}).
                    </div>
                  </div>
                </div>
              )}

              {/* Duplicata selecionada */}
              {duplicataSelecionada && (
                <div className="row mt-3">
                  <div className="col-md-12">
                    <h6 className="text-success mb-2" style={{ fontSize: "0.8rem" }}>Duplicata Selecionada</h6>
                    <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.65rem" }}>
                      <tbody>
                        <tr>
                          <td><strong>RECNUM:</strong></td>
                          <td>{duplicataSelecionada.RECNUM ?? '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Vencimento:</strong></td>
                          <td>{duplicataSelecionada.DTVENC || '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Valor:</strong></td>
                          <td className="text-end">{formatarValor(duplicataSelecionada.VALOR)}</td>
                        </tr>
                        <tr>
                          <td><strong>Fornecedor:</strong></td>
                          <td style={{ whiteSpace: 'nowrap', wordBreak: 'normal' }}>{toSingleLine(duplicataSelecionada.FORNECEDOR || '')}</td>
                        </tr>
                        <tr>
                          <td><strong>Cód. Fornecedor:</strong></td>
                          <td>{duplicataSelecionada.CODFORNEC ?? '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Conta:</strong></td>
                          <td>{duplicataSelecionada.CONTA || duplicataSelecionada.CODCONTA || '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Cód. Conta:</strong></td>
                          <td>{duplicataSelecionada.CODCONTA ?? '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Histórico:</strong></td>
                          <td style={{ whiteSpace: 'nowrap', wordBreak: 'normal' }}>{toSingleLine(duplicataSelecionada.HISTORICO || '')}</td>
                        </tr>
                        <tr>
                          <td><strong>Duplicata:</strong></td>
                          <td>{duplicataSelecionada.DUPLIC || '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Nº Nota:</strong></td>
                          <td>{duplicataSelecionada.NUMNOTA ?? '-'}</td>
                        </tr>
                        <tr>
                          <td><strong>Juros:</strong></td>
                          <td className="text-end">{formatarValor(duplicataSelecionada.JUROS)}</td>
                        </tr>
                        <tr>
                          <td><strong>Desconto:</strong></td>
                          <td className="text-end">{formatarValor(duplicataSelecionada.DESCONTOFIN)}</td>
                        </tr>
                          <tr>
                            <td><strong>Dt. Lanç.:</strong></td>
                            <td>{duplicataSelecionada.DTLANC || '-'}</td>
                          </tr>
                          <tr>
                            <td><strong>Dt. Emissão:</strong></td>
                            <td>{duplicataSelecionada.DTEMISSAO || '-'}</td>
                          </tr>
                          <tr>
                            <td><strong>Funcionário:</strong></td>
                            <td>{duplicataSelecionada.NOMEFUNC || '-'}</td>
                          </tr>
                          
                      </tbody>
                    </table>
                    {/* Campo de verificação de diferença */}
                    <div className="d-flex justify-content-between align-items-start small mt-2">
                      <div>
                        <div>
                          <strong>Diferença (Trans. - Duplicata):</strong>
                          <span className="ms-1">{formatarValor(diffAbsoluta)}</span>
                          {/* <span className="text-muted ms-1">(duplicata - juros + desconto)</span> */}
                        </div>
                        <div className={`mt-1 ${podeConfirmar ? 'text-success' : 'text-warning'}`}>
                          {podeConfirmar ? 'Diferença permitida 0,01. Pronto para conciliar.' : 'Diferença permitida 0,01.'}
                        </div>
                      </div>
                      <div className="btn-group" role="group">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm py-1 px-2 rounded-pill"
                          style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                          onClick={handleAbrirDesdobrar}
                          title="Abrir modal de desdobramento da duplicata selecionada"
                        >
                          Desdobrar
                        </button>
                        <button
                          type="button"
                          className="btn btn-warning btn-sm py-1 px-2 ms-2 rounded-pill"
                          style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                          onClick={handleAbrirDesconto}
                          title="Atualizar desconto (DESCONTOFIN) da duplicata selecionada"
                        >
                          Desconto
                        </button>
                        <button
                          type="button"
                          className="btn btn-info btn-sm py-1 px-2 ms-2 rounded-pill"
                          style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                          onClick={handleAbrirJuros}
                          title="Atualizar juros (TXPERM) da duplicata selecionada"
                        >
                          Juros
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm py-1 px-2 ms-2 rounded-pill"
                          style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                          onClick={handleAbrirParcial}
                          title="Visualizar lançamentos parciais vinculados à importação OFX"
                          disabled={!dadosLinha?.ID_IMPORTACAO_OFX}
                        >
                          Parcial
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
              <button type="button" className="btn btn-secondary btn-sm py-1 px-2 rounded-pill" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={handleClose}>
                Cancelar
              </button>
              <button type="button" className="btn btn-success btn-sm py-1 px-2 rounded-pill" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={handleAbrirAdiantamento}>
                Adiantamento
              </button>
              <button
                type="button"
                className="btn btn-warning btn-sm py-1 px-2 rounded-pill"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={handleAbrirEstorno}
                title="Visualizar resumo do lançamento (OFX) para Estorno"
              >
                Estorno
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm py-1 px-2 rounded-pill"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={handleAbrirCancelado}
                title="Visualizar resumo do lançamento (OFX)"
              >
                Cancelado
              </button>
              <button type="button" className="btn btn-primary btn-sm py-1 px-2 rounded-pill" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={handleAbrirDuplicatas}>
                Duplicatas
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm py-1 px-2 rounded-pill"
                style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                onClick={handleConciliar}
                disabled={!podeConfirmar}
                title={!podeConfirmar ? 'Habilita quando diferença entre valores for <= 0,01.' : ''}
              >
                Conciliar
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Resumo OFX - Cancelado */}
      {modalCanceladoAberto && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1080 }}
            onClick={handleFecharCancelado}
          ></div>
          <div
            className={`modal fade show`}
            role="dialog"
            aria-modal="true"
            style={{ display: 'block', zIndex: 1090 }}
          >
            <div className="modal-dialog modal-sm modal-dialog-centered" role="document" style={{ maxWidth: "28vw" }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Conciliar transção Cancelada</h5>
                  <button type="button" className="btn-close" onClick={handleFecharCancelado}></button>
                </div>
                <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
                  <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.65rem" }}>
                    <tbody>
                      <tr>
                        <td><strong>ID Importação OFX:</strong></td>
                        <td>{dadosLinha?.ID_IMPORTACAO_OFX ?? '-'}</td>
                      </tr>
                      <tr>
                        <td><strong>Dt. Trans.:</strong></td>
                        <td>{formatISODateToBR(dadosLinha?.DATA_TRANSACAO) ?? '-'}</td>
                      </tr>
                      <tr>
                        <td><strong>Valor Transação:</strong></td>
                        <td className="text-end">
                          <span className={toNumber(dadosLinha?.VALOR_TRANSACAO ?? 0) < 0 ? 'text-danger' : 'text-success'}>
                            {formatarValor(dadosLinha?.VALOR_TRANSACAO ?? 0)}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Histórico OFX:</strong></td>
                        <td style={{ whiteSpace: 'nowrap', wordBreak: 'normal' }}>{toSingleLine(dadosLinha?.HISTORICO)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm py-1 px-2 rounded-pill"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={async () => {
                      try {
                        // Monta payload com padrões solicitados
                        const rawUser = localStorage.getItem('usuarioLogado');
                        let codusurBind: number | null = null;
                        try {
                          const usuario = rawUser ? JSON.parse(rawUser) : null;
                          const c = usuario?.codusur ?? usuario?.CODUSUR ?? usuario?.matricula ?? usuario?.MATRICULA ?? null;
                          codusurBind = c != null ? Number(String(c).trim()) : null;
                        } catch {
                          codusurBind = null;
                        }

                        // CODFORNEC: se ausente/inválido, usar 0 (Sem fornecedor)
                        let codFornecNum = Number(dadosLinha?.CODFORNEC);
                        if (!Number.isFinite(codFornecNum) || codFornecNum <= 0) {
                          codFornecNum = 0;
                        }

                        const padraoCodConta = 900084; // solicitado
                        const padraoTiposervico = '99';
                        const padraoTipoParceiro = 'O';
                        const padraoValor = 0;
                        const padraoTipoNota = '0'; // Sem Nota (valor '0')

                        const hoje = new Date();
                        const dd = String(hoje.getDate()).padStart(2, '0');
                        const mm = String(hoje.getMonth() + 1).padStart(2, '0');
                        const yyyy = String(hoje.getFullYear());
                        const hojeBR = `${dd}/${mm}/${yyyy}`;

                        const payload = {
                          codConta: padraoCodConta,
                          codFornec: codFornecNum,
                          historico: 'TRANSAÇÃO CANCELADA POR ERRO NO BANCO',
                          duplic: '',
                          valor: padraoValor,
                          dtVencBind: hojeBR,
                          dtLancBind: hojeBR,
                          dtCompetenciaBind: hojeBR,
                          dtEmissaoBind: hojeBR,
                          // Campo CODFILIAL não existe em LancamentosApagarRow; usar padrão seguro
                          codFilial: 1,
                          indice: 'A',
                          tipoLanc: toNumber(dadosLinha?.VALOR_TRANSACAO ?? 0) < 0 ? 'P' : 'C',
                          tipoParceiro: padraoTipoParceiro,
                          nomeFunc: '',
                          historico2: 'C1',
                          moeda: 'R',
                          recNumPrinc: null,
                          nfServicoBind: padraoTipoNota,
                          numNotaBind: 0,
                          codRotinaCad: 'MULTGEST',
                          codRotinaAlt: 'MULTGEST',
                          parcela: 1,
                          vlrUtilizadoAdiantFornec: 0,
                          lacreDigConecSocial: null,
                          tiposervico: padraoTiposervico,
                          opcaoPagamentoIpva: null,
                          utilizouRateioConta: 'N',
                          prcRateioUtilizado: 0,
                          reinFEventor4040: 'N',
                          idImportacaoOFX: Number(dadosLinha?.ID_IMPORTACAO_OFX ?? 0) || undefined,
                          codusurBind: codusurBind ?? undefined,
                        };

                        const { conciliarTransacaoCancelada } = await import('../../services/gestfin/ConciliarCancelado');
                        const resp = await conciliarTransacaoCancelada(payload as any);
                        if (!resp?.ok) throw new Error(resp?.error || 'Falha ao conciliar cancelado');

                        // Fecha modal Cancelado e modal principal, recarrega pai
                        handleFecharCancelado();
                        if (typeof onHide === 'function') onHide();
                        if (typeof onSuccess === 'function') onSuccess();
                      } catch (e: any) {
                        console.error('Erro ao conciliar cancelado:', e);
                        window.alert(String(e?.message || 'Erro ao conciliar cancelado'));
                      }
                    }}
                  >
                    Conciliar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-1 px-2 rounded-pill ms-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={handleFecharCancelado}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de Resumo OFX - Estorno */}
      {modalEstornoAberto && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1080 }}
            onClick={handleFecharEstorno}
          ></div>
          <div
            className={`modal fade show`}
            role="dialog"
            aria-modal="true"
            style={{ display: 'block', zIndex: 1090 }}
          >
            <div className="modal-dialog modal-sm modal-dialog-centered" role="document" style={{ maxWidth: "28vw" }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" style={{ fontSize: "0.9rem" }}>Conciliar Estorno</h5>
                  <button type="button" className="btn-close" onClick={handleFecharEstorno}></button>
                </div>
                <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1 }}>
                  <table className="table table-striped table-bordered table-hover table-sm" style={{ fontSize: "0.65rem" }}>
                    <tbody>
                      <tr>
                        <td><strong>ID Importação OFX:</strong></td>
                        <td>{dadosLinha?.ID_IMPORTACAO_OFX ?? '-'}</td>
                      </tr>
                      <tr>
                        <td><strong>Dt. Trans.:</strong></td>
                        <td>{formatISODateToBR(dadosLinha?.DATA_TRANSACAO) ?? '-'}</td>
                      </tr>
                      <tr>
                        <td><strong>Valor Transação:</strong></td>
                        <td className="text-end">
                          <span className={toNumber(dadosLinha?.VALOR_TRANSACAO ?? 0) < 0 ? 'text-danger' : 'text-success'}>
                            {formatarValor(dadosLinha?.VALOR_TRANSACAO ?? 0)}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Histórico OFX:</strong></td>
                        <td style={{ whiteSpace: 'nowrap', wordBreak: 'normal' }}>{toSingleLine(dadosLinha?.HISTORICO)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer" style={{ fontSize: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn btn-warning btn-sm py-1 px-2 rounded-pill"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={async () => {
                      try {
                        const rawUser = localStorage.getItem('usuarioLogado');
                        let codusurBind: number | null = null;
                        try {
                          const usuario = rawUser ? JSON.parse(rawUser) : null;
                          const c = usuario?.codusur ?? usuario?.CODUSUR ?? usuario?.matricula ?? usuario?.MATRICULA ?? null;
                          codusurBind = c != null ? Number(String(c).trim()) : null;
                        } catch {
                          codusurBind = null;
                        }

                        let codFornecNum = Number(dadosLinha?.CODFORNEC);
                        if (!Number.isFinite(codFornecNum) || codFornecNum <= 0) {
                          codFornecNum = 0;
                        }

                        const padraoCodConta = 900084;
                        const padraoTiposervico = '99';
                        const padraoTipoParceiro = 'O';
                        const padraoTipoNota = '0';

                        const hoje = new Date();
                        const dd = String(hoje.getDate()).padStart(2, '0');
                        const mm = String(hoje.getMonth() + 1).padStart(2, '0');
                        const yyyy = String(hoje.getFullYear());
                        const hojeBR = `${dd}/${mm}/${yyyy}`;

                        const valorTransacao = toNumber(dadosLinha?.VALOR_TRANSACAO ?? 0);

                        const payload = {
                          codConta: padraoCodConta,
                          codFornec: codFornecNum,
                          historico: 'Estorno de Venda de Mercadoria',
                          duplic: '',
                          valor: valorTransacao,
                          dtVencBind: hojeBR,
                          dtLancBind: hojeBR,
                          dtCompetenciaBind: hojeBR,
                          dtEmissaoBind: hojeBR,
                          codFilial: 1,
                          indice: 'A',
                          tipoLanc: valorTransacao < 0 ? 'P' : 'C',
                          tipoParceiro: padraoTipoParceiro,
                          nomeFunc: '',
                          historico2: 'C1',
                          moeda: 'R',
                          recNumPrinc: null,
                          nfServicoBind: padraoTipoNota,
                          numNotaBind: 0,
                          codRotinaCad: 'MULTGEST',
                          codRotinaAlt: 'MULTGEST',
                          parcela: 1,
                          vlrUtilizadoAdiantFornec: 0,
                          lacreDigConecSocial: null,
                          tiposervico: padraoTiposervico,
                          opcaoPagamentoIpva: null,
                          utilizouRateioConta: 'N',
                          prcRateioUtilizado: 0,
                          reinFEventor4040: 'N',
                          idImportacaoOFX: Number(dadosLinha?.ID_IMPORTACAO_OFX ?? 0) || undefined,
                          codusurBind: codusurBind ?? undefined,
                        };

                        const { conciliarTransacaoEstorno } = await import('../../services/gestfin/ConciliarEstorno');
                        const resp = await conciliarTransacaoEstorno(payload as any);
                        if (!resp?.ok) throw new Error(resp?.error || 'Falha ao conciliar estorno');

                        handleFecharEstorno();
                        if (typeof onHide === 'function') onHide();
                        if (typeof onSuccess === 'function') onSuccess();
                      } catch (e: any) {
                        console.error('Erro ao conciliar estorno:', e);
                        window.alert(String(e?.message || 'Erro ao conciliar estorno'));
                      }
                    }}
                  >
                    Conciliar
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm py-1 px-2 rounded-pill ms-2"
                    style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                    onClick={handleFecharEstorno}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Modal de busca de duplicatas */}
      <BucarDuplicatas
        aberto={modalDuplicatasAberto}
        onClose={handleFecharDuplicatas}
        resumo={dadosLinha}
        onBuscar={handleBuscarDuplicatas}
        onSelecionar={handleSelecionarDuplicata}
        initialBusca={(() => {
          const raw = localStorage.getItem("buscaDuplicatasParametros");
          try {
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })()}
        autoBuscarOnOpen={true}
        successMessage={duplicatasSuccessMsg}
      />
      {/* Modal de Desdobrar Duplicata */}
      <ModalDesdobrarDuplicata
        isOpen={modalDesdobrarAberto}
        onClose={handleFecharDesdobrar}
        onSuccess={handleDesdobramentoConcluido}
        duplicata={duplicataSelecionada}
        valorOfx={dadosLinha?.VALOR_TRANSACAO}
      />
      {/* Modal de Atualização de Juros */}
      <ModalJurosDuplicata
        isOpen={modalJurosAberto}
        onClose={handleFecharJuros}
        duplicata={duplicataSelecionada}
        valorOfx={dadosLinha?.VALOR_TRANSACAO}
        resumoOfx={{
          ID_IMPORTACAO_OFX: dadosLinha?.ID_IMPORTACAO_OFX,
          DATA_TRANSACAO: dadosLinha?.DATA_TRANSACAO,
          VALOR_TRANSACAO: dadosLinha?.VALOR_TRANSACAO,
          HISTORICO: dadosLinha?.HISTORICO,
        }}
        onSuccess={(novoJuros) => {
          setDuplicataSelecionada((prev) => prev ? { ...prev, JUROS: String(novoJuros) } as DuplicataRow : prev);
        }}
      />
      {/* Modal de Atualização de Desconto */}
      <ModalDescontoDuplicata
        isOpen={modalDescontoAberto}
        onClose={handleFecharDesconto}
        duplicata={duplicataSelecionada}
        valorOfx={dadosLinha?.VALOR_TRANSACAO}
        resumoOfx={{
          ID_IMPORTACAO_OFX: dadosLinha?.ID_IMPORTACAO_OFX,
          DATA_TRANSACAO: dadosLinha?.DATA_TRANSACAO,
          VALOR_TRANSACAO: dadosLinha?.VALOR_TRANSACAO,
          HISTORICO: dadosLinha?.HISTORICO,
        }}
        onSuccess={(novoDesconto) => {
          setDuplicataSelecionada((prev) => prev ? { ...prev, DESCONTOFIN: String(novoDesconto) } as DuplicataRow : prev);
        }}
      />
      {/* Modal de Lançamentos Parciais */}
      <ModalLancamentosParciais
        isOpen={modalParcialAberto}
        onClose={handleFecharParcial}
        onSuccess={() => {
          // Fechar modal de conciliação principal
          if (typeof onHide === 'function') onHide();
          // Resetar mensagens locais
          setDuplicatasSuccessMsg(null);
          setDuplicataSelecionada(null);
          setModalParcialAberto(false);
          // Disparar recarga do pai (BuscarLancamentosApagar) via callback
          if (typeof onSuccess === 'function') onSuccess();
        }}
        idImportacaoOFX={dadosLinha?.ID_IMPORTACAO_OFX}
        valorOfx={dadosLinha?.VALOR_TRANSACAO}
        resumoOfx={{
          ID_IMPORTACAO_OFX: dadosLinha?.ID_IMPORTACAO_OFX,
          DATA_TRANSACAO: dadosLinha?.DATA_TRANSACAO,
          VALOR_TRANSACAO: dadosLinha?.VALOR_TRANSACAO,
          HISTORICO: dadosLinha?.HISTORICO,
        }}
        duplicata={duplicataSelecionada}
      />
      {/* Modal de Adiantamento */}
      <ModalAdiantamento
        isOpen={modalAdiantamentoAberto}
        onClose={handleFecharAdiantamento}
        resumoOfx={{
          ID_IMPORTACAO_OFX: dadosLinha?.ID_IMPORTACAO_OFX,
          DATA_TRANSACAO: dadosLinha?.DATA_TRANSACAO,
          VALOR_TRANSACAO: dadosLinha?.VALOR_TRANSACAO,
          HISTORICO: dadosLinha?.HISTORICO,
        }}
        onSuccess={() => {
          // Fecha modal de conciliação principal
          if (typeof onHide === 'function') onHide();
          // Solicita recarga ao pai (BuscarLancamentosApagar)
          if (typeof onSuccess === 'function') onSuccess();
          // Garante que este modal interno esteja fechado
          setModalAdiantamentoAberto(false);
        }}
      />
    </>
  );
};

export default ConciliarModal;