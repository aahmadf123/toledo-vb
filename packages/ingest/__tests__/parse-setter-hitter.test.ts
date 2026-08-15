import { describe, expect, it } from "vitest";
import { setterHitterParser } from "@ingest/parse-setter-hitter";
import { setterHitPct } from "@/lib/metrics";
import { fixture, makeCtx } from "./helpers";

const file = fixture(
  "setter-hitter/Blue Gold Setter Hitter.xlsx",
  "Fall 2026/Blue Gold/Blue Gold Setter Hitter.xlsx"
);

describe("setterHitterParser", () => {
  const { ctx } = makeCtx();
  const result = setterHitterParser.parse(file, ctx);
  const rows = result.setterHitter!;

  it("detects the format", () => {
    expect(setterHitterParser.detect(file)).toBe(true);
  });

  it("finds all five setter blocks including the liberos", () => {
    const setters = new Set(rows.map((r) => r.setterId));
    // 3 Green, 15 Bach, 12 LeBlanc are setters; 1 Freiberger and 7 Adamski
    // are liberos who set out-of-system balls.
    expect(setters).toEqual(new Set(["p3", "p15", "p12", "p1", "p7"]));
  });

  it("reads the Costlow-off-Green cell", () => {
    const row = rows.find((r) => r.setterId === "p3" && r.hitterId === "p6")!;
    expect(row).toMatchObject({ k: 1, eUnf: 0, eBlk: 0, ta: 5 });
  });

  it("skips zero-attempt pairs entirely", () => {
    expect(rows.some((r) => r.hitterId === "p2")).toBe(false); // Gaines: all zeros
    expect(rows.every((r) => r.k + r.eUnf + r.eBlk + r.ta > 0)).toBe(true);
  });

  it("reproduces the sheet's TOTALS row from summed records (recompute gate)", () => {
    // Cached TOTALS in the workbook: Green 17/8/2/52 -> .1346, Bach 20/3/5/50
    // -> .24, LeBlanc 14/2/3/47 -> .1915, Freiberger 3/0/0/9, Adamski 0/0/0/4.
    const cases: Array<[string, number, number]> = [
      ["p3", 52, 0.13461538],
      ["p15", 50, 0.24],
      ["p12", 47, 0.19148936],
      ["p1", 9, 0.33333333],
      ["p7", 4, 0],
    ];
    for (const [setterId, ta, cachedHitPct] of cases) {
      const mine = rows.filter((r) => r.setterId === setterId);
      const sum = mine.reduce(
        (a, r) => ({ k: a.k + r.k, eUnf: a.eUnf + r.eUnf, eBlk: a.eBlk + r.eBlk, ta: a.ta + r.ta }),
        { k: 0, eUnf: 0, eBlk: 0, ta: 0 }
      );
      expect(sum.ta).toBe(ta);
      expect(setterHitPct(sum)).toBeCloseTo(cachedHitPct, 3);
    }
  });

  it("keeps the path-rule scrimmage kind despite B1 saying PRACTICE", () => {
    expect(result.sessions[0].kind).toBe("scrimmage");
    expect(result.sessions[0].id).toBe("2026-08-08-scrimmage-blue-gold");
  });
});
