// Chart-ready shapes computed from normalized records. Pure functions over
// arrays (no fs) so server pages, client explorers, and tests all use the
// same aggregation code path; only the aggregation rules live here — the
// arithmetic itself stays in lib/metrics.

import type {
  AttackBySetType,
  MatchBoxLine,
  Player,
  Session,
  SetterHitter,
  TeamStatLine,
} from "@ingest/schema";
import {
  hitPct,
  killPct,
  matchHitPct,
  MIN_ATTEMPTS,
  passerRating,
  ppPct,
  serveMadePct,
  setterHitPct,
  sumCounts,
  weightedAvg,
} from "@/lib/metrics";
import { toGroups } from "@/lib/positions";

export type MetricId =
  | "hitPct"
  | "attackEff"
  | "killPct"
  | "boxHitPct"
  | "passerRating"
  | "boxPasserRating"
  | "ppPct"
  | "fbsoPct"
  | "inSysPct"
  | "serveMadePct"
  | "xps"
  | "serveRating"
  | "digsPerSet"
  | "blocksPerSet"
  | "assistsPerSet"
  | "acesPerSet";

export type MetricFmt = "rate3" | "pct1" | "rating" | "num1";

/** Which normalized store a metric reads — box metrics only exist for sessions with box scores. */
export type MetricSource = "team" | "attack" | "box";

export interface MetricDef {
  id: MetricId;
  label: string;
  fmt: MetricFmt;
  source: MetricSource;
  /** Which position groups this metric is meaningful for (leaderboards, profile tabs). */
  appliesTo: (position: string) => boolean;
  /**
   * Sample size below which the rate renders greyed. Per-set metrics use sets
   * played as their sample, so they get a much lower bar than attempt rates.
   */
  minAttempts?: number;
}

const hitters = (p: string) => /OH|OPP|MB/.test(p);
const receivers = (p: string) => /OH|L|DS/.test(p);
const setters = (p: string) => toGroups(p).includes("S");

export const METRICS: MetricDef[] = [
  { id: "hitPct", label: "Hitting % (by set type)", fmt: "rate3", source: "attack", appliesTo: hitters },
  { id: "attackEff", label: "Attack efficiency", fmt: "rate3", source: "team", appliesTo: hitters },
  { id: "killPct", label: "Kill %", fmt: "pct1", source: "team", appliesTo: hitters },
  { id: "boxHitPct", label: "Hit % (box score)", fmt: "rate3", source: "box", appliesTo: hitters },
  { id: "passerRating", label: "Passer rating (avg)", fmt: "rating", source: "team", appliesTo: receivers },
  { id: "boxPasserRating", label: "Passer rating (3-2-1)", fmt: "rating", source: "box", appliesTo: receivers },
  { id: "ppPct", label: "Perfect pass %", fmt: "pct1", source: "team", appliesTo: receivers },
  { id: "fbsoPct", label: "FBSO %", fmt: "pct1", source: "team", appliesTo: receivers },
  { id: "inSysPct", label: "In-system %", fmt: "pct1", source: "team", appliesTo: receivers },
  { id: "serveMadePct", label: "Serve made %", fmt: "pct1", source: "team", appliesTo: () => true },
  { id: "xps", label: "Expected points served (xPS)", fmt: "rate3", source: "team", appliesTo: () => true },
  { id: "serveRating", label: "Serve rating", fmt: "rating", source: "box", appliesTo: () => true },
  { id: "digsPerSet", label: "Digs / set", fmt: "num1", source: "box", appliesTo: () => true, minAttempts: 2 },
  { id: "blocksPerSet", label: "Blocks / set", fmt: "num1", source: "box", appliesTo: hitters, minAttempts: 2 },
  { id: "assistsPerSet", label: "Assists / set", fmt: "num1", source: "box", appliesTo: setters, minAttempts: 2 },
  { id: "acesPerSet", label: "Aces / set", fmt: "num1", source: "box", appliesTo: () => true, minAttempts: 2 },
];

export const METRIC_BY_ID = new Map(METRICS.map((m) => [m.id, m]));

export interface SeriesPoint {
  value: number | null;
  attempts: number;
}

/** "team" or a player id. Box lines store the team total row as playerId "team". */
export type EntityId = string;

// Structural Picks so client explorers can feed trimmed payload rows (no
// sourceFile) through the exact same aggregation code the server uses.
export interface MetricData {
  teamLines: Array<
    Pick<TeamStatLine, "sessionId" | "playerId" | "attacking" | "reception" | "serving">
  >;
  attackRows: Array<Pick<AttackBySetType, "sessionId" | "playerId" | "k" | "e" | "ta">>;
  boxLines: Array<Omit<MatchBoxLine, "sourceFile">>;
}

/**
 * Metric value for one entity across a set of sessions. Count metrics are
 * ratio-of-sums; stored-as-given rates (reception AVG, FBSO%, IN-SYS%, xPS,
 * serve rating) are attempt-weighted averages, exactly as specified for
 * their source formats. `attempts` is the metric's own sample size (attack
 * attempts, serve attempts, sets played …), used for MIN_ATTEMPTS greying.
 */
export function metricValue(
  metric: MetricId,
  entity: EntityId,
  sessionIds: ReadonlySet<string>,
  data: MetricData
): SeriesPoint {
  const mine = <T extends { sessionId: string }>(rows: T[], playerKey: (r: T) => string) =>
    rows.filter(
      (r) => sessionIds.has(r.sessionId) && (entity === "team" || playerKey(r) === entity)
    );
  // Box lines carry an explicit "team" total row, so the team entity selects
  // it directly instead of re-summing players (which would double count).
  const mineBox = () => data.boxLines.filter((r) => sessionIds.has(r.sessionId) && r.playerId === entity);

  switch (metric) {
    case "hitPct": {
      const rows = mine(data.attackRows, (r) => r.playerId);
      const sum = sumCounts(rows, ["k", "e", "ta"]);
      return { value: hitPct(sum), attempts: sum.ta };
    }
    case "attackEff": {
      const rows = mine(data.teamLines, (r) => r.playerId)
        .filter((r) => r.attacking)
        .map((r) => r.attacking!);
      const sum = sumCounts(rows, ["k", "e", "blk", "att"]);
      return {
        value: sum.att === 0 ? null : (sum.k - sum.e - sum.blk) / sum.att,
        attempts: sum.att,
      };
    }
    case "killPct": {
      const rows = mine(data.teamLines, (r) => r.playerId)
        .filter((r) => r.attacking)
        .map((r) => r.attacking!);
      const sum = sumCounts(rows, ["k", "att"]);
      return { value: killPct(sum), attempts: sum.att };
    }
    case "passerRating":
    case "fbsoPct":
    case "inSysPct": {
      const field = { passerRating: "avg", fbsoPct: "fbsoPct", inSysPct: "inSysPct" } as const;
      const rows = mine(data.teamLines, (r) => r.playerId).filter((r) => r.reception);
      const attempts = rows.reduce((a, r) => a + r.reception!.att, 0);
      return {
        value: weightedAvg(
          rows.map((r) => ({ value: r.reception![field[metric]], weight: r.reception!.att }))
        ),
        attempts,
      };
    }
    case "ppPct": {
      const rows = mine(data.teamLines, (r) => r.playerId)
        .filter((r) => r.reception)
        .map((r) => r.reception!);
      const sum = sumCounts(rows, ["pp", "att"]);
      return { value: ppPct(sum), attempts: sum.att };
    }
    case "serveMadePct": {
      const rows = mine(data.teamLines, (r) => r.playerId)
        .filter((r) => r.serving)
        .map((r) => r.serving!);
      const sum = sumCounts(rows, ["att", "err"]);
      return { value: serveMadePct(sum), attempts: sum.att };
    }
    case "xps": {
      const rows = mine(data.teamLines, (r) => r.playerId).filter((r) => r.serving);
      const attempts = rows.reduce((a, r) => a + r.serving!.att, 0);
      return {
        value: weightedAvg(rows.map((r) => ({ value: r.serving!.xps, weight: r.serving!.att }))),
        attempts,
      };
    }
    case "boxHitPct": {
      const sum = sumCounts(mineBox(), ["kills", "aErr", "aAtt"]);
      return { value: matchHitPct(sum), attempts: sum.aAtt };
    }
    case "boxPasserRating": {
      const sum = sumCounts(mineBox(), ["rtg3", "rtg2", "rtg1", "srAtt"]);
      return { value: passerRating(sum), attempts: sum.srAtt };
    }
    case "serveRating": {
      const rows = mineBox();
      const attempts = rows.reduce((a, r) => a + r.sAtt, 0);
      return {
        value: weightedAvg(rows.map((r) => ({ value: r.sRtg, weight: r.sAtt }))),
        attempts,
      };
    }
    case "digsPerSet":
    case "blocksPerSet":
    case "assistsPerSet":
    case "acesPerSet": {
      const field = {
        digsPerSet: "digs",
        blocksPerSet: "bTot",
        assistsPerSet: "ast",
        acesPerSet: "ace",
      } as const;
      const rows = mineBox();
      const sum = sumCounts(rows, [field[metric], "sp"]);
      return {
        value: sum.sp === 0 ? null : sum[field[metric]] / sum.sp,
        attempts: sum.sp,
      };
    }
  }
}

export interface LeaderboardRow<P = Player> {
  player: P;
  value: number | null;
  attempts: number;
  /** Meets the metric's minimum sample — unqualified rows sort to the bottom, greyed. */
  qualified: boolean;
}

/**
 * Season or session leaderboard for one metric. Only players the metric
 * applies to (by roster position) and who actually have a sample appear.
 */
export function leaderboard<P extends { id: string; position: string }>(
  metricId: MetricId,
  players: P[],
  sessionIds: ReadonlySet<string>,
  data: MetricData
): LeaderboardRow<P>[] {
  const def = METRIC_BY_ID.get(metricId);
  if (!def) return [];
  const min = def.minAttempts ?? MIN_ATTEMPTS;
  return players
    .filter((p) => def.appliesTo(p.position))
    .map((player) => {
      const point = metricValue(metricId, player.id, sessionIds, data);
      return {
        player,
        ...point,
        qualified: point.value !== null && point.attempts >= min,
      };
    })
    .filter((r) => r.attempts > 0 && r.value !== null)
    .sort(
      (a, b) => Number(b.qualified) - Number(a.qualified) || (b.value ?? 0) - (a.value ?? 0)
    );
}

export const BOX_COUNT_KEYS = [
  "mp",
  "sp",
  "ace",
  "sErr",
  "sAtt",
  "rtg3",
  "rtg2",
  "rtg1",
  "srErr",
  "srAtt",
  "kills",
  "aErr",
  "aAtt",
  "ast",
  "setAtt",
  "bSolo",
  "bAst",
  "bTot",
  "digs",
  "fbRcv",
  "fbSnt",
  "viol",
  "bhErr",
] as const;
export type BoxCountKey = (typeof BOX_COUNT_KEYS)[number];

export interface BoxTotalsRow {
  playerId: string;
  counts: Record<BoxCountKey, number>;
  hitPct: number | null;
  passerRating: number | null;
  serveRating: number | null;
  setPct: number | null;
  digsPerSet: number | null;
  blocksPerSet: number | null;
  /** Sets played over the team's sets — the closest thing to playing time. */
  playingShare: number | null;
}

/**
 * Per-player box-score totals over a set of sessions. The stored "team" total
 * row is kept out of the player list and used only for playingShare.
 */
export function boxTotals(
  boxLines: MetricData["boxLines"],
  sessionIds: ReadonlySet<string>
): BoxTotalsRow[] {
  const inRange = boxLines.filter((r) => sessionIds.has(r.sessionId));
  const teamSp = sumCounts(inRange.filter((r) => r.playerId === "team"), ["sp"]).sp;

  const byPlayer = new Map<string, MetricData["boxLines"]>();
  for (const r of inRange) {
    if (r.playerId === "team") continue;
    const list = byPlayer.get(r.playerId) ?? [];
    list.push(r);
    byPlayer.set(r.playerId, list);
  }

  return [...byPlayer.entries()]
    .map(([playerId, rows]) => {
      const counts = sumCounts(rows, [...BOX_COUNT_KEYS]);
      const sAttWeighted = weightedAvg(rows.map((r) => ({ value: r.sRtg, weight: r.sAtt })));
      return {
        playerId,
        counts,
        hitPct: matchHitPct(counts),
        passerRating: passerRating(counts),
        serveRating: sAttWeighted,
        setPct: counts.setAtt === 0 ? null : counts.ast / counts.setAtt,
        digsPerSet: counts.sp === 0 ? null : counts.digs / counts.sp,
        blocksPerSet: counts.sp === 0 ? null : counts.bTot / counts.sp,
        playingShare: teamSp === 0 ? null : counts.sp / teamSp,
      };
    })
    .sort((a, b) => b.counts.sp - a.counts.sp || b.counts.kills - a.counts.kills);
}

export interface PassingDistributionRow {
  playerId: string;
  rtg3: number;
  rtg2: number;
  rtg1: number;
  /** Zero-rated receptions: attempts not scored 3/2/1 (errors included). */
  r0: number;
  srAtt: number;
  rating: number | null;
}

/** True 3/2/1/0 reception distribution from box-score counts, heaviest passers first. */
export function passingDistribution(
  boxLines: MetricData["boxLines"],
  sessionIds: ReadonlySet<string>
): PassingDistributionRow[] {
  const byPlayer = new Map<string, MetricData["boxLines"]>();
  for (const r of boxLines) {
    if (!sessionIds.has(r.sessionId) || r.playerId === "team") continue;
    const list = byPlayer.get(r.playerId) ?? [];
    list.push(r);
    byPlayer.set(r.playerId, list);
  }
  return [...byPlayer.entries()]
    .map(([playerId, rows]) => {
      const c = sumCounts(rows, ["rtg3", "rtg2", "rtg1", "srAtt"]);
      return {
        playerId,
        rtg3: c.rtg3,
        rtg2: c.rtg2,
        rtg1: c.rtg1,
        r0: Math.max(0, c.srAtt - c.rtg3 - c.rtg2 - c.rtg1),
        srAtt: c.srAtt,
        rating: passerRating(c),
      };
    })
    .filter((r) => r.srAtt > 0)
    .sort((a, b) => b.srAtt - a.srAtt);
}

export interface SessionFamily {
  /** The whole-session row (setNumber === null). */
  parent: Session;
  /** Per-set rows of the same date/kind/opponent, in set order. */
  sets: Session[];
}

/**
 * Groups per-set sessions under their whole-session parent, so pages can
 * show set-by-set progression without every other page seeing per-set rows.
 */
export function sessionFamilies(sessions: Session[]): SessionFamily[] {
  const key = (s: Session) => `${s.date}|${s.kind}|${s.opponent ?? ""}`;
  const parents = sessions.filter((s) => s.setNumber === null);
  const setsByKey = new Map<string, Session[]>();
  for (const s of sessions) {
    if (s.setNumber === null) continue;
    const list = setsByKey.get(key(s)) ?? [];
    list.push(s);
    setsByKey.set(key(s), list);
  }
  return parents.map((parent) => ({
    parent,
    sets: (setsByKey.get(key(parent)) ?? []).sort(
      (a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0)
    ),
  }));
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

/** Setter x hitter matrix over a set of sessions. Accepts trimmed payload rows. */
export function connectionMatrix(
  rows: Array<Pick<SetterHitter, "sessionId" | "setterId" | "hitterId" | "k" | "eUnf" | "eBlk" | "ta">>,
  sessionIds: ReadonlySet<string>
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

/** Per-set-type totals (optionally for one player) over a set of sessions. Accepts trimmed payload rows. */
export function setTypeBreakdown(
  rows: Array<
    Pick<AttackBySetType, "sessionId" | "playerId" | "grid" | "setCode" | "setName" | "k" | "e" | "ta">
  >,
  sessionIds: ReadonlySet<string>,
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
