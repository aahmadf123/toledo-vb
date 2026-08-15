import "server-only";

import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { z } from "zod";
import {
  AttackBySetTypeSchema,
  ManifestSchema,
  MatchBoxLineSchema,
  PlayerSchema,
  SessionSchema,
  SetterHitterSchema,
  TeamStatLineSchema,
  type AttackBySetType,
  type Manifest,
  type MatchBoxLine,
  type Player,
  type Session,
  type SetterHitter,
  type TeamStatLine,
} from "@ingest/schema";

// The single data access layer: pages import from here and never touch the
// JSON files directly (which is what makes the future Postgres swap a
// one-module change). Reads are memoized per server lifetime — data is baked
// into each deploy, so a new sync commit means a new build, never stale reads.

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(rel: string, schema: z.ZodType<T>, fallback: T): T {
  const p = path.join(DATA_DIR, rel);
  if (!fs.existsSync(p)) return fallback;
  return schema.parse(JSON.parse(fs.readFileSync(p, "utf8")));
}

export const getPlayers = cache((): Player[] =>
  readJson("players.json", z.array(PlayerSchema), [])
);

export const getPlayer = cache((id: string): Player | undefined =>
  getPlayers().find((p) => p.id === id)
);

export const getSessions = cache((): Session[] =>
  readJson("normalized/sessions.json", z.array(SessionSchema), [])
);

export const getTeamStatLines = cache((): TeamStatLine[] =>
  readJson("normalized/team-stat-lines.json", z.array(TeamStatLineSchema), [])
);

export const getSetterHitter = cache((): SetterHitter[] =>
  readJson("normalized/setter-hitter.json", z.array(SetterHitterSchema), [])
);

export const getAttackBySetType = cache((): AttackBySetType[] =>
  readJson("normalized/attack-by-set-type.json", z.array(AttackBySetTypeSchema), [])
);

export const getMatchBoxLines = cache((): MatchBoxLine[] =>
  readJson("normalized/match-box-lines.json", z.array(MatchBoxLineSchema), [])
);

export const getManifest = cache((): Manifest =>
  readJson("manifest.json", ManifestSchema, { season: 0, lastSyncAt: "", files: {} })
);
