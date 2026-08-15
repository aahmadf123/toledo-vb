import { describe, expect, it } from "vitest";
import { setTypeParser } from "@ingest/parse-set-type";
import { hitPct } from "@/lib/metrics";
import { fixture, makeCtx } from "./helpers";

const blueGold = fixture(
  "set-type/Blue Gold Hitting by Set Type.xlsx",
  "Fall 2026/Blue Gold/Blue Gold Hitting by Set Type.xlsx"
);
const daily = fixture(
  "set-type/08.08 Hitter by Set Type.xlsx",
  "Fall 2026/Hitter by Set Type/August/08.08 Hitter by Set Type.xlsx"
);

describe("setTypeParser on the Blue Gold aggregate", () => {
  const { ctx, warnings } = makeCtx();
  const result = setTypeParser.parse(blueGold, ctx);
  const rows = result.attackBySetType!;

  it("detects the format", () => {
    expect(setTypeParser.detect(blueGold)).toBe(true);
  });

  it("reads Siefke's outsides row across set types", () => {
    const siefke = rows.filter((r) => r.playerId === "p14" && r.grid === "OH");
    const byCode = new Map(siefke.map((r) => [r.setCode, r]));
    expect(byCode.get("PG")).toMatchObject({ setName: "GO", k: 6, e: 4, ta: 18 });
    expect(byCode.get("P4")).toMatchObject({ setName: "OOS Left", k: 6, e: 1, ta: 12 });
    expect(byCode.get("PD")).toMatchObject({ setName: "DOG", k: 1, e: 1, ta: 4 });
    expect(byCode.get("P5")).toMatchObject({ k: 0, e: 1, ta: 1 });
    // Zero-attempt groups (PR, PP) produce no records.
    expect(byCode.has("PR")).toBe(false);
    expect(byCode.has("PP")).toBe(false);
  });

  it("scopes set codes to their grid (PD lives in OH/OPP and MB with different names)", () => {
    const sharkeyPd = rows.find((r) => r.playerId === "p18" && r.setCode === "PD")!;
    expect(sharkeyPd.grid).toBe("OPP");
    expect(sharkeyPd).toMatchObject({ setName: "DOG", k: 6, e: 2, ta: 12 });
    // Every record's identity includes its grid, so the MB "Dog" can never
    // collide with the OH/OPP "DOG".
    expect(rows.every((r) => ["OH", "OPP", "MB"].includes(r.grid))).toBe(true);
  });

  it("does not flag the dual-grid player as a duplicate", () => {
    // Pertzborn appears in both the OPP and MB grids of this file.
    expect(warnings.filter((w) => w.code === "duplicate-player-row")).toHaveLength(0);
    expect(warnings.filter((w) => w.code === "unknown-set-code")).toHaveLength(0);
  });

  it("recomputes every cached Hit % cell within tolerance", () => {
    // Cross-checked cells from the sheet: Naniseni PG -.1538, Catalano PD
    // .5556, Ozanich PS .5, Merk PA 1.
    const cases: Array<[string, string, string, number]> = [
      ["p11", "OH", "PG", -0.15384615],
      ["p16", "OPP", "PD", 0.55555556],
      ["p10", "MB", "PS", 0.5],
      ["p23", "MB", "PA", 1],
    ];
    for (const [playerId, grid, code, cached] of cases) {
      const r = rows.find((x) => x.playerId === playerId && x.grid === grid && x.setCode === code)!;
      expect(hitPct(r)).toBeCloseTo(cached, 3);
    }
  });
});

describe("setTypeParser on a daily practice file", () => {
  const { ctx } = makeCtx();
  const result = setTypeParser.parse(daily, ctx);

  it("resolves date and practice kind from the filename", () => {
    const s = result.sessions[0];
    expect(s.date).toBe("2026-08-08");
    expect(s.kind).toBe("practice");
    expect(s.id).toBe("2026-08-08-practice");
    expect(s.drill).toBeNull();
  });

  it("parses at least one grid of records", () => {
    expect(result.attackBySetType!.length).toBeGreaterThan(0);
  });
});
