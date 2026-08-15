import * as XLSX from "xlsx";
import type { Warning } from "./schema";

export type Sheet = XLSX.WorkSheet;

export function readWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: "buffer" });
}

/**
 * Sheet lookup tolerant of trailing/leading whitespace in either direction.
 * The VS templates ship sheets literally named "PRACTICE " and "Sheet1 ";
 * a re-save can silently drop the space, and ingestion must survive both.
 */
export function getSheetLoose(
  wb: XLSX.WorkBook,
  name: string,
  warn?: (w: Warning) => void
): Sheet {
  if (wb.Sheets[name]) return wb.Sheets[name];
  const want = name.trim().toLowerCase();
  const actual = wb.SheetNames.find((n) => n.trim().toLowerCase() === want);
  if (actual) return wb.Sheets[actual];
  warn?.({
    code: "sheet-not-found",
    message: `No sheet matching "${name.trim()}" (found: ${wb.SheetNames.join(", ")})`,
  });
  throw new Error(`Sheet "${name.trim()}" not found`);
}

export function cellRaw(sheet: Sheet, addr: string): XLSX.CellObject | undefined {
  return sheet[addr] as XLSX.CellObject | undefined;
}

/**
 * Numeric cell read. Returns null for blank cells, Excel error cells, and the
 * literal "#ERROR" strings the VS template leaves where a formula divided by
 * zero (these are real cached values, not parse failures). Percent-formatted
 * cells come back as fractions because we read .v, never the formatted .w.
 */
export function cellNum(
  sheet: Sheet,
  addr: string,
  warn?: (w: Warning) => void
): number | null {
  const cell = cellRaw(sheet, addr);
  if (!cell || cell.v === undefined || cell.v === null) return null;
  if (cell.t === "e") {
    warn?.({ code: "error-cell", message: `Error cell at ${addr}`, cell: addr });
    return null;
  }
  if (typeof cell.v === "number") return cell.v;
  if (typeof cell.v === "string") {
    const s = cell.v.trim();
    if (s === "") return null;
    if (s.startsWith("#")) {
      warn?.({ code: "error-cell", message: `"${s}" at ${addr}`, cell: addr });
      return null;
    }
    const pct = s.endsWith("%");
    const n = Number(pct ? s.slice(0, -1) : s);
    if (Number.isFinite(n)) return pct ? n / 100 : n;
    warn?.({ code: "unparsed-numeric", message: `Unparseable "${s}" at ${addr}`, cell: addr });
    return null;
  }
  return null;
}

export function cellStr(sheet: Sheet, addr: string): string | null {
  const cell = cellRaw(sheet, addr);
  if (!cell || cell.v === undefined || cell.v === null) return null;
  const s = String(cell.v).trim();
  return s === "" ? null : s;
}

/** 0-based column/row to A1 address. */
export function addr(col: number, row: number): string {
  return XLSX.utils.encode_cell({ c: col, r: row });
}
