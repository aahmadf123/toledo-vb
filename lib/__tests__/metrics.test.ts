import { describe, expect, it } from "vitest";
import {
  attackEff,
  hitPct,
  matchHitPct,
  passerRating,
  ppPct,
  rollingAvg,
  serveMadePct,
  setterHitPct,
  sumCounts,
  weightedAvg,
} from "@/lib/metrics";

describe("rate formulas", () => {
  it("hitPct = (k - e) / ta, null at ta = 0", () => {
    expect(hitPct({ k: 5, e: 2, ta: 10 })).toBeCloseTo(0.3, 10);
    expect(hitPct({ k: 0, e: 0, ta: 0 })).toBeNull();
  });

  it("setterHitPct subtracts both error kinds", () => {
    expect(setterHitPct({ k: 6, eUnf: 1, eBlk: 1, ta: 10 })).toBeCloseTo(0.4, 10);
    expect(setterHitPct({ k: 0, eUnf: 0, eBlk: 0, ta: 0 })).toBeNull();
  });

  it("attackEff subtracts errors and blocks", () => {
    expect(attackEff({ k: 10, e: 3, blk: 2, att: 20 })).toBeCloseTo(0.25, 10);
  });

  it("matchHitPct = (kills - aErr) / aAtt", () => {
    expect(matchHitPct({ kills: 7, aErr: 2, aAtt: 20 })).toBeCloseTo(0.25, 10);
  });

  it("passerRating = (3*r3 + 2*r2 + r1) / srAtt on the 0-3 scale", () => {
    expect(passerRating({ rtg3: 4, rtg2: 2, rtg1: 1, srAtt: 10 })).toBeCloseTo(1.7, 10);
    expect(passerRating({ rtg3: 0, rtg2: 0, rtg1: 0, srAtt: 0 })).toBeNull();
  });

  it("ppPct and serveMadePct", () => {
    expect(ppPct({ pp: 3, att: 12 })).toBeCloseTo(0.25, 10);
    expect(serveMadePct({ att: 20, err: 3 })).toBeCloseTo(0.85, 10);
    expect(serveMadePct({ att: 0, err: 0 })).toBeNull();
  });
});

describe("weightedAvg", () => {
  it("weights by attempts and skips nulls", () => {
    expect(
      weightedAvg([
        { value: 2.0, weight: 10 },
        { value: 3.0, weight: 30 },
        { value: null, weight: 50 },
      ])
    ).toBeCloseTo(2.75, 10);
  });

  it("returns null with no usable points", () => {
    expect(weightedAvg([{ value: null, weight: 5 }, { value: 1, weight: 0 }])).toBeNull();
  });
});

describe("rollingAvg", () => {
  it("averages the trailing window", () => {
    expect(rollingAvg([1, 2, 3, 4, 5], 3)).toEqual([1, 1.5, 2, 3, 4]);
  });

  it("skips nulls without breaking the window", () => {
    const out = rollingAvg([1, null, 3], 3);
    expect(out[0]).toBe(1);
    expect(out[1]).toBe(1); // only the 1 is real so far
    expect(out[2]).toBe(2); // (1 + 3) / 2
  });

  it("keeps all-null windows null", () => {
    expect(rollingAvg([null, null], 5)).toEqual([null, null]);
  });
});

describe("sumCounts", () => {
  it("sums selected numeric fields", () => {
    expect(
      sumCounts(
        [
          { k: 1, e: 2, ta: 5 },
          { k: 3, e: 0, ta: 7 },
        ],
        ["k", "e", "ta"]
      )
    ).toEqual({ k: 4, e: 2, ta: 12 });
  });
});
