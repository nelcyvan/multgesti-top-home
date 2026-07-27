import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "react-bootstrap";
import { Upload } from "react-bootstrap-icons";

interface ImportarPlanilhaModalProps {
  show: boolean;
  onHide: () => void;
}

type PlanilhaResumo = {
  fileName: string;
  fileSizeBytes: number;
  sheetNames: string[];
  sheetName: string;
  columns: string[];
  missingColumns: string[];
  extraColumns: string[];
  rowCount: number;
  periodStart?: Date;
  periodEnd?: Date;
  invalidDateCount: number;
  previewRows: Array<Record<string, string>>;
};

const ImportarPlanilhaModal: React.FC<ImportarPlanilhaModalProps> = ({ show, onHide }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string>("");
  const [resumo, setResumo] = useState<PlanilhaResumo | null>(null);

  const expectedColumns = useMemo(() => ["DATA", "SAÍDA", "BANCO", "REF"], []);

  useEffect(() => {
    if (show) return;
    setIsParsing(false);
    setParseError("");
    setResumo(null);
  }, [show]);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  const formatDateBR = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const parseFile = async (file: File) => {
    setParseError("");
    setResumo(null);
    setIsParsing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetNames = workbook.SheetNames || [];
      const sheetName = sheetNames[0] ?? "";
      if (!sheetName) {
        throw new Error("Nenhuma aba encontrada na planilha.");
      }

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error("Aba inválida na planilha.");
      }

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as Array<Array<unknown>>;
      const normalizeCol = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().trim();
      const expectedNormalized = expectedColumns.map(normalizeCol);

      const findHeaderRowIndex = () => {
        const maxScan = Math.min(rows.length, 50);
        let bestIdx = -1;
        let bestCount = 0;

        for (let i = 0; i < maxScan; i += 1) {
          const r = rows[i] ?? [];
          const normalizedSet = new Set(
            r
              .map((v) => String(v ?? "").trim())
              .filter((v) => v.length > 0)
              .map(normalizeCol),
          );
          const matchCount = expectedNormalized.filter((e) => normalizedSet.has(e)).length;
          if (matchCount > bestCount) {
            bestCount = matchCount;
            bestIdx = i;
          }
        }

        return bestIdx;
      };

      const headerRowIndex = findHeaderRowIndex();
      if (headerRowIndex === -1) {
        throw new Error("Cabeçalho não encontrado na planilha.");
      }

      const headerRow = rows[headerRowIndex] ?? [];
      const normalizedHeaderRow = headerRow.map((v) => normalizeCol(String(v ?? "").trim()));
      const columns = headerRow
        .map((v) => String(v ?? "").trim())
        .filter((v) => v.length > 0);

      const colIndexByExpected = new Map<string, number>();
      expectedNormalized.forEach((eNorm) => {
        const idx = normalizedHeaderRow.findIndex((h) => h === eNorm);
        if (idx >= 0) colIndexByExpected.set(eNorm, idx);
      });

      const normalizedColumns = new Set(columns.map(normalizeCol));

      const missingColumns = expectedColumns.filter((c) => !normalizedColumns.has(normalizeCol(c)));
      const extraColumns = columns.filter((c) => !expectedColumns.some((e) => normalizeCol(e) === normalizeCol(c)));

      const dataRows = rows.slice(headerRowIndex + 1);
      const nonEmptyRows = dataRows.filter((r) => (r ?? []).some((cell) => String(cell ?? "").trim().length > 0));

      const tryParseDate = (v: unknown): Date | null => {
        if (v instanceof Date && !Number.isNaN(v.getTime())) return v;

        if (typeof v === "number" && Number.isFinite(v)) {
          const parsed = XLSX.SSF.parse_date_code(v);
          if (parsed && typeof parsed.y === "number" && typeof parsed.m === "number" && typeof parsed.d === "number") {
            const dt = new Date(parsed.y, parsed.m - 1, parsed.d);
            if (!Number.isNaN(dt.getTime())) return dt;
          }
          return null;
        }

        const s = String(v ?? "").trim();
        if (!s) return null;

        const match = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
        if (!match) return null;
        const dd = Number(match[1]);
        const mm = Number(match[2]);
        const yyyyRaw = Number(match[3]);
        const yyyy = yyyyRaw < 100 ? 2000 + yyyyRaw : yyyyRaw;
        const dt = new Date(yyyy, mm - 1, dd);
        if (Number.isNaN(dt.getTime())) return null;
        if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
        return dt;
      };

      const inferDateColumnIndex = () => {
        const fromHeader = colIndexByExpected.get(normalizeCol("DATA"));
        if (typeof fromHeader === "number") return fromHeader;

        const maxCols = Math.min(10, Math.max(0, ...dataRows.map((r) => (r ?? []).length)));
        const sampleRows = dataRows.slice(0, 200);

        let bestIdx = 0;
        let bestScore = 0;
        for (let c = 0; c < maxCols; c += 1) {
          let score = 0;
          for (const r of sampleRows) {
            const v = r?.[c];
            const s = String(v ?? "").trim();
            if (!s) continue;
            if (tryParseDate(v)) score += 1;
          }
          if (score > bestScore) {
            bestScore = score;
            bestIdx = c;
          }
        }

        return bestScore > 0 ? bestIdx : 0;
      };

      const dateColIndex = inferDateColumnIndex();

      let periodStart: Date | undefined;
      let periodEnd: Date | undefined;
      let invalidDateCount = 0;

      dataRows.forEach((r) => {
        const raw = r?.[dateColIndex];
        const rawStr = String(raw ?? "").trim();
        if (!rawStr) return;

        const dt = tryParseDate(raw);
        if (!dt) {
          invalidDateCount += 1;
          return;
        }
        if (!periodStart || dt.getTime() < periodStart.getTime()) periodStart = dt;
        if (!periodEnd || dt.getTime() > periodEnd.getTime()) periodEnd = dt;
      });

      const previewRows = nonEmptyRows.map((r) => {
        const obj: Record<string, string> = {};
        expectedColumns.forEach((col, idx) => {
          const colIdx = colIndexByExpected.get(normalizeCol(col)) ?? idx;
          obj[col] = String(r?.[colIdx] ?? "").trim();
        });
        return obj;
      });

      setResumo({
        fileName: file.name,
        fileSizeBytes: file.size,
        sheetNames,
        sheetName,
        columns,
        missingColumns,
        extraColumns,
        rowCount: nonEmptyRows.length,
        periodStart,
        periodEnd,
        invalidDateCount,
        previewRows,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível ler a planilha.";
      setParseError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered size="xl">
      <Modal.Header closeButton className="bg-white border-bottom py-2">
        <Modal.Title className="h6 mb-0 d-flex align-items-center gap-2">
          <Upload size={18} />
          Importar planilha
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="bg-light">
        <div className="d-flex flex-column gap-3" style={{ fontSize: "0.85rem" }}>
          <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
            <div className="text-muted">Selecione uma planilha no seu computador (.xlsx)</div>
            <div className="d-flex align-items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="d-none"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (!f) return;
                  void parseFile(f);
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm d-flex align-items-center gap-2"
                onClick={() => inputRef.current?.click()}
                disabled={isParsing}
              >
                <Upload size={16} />
                <span>{isParsing ? "Lendo..." : "Selecionar planilha"}</span>
              </button>
            </div>
          </div>

          {parseError && <div className="alert alert-danger py-2 mb-0">{parseError}</div>}

          {resumo && (
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex justify-content-between flex-wrap gap-2">
                    <div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>Arquivo</div>
                      <div className="fw-semibold">{resumo.fileName}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>Tamanho</div>
                      <div className="fw-semibold">{formatBytes(resumo.fileSizeBytes)}</div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between flex-wrap gap-2">
                    <div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>Aba</div>
                      <div className="fw-semibold">{resumo.sheetName}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>Linhas (sem cabeçalho)</div>
                      <div className="fw-semibold">{resumo.rowCount}</div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between flex-wrap gap-2">
                    <div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>Período (DATA)</div>
                      <div className="fw-semibold">
                        {resumo.periodStart && resumo.periodEnd ? `${formatDateBR(resumo.periodStart)} até ${formatDateBR(resumo.periodEnd)}` : "—"}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>Datas inválidas</div>
                      <div className="fw-semibold">{resumo.invalidDateCount}</div>
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>Colunas encontradas</div>
                    <div className="d-flex flex-wrap gap-2">
                      {resumo.columns.map((c) => (
                        <span key={c} className="badge text-bg-light border fw-normal">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {resumo.missingColumns.length > 0 && (
                    <div className="alert alert-warning py-2 mb-0">
                      Colunas obrigatórias faltando: <strong>{resumo.missingColumns.join(", ")}</strong>
                    </div>
                  )}

                  {resumo.extraColumns.length > 0 && (
                    <div className="alert alert-info py-2 mb-0">
                      Colunas extras: <strong>{resumo.extraColumns.join(", ")}</strong>
                    </div>
                  )}

                  <div className="d-flex flex-column gap-2">
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>Prévia (todas as linhas importadas)</div>
                    <div className="border rounded bg-white" style={{ maxHeight: "240px", overflow: "auto" }}>
                      <table className="table table-sm mb-0 align-middle">
                        <thead className="table-light">
                          <tr>
                            {expectedColumns.map((c) => (
                              <th key={c} className="text-muted text-uppercase" style={{ fontSize: "0.7rem" }}>
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resumo.previewRows.length === 0 ? (
                            <tr>
                              <td colSpan={expectedColumns.length} className="text-center text-muted py-3">
                                Nenhuma linha de dados encontrada
                              </td>
                            </tr>
                          ) : (
                            resumo.previewRows.map((r, idx) => (
                              <tr key={idx}>
                                {expectedColumns.map((c) => (
                                  <td key={c} className="text-truncate" style={{ maxWidth: "180px" }} title={r[c] ?? ""}>
                                    {r[c] ?? ""}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default ImportarPlanilhaModal;
