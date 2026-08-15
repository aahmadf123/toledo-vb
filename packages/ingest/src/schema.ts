import { z } from "zod";

// Single source of truth for every record shape. lib/data.ts re-validates
// normalized JSON against these on load, so parser output and site input
// can never drift apart silently.

export const PlayerSchema = z.object({
  id: z.string(),
  jersey: z.number().int(),
  first: z.string(),
  last: z.string(),
  position: z.string(),
  class: z.string(),
  height: z.string(),
  hometown: z.string(),
  previousSchool: z.string().nullable(),
  aliases: z.array(z.string()),
});
export type Player = z.infer<typeof PlayerSchema>;

export const SessionKindSchema = z.enum(["practice", "scrimmage", "match"]);
export type SessionKind = z.infer<typeof SessionKindSchema>;

// Scoring weights from rows 2-3 of the Team workbook. The template invites
// coaches to change them, so they live on the session, never in code.
export const WeightsSchema = z.object({
  reception: z.array(z.number().nullable()),
  serving: z.array(z.number().nullable()),
});
export type Weights = z.infer<typeof WeightsSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: SessionKindSchema,
  drill: z.string().nullable(),
  opponent: z.string().nullable(),
  setNumber: z.number().int().nullable(),
  sourceFiles: z.array(z.string()),
  weights: WeightsSchema.nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

export const PositionGroupSchema = z.enum(["OH", "OPP", "MB", "L", "S"]);
export type PositionGroup = z.infer<typeof PositionGroupSchema>;

const num = z.number();
const numOrNull = z.number().nullable();

export const TeamStatLineSchema = z.object({
  sessionId: z.string(),
  playerId: z.string(),
  positionGroup: PositionGroupSchema,
  attacking: z
    .object({ k: num, e: num, blk: num, att: num })
    .nullable(),
  reception: z
    .object({
      att: num,
      // avg/fbsoPct/inSysPct arrive as computed aggregates without raw
      // symbol counts, so they are stored as given (spec Appendix B).
      avg: numOrNull,
      pp: num,
      err: num,
      fbsoPct: numOrNull,
      inSysPct: numOrNull,
    })
    .nullable(),
  serving: z
    .object({ att: num, aces: num, err: num, xps: numOrNull, madePct: numOrNull })
    .nullable(),
  satOut: z.boolean(),
  sourceFile: z.string(),
});
export type TeamStatLine = z.infer<typeof TeamStatLineSchema>;

export const SetterHitterSchema = z.object({
  sessionId: z.string(),
  setterId: z.string(),
  hitterId: z.string(),
  k: num,
  eUnf: num,
  eBlk: num,
  ta: num,
  sourceFile: z.string(),
});
export type SetterHitter = z.infer<typeof SetterHitterSchema>;

export const AttackBySetTypeSchema = z.object({
  sessionId: z.string(),
  playerId: z.string(),
  grid: PositionGroupSchema.extract(["OH", "OPP", "MB"]),
  // A set code is only meaningful scoped to its grid (PD = OOS Left's DOG in
  // one grid, plain Dog in another), so code and name travel together.
  setCode: z.string(),
  setName: z.string(),
  k: num,
  e: num,
  ta: num,
  sourceFile: z.string(),
});
export type AttackBySetType = z.infer<typeof AttackBySetTypeSchema>;

export const MatchBoxLineSchema = z.object({
  sessionId: z.string(),
  playerId: z.string(), // "team" for the University of Toledo total row
  mp: num,
  sp: num,
  ace: num,
  sErr: num,
  sAtt: num,
  sRtg: numOrNull,
  sPct: numOrNull,
  rtg3: num,
  rtg2: num,
  rtg1: num,
  srErr: num,
  srAtt: num,
  srRtg: numOrNull,
  kills: num,
  aErr: num,
  aAtt: num,
  aPct: numOrNull,
  ast: num,
  setAtt: num,
  setPct: numOrNull,
  bSolo: num,
  bAst: num,
  bTot: num,
  digs: num,
  fbRcv: num,
  fbSnt: num,
  viol: num,
  bhErr: num,
  sourceFile: z.string(),
});
export type MatchBoxLine = z.infer<typeof MatchBoxLineSchema>;

export const WarningCodeSchema = z.enum([
  "unknown-jersey",
  "unknown-player-name",
  "unknown-set-code",
  "header-drift",
  "sheet-not-found",
  "error-cell",
  "unparsed-numeric",
  "ambiguous-date",
  "zero-attempt-row",
  "duplicate-player-row",
  "weights-conflict",
]);
export type WarningCode = z.infer<typeof WarningCodeSchema>;

export const WarningSchema = z.object({
  code: WarningCodeSchema,
  message: z.string(),
  cell: z.string().optional(),
});
export type Warning = z.infer<typeof WarningSchema>;

export const FileFormatSchema = z.enum([
  "team",
  "setter-hitter",
  "attack-by-set-type",
  "box-score",
  "ignored",
  "unknown",
]);
export type FileFormat = z.infer<typeof FileFormatSchema>;

export const ManifestFileSchema = z.object({
  sha256: z.string(),
  size: z.number(),
  format: FileFormatSchema,
  status: z.enum(["ok", "ok-with-warnings", "error", "ignored"]),
  sessionIds: z.array(z.string()),
  warnings: z.array(WarningSchema),
  error: z.string().optional(),
  parsedAt: z.string(),
});
export type ManifestFile = z.infer<typeof ManifestFileSchema>;

export const ManifestSchema = z.object({
  season: z.number().int(),
  lastSyncAt: z.string(),
  // Hash of parser version + players.json + ingest-config.json. When any of
  // those change, every file re-parses even though the raw bytes did not.
  inputsFingerprint: z.string().optional(),
  files: z.record(z.string(), ManifestFileSchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const IngestConfigSchema = z.object({
  seasonYear: z.number().int(),
  pathRules: z.array(
    z.object({
      glob: z.string(),
      kind: SessionKindSchema,
      date: z.string().optional(),
      label: z.string().optional(),
    })
  ),
  ignoreGlobs: z.array(z.string()),
});
export type IngestConfig = z.infer<typeof IngestConfigSchema>;
