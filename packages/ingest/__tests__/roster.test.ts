import { describe, expect, it } from "vitest";
import { buildRosterIndex, matchPlayer, normalizeLabel } from "@ingest/roster";
import { PlayerSchema, type Warning } from "@ingest/schema";
import { z } from "zod";
import players from "@/data/players.json";

const roster = buildRosterIndex(z.array(PlayerSchema).parse(players));

describe("normalizeLabel", () => {
  it("strips #, periods, extra spaces, case", () => {
    expect(normalizeLabel("#15 Maddy  Bach")).toBe("15 maddy bach");
    expect(normalizeLabel("Costlow J.")).toBe("costlow j");
  });
});

describe("matchPlayer", () => {
  it("matches by jersey first", () => {
    expect(matchPlayer(roster, { jersey: 14, label: "Seifke A." })?.id).toBe("p14");
  });

  it("matches team-sheet labels like '6 Costlow J.'", () => {
    expect(matchPlayer(roster, { label: "6 Costlow J." })?.id).toBe("p6");
  });

  it("matches box-score labels like '#15 Maddy Bach'", () => {
    expect(matchPlayer(roster, { label: "#15 Maddy Bach" })?.id).toBe("p15");
  });

  it("matches bare 'Last F.' labels", () => {
    expect(matchPlayer(roster, { label: "Pertzborn S." })?.id).toBe("p22");
  });

  it("matches the legacy misspelling via aliases", () => {
    expect(matchPlayer(roster, { label: "Ava Seifke" })?.id).toBe("p14");
  });

  it("warns on unknown jersey but still tries the label", () => {
    const warnings: Warning[] = [];
    const p = matchPlayer(roster, { jersey: 99, label: "Maddy Bach" }, (w) => warnings.push(w));
    expect(p?.id).toBe("p15");
    expect(warnings.map((w) => w.code)).toContain("unknown-jersey");
  });

  it("returns null with a warning for a stranger", () => {
    const warnings: Warning[] = [];
    const p = matchPlayer(roster, { label: "Nobody Here" }, (w) => warnings.push(w));
    expect(p).toBeNull();
    expect(warnings.map((w) => w.code)).toContain("unknown-player-name");
  });
});
