import { describe, expect, it } from "vitest";
import { boxScoreParser } from "@ingest/parse-box-score";
import { matchHitPct, passerRating } from "@/lib/metrics";
import { fixture, makeCtx } from "./helpers";

const allSets = fixture(
  "box-score/08.08 Blue.Gold All Sets.csv",
  "Fall 2026/Team/August/08.08 Blue.Gold All Sets.csv"
);
const set1 = fixture(
  "box-score/08.08 Blue.Gold Set 1.csv",
  "Fall 2026/Team/August/08.08 Blue.Gold Set 1.csv"
);

describe("boxScoreParser on All Sets", () => {
  const { ctx, warnings } = makeCtx();
  const result = boxScoreParser.parse(allSets, ctx);
  const lines = result.matchBoxLines!;
  const byId = new Map(lines.map((l) => [l.playerId, l]));

  it("detects the format", () => {
    expect(boxScoreParser.detect(allSets)).toBe(true);
    expect(warnings.filter((w) => w.code === "header-drift")).toHaveLength(0);
  });

  it("maps a box score in a practice folder to the scrimmage session", () => {
    const s = result.sessions[0];
    expect(s.kind).toBe("scrimmage");
    expect(s.id).toBe("2026-08-08-scrimmage-blue-gold");
    expect(s.setNumber).toBeNull();
  });

  it("parses 17 player rows plus the team total", () => {
    expect(lines).toHaveLength(18);
    expect(byId.has("team")).toBe(true);
  });

  it("disambiguates the duplicate S Att header by position", () => {
    // Bach: serve attempts 11 (index 5) vs set attempts 53 (index 19) — a
    // header-name parser would collapse these into one.
    const bach = byId.get("p15")!;
    expect(bach.sAtt).toBe(11);
    expect(bach.setAtt).toBe(53);
    expect(bach.sAtt).not.toBe(bach.setAtt);
    expect(bach.ast).toBe(18);
  });

  it("treats empty cells as zero counts and null rates", () => {
    const naniseni = byId.get("p11")!; // no serving at all that day
    expect(naniseni.sAtt).toBe(0);
    expect(naniseni.sRtg).toBeNull();
    expect(naniseni.kills).toBe(6);
  });

  it("recomputes cached rates from counts on player rows (recompute gate)", () => {
    for (const l of lines) {
      if (l.playerId === "team") continue;
      if (l.aAtt > 0 && l.aPct !== null) {
        expect(matchHitPct({ kills: l.kills, aErr: l.aErr, aAtt: l.aAtt })).toBeCloseTo(
          l.aPct,
          3
        );
      }
      if (l.srAtt > 0 && l.srRtg !== null) {
        expect(
          passerRating({ rtg3: l.rtg3, rtg2: l.rtg2, rtg1: l.rtg1, srAtt: l.srAtt })
        ).toBeCloseTo(l.srRtg, 2); // sheet rounds to 2 decimals
      }
    }
  });

  it("team total SR Rtg is known to disagree with the player formula (excluded above)", () => {
    const team = byId.get("team")!;
    const recomputed = passerRating(team);
    // Cached 1.75 vs recomputed ~1.74 — the documented VS quirk.
    expect(recomputed).not.toBeNull();
    expect(Math.abs(recomputed! - team.srRtg!)).toBeLessThan(0.02);
  });
});

describe("boxScoreParser on a per-set CSV", () => {
  const { ctx } = makeCtx();
  const result = boxScoreParser.parse(set1, ctx);

  it("gets its own set-numbered session", () => {
    const s = result.sessions[0];
    expect(s.id).toBe("2026-08-08-scrimmage-blue-gold-set-1");
    expect(s.setNumber).toBe(1);
  });
});
