import type { SessionKind } from "./schema";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Deterministic session IDs so the future Postgres import is a plain copy
 * and multiple files feeding one session converge on the same row:
 * "2026-08-13-practice-4-2-4-2-ct-2", "2026-08-08-scrimmage-blue-gold-set-1".
 */
export function buildSessionId(opts: {
  date: string;
  kind: SessionKind;
  label?: string | null;
  setNumber?: number | null;
}): string {
  const parts = [opts.date, opts.kind];
  if (opts.label) parts.push(slugify(opts.label));
  if (opts.setNumber !== undefined && opts.setNumber !== null) {
    parts.push(`set-${opts.setNumber}`);
  }
  return parts.join("-");
}
