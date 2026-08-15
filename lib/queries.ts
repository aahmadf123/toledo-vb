// Chart-ready shapes computed from normalized records. Pure functions over
// arrays (no fs) so both server pages and tests can use them; only the
// aggregation rules live here — the arithmetic itself stays in lib/metrics.

import type { AttackBySetType, Session, SetterHitter, TeamStatLine } from "@ingest/schema";
import { hitPct, ppPct, serveMadePct, setterHitPct, weightedAvg } from "@/lib/metrics";

export type MetricId =
  | "hitPct"
  | "attackEff"
  | "passerRating"
  | "ppPct"
  | "fbsoPct"
  | "inSysPct"
  | "serveMadePct"
  | "xps";

export interface MetricDef {
  id: MetricId;
  label: string;
  fmt: "rate3" | "pct1" | "rating";
  /** Which position groups this metric is meaningful for (profile tabs). */
  appliesTo: (position: string) => boolean;
}

const hitters = (p: string) => /OH|OPP|MB/.test(p);
const receivers = (p: string) => /OH|L|DS/.test(p);

export const METRICS: MetricDef[] = [
  { id: "hitPct", label: "Hitting % (by set type)", fmt: "rate3", appliesTo: hitters },
  { id: "attackEff", label: "Attack efficiency", fmt: "rate3", appliesTo: hitters },
  { id: "passerRating", label: "Passer rating", fmt: "rating", appliesTo: receivers },
  { id: "ppPct", label: "Perfect pass %", fmt: "pct1", appliesTo: receivers },
  { id: "fbsoPct", label: "FBSO %", fmt: "pct1", appliesTo: receivers },
  { id: "inSysPct", label: "In-system %", fmt: "pct1", appliesTo: receivers },
  { id: "serveMadePct", label: "Serve made %", fmt: "pct1", appliesTo: () => true },
  { id: "xps", label: "Expected points served (xPS)", fmt: "rate3", appliesTo: () => true },
];

export interface SeriesPoint {
  value: number | null;
  attempts: number;
}

/** "team" or a player id. */
export type EntityId = string;

/**
 * Metric value for one entity in one session. Count metrics are
 * ratio-of-sums; stored-as-given rates (passer rating, FBSO%, IN-SYS%, xPS)
 * are attempt-weighted averages, exactly as specified for Format A.
 */
export function metricPoint(
  metric: MetricId,
  entity: EntityId,
  sessionId: string,
  teamLines: TeamStatLine[],
  attackRows: AttackBySetType[]
): SeriesPoint {
  const mine = <T extends { sessionId: string }>(rows: T[], playerKey: (r: T) => string) =>
    rows.filter((r) => r.sessionId === sessionId && (entity === "team" || playerKey(r) === entity));

  switch (metric) {
    case "hitPct": {
      const rows = mine(attackRows, (r) => r.playerId);
      const sum = rows.reduce(
        (a, r) => ({ k: a.k + r.k, e: a.e + r.e, ta: a.ta + r.ta }),
        { k: 0, e: 0, ta: 0 }
      );
      return { value: hitPct(sum), attempts: sum.ta };
    }
    case "attackEff": {
      const rows = mine(teamLines, (r) => r.playerId).filter((r) => r.attacking);
      const sum = rows.reduce(
        (a, r) => ({
          k: a.k + r.attacking!.k,
          e: a.e + r.attacking!.e,
          blk: a.blk + r.attacking!.blk,
          att: a.att + r.attacking!.att,
        }),
        { k: 0, e: 0, blk: 0, att: 0 }
      );
      return {
        value: sum.att === 0 ? null : (sum.k - sum.e - sum.blk) / sum.att,
        attempts: sum.att,
      };
    }
    case "passerRating":
    case "fbsoPct":
    case "inSysPct": {
      const field = { passerRating: "avg", fbsoPct: "fbsoPct", inSysPct: "inSysPct" } as const;
      const rows = mine(teamLines, (r) => r.playerId).filter((r) => r.reception);
      const attempts = rows.reduce((a, r) => a + r.reception!.att, 0);
      return {
        value: weightedAvg(
          rows.map((r) => ({ value: r.reception![field[metric]], weight: r.reception!.att }))
        ),
        attempts,
      };
    }
    case "ppPct": {
      const rows = mine(teamLines, (r) => r.playerId).filter((r) => r.reception);
      const sum = rows.reduce(
        (a, r) => ({ pp: a.pp + r.reception!.pp, att: a.att + r.reception!.att }),
        { pp: 0, att: 0 }
      );
      return { value: ppPct(sum), attempts: sum.att };
    }
    case "serveMadePct": {
      const rows = mine(teamLines, (r) => r.playerId).filter((r) => r.serving);
      const sum = rows.reduce(
        (a, r) => ({ att: a.att + r.serving!.att, err: a.err + r.serving!.err }),
        { att: 0, err: 0 }
      );
      return { value: serveMadePct(sum), attempts: sum.att };
    }
    case "xps": {
      const rows = mine(teamLines, (r) => r.playerId).filter((r) => r.serving);
      const attempts = rows.reduce((a, r) => a + r.serving!.att, 0);
      return {
        value: weightedAvg(rows.map((r) => ({ value: r.serving!.xps, weight: r.serving!.att }))),
        attempts,
      };
    }
  }
}

export interface ConnectionCell {
  setterId: string;
  hitterId: string;
  k: number;
  eUnf: number;
  eBlk: number;
  ta: number;
  hitPct: number | null;
}

/** Setter x hitter matrix over a set of sessions. */
export function connectionMatrix(
  rows: SetterHitter[],
  sessionIds: Set<string>
): ConnectionCell[] {
  const cells = new Map<string, ConnectionCell>();
  for (const r of rows) {
    if (!sessionIds.has(r.sessionId)) continue;
    const key = `${r.setterId}|${r.hitterId}`;
    const cell =
      cells.get(key) ??
      ({ setterId: r.setterId, hitterId: r.hitterId, k: 0, eUnf: 0, eBlk: 0, ta: 0, hitPct: null } as ConnectionCell);
    cell.k += r.k;
    cell.eUnf += r.eUnf;
    cell.eBlk += r.eBlk;
    cell.ta += r.ta;
    cells.set(key, cell);
  }
  for (const cell of cells.values()) cell.hitPct = setterHitPct(cell);
  return [...cells.values()];
}

export interface SetTypeAgg {
  grid: string;
  setCode: string;
  setName: string;
  k: number;
  e: number;
  ta: number;
  hitPct: number | null;
  /** Share of the aggregate's total attempts. */
  taShare: number;
}

/** Per-set-type totals (optionally for one player) over a set of sessions. */
export function setTypeBreakdown(
  rows: AttackBySetType[],
  sessionIds: Set<string>,
  playerId?: string
): SetTypeAgg[] {
  const byType = new Map<string, SetTypeAgg>();
  for (const r of rows) {
    if (!sessionIds.has(r.sessionId)) continue;
    if (playerId && r.playerId !== playerId) continue;
    const key = `${r.grid}|${r.setCode}`;
    const agg =
      byType.get(key) ??
      ({ grid: r.grid, setCode: r.setCode, setName: r.setName, k: 0, e: 0, ta: 0, hitPct: null, taShare: 0 } as SetTypeAgg);
    agg.k += r.k;
    agg.e += r.e;
    agg.ta += r.ta;
    byType.set(key, agg);
  }
  const total = [...byType.values()].reduce((a, t) => a + t.ta, 0);
  for (const agg of byType.values()) {
    agg.hitPct = hitPct(agg);
    agg.taShare = total === 0 ? 0 : agg.ta / total;
  }
  return [...byType.values()].sort((a, b) => b.ta - a.ta);
}

export function sessionLabel(s: Session): string {
  const what =
    s.kind === "practice"
      ? s.drill ?? "practice"
      : s.opponent
        ? `${s.kind === "match" ? "vs " : ""}${s.opponent}`
        : s.kind;
  return `${what}${s.setNumber ? ` (set ${s.setNumber})` : ""}`;
}
