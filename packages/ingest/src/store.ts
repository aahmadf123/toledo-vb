import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  AttackBySetTypeSchema,
  MatchBoxLineSchema,
  SessionSchema,
  SetterHitterSchema,
  TeamStatLineSchema,
  type AttackBySetType,
  type MatchBoxLine,
  type Session,
  type SetterHitter,
  type TeamStatLine,
  type Warning,
} from "./schema";
import type { ParseResult } from "./types";

export interface NormalizedStores {
  sessions: Session[];
  teamStatLines: TeamStatLine[];
  setterHitter: SetterHitter[];
  attackBySetType: AttackBySetType[];
  matchBoxLines: MatchBoxLine[];
}

const FILES: Record<keyof NormalizedStores, { file: string; schema: z.ZodTypeAny }> = {
  sessions: { file: "sessions.json", schema: z.array(SessionSchema) },
  teamStatLines: { file: "team-stat-lines.json", schema: z.array(TeamStatLineSchema) },
  setterHitter: { file: "setter-hitter.json", schema: z.array(SetterHitterSchema) },
  attackBySetType: { file: "attack-by-set-type.json", schema: z.array(AttackBySetTypeSchema) },
  matchBoxLines: { file: "match-box-lines.json", schema: z.array(MatchBoxLineSchema) },
};

export function emptyStores(): NormalizedStores {
  return {
    sessions: [],
    teamStatLines: [],
    setterHitter: [],
    attackBySetType: [],
    matchBoxLines: [],
  };
}

export function readStores(dir: string): NormalizedStores {
  const out = emptyStores();
  for (const key of Object.keys(FILES) as Array<keyof NormalizedStores>) {
    const p = path.join(dir, FILES[key].file);
    if (!fs.existsSync(p)) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out[key] as any) = FILES[key].schema.parse(JSON.parse(fs.readFileSync(p, "utf8")));
  }
  return out;
}

export function writeStores(dir: string, stores: NormalizedStores): void {
  fs.mkdirSync(dir, { recursive: true });
  sortStores(stores);
  for (const key of Object.keys(FILES) as Array<keyof NormalizedStores>) {
    fs.writeFileSync(
      path.join(dir, FILES[key].file),
      JSON.stringify(stores[key], null, 2) + "\n"
    );
  }
}

function sortStores(stores: NormalizedStores): void {
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  stores.sessions.sort((a, b) => cmp(a.date, b.date) || cmp(a.id, b.id));
  stores.teamStatLines.sort((a, b) => cmp(a.sessionId, b.sessionId) || cmp(a.playerId, b.playerId));
  stores.setterHitter.sort(
    (a, b) => cmp(a.sessionId, b.sessionId) || cmp(a.setterId, b.setterId) || cmp(a.hitterId, b.hitterId)
  );
  stores.attackBySetType.sort(
    (a, b) =>
      cmp(a.sessionId, b.sessionId) ||
      cmp(a.playerId, b.playerId) ||
      cmp(a.grid, b.grid) ||
      cmp(a.setCode, b.setCode)
  );
  stores.matchBoxLines.sort((a, b) => cmp(a.sessionId, b.sessionId) || cmp(a.playerId, b.playerId));
  for (const s of stores.sessions) s.sourceFiles.sort(cmp);
}

/**
 * Remove every trace of the given source files (they are being re-ingested or
 * have disappeared from the raw tree). Sessions lose the file from
 * sourceFiles and vanish entirely when no file references them anymore.
 */
export function removeSourceFiles(stores: NormalizedStores, relPaths: Set<string>): void {
  const keep = <T extends { sourceFile: string }>(rows: T[]) =>
    rows.filter((r) => !relPaths.has(r.sourceFile));
  stores.teamStatLines = keep(stores.teamStatLines);
  stores.setterHitter = keep(stores.setterHitter);
  stores.attackBySetType = keep(stores.attackBySetType);
  stores.matchBoxLines = keep(stores.matchBoxLines);
  stores.sessions = stores.sessions
    .map((s) => ({ ...s, sourceFiles: s.sourceFiles.filter((f) => !relPaths.has(f)) }))
    .filter((s) => s.sourceFiles.length > 0);
}

/**
 * Merge one file's ParseResult into the stores. Sessions merge by id:
 * sourceFiles union, weights last-write-wins (in sorted-path processing
 * order) with a warning when two files disagree.
 */
export function upsertResult(
  stores: NormalizedStores,
  result: ParseResult,
  warn: (w: Warning) => void
): void {
  for (const incoming of result.sessions) {
    const existing = stores.sessions.find((s) => s.id === incoming.id);
    if (!existing) {
      stores.sessions.push(incoming);
      continue;
    }
    for (const f of incoming.sourceFiles) {
      if (!existing.sourceFiles.includes(f)) existing.sourceFiles.push(f);
    }
    existing.drill = existing.drill ?? incoming.drill;
    existing.opponent = existing.opponent ?? incoming.opponent;
    if (incoming.weights) {
      if (existing.weights && JSON.stringify(existing.weights) !== JSON.stringify(incoming.weights)) {
        warn({
          code: "weights-conflict",
          message: `Session ${incoming.id}: weights differ between source files; keeping the later file's values`,
        });
      }
      existing.weights = incoming.weights;
    }
  }
  if (result.teamStatLines) stores.teamStatLines.push(...result.teamStatLines);
  if (result.setterHitter) stores.setterHitter.push(...result.setterHitter);
  if (result.attackBySetType) stores.attackBySetType.push(...result.attackBySetType);
  if (result.matchBoxLines) stores.matchBoxLines.push(...result.matchBoxLines);
}
