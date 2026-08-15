import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runIngest } from "@ingest/index";
import { ManifestSchema } from "@ingest/schema";

const ROOT = path.resolve(__dirname, "../../..");
let tmpRoot: string;

function snapshotNormalized(): string {
  const dir = path.join(tmpRoot, "data/normalized");
  return fs
    .readdirSync(dir)
    .sort()
    .map((f) => `${f}:${fs.readFileSync(path.join(dir, f), "utf8")}`)
    .join("\n");
}

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "toledo-ingest-"));
  const dataDir = path.join(tmpRoot, "data");
  fs.mkdirSync(path.join(dataDir, "raw/Fall 2026/Team/August"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "raw/Fall 2026/Blue Gold"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "raw/Fall 2026/Setter Stats/August/Before VS"), {
    recursive: true,
  });
  for (const f of ["players.json", "ingest-config.json"]) {
    fs.copyFileSync(path.join(ROOT, "data", f), path.join(dataDir, f));
  }
  const fx = (p: string) => path.join(__dirname, "../fixtures", p);
  fs.copyFileSync(
    fx("team/8.13 4-2-4-2 ct 2.xlsx"),
    path.join(dataDir, "raw/Fall 2026/Team/August/8.13 4-2-4-2 ct 2.xlsx")
  );
  fs.copyFileSync(
    fx("box-score/08.08 Blue.Gold All Sets.csv"),
    path.join(dataDir, "raw/Fall 2026/Team/August/08.08 Blue.Gold All Sets.csv")
  );
  fs.copyFileSync(
    fx("setter-hitter/Blue Gold Setter Hitter.xlsx"),
    path.join(dataDir, "raw/Fall 2026/Blue Gold/Blue Gold Setter Hitter.xlsx")
  );
  // A corrupt workbook, plus a legacy file that must be ignored.
  fs.copyFileSync(
    fx("broken/truncated.xlsx"),
    path.join(dataDir, "raw/Fall 2026/Team/August/8.14 broken.xlsx")
  );
  fs.copyFileSync(
    fx("setter-hitter/Blue Gold Setter Hitter.xlsx"),
    path.join(dataDir, "raw/Fall 2026/Setter Stats/August/Before VS/08.08 Blue Gold Setters.xlsx")
  );
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("runIngest", () => {
  it("parses healthy files and contains the broken one", () => {
    const fixedNow = () => "2026-08-15T00:00:00.000Z";
    const summary = runIngest({ rootDir: tmpRoot, now: fixedNow });

    expect(summary.ok.length + summary.warned.length).toBe(3);
    expect(summary.errored).toHaveLength(1);
    expect(summary.errored[0].relPath).toContain("8.14 broken.xlsx");
    expect(summary.ignored.some((p) => p.includes("Before VS"))).toBe(true);

    const manifest = ManifestSchema.parse(
      JSON.parse(fs.readFileSync(path.join(tmpRoot, "data/manifest.json"), "utf8"))
    );
    const broken = manifest.files["Fall 2026/Team/August/8.14 broken.xlsx"];
    expect(broken.status).toBe("error");
    expect(broken.error).toBeTruthy();

    const sessions = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, "data/normalized/sessions.json"), "utf8")
    );
    // The Blue Gold Setter Hitter file and the All Sets CSV merge into one
    // scrimmage session; the 8.13 practice is separate.
    expect(sessions.map((s: { id: string }) => s.id)).toEqual([
      "2026-08-08-scrimmage-blue-gold",
      "2026-08-13-practice-4-2-4-2-ct-2",
    ]);
    const blueGold = sessions.find((s: { id: string }) => s.id === "2026-08-08-scrimmage-blue-gold");
    expect(blueGold.sourceFiles).toHaveLength(2);
  });

  it("is idempotent: a second run is byte-identical and skips unchanged files", () => {
    const before = snapshotNormalized();
    const summary = runIngest({ rootDir: tmpRoot, now: () => "2026-08-15T00:00:00.000Z" });
    expect(summary.skipped.length).toBe(3);
    // The broken file is retried every run (a parser fix may land in code).
    expect(summary.errored).toHaveLength(1);
    expect(snapshotNormalized()).toBe(before);
  });

  it("removes records when their source file disappears", () => {
    fs.rmSync(path.join(tmpRoot, "data/raw/Fall 2026/Team/August/8.13 4-2-4-2 ct 2.xlsx"));
    runIngest({ rootDir: tmpRoot, now: () => "2026-08-15T01:00:00.000Z" });
    const sessions = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, "data/normalized/sessions.json"), "utf8")
    );
    expect(sessions.map((s: { id: string }) => s.id)).toEqual(["2026-08-08-scrimmage-blue-gold"]);
    const lines = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, "data/normalized/team-stat-lines.json"), "utf8")
    );
    expect(lines).toHaveLength(0);
  });
});
