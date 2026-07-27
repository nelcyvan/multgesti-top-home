import type { LancamentosAreceberRow } from "./BuscarLancamentosAreceber";

function toNumber(val: any): number {
  const s = String(val ?? "");
  // Remove símbolos e letras, mantém dígitos, separadores e sinal
  const cleaned = s.replace(/[^0-9,.-]/g, "");
  // Remove separador de milhar e normaliza decimal
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrencyBR(n: number): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

function formatISODateToBR(iso?: string | null): string {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportAreceberCSV(rows: LancamentosAreceberRow[], filename = "areceber.csv") {
  const headers = ["ID OFX", "Dt. Trans.", "Histórico OFX", "Valor Trans.", "Banco/Filial"];
  const lines = rows.map((r) => {
    const id = String(r.ID_IMPORTACAO_OFX ?? "");
    const dt = formatISODateToBR(r.DATA_TRANSACAO || r.DTEMISSAO || "");
    const hist = String(r.HISTORICO ?? "").replace(/\r?\n/g, " ");
    const valor = String(r.VALOR_TRANSACAO ?? "");
    const banco = String(r.NOME_BANCO_FILIAL ?? "");
    const cells = [id, dt, hist, valor, banco].map((c) => {
      const s = String(c);
      if (/[";\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    });
    return cells.join(";");
  });
  const content = "\uFEFF" + headers.join(";") + "\n" + lines.join("\n");
  // Acrescenta totalizadores ao final
  const totaisSituacoes = analisarHistoricoPorPrefixo(rows);
  const totaisHeader = "\n\nTotais por situação";
  const totaisLines = ["Categoria;Qtd;Total"].concat(
    totaisSituacoes.map((t) => `${t.categoria};${t.qtd};${formatCurrencyBR(t.total)}`)
  ).join("\n");
  const full = content + totaisHeader + "\n" + totaisLines + "\n";
  const blob = new Blob([full], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename);
}

// Utilitário: CRC32 para ZIP
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Utilitário: cria ZIP (store) mínimo
function createZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  function dosDate(t: Date) {
    const time = ((t.getHours() & 0x1f) << 11) | ((t.getMinutes() & 0x3f) << 5) | ((Math.floor(t.getSeconds() / 2)) & 0x1f);
    const date = (((t.getFullYear() - 1980) & 0x7f) << 9) | (((t.getMonth() + 1) & 0xf) << 5) | (t.getDate() & 0x1f);
    return { time, date };
  }
  const parts: Uint8Array[] = [];
  const central: { name: string; headerOffset: number; size: number; crc: number }[] = [];
  let offset = 0;
  const now = new Date();
  const dd = dosDate(now);
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const size = f.data.length;
    const crc = crc32(f.data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(localHeader.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true); // version
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // compression store
    dv.setUint16(10, dd.time, true);
    dv.setUint16(12, dd.date, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    parts.push(localHeader);
    parts.push(f.data);
    central.push({ name: f.name, headerOffset: offset, size, crc });
    offset += localHeader.length + f.data.length;
  }

  const centralParts: Uint8Array[] = [];
  let centralSize = 0;
  for (const c of central) {
    const nameBytes = encoder.encode(c.name);
    const hdr = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(hdr.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, dd.time, true);
    dv.setUint16(14, dd.date, true);
    dv.setUint32(16, c.crc, true);
    dv.setUint32(20, c.size, true);
    dv.setUint32(24, c.size, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint16(30, 0, true);
    dv.setUint16(32, 0, true);
    dv.setUint16(34, 0, true);
    dv.setUint16(36, 0, true);
    dv.setUint32(38, 0, true);
    dv.setUint32(42, c.headerOffset, true);
    hdr.set(nameBytes, 46);
    centralParts.push(hdr);
    centralSize += hdr.length;
  }

  const end = new Uint8Array(22);
  const dvEnd = new DataView(end.buffer);
  dvEnd.setUint32(0, 0x06054b50, true);
  dvEnd.setUint16(4, 0, true);
  dvEnd.setUint16(6, 0, true);
  dvEnd.setUint16(8, central.length, true);
  dvEnd.setUint16(10, central.length, true);
  dvEnd.setUint32(12, centralSize, true);
  dvEnd.setUint32(16, offset, true);
  dvEnd.setUint16(20, 0, true);

  const totalSize = offset + centralSize + end.length;
  const out = new Uint8Array(totalSize);
  let p = 0;
  for (const part of parts) { out.set(part, p); p += part.length; }
  for (const part of centralParts) { out.set(part, p); p += part.length; }
  out.set(end, p);
  return out;
}

export function exportAreceberExcelHtml(rows: LancamentosAreceberRow[], filename = "areceber.xlsx") {
  // Gera um XLSX mínimo (OpenXML) com uma planilha contendo os dados e totalizadores ao final
  const encoder = new TextEncoder();
  const headers = ["ID OFX", "Dt. Trans.", "Histórico OFX", "Valor Trans.", "Banco/Filial"];
  const totaisSituacoes = analisarHistoricoPorPrefixo(rows);

  function esc(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Sheet XML
  // Geração da planilha com conteúdo inline simples (sem estilos)
  let sheetRows = "";
  function cellStr(col: number, row: number, text: string) {
    // Column letters A, B, C...
    const letters = (function(n:number){ let s=""; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26);} return s; })(col);
    const ref = `${letters}${row}`;
    return `<c r="${ref}" t="inlineStr"><is><t>${esc(text)}</t></is></c>`;
  }
  let rowIndex = 1;
  // Header row
  sheetRows += `<row r="${rowIndex}">` + headers.map((h,i)=>cellStr(i+1,rowIndex,h)).join("") + `</row>`;
  // Data rows
  for (const r of rows) {
    rowIndex++;
    const id = String(r.ID_IMPORTACAO_OFX ?? "");
    const dt = formatISODateToBR(r.DATA_TRANSACAO || r.DTEMISSAO || "");
    const hist = String(r.HISTORICO ?? "").replace(/\r?\n/g, " ");
    const valor = String(r.VALOR_TRANSACAO ?? "");
    const banco = String(r.NOME_BANCO_FILIAL ?? "");
    const cols = [id, dt, hist, valor, banco];
    sheetRows += `<row r="${rowIndex}">` + cols.map((v,i)=>cellStr(i+1,rowIndex,v)).join("") + `</row>`;
  }
  // Blank row then totals header
  rowIndex++;
  sheetRows += `<row r="${rowIndex}">` + cellStr(1,rowIndex,"Totais por situação") + `</row>`;
  rowIndex++;
  sheetRows += `<row r="${rowIndex}">` + ["Categoria","Qtd","Total"].map((v,i)=>cellStr(i+1,rowIndex,v)).join("") + `</row>`;
  for (const t of totaisSituacoes) {
    rowIndex++;
    sheetRows += `<row r="${rowIndex}">` + [t.categoria, String(t.qtd), formatCurrencyBR(t.total)].map((v,i)=>cellStr(i+1,rowIndex,v)).join("") + `</row>`;
  }

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <sheetData>${sheetRows}</sheetData>
  </worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets>
      <sheet name="Lançamentos" sheetId="1" r:id="rId1"/>
    </sheets>
  </workbook>`;

  // Relações do pacote (raiz) -> aponta para o workbook
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  </Relationships>`;

  // Relações do workbook -> aponta para a planilha 1
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  </Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
    <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  </Types>`;

  const docPropsCoreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <dc:title>Lançamentos a Receber</dc:title>
    <dc:creator>MultGesti</dc:creator>
    <cp:lastModifiedBy>MultGesti</cp:lastModifiedBy>
    <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
    <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
  </cp:coreProperties>`;

  const docPropsAppXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
    <Application>MultGesti</Application>
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

  const zip = createZip(files);
  // Converte para ArrayBuffer para compatibilidade com o tipo BlobPart
  const abZip: ArrayBuffer = zip.buffer instanceof ArrayBuffer
    ? (zip.buffer as ArrayBuffer)
    : (() => { const ab = new ArrayBuffer(zip.length); new Uint8Array(ab).set(zip); return ab; })();
  const blob = new Blob([abZip], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, filename);
}

function extrairPrefixoHistorico(h: unknown): string {
  const s = String(h ?? "").trim();
  if (!s) return "Sem Histórico";
  const m = s.match(/^\s*([^\-–—]+?)\s*[\-–—]/);
  const prefix = m ? m[1].trim() : s;
  return prefix || "Outros";
}

function analisarHistoricoPorPrefixo(rows: LancamentosAreceberRow[]): { categoria: string; total: number; qtd: number }[] {
  const mapa = new Map<string, { total: number; qtd: number }>();
  for (const r of rows) {
    const cat = extrairPrefixoHistorico(r.HISTORICO);
    const valor = Math.abs(toNumber(r.VALOR_TRANSACAO));
    const cur = mapa.get(cat) ?? { total: 0, qtd: 0 };
    cur.total += valor;
    cur.qtd += 1;
    mapa.set(cat, cur);
  }
  return Array.from(mapa.entries())
    .map(([categoria, { total, qtd }]) => ({ categoria, total, qtd }))
    .sort((a, b) => b.total - a.total);
}

export function exportAreceberPDFWindowPrint(
  rows: LancamentosAreceberRow[],
  opts?: { title?: string; pageNote?: string; rowsPerPage?: number }
) {
  const title = opts?.title ?? "Relatório Lançamentos à Receber";
  const pageNote = opts?.pageNote ?? "Totalizadores por situação constam na última página.";
  const headers = ["ID OFX", "Dt. Trans.", "Histórico OFX", "Valor Trans.", "Banco/Filial"];
  const totaisSituacoes = analisarHistoricoPorPrefixo(rows);

  const bodyRows = rows
    .map((r) => {
      const id = String(r.ID_IMPORTACAO_OFX ?? "");
      const dt = formatISODateToBR(r.DATA_TRANSACAO || r.DTEMISSAO || "");
      const hist = String(r.HISTORICO ?? "").replace(/\r?\n/g, " ");
      const valor = String(r.VALOR_TRANSACAO ?? "");
      const banco = String(r.NOME_BANCO_FILIAL ?? "");
      return `<tr>
        <td>${id}</td>
        <td>${dt}</td>
        <td>${hist}</td>
        <td>${valor}</td>
        <td>${banco}</td>
      </tr>`;
    })
    .join("\n");

  const tableHtml = `<table class="report">
    <thead>
      <tr>
        <th colspan="5">
          <div class="header-inline">
            <span class="title">${title}</span>
            <span class="note-inline">${pageNote}</span>
          </div>
        </th>
      </tr>
      <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>`;

  const totaisHtml = `<div class="totais-final">
    ${totaisSituacoes
      .map((t) => `<div class="chip">${t.categoria}: ${t.qtd} • ${formatCurrencyBR(t.total)}</div>`)
      .join("")}
  </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { margin: 16mm; size: A4 portrait; }
    body { font-family: Arial, sans-serif; }
    table.report { width: 100%; border-collapse: collapse; page-break-inside: auto; }
    thead { display: table-header-group; }
    /* Totalizadores devem aparecer somente na última página, fora da tabela */
    .header-inline { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
    .header-inline .title { font-weight: bold; }
    .header-inline .note-inline { color: #333; font-weight: normal; }
    table.report th, table.report td { border: 1px solid #444; font-size: 11px; padding: 3px 4px; }
    .totais-final { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; page-break-inside: avoid; }
    .chip { border: 1px solid #999; border-radius: 8px; padding: 2px 6px; font-size: 11px; }
  </style>
  </head><body>
  ${tableHtml}
  ${totaisHtml}
  <script>window.onload = () => { window.print(); };</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}