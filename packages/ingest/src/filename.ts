import path from "node:path";
import type { IngestConfig, SessionKind, Warning } from "./schema";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export interface ParsedRawPath {
  /** "YYYY-MM-DD" or null when the filename has no date prefix. */
  date: string | null;
  /** Label after the date prefix, extension stripped: "6v6", "Blue.Gold All Sets". */
  label: string | null;
  /** Session kind resolved from path rules (first segment under the season root). */
  kind: SessionKind | null;
  /** Fixed date/label from a path rule (Blue Gold folder has no date prefixes). */
  ruleDate: string | null;
  ruleLabel: string | null;
  setNumber: number | null;
  warnings: Warning[];
}

/**
 * Resolve date, drill label, and session kind from a raw-tree path like
 * "Fall 2026/Team/August/8.13 4-2-4-2 ct 2.xlsx". Date prefixes are
 * inconsistent ("08.08" and "8.10" both occur) and carry no year: year comes
 * from config.seasonYear, and the month folder is a sanity check only — on
 * mismatch the filename wins and a warning is recorded.
 */
export function parseRawPath(relPath: string, config: IngestConfig): ParsedRawPath {
  const warnings: Warning[] = [];
  const parts = relPath.split("/");
  // Drop the season root ("Fall 2026") if present.
  const inSeason = parts.length > 1 && /^(fall|spring)\s+\d{4}$/i.test(parts[0]) ? parts.slice(1) : parts;
  const topFolder = inSeason.length > 1 ? inSeason[0] : null;
  const base = path.basename(relPath, path.extname(relPath));

  const rule = config.pathRules.find(
    (r) => topFolder !== null && r.glob.toLowerCase().startsWith(topFolder.toLowerCase())
  );

  let date: string | null = null;
  let label: string | null = base;
  const m = base.match(/^(\d{1,2})\.(\d{1,2})\b\s*/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    date = `${config.seasonYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    label = base.slice(m[0].length).trim() || null;

    const monthFolder = inSeason.find((p) => MONTHS[p.toLowerCase()] !== undefined);
    if (monthFolder && MONTHS[monthFolder.toLowerCase()] !== month) {
      warnings.push({
        code: "ambiguous-date",
        message: `Filename month ${month} disagrees with folder "${monthFolder}" in ${relPath}; using filename`,
      });
    }
  }

  let setNumber: number | null = null;
  if (label) {
    const setMatch = label.match(/\bSet\s+(\d+)$/i);
    if (setMatch) {
      setNumber = Number(setMatch[1]);
      label = label.slice(0, setMatch.index).trim() || null;
    } else {
      const allSets = label.match(/\bAll\s+Sets$/i);
      if (allSets) label = label.slice(0, allSets.index).trim() || null;
    }
    // "Blue.Gold" in Team-folder CSV names is the scrimmage label.
    if (label && /^blue\.?\s?gold$/i.test(label)) label = "Blue Gold";
  }

  return {
    date,
    label,
    kind: rule?.kind ?? null,
    ruleDate: rule?.date ?? null,
    ruleLabel: rule?.label ?? null,
    setNumber,
    warnings,
  };
}

export function isIgnoredPath(relPath: string): boolean {
  const base = path.basename(relPath);
  if (base.startsWith("~$") || base === ".gitkeep" || base.startsWith(".")) return true;
  if (relPath.split("/").some((p) => p.trim().toLowerCase() === "before vs")) return true;
  const ext = path.extname(base).toLowerCase();
  return ext !== ".xlsx" && ext !== ".csv";
}
