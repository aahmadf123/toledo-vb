import type { Player, Warning } from "./schema";

export interface RosterIndex {
  players: Player[];
  byJersey: Map<number, Player>;
  byAlias: Map<string, Player>;
}

/** Lowercase, strip leading '#', trailing periods, collapse whitespace. */
export function normalizeLabel(s: string): string {
  return s
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildRosterIndex(players: Player[]): RosterIndex {
  const byJersey = new Map<number, Player>();
  const byAlias = new Map<string, Player>();
  for (const p of players) {
    byJersey.set(p.jersey, p);
    byAlias.set(normalizeLabel(`${p.first} ${p.last}`), p);
    byAlias.set(normalizeLabel(`${p.last} ${p.first[0]}`), p);
    byAlias.set(normalizeLabel(`${p.jersey} ${p.last} ${p.first[0]}`), p);
    for (const a of p.aliases) byAlias.set(normalizeLabel(a), p);
  }
  return { players, byJersey, byAlias };
}

/**
 * Match a player label from any source format. Jersey number wins when
 * present (spelling varies across sources: Siefke vs Seifke); alias and
 * name matching is the fallback. Label forms seen in the wild:
 * "6 Costlow J.", "Costlow J.", "#15 Maddy Bach", "Maddy Bach".
 */
export function matchPlayer(
  roster: RosterIndex,
  opts: { jersey?: number | null; label?: string | null },
  warn?: (w: Warning) => void
): Player | null {
  if (opts.jersey !== undefined && opts.jersey !== null) {
    const p = roster.byJersey.get(opts.jersey);
    if (p) return p;
    warn?.({
      code: "unknown-jersey",
      message: `No rostered player with jersey ${opts.jersey}${opts.label ? ` (label "${opts.label}")` : ""}`,
    });
    // Fall through to label matching — a wrong jersey shouldn't lose the row.
  }
  if (opts.label) {
    const norm = normalizeLabel(opts.label);
    // Leading jersey digits inside the label ("15 Bach M.", "#15 Maddy Bach").
    const m = norm.match(/^(\d{1,2})\s+(.*)$/);
    if (m) {
      const byNum = roster.byJersey.get(Number(m[1]));
      if (byNum) return byNum;
      const rest = roster.byAlias.get(m[2]);
      if (rest) return rest;
    }
    const direct = roster.byAlias.get(norm);
    if (direct) return direct;
    // Last resort: unique last-name match ("Pertzborn").
    const lastNameHits = roster.players.filter((p) =>
      norm.includes(p.last.toLowerCase())
    );
    if (lastNameHits.length === 1) return lastNameHits[0];
    warn?.({
      code: "unknown-player-name",
      message: `Unmatched player label "${opts.label}"`,
    });
  }
  return null;
}
