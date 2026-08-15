// The only module that turns numbers and date strings into display text —
// and the only one allowed to construct Date objects (from split parts;
// never new Date("YYYY-MM-DD"), which is UTC midnight and shifts a day in ET).

/** Volleyball-style rate: 0.325 -> ".325", -0.05 -> "-.050". */
export function fmtRate(v: number | null): string {
  if (v === null) return "—";
  const s = v.toFixed(3);
  return s.replace(/^(-?)0\./, "$1.");
}

/** 0.742 -> "74.2%". */
export function fmtPct(v: number | null, digits = 1): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

/** Passer rating on the 0-3 scale: 2.13 -> "2.13". */
export function fmtRating(v: number | null): string {
  return v === null ? "—" : v.toFixed(2);
}

/** Per-set counting stats: 3.24 -> "3.2". */
export function fmtNum1(v: number | null): string {
  return v === null ? "—" : v.toFixed(1);
}

/** "2026-08-13" -> "Aug 13". */
export function fmtDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** "2026-08-13" -> "Aug 13, 2026". */
export function fmtDateLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** ISO timestamp -> "Aug 14, 3:42 PM ET" for the freshness stamp. */
export function fmtEt(iso: string): string {
  if (!iso) return "never";
  const formatted = new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatted} ET`;
}

/**
 * Diverging color bands for the setter/hitter matrix and set-type cells:
 * warm (orange) = trouble, neutral around break-even, cool (blue) = strong.
 * Orange/blue instead of red/green so colorblind readers get the same story;
 * the number is always printed in the cell, never color alone.
 */
export function rateColorClass(v: number | null): string {
  if (v === null) return "bg-white/5 text-ink-faint";
  if (v < 0) return "bg-orange-400/25 text-orange-200";
  if (v < 0.1) return "bg-orange-400/15 text-orange-300";
  if (v < 0.2) return "bg-white/5 text-ink-muted";
  if (v < 0.3) return "bg-sky-400/15 text-sky-300";
  return "bg-sky-400/25 text-sky-200";
}

/**
 * Fixed categorical series palette — the dataviz reference dark steps, same
 * hue order as v1's light palette, validated against the navy-900 chart
 * surface (all six ≥3:1, adjacent CVD ΔE ≥ 8.4).
 */
export const SERIES_COLORS = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
] as const;
