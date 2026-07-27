import React, { useEffect, useMemo, useState } from "react";
import { buscarLancamentosApagar, buscarSomaAdiantamentos, type LancamentosApagarRow } from "../../services/gestfin/BucarLancamentosApagar";
import ConciliarModal from "./Conciliar";
import VisualizarModal from "./VisualizarModal";
import AguardandoPagamentoModal from "./AguardandoPagamentoModal";
import ParcialmenteModal from "./ParcialmenteModal";
import { exportarLancamentosApagar } from "./exportacao";

interface BuscarLancamentosApagarProps {
  isOpen: boolean;
  onClose: () => void;
}

const BuscarLancamentosApagar: React.FC<BuscarLancamentosApagarProps> = ({ isOpen, onClose }) => {
  // Utilitário: converte valores pt-BR para número
  function toNumber(val: unknown): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return val;
    const s = String(val).replace(/\./g, "").replace(/,/g, ".");
    const n = parseFloat(s);
    return Number.isNaN(n) ? 0 : n;
  }

  // Utilitário: formata moeda BRL
  function formatCurrency(n: number): string {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  }

  // Normaliza string para busca (lowercase + remove acentos quando possível)
  function normalizeStr(s: unknown): string {
    const str = String(s ?? "").toLowerCase();
    try {
      return str.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    } catch {
      return str;
    }
  }

  // Formata ISO (ex.: 2025-10-01T00:00:00.000Z) para DD/MM/YYYY ignorando fuso
  function formatISODateToBR(iso?: string): string | null {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
  }
  // Quebra em vírgulas sem afetar decimais (ex: 1.234,56)
  function renderWithCommaBreaks(val: unknown) {
    if (val === null || val === undefined) return null;
    const str = String(val);
    const parts = str.split(/,(?!\d)/); // divide em vírgula que NÃO é seguida de dígito
    if (parts.length === 1) return str;
    return (
      <>
        {parts.map((p, i) => (
          <span key={i}>
            {p.trim()}
            {i < parts.length - 1 && (<><span>,</span><br /></>)}
          </span>
        ))}
      </>
    );
  }

  // Para Histórico Duplicata: quebra em vírgulas (não-decimais) e aplica quebra de 20 caracteres por palavra
  function renderHistoricoDuplicata(val?: string) {
    if (!val) return null;
    // Normaliza quebras de linha internas (ex.: "Ange\nla" -> "Angela")
    const str = String(val).replace(/\s*\n\s*/g, " ");

    // Helper: quebra por vírgula e aplica wrap por palavra (20 chars) em cada parte
    const renderCommaParts = (text: string) => {
      const parts = text.split(/,(?!\d)/); // divide em vírgula que NÃO é seguida de dígito
      return (
        <>
          {parts.map((p, i) => (
            <span key={i}>
              {renderFornecedorBreak(p.trim(), 20)}
              {i < parts.length - 1 && (
                <>
                  <span>,</span>
                  <br />
                </>
              )}
            </span>
          ))}
        </>
      );
    };

    // Detecta padrão com ' - Pix'
    const pixMatch = str.match(/^(.*? - Pix)(.*)$/i);
    if (pixMatch) {
      const first = pixMatch[1].trim();
      const second = pixMatch[2].trim();

      // Condição de continuação em uma única linha:
      // - Quando há padrão tipo data/código com barras antes de " - Pix" (ex.: 04/10 06/1)
      const hasSlashNumbers = /(\d{1,2}\/\d{1,2})/.test(first);
      if (hasSlashNumbers) {
        const combined = `${first} ${second}`.replace(/\s{2,}/g, " ");
        return <span>{renderCommaParts(combined)}</span>;
      }

      // Caso padrão anterior: quebra após " - Pix" e mostra o restante em nova linha
      return (
        <>
          <span>{renderCommaParts(first)}</span>
          <br />
          <span>{renderCommaParts(second)}</span>
        </>
      );
    }

    // Sem ' - Pix': quebra por vírgulas não-decimais, e aplica wrap por palavra
    return renderCommaParts(str);
  }

  // Para Histórico OFX: quebra por hífen e preserva decimais/negativos
  function renderHistoricoOFX(val?: string) {
    if (!val) return null;
    const parts = String(val).split(/-(?!\d)/); // divide em hífen que NÃO é seguido de dígito
    return (
      <>
        {parts.map((p, i) => (
          <span key={i}>
            {renderWithCommaBreaks(p.trim())}
            {i < parts.length - 1 && (<><span>-</span><br /></>)}
          </span>
        ))}
      </>
    );
  }
  // Fornecedor: quebra automática em linhas de até maxLen, evitando cortar palavras
  // Regra especial: não deixar "E" sozinho no fim da linha; une com a próxima palavra (ex.: "E COMERCIO")
  function renderFornecedorBreak(val?: string, maxLen = 20) {
    if (!val) return null;
    const str = String(val).replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
    if (str.length <= maxLen) return <span>{str}</span>;

    const words = str.split(" ");
    const segments: string[] = [];
    let current = "";

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const candidate = current ? `${current} ${w}` : w;
      if (candidate.length <= maxLen) {
        current = candidate;
        continue;
      }

      // Vai exceder: regra especial para não terminar com "E"
      const lastWord = current.split(" ").pop()?.toLowerCase();
      if (lastWord === "e" && w) {
        // Inclui também a próxima palavra para manter "E <palavra>" junto, mesmo que passe do maxLen
        current = `${current} ${w}`;
        segments.push(current);
        current = "";
        continue;
      }

      // Finaliza o segmento atual e começa próximo com a palavra excedente
      if (current) segments.push(current);
      current = w;
    }

    if (current) segments.push(current);

    return (
      <>
        {segments.map((seg, idx) => (
          <span key={idx}>
            {seg}
            {idx < segments.length - 1 && <br />}
          </span>
        ))}
      </>
    );
  }
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const yyyy = inicioMes.getFullYear();
    const mm = String(inicioMes.getMonth() + 1).padStart(2, "0");
    const dd = String(inicioMes.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [dataFinal, setDataFinal] = useState<string>(() => {
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const dd = String(hoje.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [carregando, setCarregando] = useState<boolean>(false);
  const [erro, setErro] = useState<string>("");
  const [resultados, setResultados] = useState<LancamentosApagarRow[]>([]);
  const [adiantamentoTotal, setAdiantamentoTotal] = useState<number>(0);
  const [apenasRecnumVazio, setApenasRecnumVazio] = useState<boolean>(false);
  const [apenasRecnumMultiplo, setApenasRecnumMultiplo] = useState<boolean>(false);
  const [somentePago, setSomentePago] = useState<boolean>(false);
  const [comDiferenca, setComDiferenca] = useState<boolean>(false);
  const [somenteComJuros, setSomenteComJuros] = useState<boolean>(false);
  const [somenteComDesconto, setSomenteComDesconto] = useState<boolean>(false);
  const [pesquisaAvancada, setPesquisaAvancada] = useState<string>("");
  const [modalConciliarAberto, setModalConciliarAberto] = useState<boolean>(false);
  const [linhaSelecionada, setLinhaSelecionada] = useState<LancamentosApagarRow | null>(null);
  const [modalVisualizarAberto, setModalVisualizarAberto] = useState<boolean>(false);
  const [modalAguardandoAberto, setModalAguardandoAberto] = useState<boolean>(false);
  const [modalParcialAberto, setModalParcialAberto] = useState<boolean>(false);
  const [modalExportarAberto, setModalExportarAberto] = useState<boolean>(false);
  const [selectedRowId, setSelectedRowId] = useState<string | number | null>(null);
  // Formato de exportação (alinha estilo com modal de Areceber)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'xlsx'>("csv");

  // Soma números presentes em uma string (formato pt-BR), ignorando vírgulas separadoras entre itens
  function sumNumbersFromString(val: unknown, opts: { absolute?: boolean } = {}): number {
    const { absolute } = opts;
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return absolute ? Math.abs(val) : val;
    const str = String(val).replace(/\s*\n\s*/g, " ").trim();
    const regex = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g; // pt-BR: milhar com ponto e decimal com vírgula
    const matches = str.match(regex);
    if (!matches) return 0;
    const total = matches.reduce((acc, m) => {
      const n = parseFloat(m.replace(/\./g, "").replace(/,/g, "."));
      const v = Number.isNaN(n) ? 0 : (absolute ? Math.abs(n) : n);
      return acc + v;
    }, 0);
    return Math.round(total * 100) / 100;
  }

  function calcDiferenca(row: LancamentosApagarRow): number {
    // Regra: quando histórico for "TRANSAÇÃO CANCELADA POR ERRO NO BANCO", Diferença deve ser 0,00
    const normalizeCompare = (v: unknown) => normalizeStr(v).replace(/\s+/g, " ").trim();
    const targetCancelado = normalizeCompare("TRANSAÇÃO CANCELADA POR ERRO NO BANCO");
    const histOfx = normalizeCompare(row.HISTORICO);
    const histDup = normalizeCompare(row.HISTORICO_DUPLICATA);
    if (histOfx === targetCancelado || histDup === targetCancelado) {
      return 0;
    }

    // Valor de transação do OFX sempre negativo no dado de origem; para cálculo, usar absoluto
    const valorTransPos = sumNumbersFromString(row.VALOR_TRANSACAO, { absolute: true });
    const valor = sumNumbersFromString(row.VALOR_LANCAMENTO_INTERNO);
    const descAbs = Math.abs(sumNumbersFromString(row.DESCONTOFIN));
    const jurosAbs = Math.abs(sumNumbersFromString(row.JUROS));
    // Regra dinâmica:
    // - Se Transação > Duplicata: espera-se juros adicionando e desconto subtraindo
    // - Se Transação < Duplicata: espera-se desconto adicionando e juros subtraindo
    const duplicataLiquida = valorTransPos >= valor
      ? Math.max(0, valor + jurosAbs - descAbs)
      : Math.max(0, valor - jurosAbs - descAbs);
    const diff = Math.abs(valorTransPos - duplicataLiquida);
    return Math.round(diff * 100) / 100;
  }

  function countNumbersFromString(val: unknown): number {
    if (val === null || val === undefined) return 0;
    const str = String(val).replace(/\s*\n\s*/g, " ").trim();
    const regex = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
    const matches = str.match(regex);
    return matches ? matches.length : 0;
  }

  function hasMultipleValores(row: LancamentosApagarRow): boolean {
    const cValor = countNumbersFromString(row.VALOR_LANCAMENTO_INTERNO);
    const cDesc = countNumbersFromString(row.DESCONTOFIN);
    const cJuros = countNumbersFromString(row.JUROS);
    return cValor > 1 || cDesc > 1 || cJuros > 1;
  }

  // Função robusta para parse de datas em formatos ISO e dd/mm/yyyy (UTC para ISO)
  const parseDateFlex = (val: unknown) => {
    if (!val) return Number.POSITIVE_INFINITY;
    if (val instanceof Date) return val.getTime();
    const str = String(val).trim();
    // ISO: usa somente a parte de data e monta timestamp UTC
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, yyyy, mm, dd] = isoMatch;
      return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
    }
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
    }
    return Number.POSITIVE_INFINITY;
  };

  // Ordena cronologicamente usando Dt. Trans. como primário, Dt. Pgto como secundário e ID como desempate
  const resultadosOrdenados = useMemo(() => {
    return [...resultados].sort((a, b) => {
      const ta = parseDateFlex(a.DATA_TRANSACAO);
      const tb = parseDateFlex(b.DATA_TRANSACAO);
      if (ta !== tb) return ta - tb;

      const tpa = parseDateFlex(a.DTPAGTO);
      const tpb = parseDateFlex(b.DTPAGTO);
      if (tpa !== tpb) return tpa - tpb;

      const ida = Number(a.ID_IMPORTACAO_OFX);
      const idb = Number(b.ID_IMPORTACAO_OFX);
      if (!Number.isNaN(ida) && !Number.isNaN(idb)) return ida - idb;
      return String(a.ID_IMPORTACAO_OFX).localeCompare(String(b.ID_IMPORTACAO_OFX));
    });
  }, [resultados]);

  const resultadosExibidos = useMemo(() => {
    let base = resultadosOrdenados;
    if (apenasRecnumVazio) {
      base = base.filter((row) => {
        const rec = row.RECNUM_PRINCIPAL_OU_PARCIAIS as unknown;
        if (rec === null || rec === undefined) return true;
        return String(rec).trim() === "";
      });
    }
    if (comDiferenca) {
      base = base.filter((row) => {
        const rec = String(row.RECNUM_PRINCIPAL_OU_PARCIAIS ?? "").replace(/\s*\n\s*/g, " ").trim();
        if (rec.length === 0) return false; // só considerar quando a coluna Diferença existe (Recnum preenchido)
        return calcDiferenca(row) > 0; // e é maior que 0,00
      });
    }
    if (apenasRecnumMultiplo) {
      base = base.filter((row) => {
        const recval = row.RECNUM_PRINCIPAL_OU_PARCIAIS as unknown;
        if (recval === null || recval === undefined) return false;
        const s = String(recval).replace(/\s*\n\s*/g, " ");
        const parts = s.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
        return parts.length > 1;
      });
    }
    if (somentePago) {
      base = base.filter((row) => String(row.STATUS_PAGAMENTO).trim().toLowerCase() === "pago");
    }
    if (somenteComJuros) {
      base = base.filter((row) => sumNumbersFromString(row.JUROS, { absolute: true }) > 0);
    }
    if (somenteComDesconto) {
      base = base.filter((row) => sumNumbersFromString(row.DESCONTOFIN, { absolute: true }) > 0);
    }
    const q = pesquisaAvancada.trim();
    if (q.length > 0) {
      const nq = normalizeStr(q);
      base = base.filter((row) => {
        const hay = [
          row.ID_IMPORTACAO_OFX,
          row.HISTORICO,
          row.HISTORICO_DUPLICATA,
          row.FORNECEDOR,
          row.CODFORNEC,
          row.NOME_BANCO_FILIAL,
          row.RECNUM_PRINCIPAL_OU_PARCIAIS,
          row.CONTA,
          row.NUMNOTA,
          row.NFSERVICO_STATUS,
          row.STATUS_PAGAMENTO,
          row.VALOR_TRANSACAO,
          row.VALOR_LANCAMENTO_INTERNO,
        ].map((v) => normalizeStr(v));
        return hay.some((h) => h.includes(nq));
      });
    }
    return base;
  }, [resultadosOrdenados, apenasRecnumVazio, comDiferenca, apenasRecnumMultiplo, somentePago, somenteComJuros, somenteComDesconto, pesquisaAvancada]);

  // Totalizadores baseados nos resultados filtrados atuais
  const totalizadores = useMemo(() => {
    const totals = resultadosExibidos.reduce(
      (acc, row) => {
        acc.qtd += 1;
        acc.valorTrans += toNumber(row.VALOR_TRANSACAO);
        // Soma todos os valores presentes na string (inclui parciais)
        acc.valorInterno += sumNumbersFromString(row.VALOR_LANCAMENTO_INTERNO);
        acc.desconto += toNumber(row.DESCONTOFIN);
        acc.juros += toNumber(row.JUROS);

        const st = String(row.STATUS_PAGAMENTO ?? "").trim().toLowerCase();
        if (st === "pago") acc.qtdPago += 1;
        else acc.qtdNaoPago += 1;

        const rec = String(row.RECNUM_PRINCIPAL_OU_PARCIAIS ?? "").replace(/\s*\n\s*/g, " ");
        if (rec.trim() === "") acc.qtdRecnumVazio += 1;
        const parts = rec.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
        if (parts.length > 1) acc.qtdRecnumMultiplo += 1;

        return acc;
      },
      {
        qtd: 0,
        valorTrans: 0,
        valorInterno: 0,
        desconto: 0,
        juros: 0,
        qtdPago: 0,
        qtdNaoPago: 0,
        qtdRecnumVazio: 0,
        qtdRecnumMultiplo: 0,
      }
    );
    return totals;
  }, [resultadosExibidos]);

  // Total de Valor Trans. ABSOLUTO para linhas com HISTÓRICO_DUPLICATA exatamente
  // "TRANSAÇÃO CANCELADA POR ERRO NO BANCO" — usado para deduzir da Diferença Total
  const totalTransAbsCanceladaPorErroBanco = useMemo(() => {
    const alvo = normalizeStr("TRANSAÇÃO CANCELADA POR ERRO NO BANCO");
    let total = 0;
    resultadosExibidos.forEach((row) => {
      const historicoDup = normalizeStr(String(row.HISTORICO_DUPLICATA ?? "").replace(/\s*\n\s*/g, " ").trim());
      if (historicoDup === alvo) {
        const vTransAbs = sumNumbersFromString(row.VALOR_TRANSACAO, { absolute: true });
        total += vTransAbs;
      }
    });
    return Math.round(total * 100) / 100;
  }, [resultadosExibidos]);

  
  // Diferença agregada para totalizadores (com base nos totalizadores exibidos)
  const totalizadoresDiferenca = useMemo(() => {
    const transAbs = Math.abs(totalizadores.valorTrans);
    const liquidoInterno = Math.max(
      0,
      Math.abs(totalizadores.valorInterno) + Math.abs(totalizadores.juros) - Math.abs(totalizadores.desconto)
    );
    const diffBruto = Math.abs(transAbs - liquidoInterno);
    const diffTotal = Math.max(0, diffBruto - Math.abs(totalTransAbsCanceladaPorErroBanco));
    return {
      transAbs: Math.round(transAbs * 100) / 100,
      liquidoInterno: Math.round(liquidoInterno * 100) / 100,
      diffTotal: Math.round(diffTotal * 100) / 100,
    };
  }, [totalizadores, totalTransAbsCanceladaPorErroBanco]);

  // Totalizadores por igualdade estrita em HISTÓRICO_DUPLICATA
  const totaisDuplicataCategorias = useMemo(() => {
    const alvoCancelada = normalizeStr("TRANSAÇÃO CANCELADA");
    const alvoErroBanco = normalizeStr("POR ERRO NO BANCO");
    const alvoEstornoMercadoria = normalizeStr("Estorno de Venda de Mercadoria");

    const acc = {
      cancelada: { qtd: 0, total: 0 },
      erroBanco: { qtd: 0, total: 0 },
      estornoMercadoria: { qtd: 0, total: 0 },
    };

    resultadosExibidos.forEach((row) => {
      const historicoDup = normalizeStr(String(row.HISTORICO_DUPLICATA ?? "").replace(/\s*\n\s*/g, " ").trim());
      const valor = toNumber(row.VALOR_LANCAMENTO_INTERNO);

      if (historicoDup === alvoCancelada) {
        acc.cancelada.qtd += 1;
        acc.cancelada.total += valor;
      } else if (historicoDup === alvoErroBanco) {
        acc.erroBanco.qtd += 1;
        acc.erroBanco.total += valor;
      } else if (historicoDup === alvoEstornoMercadoria) {
        acc.estornoMercadoria.qtd += 1;
        acc.estornoMercadoria.total += valor;
      }
    });

    return acc;
  }, [resultadosExibidos]);

  // Quantidade de linhas com HISTÓRICO_DUPLICATA exatamente "TRANSAÇÃO CANCELADA POR ERRO NO BANCO"
  const qtdCanceladaPorErroBanco = useMemo(() => {
    const alvo = normalizeStr("TRANSAÇÃO CANCELADA POR ERRO NO BANCO");
    let count = 0;
    resultadosExibidos.forEach((row) => {
      const historicoDup = normalizeStr(String(row.HISTORICO_DUPLICATA ?? "").replace(/\s*\n\s*/g, " ").trim());
      if (historicoDup === alvo) count += 1;
    });
    return count;
  }, [resultadosExibidos]);

  // Total de Valor Trans. ABSOLUTO para linhas com HISTÓRICO_DUPLICATA exatamente "TRANSAÇÃO CANCELADA POR ERRO NO BANCO"
  

  useEffect(() => {
    if (!isOpen) {
      const hoje = new Date();
      const yyyyF = hoje.getFullYear();
      const mmF = String(hoje.getMonth() + 1).padStart(2, "0");
      const ddF = String(hoje.getDate()).padStart(2, "0");
      setDataFinal(`${yyyyF}-${mmF}-${ddF}`);
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const yyyyI = inicioMes.getFullYear();
      const mmI = String(inicioMes.getMonth() + 1).padStart(2, "0");
      const ddI = String(inicioMes.getDate()).padStart(2, "0");
      setDataInicio(`${yyyyI}-${mmI}-${ddI}`);
      setErro("");
      setResultados([]);
      setCarregando(false);
    }
  }, [isOpen]);

  const titulo = useMemo(() => "Lançamentos à Pagar", []);

  const onBuscar = async () => {
    setErro("");
    if (!dataInicio || !dataFinal) {
      setErro("Informe as datas de início e final");
      return;
    }

    try {
      setCarregando(true);
      const payload = { dataInicio, dataFinal };
      const [data, somaAdiantamentos] = await Promise.all([
        buscarLancamentosApagar(payload),
        buscarSomaAdiantamentos(payload),
      ]);
      setResultados(Array.isArray(data) ? data : []);
      setAdiantamentoTotal(Number.isFinite(somaAdiantamentos) ? somaAdiantamentos : 0);
    } catch (e) {
      setErro("Falha ao buscar lançamentos à pagar");
    } finally {
      setCarregando(false);
    }
  };

  const onAssinar = () => {
    // Placeholder: aqui podemos integrar com fluxo de assinatura
    // Ex.: selecionar linhas, preparar payload e chamar API
    console.log("Assinar clicado", { quantidade: resultadosExibidos.length });
  };

  const onPagar = () => {
    // Placeholder: aqui podemos integrar com fluxo de pagamento
    // Ex.: selecionar linhas, preparar payload e chamar API
    console.log("Pagar clicado", { quantidade: resultadosExibidos.length });
  };

  const onConciliar = (row: LancamentosApagarRow) => {
    setLinhaSelecionada(row);
    const isPago = String(row.STATUS_PAGAMENTO).trim().toLowerCase() === "pago";
    const diferenca = calcDiferenca(row);
    const isConciliado = Math.abs(diferenca) < 0.01;
    const isMultiplo = hasMultipleValores(row);
    if (isPago) {
      setModalVisualizarAberto(true);
    } else if (isConciliado && isMultiplo) {
      setModalParcialAberto(true);
    } else if (isConciliado) {
      setModalAguardandoAberto(true);
    } else {
      setModalConciliarAberto(true);
    }
  };

  const fecharModalConciliar = () => {
    setModalConciliarAberto(false);
    setLinhaSelecionada(null);
  };

  const fecharModalVisualizar = () => {
    setModalVisualizarAberto(false);
    setLinhaSelecionada(null);
  };

  const fecharModalAguardando = () => {
    setModalAguardandoAberto(false);
    setLinhaSelecionada(null);
  };

  const fecharModalParcial = () => {
    setModalParcialAberto(false);
    setLinhaSelecionada(null);
  };

  const onExportar = () => {
    setModalExportarAberto(true);
  };

  const fecharModalExportar = () => {
    setModalExportarAberto(false);
  };

  // Removido handler antigo por formato individual; usamos um único botão Exportar

  const handleExport = () => {
    try {
      exportarLancamentosApagar(exportFormat, resultadosExibidos, { filenamePrefix: 'lancamentos_apagar', adiantamentoTotal });
    } finally {
      setModalExportarAberto(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Espaçamento padrão entre colunas */}
      <style>{`
        .compact-table th, .compact-table td {
          padding: 0.35rem 0.6rem;
          vertical-align: middle;
        }
        /* Realce suave ao passar o mouse e seleção verde ao clicar */
        .compact-table tbody tr {
          transition: background-color 0.15s ease-in-out;
        }
        /* Aplica o hover diretamente nos cells para sobrepor table-striped/table-hover */
        .compact-table tbody tr:hover > * {
          background-color: #e9f7ef !important; /* leve verde no hover */
        }
        .compact-table tbody tr:hover {
          cursor: pointer;
        }
        /* Seleção verde por clique: aplica nos cells para garantir prioridade */
        .compact-table tbody tr.selected-row > * {
          background-color: #d1e7dd !important; /* verde sutil quando selecionado */
        }
      `}</style>
      {/* Backdrop */}
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />

      {/* Modal centralizado */}
      <div
        className="modal fade show"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modalApagarTitulo"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1050, minHeight: "100vh" }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document" style={{ maxWidth: "95vw", minHeight: "70vh", maxHeight: "75vh" }}>
          <div className="modal-content" style={{ display: "flex", flexDirection: "column", minHeight: "70vh", maxHeight: "75vh", height: "auto" }}>
            <div className="modal-header">
              <h5 className="modal-title" id="modalApagarTitulo" style={{ fontSize: "0.9rem" }}>{titulo}</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>

            <div className="modal-body" style={{ fontSize: "0.75rem", lineHeight: 1.1, flex: "1 1 auto", overflow: "hidden" }}>
              {/* Filtros compactos em uma linha */}
              <div className="d-flex align-items-end gap-2 flex-nowrap mb-2" style={{ fontSize: "0.75rem", lineHeight: "1.1" }}>
                <div className="d-flex align-items-center me-2">
                  <label htmlFor="dataInicio" className="form-label mb-0 me-1" style={{ fontSize: "0.75rem" }}>Data Início</label>
                  <input
                    id="dataInicio"
                    type="date"
                    className={`form-control form-control-sm ${!dataInicio && erro ? "is-invalid" : ""}`}
                    style={{ width: "9rem" }}
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="d-flex align-items-center me-2">
                  <label htmlFor="dataFinal" className="form-label mb-0 me-1" style={{ fontSize: "0.75rem" }}>Data Final</label>
                  <input
                    id="dataFinal"
                    type="date"
                    className={`form-control form-control-sm ${!dataFinal && erro ? "is-invalid" : ""}`}
                    style={{ width: "9rem" }}
                    value={dataFinal}
                    onChange={(e) => setDataFinal(e.target.value)}
                  />
                </div>
                 <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onBuscar}
                  disabled={carregando}
                >
                  {carregando ? "Buscando..." : "Buscar"}
                </button>
              <div className="d-flex align-items-center ms-auto gap-2 flex-wrap">
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="switchRecnumVazio"
                    checked={apenasRecnumVazio}
                    onChange={(e) => setApenasRecnumVazio(e.target.checked)}
                  />
                  <label className="form-check-label mb-0" htmlFor="switchRecnumVazio" style={{ fontSize: "0.75rem" }}>
                    Sem Conciliação
                  </label>
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="switchComDiferenca"
                    checked={comDiferenca}
                    onChange={(e) => setComDiferenca(e.target.checked)}
                  />
                  <label className="form-check-label mb-0" htmlFor="switchComDiferenca" style={{ fontSize: "0.75rem" }}>
                    Com Diferença
                  </label>
                </div>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="switchRecnumMultiplo"
                    checked={apenasRecnumMultiplo}
                    onChange={(e) => setApenasRecnumMultiplo(e.target.checked)}
                  />
                  <label className="form-check-label mb-0" htmlFor="switchRecnumMultiplo" style={{ fontSize: "0.75rem" }}>
                    Conciliação Parcial
                  </label>
                </div>
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="switchSomentePago"
                      checked={somentePago}
                      onChange={(e) => setSomentePago(e.target.checked)}
                    />
                    <label className="form-check-label mb-0" htmlFor="switchSomentePago" style={{ fontSize: "0.75rem" }}>
                      Somente Pago
                    </label>
                  </div>
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="switchSomenteComJuros"
                      checked={somenteComJuros}
                      onChange={(e) => setSomenteComJuros(e.target.checked)}
                    />
                    <label className="form-check-label mb-0" htmlFor="switchSomenteComJuros" style={{ fontSize: "0.75rem" }}>
                      Com Juros
                    </label>
                  </div>
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="switchSomenteComDesconto"
                      checked={somenteComDesconto}
                      onChange={(e) => setSomenteComDesconto(e.target.checked)}
                    />
                    <label className="form-check-label mb-0" htmlFor="switchSomenteComDesconto" style={{ fontSize: "0.75rem" }}>
                      Com Desconto
                    </label>
                  </div>
                  <div className="d-flex align-items-center">
                    <input
                      id="pesquisaAvancada"
                      type="text"
                      className="form-control form-control-sm"
                      style={{ width: "15rem" }}
                      placeholder="Pesquisa avançada"
                      aria-label="Pesquisa avançada"
                      maxLength={15}
                      value={pesquisaAvancada}
                      onChange={(e) => setPesquisaAvancada(e.target.value.slice(0, 15))}
                    />
                  </div>
                </div>
              </div>
              {erro && <div className="text-danger mb-2">{erro}</div>}

              {/* Resultados formatados - rolagem apenas na área da tabela */}
              <div className="table-responsive" style={{ maxHeight: "50vh", overflowY: "auto" }}>
                <table className="table table-sm table-striped table-hover compact-table" style={{ minWidth: "1800px", fontSize: "0.7rem" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 2, background: "#fff" }}>
                    <tr>
                      {/* Ordem solicitada */}
                      <th>Id</th>
                      <th>Dt. Trans.</th>
                      <th>Histórico OFX</th>
                      <th>Valor Trans.</th>
                      <th>Banco/Filial</th>
                      <th>Recnum</th>
                      <th>Fornec.</th>
                      <th>Histórico Duplicata</th>
                      <th>Conta</th>
                      <th>NFs</th>
                      <th>Nº Nota</th>
                      <th>Valor</th>
                      <th>Desc.</th>
                      <th>Juros</th>
                      <th>Difer.</th>
                      <th>Dt. Pgto</th>
                      <th>Status</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosExibidos.length === 0 && (
                      <tr>
                        <td className="text-muted" colSpan={18}>Nenhum lançamento encontrado</td>
                      </tr>
                    )}
                    {resultadosExibidos.map((row, idx) => (
                      <tr
                        key={idx}
                        className={selectedRowId === String(row.ID_IMPORTACAO_OFX) ? "selected-row" : ""}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          const idAtual = String(row.ID_IMPORTACAO_OFX);
                          setSelectedRowId(selectedRowId === idAtual ? null : idAtual);
                        }}
                      >
                        {/* Ordem solicitada */}
                        <td>{renderWithCommaBreaks(row.ID_IMPORTACAO_OFX)}</td>
                        <td>{formatISODateToBR(row.DATA_TRANSACAO)}</td>
                        <td style={{ whiteSpace: "normal", wordBreak: "break-word" }} title={row.HISTORICO_DUPLICATA}>{renderHistoricoOFX(row.HISTORICO)}</td>
                        <td className={toNumber(row.VALOR_TRANSACAO) < 0 ? "text-danger" : "text-success"}>{renderWithCommaBreaks(row.VALOR_TRANSACAO)}</td>
                        <td>{renderWithCommaBreaks(row.NOME_BANCO_FILIAL)}</td>
                        <td>{renderWithCommaBreaks(row.RECNUM_PRINCIPAL_OU_PARCIAIS)}</td>
                        <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{renderFornecedorBreak(row.FORNECEDOR)}</td>
                        <td style={{ whiteSpace: "normal", wordBreak: "break-word" }} title={row.HISTORICO_DUPLICATA}>
                          {renderHistoricoDuplicata(row.HISTORICO_DUPLICATA)}
                        </td>
                        <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{renderWithCommaBreaks(row.CONTA)}</td>
                        <td>{renderWithCommaBreaks(row.NFSERVICO_STATUS)}</td>
                        <td>{renderWithCommaBreaks(row.NUMNOTA)}</td>
                        <td className={toNumber(row.VALOR_LANCAMENTO_INTERNO) < 0 ? "text-danger" : "text-success"}>{renderWithCommaBreaks(row.VALOR_LANCAMENTO_INTERNO)}</td>
                        <td className="text-primary">{renderWithCommaBreaks(row.DESCONTOFIN)}</td>
                        <td className="text-danger">{renderWithCommaBreaks(row.JUROS)}</td>
                        <td className="text-warning">
                          {String(row.RECNUM_PRINCIPAL_OU_PARCIAIS ?? "").replace(/\s*\n\s*/g, " ").trim()
                            ? formatCurrency(calcDiferenca(row))
                            : ""}
                        </td>
                        <td>{renderWithCommaBreaks(row.DTPAGTO)}</td>
                        <td>{renderWithCommaBreaks(row.STATUS_PAGAMENTO)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm py-1 px-2"
                            style={{ fontSize: "0.7rem", lineHeight: 1.1 }}
                            onClick={(e) => { e.stopPropagation(); onConciliar(row); }}
                            disabled={carregando}
                          >
                            {(() => {
                              const isPago = String(row.STATUS_PAGAMENTO).trim().toLowerCase() === "pago";
                              const diff = calcDiferenca(row);
                              const isConciliado = Math.abs(diff) < 0.01;
                              const isMultiplo = hasMultipleValores(row);
                              if (isPago) return "Visualizar";
                              if (isConciliado && isMultiplo) return "Parcial";
                              if (isConciliado) return "Conciliado";
                              return "Conciliar";
                            })()}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer d-flex justify-content-between align-items-center" style={{ fontSize: "0.75rem" }}>
              <div className="d-flex flex-wrap align-items-start gap-3 flex-grow-1">
                <div className="d-flex flex-column gap-1">
                  <div className="fw-bold text-muted">Resumo</div>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="badge bg-secondary">Registros: {totalizadores.qtd}</span>
                    <span className="badge bg-primary">Valor Trans.: {formatCurrency(totalizadores.valorTrans)}</span>
                    <span className="badge bg-primary">Valor Interno: {formatCurrency(totalizadores.valorInterno)}</span>
                    <span className="badge bg-success">Desconto: {formatCurrency(totalizadores.desconto)}</span>
                    <span className="badge bg-danger">Juros: {formatCurrency(totalizadores.juros)}</span>
                    <span className="badge bg-info text-dark">Qtd. Estorno: {totaisDuplicataCategorias.estornoMercadoria.qtd}</span>
                    <span className="badge bg-info text-dark">Total Estorno: {formatCurrency(totaisDuplicataCategorias.estornoMercadoria.total)}</span>
                    <span className="badge bg-secondary text-light">Qtd. Erro Banco: {qtdCanceladaPorErroBanco}</span>
                    <span className="badge bg-secondary text-light">Total erro: {formatCurrency(totalTransAbsCanceladaPorErroBanco)}</span>
                    <span className="badge bg-info text-dark">Pago: {totalizadores.qtdPago}</span>
                    <span className="badge bg-warning text-dark">Não Pago: {totalizadores.qtdNaoPago}</span>
                    <span className="badge text-light" style={{ backgroundColor: "#6f42c1" }}>Diferença Total: {formatCurrency(totalizadoresDiferenca.diffTotal)}</span>
                    <span className="badge bg-secondary text-light">Adiant. Fornec.: {formatCurrency(adiantamentoTotal)}</span>
                    <span className="badge bg-dark">Sem Conciliação: {totalizadores.qtdRecnumVazio}</span>
                    <span className="badge bg-dark">Conciliação Parcial: {totalizadores.qtdRecnumMultiplo}</span>
                  </div>
                  
                </div>
              </div>
              <div className="d-flex align-items-center gap-2 ms-auto justify-content-end">
                <button type="button" className="btn btn-outline-primary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onAssinar} disabled={carregando}>Assinar</button>
                <button type="button" className="btn btn-success btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onExportar} disabled={carregando}>Exportar</button>
                <button type="button" className="btn btn-primary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onPagar} disabled={carregando}>Pagar</button>
                <button type="button" className="btn btn-secondary btn-sm py-1 px-2" style={{ fontSize: "0.7rem", lineHeight: 1.1 }} onClick={onClose}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Exportação (estilo unificado) */}
      {modalExportarAberto && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, background: "rgba(0,0,0,0.35)", zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ minWidth: "380px", maxWidth: "90vw" }}>
            <div className="card-header">Exportar Lançamentos</div>
            <div className="card-body" style={{ fontSize: "0.85rem" }}>
              <p className="mb-2">Selecione o formato de exportação:</p>
              <div className="d-flex flex-column gap-2 mb-3">
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="exportFormatApagar" id="exportCSVApagar" checked={exportFormat === "csv"} onChange={() => setExportFormat("csv")} />
                  <label className="form-check-label" htmlFor="exportCSVApagar">CSV</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="exportFormatApagar" id="exportXLSXApagar" checked={exportFormat === "xlsx"} onChange={() => setExportFormat("xlsx")} />
                  <label className="form-check-label" htmlFor="exportXLSXApagar">XLSX</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="exportFormatApagar" id="exportPDFApagar" checked={exportFormat === "pdf"} onChange={() => setExportFormat("pdf")} />
                  <label className="form-check-label" htmlFor="exportPDFApagar">PDF</label>
                </div>
              </div>
              <div className="alert alert-secondary py-2" style={{ fontSize: "0.8rem" }}>
                Registros selecionados para exportação: <strong>{resultadosExibidos.length}</strong>
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button className="btn btn-outline-secondary btn-sm" onClick={fecharModalExportar}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleExport}>Exportar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Conciliação */}
      <ConciliarModal
        show={modalConciliarAberto}
        onHide={fecharModalConciliar}
        dadosLinha={linhaSelecionada}
        onSuccess={onBuscar}
      />

      {/* Modal Conciliação Parcial */}
      <ParcialmenteModal
        isOpen={modalParcialAberto}
        onClose={fecharModalParcial}
        dadosLinha={linhaSelecionada}
      />

      {/* Modal Aguardando Pagamento */}
      <AguardandoPagamentoModal
        isOpen={modalAguardandoAberto}
        onClose={fecharModalAguardando}
        dadosLinha={linhaSelecionada}
      />

      {/* Modal Visualizar */}
      <VisualizarModal
        isOpen={modalVisualizarAberto}
        onClose={fecharModalVisualizar}
        dadosLinha={linhaSelecionada}
      />
    </>
  );
};

export default BuscarLancamentosApagar;