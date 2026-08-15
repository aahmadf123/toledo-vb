import type {
  AttackBySetType,
  IngestConfig,
  MatchBoxLine,
  Session,
  SetterHitter,
  TeamStatLine,
  Warning,
} from "./schema";
import type { RosterIndex } from "./roster";

export interface RawFile {
  /** Path relative to the data/raw root, e.g. "Fall 2026/Team/August/8.10 6v6.xlsx". */
  relPath: string;
  buffer: Buffer;
  sha256: string;
}

export interface ParseContext {
  roster: RosterIndex;
  config: IngestConfig;
  /** Collector — parsers report data issues here instead of throwing. */
  warn(w: Warning): void;
}

export interface ParseResult {
  sessions: Session[];
  teamStatLines?: TeamStatLine[];
  setterHitter?: SetterHitter[];
  attackBySetType?: AttackBySetType[];
  matchBoxLines?: MatchBoxLine[];
}

export interface Parser {
  format: "team" | "setter-hitter" | "attack-by-set-type" | "box-score";
  /** Content-level check; path routing happens in detect.ts first. */
  detect(file: RawFile): boolean;
  /** Throws only on structural failure (missing sheet, unrecognizable layout). */
  parse(file: RawFile, ctx: ParseContext): ParseResult;
}
