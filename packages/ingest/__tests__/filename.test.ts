import { describe, expect, it } from "vitest";
import { isIgnoredPath, parseRawPath } from "@ingest/filename";
import { buildSessionId, slugify } from "@ingest/session-id";
import type { IngestConfig } from "@ingest/schema";

const config: IngestConfig = {
  seasonYear: 2026,
  pathRules: [
    { glob: "Blue Gold/**", kind: "scrimmage", date: "2026-08-08", label: "Blue Gold" },
    { glob: "Hitter by Set Type/**", kind: "practice" },
    { glob: "Setter Stats/**", kind: "practice" },
    { glob: "Team/**", kind: "practice" },
    { glob: "Matches/**", kind: "match" },
  ],
  ignoreGlobs: ["**/Before VS/**", "**/~$*", "**/.gitkeep"],
};

describe("parseRawPath", () => {
  it("parses zero-padded date prefixes", () => {
    const r = parseRawPath("Fall 2026/Setter Stats/August/08.08 Setter Hitter.xlsx", config);
    expect(r.date).toBe("2026-08-08");
    expect(r.label).toBe("Setter Hitter");
    expect(r.kind).toBe("practice");
    expect(r.warnings).toHaveLength(0);
  });

  it("parses unpadded date prefixes", () => {
    const r = parseRawPath("Fall 2026/Team/August/8.10 6v6.xlsx", config);
    expect(r.date).toBe("2026-08-10");
    expect(r.label).toBe("6v6");
  });

  it("keeps multi-word drill labels", () => {
    const r = parseRawPath("Fall 2026/Team/August/8.13 4-2-4-2 ct 2.xlsx", config);
    expect(r.date).toBe("2026-08-13");
    expect(r.label).toBe("4-2-4-2 ct 2");
  });

  it("extracts set numbers from Blue.Gold per-set CSVs", () => {
    const r = parseRawPath("Fall 2026/Team/August/08.08 Blue.Gold Set 1.csv", config);
    expect(r.date).toBe("2026-08-08");
    expect(r.label).toBe("Blue Gold");
    expect(r.setNumber).toBe(1);
  });

  it("treats All Sets as the parent session (no set number)", () => {
    const r = parseRawPath("Fall 2026/Team/August/08.08 Blue.Gold All Sets.csv", config);
    expect(r.label).toBe("Blue Gold");
    expect(r.setNumber).toBeNull();
  });

  it("resolves Blue Gold folder files entirely from path rules", () => {
    const r = parseRawPath("Fall 2026/Blue Gold/Blue Gold Stats.xlsx", config);
    expect(r.date).toBeNull();
    expect(r.kind).toBe("scrimmage");
    expect(r.ruleDate).toBe("2026-08-08");
    expect(r.ruleLabel).toBe("Blue Gold");
  });

  it("warns when filename month disagrees with the month folder", () => {
    const r = parseRawPath("Fall 2026/Team/September/8.30 6v6.xlsx", config);
    expect(r.date).toBe("2026-08-30");
    expect(r.warnings.map((w) => w.code)).toContain("ambiguous-date");
  });
});

describe("isIgnoredPath", () => {
  it.each([
    ["Fall 2026/Setter Stats/August/Before VS/08.08 Blue Gold Setters.xlsx", true],
    ["Fall 2026/Team/August/~$8.10 6v6.xlsx", true],
    ["Fall 2026/Matches/.gitkeep", true],
    ["Fall 2026/roster.pdf", true],
    ["Fall 2026/Team/August/8.10 6v6.xlsx", false],
    ["Fall 2026/Team/August/08.08 Blue.Gold Set 1.csv", false],
  ])("%s -> %s", (p, expected) => {
    expect(isIgnoredPath(p, config)).toBe(expected);
  });

  it("honors additional configured ignore globs", () => {
    const custom: IngestConfig = { ...config, ignoreGlobs: [...config.ignoreGlobs, "**/Scratch/**"] };
    expect(isIgnoredPath("Fall 2026/Scratch/junk.xlsx", custom)).toBe(true);
    expect(isIgnoredPath("Fall 2026/Scratch/junk.xlsx", config)).toBe(false);
  });
});

describe("session ids", () => {
  it("slugifies drill labels", () => {
    expect(slugify("4-2-4-2 ct 2")).toBe("4-2-4-2-ct-2");
    expect(slugify("Blue Gold")).toBe("blue-gold");
  });

  it("builds deterministic ids", () => {
    expect(
      buildSessionId({ date: "2026-08-13", kind: "practice", label: "4-2-4-2 ct 2" })
    ).toBe("2026-08-13-practice-4-2-4-2-ct-2");
    expect(
      buildSessionId({ date: "2026-08-08", kind: "scrimmage", label: "Blue Gold", setNumber: 1 })
    ).toBe("2026-08-08-scrimmage-blue-gold-set-1");
    expect(buildSessionId({ date: "2026-08-08", kind: "scrimmage", label: "Blue Gold" })).toBe(
      "2026-08-08-scrimmage-blue-gold"
    );
  });
});
