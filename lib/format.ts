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
 * Color scale for the setter/hitter matrix and set-type cells. Hitting %
 * bands follow coaching intuition: negative is trouble, .300+ is excellent.
 */
export function rateColorClass(v: number | null): string {
  if (v === null) return "bg-neutral-100 text-neutral-400";
  if (v < 0) return "bg-red-100 text-red-900";
  if (v < 0.1) return "bg-orange-100 text-orange-900";
  if (v < 0.2) return "bg-yellow-100 text-yellow-900";
  if (v < 0.3) return "bg-lime-100 text-lime-900";
  return "bg-green-200 text-green-900";
}
