import { type LancamentosApagarRow } from "../../services/gestfin/BucarLancamentosApagar";

function normalizeStr(s: unknown): string {
  const str = String(s ?? "").toLowerCase();
  try {
    return str.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  } catch {
    return str;
  }
}

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

function calcDiferenca(row: LancamentosApagarRow): number {
  const normalizeCompare = (v: unknown) => normalizeStr(v).replace(/\s+/g, " ").trim();
  const targetCancelado = normalizeCompare("TRANSAÇÃO CANCELADA POR ERRO NO BANCO");
  const histOfx = normalizeCompare(row.HISTORICO);
  const histDup = normalizeCompare(row.HISTORICO_DUPLICATA);
  if (histOfx === targetCancelado || histDup === targetCancelado) {
    return 0;
  }

  const valorTransPos = sumNumbersFromString(row.VALOR_TRANSACAO, { absolute: true });
  const valor = sumNumbersFromString(row.VALOR_LANCAMENTO_INTERNO);
  const descAbs = Math.abs(sumNumbersFromString(row.DESCONTOFIN));
  const jurosAbs = Math.abs(sumNumbersFromString(row.JUROS));
  const duplicataLiquida = valorTransPos >= valor
    ? Math.max(0, valor + jurosAbs - descAbs)
    : Math.max(0, valor - jurosAbs - descAbs);
  const diff = Math.abs(valorTransPos - duplicataLiquida);
  return Math.round(diff * 100) / 100;
}

function formatISODateToBR(iso?: string): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val).replace(/\r?\n/g, " ");
  const needsQuote = /[",;\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportarCSV(
  rows: LancamentosApagarRow[],
  filename = "lancamentos_apagar.csv",
  opts?: { adiantamentoTotal?: number }
): void {
  const headers = [
    "ID",
    "Dt. Trans.",
    "Histórico OFX",
    "Valor Trans.",
    "Banco/Filial",
    "Conta",
    "Recnum",
    "Fornecedor",
    "Histórico Duplicata",
    "NFs",
    "Nº Nota",
    "Valor",
    "Desconto",
    "Juros",
    "Diferença",
    "Dt. Pgto",
  ];

  const lines = rows.map((row) => [
    row.ID_IMPORTACAO_OFX,
    formatISODateToBR(row.DATA_TRANSACAO),
    row.HISTORICO,
    row.VALOR_TRANSACAO,
    row.NOME_BANCO_FILIAL,
    row.CONTA ?? "",
    row.RECNUM_PRINCIPAL_OU_PARCIAIS,
    row.FORNECEDOR,
    row.HISTORICO_DUPLICATA,
    row.NFSERVICO_STATUS,
    row.NUMNOTA,
    row.VALOR_LANCAMENTO_INTERNO,
    row.DESCONTOFIN,
    row.JUROS,
    calcDiferenca(row).toFixed(2).replace(".", ","),
    formatISODateToBR(row.DATA_TRANSACAO),
  ]);

  // Totalizadores e contagens adicionais
  const alvoCanceladaErroBanco = normalizeStr("TRANSAÇÃO CANCELADA POR ERRO NO BANCO");
  const alvoEstornoMercadoria = normalizeStr("Estorno de Venda de Mercadoria");

  let qtd = 0, vTrans = 0, vInterno = 0, vDesc = 0, vJuros = 0;
  let qtdEstorno = 0, totEstorno = 0;
  let qtdCanceladaErroBanco = 0, totTransAbsCanceladaErroBanco = 0;
  let qtdSemConciliacao = 0, qtdConcParcial = 0;
  rows.forEach((row) => {
    qtd += 1;
    vTrans += sumNumbersFromString(row.VALOR_TRANSACAO) || 0;
    vInterno += sumNumbersFromString(row.VALOR_LANCAMENTO_INTERNO) || 0;
    vDesc += sumNumbersFromString(row.DESCONTOFIN) || 0;
    vJuros += sumNumbersFromString(row.JUROS) || 0;

    const histDupNorm = normalizeStr(String(row.HISTORICO_DUPLICATA ?? "").replace(/\s*\n\s*/g, " ").trim());
    const vInt = sumNumbersFromString(row.VALOR_LANCAMENTO_INTERNO) || 0;
    if (histDupNorm === alvoEstornoMercadoria) {
      qtdEstorno += 1; totEstorno += vInt;
    }
    if (histDupNorm === alvoCanceladaErroBanco) {
      qtdCanceladaErroBanco += 1;
      const vTransAbs = sumNumbersFromString(row.VALOR_TRANSACAO, { absolute: true }) || 0;
      totTransAbsCanceladaErroBanco += vTransAbs;
    }

    const diff = calcDiferenca(row);
    const isParcial = Math.abs(diff) < 0.01 && hasMultipleValores(row);
    if (isParcial) qtdConcParcial += 1;
    if (Math.abs(diff) >= 0.01) qtdSemConciliacao += 1;
  });

  const formatCurrencyBR = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  // Diferença Total agregada com dedução de Total erro
  const transAbsAgg = Math.abs(vTrans);
  const liquidoInternoAgg = Math.max(0, Math.abs(vInterno) + Math.abs(vJuros) - Math.abs(vDesc));
  const diffBrutoAgg = Math.abs(transAbsAgg - liquidoInternoAgg);
  const diffTotalAgg = Math.max(0, diffBrutoAgg - Math.abs(totTransAbsCanceladaErroBanco));
  const adiantTotal = opts?.adiantamentoTotal ?? 0;

  const totalsBlock: string[][] = [
    [""],
    ["Totais por situação"],
    ["Registros", String(qtd)],
    ["Valor Trans.", formatCurrencyBR(vTrans)],
    ["Valor Interno", formatCurrencyBR(vInterno)],
    ["Desconto", formatCurrencyBR(vDesc)],
    ["Juros", formatCurrencyBR(vJuros)],
    ["Qtd. Estorno", String(qtdEstorno)],
    ["Total Estorno", formatCurrencyBR(totEstorno)],
    ["Qtd. Erro Banco", String(qtdCanceladaErroBanco)],
    ["Total erro", formatCurrencyBR(totTransAbsCanceladaErroBanco)],
    ["Diferença Total", formatCurrencyBR(diffTotalAgg)],
    ["Adiant. Fornec.", formatCurrencyBR(adiantTotal)],
    ["Sem Conciliação", String(qtdSemConciliacao)],
    ["Conciliação Parcial", String(qtdConcParcial)],
  ];

  const csv = [headers, ...lines, ...totalsBlock]
    .map((arr) => arr.map(escapeCsvCell).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

// Utilitário: CRC32 para montar ZIP
function crc32(arr: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < arr.length; i++) {
    c ^= arr[i];
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ZIP minimal: armazena arquivos sem compressão
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const records: { local: Uint8Array; central: Uint8Array; name: string; }[] = [];
  let offset = 0;
  const localParts: Uint8Array[] = [];
  files.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); // local file header signature
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, 0, true); // method = store
    view.setUint16(10, 0, true); // mtime
    view.setUint16(12, 0, true); // mdate
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true); // compressed
    view.setUint32(22, data.length, true); // uncompressed
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true); // extra len
    header.set(nameBytes, 30);
    const local = new Uint8Array(header.length + data.length);
    local.set(header, 0);
    local.set(data, header.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cview = new DataView(central.buffer);
    cview.setUint32(0, 0x02014b50, true); // central header
    cview.setUint16(4, 20, true); // ver made by
    cview.setUint16(6, 20, true); // ver needed
    cview.setUint16(8, 0, true); // flags
    cview.setUint16(10, 0, true); // method
    cview.setUint16(12, 0, true); // mtime
    cview.setUint16(14, 0, true); // mdate
    cview.setUint32(16, crc, true);
    cview.setUint32(20, data.length, true); // compressed
    cview.setUint32(24, data.length, true); // uncompressed
    cview.setUint16(28, nameBytes.length, true);
    cview.setUint16(30, 0, true); // extra len
    cview.setUint16(32, 0, true); // comment len
    cview.setUint16(34, 0, true); // disk start
    cview.setUint16(36, 0, true); // int attrs
    cview.setUint32(38, 0, true); // ext attrs
    cview.setUint32(42, offset, true); // local header offset
    central.set(nameBytes, 46);
    records.push({ local, central, name });
    offset += local.length;
  });

  const centralLen = records.reduce((acc, r) => acc + r.central.length, 0);
  const totalLen = offset + centralLen + 22;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  localParts.forEach((p) => { out.set(p, pos); pos += p.length; });
  records.forEach((r) => { out.set(r.central, pos); pos += r.central.length; });
  const end = new DataView(out.buffer);
  end.setUint32(pos, 0x06054b50, true); // end of central dir
  end.setUint16(pos + 4, 0, true); // disk
  end.setUint16(pos + 6, 0, true); // start disk
  end.setUint16(pos + 8, files.length, true); // entries on disk
  end.setUint16(pos + 10, files.length, true); // total entries
  end.setUint32(pos + 12, centralLen, true); // central size
  end.setUint32(pos + 16, offset, true); // central offset
  end.setUint16(pos + 20, 0, true); // comment len
  return out;
}

export function exportarExcelXLSX(
  rows: LancamentosApagarRow[],
  filename = "lancamentos_apagar.xlsx",
  opts?: { adiantamentoTotal?: number }
): void {
  const headers = [
    "ID","Dt. Trans.","Histórico OFX","Valor Trans.","Banco/Filial","Conta","Recnum","Fornecedor","Histórico Duplicata",
    "NFs","Nº Nota","Valor","Desconto","Juros","Diferença","Dt. Pgto"
  ];

  const tableRows = rows.map((row) => [
    row.ID_IMPORTACAO_OFX,
    formatISODateToBR(row.DATA_TRANSACAO),
    row.HISTORICO,
    row.VALOR_TRANSACAO,
    row.NOME_BANCO_FILIAL,
    row.CONTA ?? "",
    row.RECNUM_PRINCIPAL_OU_PARCIAIS,
    row.FORNECEDOR,
    row.HISTORICO_DUPLICATA,
    row.NFSERVICO_STATUS,
    row.NUMNOTA,
    row.VALOR_LANCAMENTO_INTERNO,
    row.DESCONTOFIN,
    row.JUROS,
    calcDiferenca(row).toFixed(2).replace(".", ","),
    formatISODateToBR(row.DATA_TRANSACAO),
  ]);

  // Totais e contagens
  const alvoCanceladaErroBanco = normalizeStr("TRANSAÇÃO CANCELADA POR ERRO NO BANCO");
  const alvoEstornoMercadoria = normalizeStr("Estorno de Venda de Mercadoria");
  let qtd = 0, vTrans = 0, vInterno = 0, vDesc = 0, vJuros = 0;
  let qtdEstorno = 0, totEstorno = 0;
  let qtdCanceladaErroBanco = 0, totTransAbsCanceladaErroBanco = 0;
  let qtdSemConciliacao = 0, qtdConcParcial = 0;
  rows.forEach((row) => {
    qtd += 1;
    vTrans += sumNumbersFromString(row.VALOR_TRANSACAO) || 0;
    vInterno += sumNumbersFromString(row.VALOR_LANCAMENTO_INTERNO) || 0;
    vDesc += sumNumbersFromString(row.DESCONTOFIN) || 0;
    vJuros += sumNumbersFromString(row.JUROS) || 0;
    const histDupNorm = normalizeStr(String(row.HISTORICO_DUPLICATA ?? "").replace(/\s*\n\s*/g, " ").trim());
    const vInt = sumNumbersFromString(row.VALOR_LANCAMENTO_INTERNO) || 0;
    if (histDupNorm === alvoEstornoMercadoria) { qtdEstorno += 1; totEstorno += vInt; }
    if (histDupNorm === alvoCanceladaErroBanco) {
      qtdCanceladaErroBanco += 1;
      const vTransAbs = sumNumbersFromString(row.VALOR_TRANSACAO, { absolute: true }) || 0;
      totTransAbsCanceladaErroBanco += vTransAbs;
    }
    const diff = calcDiferenca(row);
    const isParcial = Math.abs(diff) < 0.01 && hasMultipleValores(row);
    if (isParcial) qtdConcParcial += 1;
    if (Math.abs(diff) >= 0.01) qtdSemConciliacao += 1;
  });

  const formatCurrencyBR = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  const transAbsAgg = Math.abs(vTrans);
  const liquidoInternoAgg = Math.max(0, Math.abs(vInterno) + Math.abs(vJuros) - Math.abs(vDesc));
  const diffBrutoAgg = Math.abs(transAbsAgg - liquidoInternoAgg);
  const diffTotalAgg = Math.max(0, diffBrutoAgg - Math.abs(totTransAbsCanceladaErroBanco));
  const adiantTotal = opts?.adiantamentoTotal ?? 0;

  const totalsRows: (string | number)[][] = [
    [],
    ["Totais por situação"],
    ["Registros", qtd],
    ["Valor Trans.", formatCurrencyBR(vTrans)],
    ["Valor Interno", formatCurrencyBR(vInterno)],
    ["Desconto", formatCurrencyBR(vDesc)],
    ["Juros", formatCurrencyBR(vJuros)],
    ["Qtd. Estorno", qtdEstorno],
    ["Total Estorno", formatCurrencyBR(totEstorno)],
    ["Qtd. Erro Banco", qtdCanceladaErroBanco],
    ["Total erro", formatCurrencyBR(totTransAbsCanceladaErroBanco)],
    ["Diferença Total", formatCurrencyBR(diffTotalAgg)],
    ["Adiant. Fornec.", formatCurrencyBR(adiantTotal)],
    ["Sem Conciliação", qtdSemConciliacao],
    ["Conciliação Parcial", qtdConcParcial],
  ];

  const encoder = new TextEncoder();
  const escapeXml = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cellXml = (r: number, c: number, v: unknown) => {
    const col = String.fromCharCode(65 + c) + r;
    const value = String(v ?? "");
    const isNumber = /^-?\d+(?:[.,]\d+)?$/.test(value);
    if (isNumber) {
      const num = Number(value.replace(/\./g, "").replace(/,/g, "."));
      return `<c r="${col}" t="n"><v>${Number.isNaN(num) ? 0 : num}</v></c>`;
    }
    return `<c r="${col}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
  };

  const sheetRowsXml: string[] = [];
  // headers
  sheetRowsXml.push(`<row r="1">${headers.map((h, idx) => cellXml(1, idx, h)).join("")}</row>`);
  // data
  tableRows.forEach((r, i) => {
    const rn = i + 2;
    sheetRowsXml.push(`<row r="${rn}">${r.map((v, idx) => cellXml(rn, idx, v)).join("")}</row>`);
  });
  // totals appended
  let base = tableRows.length + 2;
  totalsRows.forEach((r) => {
    const rn = base++;
    sheetRowsXml.push(`<row r="${rn}">${r.map((v, idx) => cellXml(rn, idx, v)).join("")}</row>`);
  });

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheetData>
      ${sheetRowsXml.join("\n")}
    </sheetData>
  </worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets>
      <sheet name="Lançamentos" sheetId="1" r:id="rId1"/>
    </sheets>
  </workbook>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
    <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  </Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  </Relationships>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  </Relationships>`;

  const docPropsCoreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <dc:title>Lançamentos</dc:title>
    <dc:creator>GestFIN</dc:creator>
    <cp:lastModifiedBy>GestFIN</cp:lastModifiedBy>
    <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  </cp:coreProperties>`;

  const docPropsAppXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
    <Application>GestFIN</Application>
    <DocSecurity>0</DocSecurity>
    <ScaleCrop>false</ScaleCrop>
    <Company>GestFIN</Company>
  </Properties>`;

  const files = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypesXml) },
    { name: "_rels/.rels", data: encoder.encode(rootRelsXml) },
    { name: "xl/workbook.xml", data: encoder.encode(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRelsXml) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheetXml) },
    { name: "docProps/core.xml", data: encoder.encode(docPropsCoreXml) },
    { name: "docProps/app.xml", data: encoder.encode(docPropsAppXml) },
  ];

  const zipBuffer = buildZip(files);
  // Converter explicitamente para ArrayBuffer padrão para máxima compatibilidade de tipos
  const outAb = new ArrayBuffer(zipBuffer.byteLength);
  new Uint8Array(outAb).set(zipBuffer);
  const blob = new Blob([outAb], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, filename);
}

export function exportarPDFPrint(
  rows: LancamentosApagarRow[],
  filename = "lancamentos_apagar.pdf",
  opts?: { adiantamentoTotal?: number }
): void {
  const headers = [
    "ID","Dt. Trans.","Histórico OFX","Valor Trans.","Banco/Filial","Conta","Recnum","Fornecedor","Histórico Duplicata",
    "NFs","Nº Nota","Valor","Desconto","Juros","Diferença","Dt. Pgto"
  ];
  const tableRows = rows.map((row) => [
    row.ID_IMPORTACAO_OFX,
    formatISODateToBR(row.DATA_TRANSACAO),
    row.HISTORICO,
    row.VALOR_TRANSACAO,
    row.NOME_BANCO_FILIAL,
    row.CONTA ?? "",
    row.RECNUM_PRINCIPAL_OU_PARCIAIS,
    row.FORNECEDOR,
    row.HISTORICO_DUPLICATA,
    row.NFSERVICO_STATUS,
    row.NUMNOTA,
    row.VALOR_LANCAMENTO_INTERNO,
    row.DESCONTOFIN,
    row.JUROS,
    calcDiferenca(row).toFixed(2).replace(".", ","),
    formatISODateToBR(row.DATA_TRANSACAO),
  ]);

  // Totalizadores (exibidos apenas no final do documento)
  const alvoCancelada = normalizeStr("TRANSAÇÃO CANCELADA");
  const alvoErroBanco = normalizeStr("POR ERRO NO BANCO");
  const alvoEstornoMercadoria = normalizeStr("Estorno de Venda de Mercadoria");
  const alvoCanceladaErroBanco = normalizeStr("TRANSAÇÃO CANCELADA POR ERRO NO BANCO");

  let qtd = 0, vTrans = 0, vInterno = 0, vDesc = 0, vJuros = 0;
  let qtdPago = 0, qtdNaoPago = 0;
  const categorias = {
    cancelada: { qtd: 0, total: 0 },
    erroBanco: { qtd: 0, total: 0 },
    estornoMercadoria: { qtd: 0, total: 0 },
  };
  let qtdCanceladaPorErroBanco = 0;
  let totalTransAbsCanceladaPorErroBanco = 0;
  let qtdSemConciliacao = 0, qtdConcParcial = 0;

  rows.forEach((row) => {
    qtd += 1;
    vTrans += sumNumbersFromString(row.VALOR_TRANSACAO) || 0;
    vInterno += sumNumbersFromString(row.VALOR_LANCAMENTO_INTERNO) || 0;
    vDesc += sumNumbersFromString(row.DESCONTOFIN) || 0;
    vJuros += sumNumbersFromString(row.JUROS) || 0;

    const st = String(row.STATUS_PAGAMENTO ?? "").trim().toLowerCase();
    if (st === "pago") qtdPago += 1; else qtdNaoPago += 1;

    const historicoDupNorm = normalizeStr(String(row.HISTORICO_DUPLICATA ?? "").replace(/\s*\n\s*/g, " ").trim());
    const vInt = sumNumbersFromString(row.VALOR_LANCAMENTO_INTERNO) || 0;
    if (historicoDupNorm === normalizeStr(alvoCancelada)) { categorias.cancelada.qtd += 1; categorias.cancelada.total += vInt; }
    else if (historicoDupNorm === normalizeStr(alvoErroBanco)) { categorias.erroBanco.qtd += 1; categorias.erroBanco.total += vInt; }
    else if (historicoDupNorm === normalizeStr(alvoEstornoMercadoria)) { categorias.estornoMercadoria.qtd += 1; categorias.estornoMercadoria.total += vInt; }

    if (historicoDupNorm === normalizeStr(alvoCanceladaErroBanco)) {
      qtdCanceladaPorErroBanco += 1;
      const vTransAbs = sumNumbersFromString(row.VALOR_TRANSACAO, { absolute: true });
      totalTransAbsCanceladaPorErroBanco += vTransAbs || 0;
    }

    const diff = calcDiferenca(row);
    const isParcial = Math.abs(diff) < 0.01 && hasMultipleValores(row);
    if (isParcial) qtdConcParcial += 1;
    if (Math.abs(diff) >= 0.01) qtdSemConciliacao += 1;
  });

  const formatCurrencyBR = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  const transAbsAgg = Math.abs(vTrans);
  const liquidoInternoAgg = Math.max(0, Math.abs(vInterno) + Math.abs(vJuros) - Math.abs(vDesc));
  const diffBrutoAgg = Math.abs(transAbsAgg - liquidoInternoAgg);
  const diffTotalAgg = Math.max(0, diffBrutoAgg - Math.abs(totalTransAbsCanceladaPorErroBanco));
  const adiantTotal = opts?.adiantamentoTotal ?? 0;
  const totaisHtml = `
    <div class="totais-final" style="page-break-inside: avoid; margin-top: 12px; font-size: 11px;">
      <div style="font-weight: bold; margin-bottom: 6px;">Totais por situação</div>
      <div>Registros: <strong>${qtd}</strong> Valor Trans.: <strong>${formatCurrencyBR(vTrans)}</strong> Valor Interno: <strong>${formatCurrencyBR(vInterno)}</strong> Desconto: <strong>${formatCurrencyBR(vDesc)}</strong> Juros: <strong>${formatCurrencyBR(vJuros)}</strong></div>
      <div>Qtd. Estorno: <strong>${categorias.estornoMercadoria.qtd}</strong></div>
      <div>Total Estorno: <strong>${formatCurrencyBR(categorias.estornoMercadoria.total)}</strong></div>
      <div>Qtd. Erro Banco: <strong>${qtdCanceladaPorErroBanco}</strong></div>
      <div>Total erro: <strong>${formatCurrencyBR(totalTransAbsCanceladaPorErroBanco)}</strong></div>
      <div>Diferença Total: <strong>${formatCurrencyBR(diffTotalAgg)}</strong></div>
      <div>Adiant. Fornec.: <strong>${formatCurrencyBR(adiantTotal)}</strong></div>
      <div>Sem Conciliação: <strong>${qtdSemConciliacao}</strong></div>
      <div>Conciliação Parcial: <strong>${qtdConcParcial}</strong></div>
    </div>
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <title>Exportação</title>
  <style>
    body{font-family: Arial, sans-serif; font-size:9px; margin: 16px}
    table{border-collapse:collapse; width:100%; page-break-inside:auto}
    thead{display:table-header-group}
    tfoot{display:table-footer-group}
    th,td{border:1px solid #333; padding:2px 3px; font-size:9px}
    .header-line{display:flex; justify-content:space-between; align-items:center; margin-bottom:6px}
    .header-title{font-size:11px; font-weight:bold}
    .header-note{font-size:9px; color:#444}
  </style>
  </head><body>
  <table>
    <thead>
      <tr>
        <th colspan="15" style="border:none;">
          <div class="header-line">
            <span class="header-title">Lançamentos à Pagar</span>
            <span class="header-note">Totalizadores por situação constam na última página.</span>
          </div>
        </th>
      </tr>
      <tr>${headers.map((h) => `<th>${String(h)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${tableRows.map((r) => `<tr>${r.map((c) => `<td>${String(c ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
  ${totaisHtml}
  <script>window.print && window.print();</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    // Fallback: download HTML para permitir impressão manual
    const blob = new Blob([html], { type: "text/html" });
    downloadBlob(blob, filename.replace(/\.pdf$/i, ".html"));
  }
}

export function exportarLancamentosApagar(
  formato: 'csv' | 'xlsx' | 'pdf',
  rows: LancamentosApagarRow[],
  opts: { filenamePrefix?: string; adiantamentoTotal?: number } = {}
): void {
  const prefix = opts.filenamePrefix || 'lancamentos_apagar';
  const adiantTotal = opts.adiantamentoTotal ?? 0;
  if (formato === 'csv') return exportarCSV(rows, `${prefix}.csv`, { adiantamentoTotal: adiantTotal });
  if (formato === 'xlsx') return exportarExcelXLSX(rows, `${prefix}.xlsx`, { adiantamentoTotal: adiantTotal });
  if (formato === 'pdf') return exportarPDFPrint(rows, `${prefix}.pdf`, { adiantamentoTotal: adiantTotal });
}