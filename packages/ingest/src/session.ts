import type { ParsedRawPath } from "./filename";
import type { Session, SessionKind } from "./schema";
import { buildSessionId } from "./session-id";

/**
 * Trailing file-type words are workbook descriptions, not drill names:
 * "08.08 Setter Hitter.xlsx" -> no label, "Blue Gold Stats.xlsx" -> "Blue Gold".
 */
const FILE_TYPE_SUFFIX = /\s*(setter hitter|hitter by set type|hitting by set type|stats|setters)\s*$/i;

export interface SessionMeta {
  id: string;
  date: string;
  kind: SessionKind;
  drill: string | null;
  opponent: string | null;
  setNumber: number | null;
}

/**
 * Single place every parser resolves session identity from a parsed path, so
 * multiple files describing the same event converge on the same session id.
 */
export function resolveSessionMeta(
  parsed: ParsedRawPath,
  opts: { kindOverride?: SessionKind; isBoxScore?: boolean } = {}
): SessionMeta {
  const date = parsed.date ?? parsed.ruleDate;
  if (!date) {
    throw new Error("No date in filename and no path-rule date");
  }

  let label = parsed.label ? parsed.label.replace(FILE_TYPE_SUFFIX, "").trim() || null : null;
  label = label ?? parsed.ruleLabel ?? null;

  let kind: SessionKind = opts.kindOverride ?? parsed.kind ?? "practice";
  // A box score is never a practice: one inside a practice folder is an
  // intrasquad scrimmage (the Blue.Gold CSVs live in Team/August).
  if (opts.isBoxScore && kind === "practice") kind = "scrimmage";

  const id = buildSessionId({ date, kind, label, setNumber: parsed.setNumber });
  return {
    id,
    date,
    kind,
    drill: kind === "practice" ? label : null,
    opponent: kind === "practice" ? null : label,
    setNumber: parsed.setNumber,
  };
}

export function sessionFromMeta(meta: SessionMeta, sourceFile: string): Session {
  return {
    id: meta.id,
    date: meta.date,
    kind: meta.kind,
    drill: meta.drill,
    opponent: meta.opponent,
    setNumber: meta.setNumber,
    sourceFiles: [sourceFile],
    weights: null,
  };
}
