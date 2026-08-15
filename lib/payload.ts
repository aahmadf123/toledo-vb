// Compact row shapes RSC pages ship to client explorers. Pages precompute
// these server-side; the client re-filters and re-aggregates instantly with
// the same pure lib/queries functions — one aggregation code path, no
// network round trips, and sourceFile paths stay out of the payload.

import type { Player, Session } from "@ingest/schema";
import { sessionLabel } from "@/lib/queries";

export interface PlayerLite {
  id: string;
  jersey: number;
  first: string;
  last: string;
  position: string;
}

export interface SessionLite {
  id: string;
  date: string;
  kind: string;
  drill: string | null;
  label: string;
}

export function toPlayerLite(p: Player): PlayerLite {
  return { id: p.id, jersey: p.jersey, first: p.first, last: p.last, position: p.position };
}

export function toSessionLite(s: Session): SessionLite {
  return { id: s.id, date: s.date, kind: s.kind, drill: s.drill, label: sessionLabel(s) };
}

/** "12 Ozanich" — the compact form used in chips, columns, and comboboxes. */
export function shortName(p: PlayerLite): string {
  return `${p.jersey} ${p.last}`;
}
