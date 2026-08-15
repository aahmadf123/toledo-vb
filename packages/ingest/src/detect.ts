import path from "node:path";
import type { RawFile } from "./types";
import { cellStr, getSheetLoose, readWorkbook } from "./xlsx-utils";

export type ParserFormat = "team" | "setter-hitter" | "attack-by-set-type" | "box-score";

/**
 * Path-based routing first (cheap, matches the OneDrive folder conventions),
 * content sniffing as fallback for files that land somewhere unexpected.
 */
export function detectFormat(file: RawFile): ParserFormat | null {
  const ext = path.extname(file.relPath).toLowerCase();
  const base = path.basename(file.relPath).toLowerCase();
  const full = file.relPath.toLowerCase();

  if (ext === ".csv") {
    return file.buffer.toString("utf8", 0, 200).includes("Athlete Stats")
      ? "box-score"
      : null;
  }
  if (ext !== ".xlsx") return null;

  // Basename cues cover the Blue Gold folder, where all three workbook
  // formats sit side by side.
  if (base.includes("setter hitter")) return "setter-hitter";
  if (base.includes("hitter by set type") || base.includes("hitting by set type")) {
    return "attack-by-set-type";
  }
  if (full.includes("setter stats/")) return "setter-hitter";
  if (full.includes("hitter by set type/")) return "attack-by-set-type";
  if (full.includes("team/") || base.includes("stats")) return "team";

  return sniffWorkbook(file);
}

function sniffWorkbook(file: RawFile): ParserFormat | null {
  try {
    const wb = readWorkbook(file.buffer);
    if (wb.SheetNames.some((n) => n.trim().toLowerCase() === "practice")) return "team";
    const sheet = getSheetLoose(wb, "Sheet1");
    if (cellStr(sheet, "A1")?.startsWith("TOL")) return "attack-by-set-type";
    for (let c = 0; c < 40; c++) {
      const v = cellStr(sheet, `${colName(c)}6`);
      if (v === "E-Unf") return "setter-hitter";
    }
  } catch {
    return null;
  }
  return null;
}

function colName(c: number): string {
  let s = "";
  let n = c;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}
