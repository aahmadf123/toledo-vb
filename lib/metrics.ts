// Every rate the dashboard shows is computed here, from raw counts, and
// nowhere else. Parser tests compare these against the spreadsheets' cached
// cells (within 0.001), which is the early-warning system for template drift.
// This module is pure and isomorphic: client components and ingest tests both
// import it. No fs, no server-only.

/** Rates render greyed with an attempts badge below this many attempts. */
export const MIN_ATTEMPTS = 10;

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

/** Hitting % by set type (Format C): single error column. */
export function hitPct(x: { k: number; e: number; ta: number }): number | null {
  return ratio(x.k - x.e, x.ta);
}

/** Hitting % on a setter's deliveries (Format B): unforced + blocked errors. */
export function setterHitPct(x: {
  k: number;
  eUnf: number;
  eBlk: number;
  ta: number;
}): number | null {
  return ratio(x.k - x.eUnf - x.eBlk, x.ta);
}

/** Attack efficiency from the Team workbook (Format A). */
export function attackEff(x: {
  k: number;
  e: number;
  blk: number;
  att: number;
}): number | null {
  return ratio(x.k - x.e - x.blk, x.att);
}

export function killPct(x: { k: number; att: number }): number | null {
  return ratio(x.k, x.att);
}

/** Match hitting % from the box score (Format D). */
export function matchHitPct(x: {
  kills: number;
  aErr: number;
  aAtt: number;
}): number | null {
  return ratio(x.kills - x.aErr, x.aAtt);
}

/** 0-3 passer rating from box-score reception counts (Format D). */
export function passerRating(x: {
  rtg3: number;
  rtg2: number;
  rtg1: number;
  srAtt: number;
}): number | null {
  return ratio(3 * x.rtg3 + 2 * x.rtg2 + x.rtg1, x.srAtt);
}

/** Perfect pass % (Format A reception). */
export function ppPct(x: { pp: number; att: number }): number | null {
  return ratio(x.pp, x.att);
}

export function serveMadePct(x: { att: number; err: number }): number | null {
  return ratio(x.att - x.err, x.att);
}

/**
 * Weighted average for rates that arrive without raw counts (reception AVG,
 * FBSO%, IN-SYS% from Format A): weight by attempts, skip null values.
 */
export function weightedAvg(
  pairs: Array<{ value: number | null; weight: number }>
): number | null {
  let sum = 0;
  let wsum = 0;
  for (const { value, weight } of pairs) {
    if (value === null || weight <= 0) continue;
    sum += value * weight;
    wsum += weight;
  }
  return wsum === 0 ? null : sum / wsum;
}

/**
 * Rolling mean over the trailing `window` points, skipping nulls (sessions
 * the player sat out). A point with no real values in its window stays null.
 */
export function rollingAvg(
  values: Array<number | null>,
  window = 5
): Array<number | null> {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    const real = slice.filter((v): v is number => v !== null);
    if (real.length === 0) return null;
    return real.reduce((a, b) => a + b, 0) / real.length;
  });
}

/** Sum count objects field-by-field; the only sanctioned aggregation. */
export function sumCounts<K extends string>(
  rows: Array<Record<K, number>>,
  keys: K[]
): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) for (const k of keys) out[k] += row[k];
  return out;
}
