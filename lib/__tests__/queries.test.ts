import { describe, expect, it } from "vitest";
import type { MatchBoxLine, Player, Session } from "@ingest/schema";
import {
  boxTotals,
  leaderboard,
  metricValue,
  passingDistribution,
  sessionFamilies,
  type MetricData,
} from "@/lib/queries";
import { matchesPos, toGroups } from "@/lib/positions";

const boxLine = (over: Partial<MatchBoxLine> & { sessionId: string; playerId: string }): MatchBoxLine => ({
  mp: 1,
  sp: 0,
  ace: 0,
  sErr: 0,
  sAtt: 0,
  sRtg: null,
  sPct: null,
  rtg3: 0,
  rtg2: 0,
  rtg1: 0,
  srErr: 0,
  srAtt: 0,
  srRtg: null,
  kills: 0,
  aErr: 0,
  aAtt: 0,
  aPct: null,
  ast: 0,
  setAtt: 0,
  setPct: null,
  bSolo: 0,
  bAst: 0,
  bTot: 0,
  digs: 0,
  fbRcv: 0,
  fbSnt: 0,
  viol: 0,
  bhErr: 0,
  sourceFile: "test.csv",
  ...over,
});

const session = (over: Partial<Session> & { id: string; date: string }): Session => ({
  kind: "scrimmage",
  drill: null,
  opponent: null,
  setNumber: null,
  sourceFiles: [],
  weights: null,
  ...over,
});

const player = (over: Partial<Player> & { id: string; position: string }): Player => ({
  jersey: 1,
  first: "Test",
  last: over.id,
  class: "Jr",
  height: "6-0",
  hometown: "Toledo, OH",
  previousSchool: null,
  aliases: [],
  ...over,
});

const data = (boxLines: MatchBoxLine[]): MetricData => ({
  teamLines: [],
  attackRows: [],
  boxLines,
});

describe("positions", () => {
  it("splits dual positions and drops unknown fragments", () => {
    expect(toGroups("OH/OPP")).toEqual(["OH", "OPP"]);
    expect(toGroups("L")).toEqual(["L"]);
    expect(toGroups("DS")).toEqual([]);
  });

  it("matchesPos treats an empty filter as match-all and dual positions as either", () => {
    expect(matchesPos("MB", [])).toBe(true);
    expect(matchesPos("OH/OPP", ["OPP"])).toBe(true);
    expect(matchesPos("S", ["OH", "MB"])).toBe(false);
  });
});

describe("metricValue (box source)", () => {
  const lines = [
    boxLine({ sessionId: "s1", playerId: "p1", kills: 5, aErr: 1, aAtt: 12, digs: 6, sp: 3 }),
    boxLine({ sessionId: "s2", playerId: "p1", kills: 3, aErr: 2, aAtt: 8, digs: 2, sp: 1 }),
    boxLine({ sessionId: "s1", playerId: "team", kills: 30, aErr: 8, aAtt: 90, sp: 3 }),
  ];

  it("is ratio-of-sums across the session set, not an average of rates", () => {
    const point = metricValue("boxHitPct", "p1", new Set(["s1", "s2"]), data(lines));
    // (5+3 - 1-2) / (12+8) = 5/20, NOT mean(.333, .125)
    expect(point.value).toBeCloseTo(0.25, 10);
    expect(point.attempts).toBe(20);
  });

  it("selects the stored team row for the team entity instead of re-summing players", () => {
    const point = metricValue("boxHitPct", "team", new Set(["s1"]), data(lines));
    expect(point.value).toBeCloseTo((30 - 8) / 90, 10);
  });

  it("per-set metrics divide by sets played and report sp as the sample", () => {
    const point = metricValue("digsPerSet", "p1", new Set(["s1", "s2"]), data(lines));
    expect(point.value).toBeCloseTo(8 / 4, 10);
    expect(point.attempts).toBe(4);
  });

  it("boxPasserRating uses true 3/2/1 counts", () => {
    const passes = [
      boxLine({ sessionId: "s1", playerId: "p2", rtg3: 4, rtg2: 2, rtg1: 1, srAtt: 10 }),
    ];
    const point = metricValue("boxPasserRating", "p2", new Set(["s1"]), data(passes));
    expect(point.value).toBeCloseTo(1.7, 10);
    expect(point.attempts).toBe(10);
  });
});

describe("leaderboard", () => {
  const players = [
    player({ id: "oh1", position: "OH" }),
    player({ id: "oh2", position: "OH" }),
    player({ id: "lib", position: "L" }),
    player({ id: "set", position: "S" }),
  ];
  const lines = [
    boxLine({ sessionId: "s1", playerId: "oh1", kills: 10, aErr: 2, aAtt: 30 }),
    boxLine({ sessionId: "s1", playerId: "oh2", kills: 3, aErr: 0, aAtt: 4 }),
    boxLine({ sessionId: "s1", playerId: "lib", digs: 12, sp: 3 }),
  ];

  it("filters by appliesTo, drops empty samples, and sinks sub-minimum rows", () => {
    const rows = leaderboard("boxHitPct", players, new Set(["s1"]), data(lines));
    // lib and set are not hitters; oh2 has a sample but under MIN_ATTEMPTS.
    expect(rows.map((r) => r.player.id)).toEqual(["oh1", "oh2"]);
    expect(rows[0].qualified).toBe(true);
    expect(rows[1].qualified).toBe(false);
    // oh2's raw rate (.750) beats oh1's (.267) but does not outrank it.
    expect(rows[1].value).toBeCloseTo(0.75, 10);
  });

  it("per-set metrics qualify on their own lower sample bar", () => {
    const rows = leaderboard("digsPerSet", players, new Set(["s1"]), data(lines));
    expect(rows[0].player.id).toBe("lib");
    expect(rows[0].qualified).toBe(true);
  });
});

describe("boxTotals", () => {
  const lines = [
    boxLine({ sessionId: "s1", playerId: "p1", kills: 5, aErr: 1, aAtt: 12, sp: 3, digs: 6, ast: 2, setAtt: 5 }),
    boxLine({ sessionId: "s2", playerId: "p1", kills: 3, aErr: 2, aAtt: 8, sp: 1, digs: 2 }),
    boxLine({ sessionId: "s1", playerId: "team", sp: 3 }),
    boxLine({ sessionId: "s2", playerId: "team", sp: 1 }),
    boxLine({ sessionId: "s9", playerId: "p1", kills: 99, aAtt: 99, sp: 9 }),
  ];

  it("sums counts in range, derives rates, and computes playing share from the team row", () => {
    const rows = boxTotals(lines, new Set(["s1", "s2"]));
    expect(rows).toHaveLength(1);
    const p1 = rows[0];
    expect(p1.counts.kills).toBe(8);
    expect(p1.counts.digs).toBe(8);
    expect(p1.hitPct).toBeCloseTo(0.25, 10);
    expect(p1.digsPerSet).toBeCloseTo(2, 10);
    expect(p1.setPct).toBeCloseTo(2 / 5, 10);
    expect(p1.playingShare).toBeCloseTo(1, 10);
  });

  it("keeps the team row out of the player list", () => {
    const rows = boxTotals(lines, new Set(["s1", "s2"]));
    expect(rows.some((r) => r.playerId === "team")).toBe(false);
  });
});

describe("passingDistribution", () => {
  it("derives the zero-rated bucket from the attempt total and sums to srAtt", () => {
    const lines = [
      boxLine({ sessionId: "s1", playerId: "p1", rtg3: 4, rtg2: 3, rtg1: 1, srErr: 1, srAtt: 10 }),
      boxLine({ sessionId: "s1", playerId: "p2", srAtt: 0 }),
    ];
    const rows = passingDistribution(lines, new Set(["s1"]));
    expect(rows).toHaveLength(1);
    const p1 = rows[0];
    expect(p1.rtg3 + p1.rtg2 + p1.rtg1 + p1.r0).toBe(p1.srAtt);
    expect(p1.r0).toBe(2);
    expect(p1.rating).toBeCloseTo(1.9, 10);
  });
});

describe("sessionFamilies", () => {
  it("groups per-set rows under their whole-session parent in set order", () => {
    const sessions = [
      session({ id: "prac", date: "2026-08-10", kind: "practice" }),
      session({ id: "bg", date: "2026-08-13", opponent: "Blue Gold" }),
      session({ id: "bg-2", date: "2026-08-13", opponent: "Blue Gold", setNumber: 2 }),
      session({ id: "bg-1", date: "2026-08-13", opponent: "Blue Gold", setNumber: 1 }),
    ];
    const families = sessionFamilies(sessions);
    expect(families).toHaveLength(2);
    const bg = families.find((f) => f.parent.id === "bg")!;
    expect(bg.sets.map((s) => s.id)).toEqual(["bg-1", "bg-2"]);
    expect(families.find((f) => f.parent.id === "prac")!.sets).toEqual([]);
  });
});
