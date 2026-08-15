import { describe, expect, it } from "vitest";
import { teamParser } from "@ingest/parse-team";
import { fixture, makeCtx } from "./helpers";

// Values below are read straight off the real Blue Gold Stats.xlsx.
const file = fixture("team/Blue Gold Stats.xlsx", "Fall 2026/Blue Gold/Blue Gold Stats.xlsx");

describe("teamParser", () => {
  const { ctx, warnings } = makeCtx();
  const result = teamParser.parse(file, ctx);
  const lines = result.teamStatLines!;
  const byId = new Map(lines.map((l) => [l.playerId, l]));

  it("detects the format", () => {
    expect(teamParser.detect(file)).toBe(true);
  });

  it("resolves the Blue Gold session from path rules", () => {
    expect(result.sessions).toHaveLength(1);
    const s = result.sessions[0];
    expect(s.id).toBe("2026-08-08-scrimmage-blue-gold");
    expect(s.date).toBe("2026-08-08");
    expect(s.kind).toBe("scrimmage");
  });

  it("stores the configurable weights from rows 2-3", () => {
    expect(result.sessions[0].weights).toEqual({
      reception: [3, 2, 2, 1, 0.5, 0],
      serving: [1, 0.48, 0.42, 0.33, 0.71, 0],
    });
  });

  it("parses all 20 rostered players across five position blocks", () => {
    expect(lines).toHaveLength(20);
    const groups = Object.fromEntries(
      ["OH", "OPP", "MB", "L", "S"].map((g) => [
        g,
        lines.filter((l) => l.positionGroup === g).length,
      ])
    );
    expect(groups).toEqual({ OH: 5, OPP: 3, MB: 4, L: 5, S: 3 });
  });

  it("reads Costlow's full line correctly", () => {
    const c = byId.get("p6")!;
    expect(c.positionGroup).toBe("OH");
    expect(c.attacking).toEqual({ k: 7, e: 0, blk: 1, att: 24 });
    expect(c.reception?.att).toBe(13);
    expect(c.reception?.avg).toBeCloseTo(1.61538462, 6);
    expect(c.reception?.pp).toBe(3);
    expect(c.reception?.fbsoPct).toBe(1);
    expect(c.reception?.inSysPct).toBeCloseTo(0.38461538, 6);
    expect(c.serving).toEqual({ att: 10, aces: 2, err: 4, xps: 0.332, madePct: 0.6 });
    expect(c.satOut).toBe(false);
  });

  it("turns #ERROR cells into nulls", () => {
    const gaines = byId.get("p2")!;
    expect(gaines.reception?.avg).toBeNull();
    expect(gaines.serving?.xps).toBeNull();
    expect(gaines.serving?.madePct).toBeNull();
    expect(warnings.some((w) => w.code === "error-cell")).toBe(true);
  });

  it("marks zero-attempt rows as sat out", () => {
    expect(byId.get("p2")?.satOut).toBe(true); // Gaines
    expect(byId.get("p22")?.satOut).toBe(true); // Pertzborn (played MB side only that day)
    expect(byId.get("p6")?.satOut).toBe(false);
  });

  it("gives liberos null attacking and setters null reception", () => {
    expect(byId.get("p1")?.attacking).toBeNull(); // Freiberger
    expect(byId.get("p1")?.reception?.att).toBe(19);
    expect(byId.get("p15")?.reception).toBeNull(); // Bach
    expect(byId.get("p15")?.attacking).toEqual({ k: 2, e: 0, blk: 0, att: 4 });
  });

  it("assigns Pertzborn to the OPPOSITIES block of this sheet", () => {
    expect(byId.get("p22")?.positionGroup).toBe("OPP");
  });
});
