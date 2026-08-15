// Position groups as coaches filter by them. Pure and client-safe.
//
// The filter dimension is the ROSTER position (Player.position), not the
// per-session TeamStatLine.positionGroup: roster position exists for every
// record type (box lines, setter-hitter pairs, attack rows carry no position),
// and "show me the OHs" means the roster slot. A player logged under another
// grid for one session still filters by her roster position; the per-view
// grid column stays visible where it exists.

export const POSITION_GROUPS = ["OH", "MB", "OPP", "S", "L"] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];

/** "OH/OPP" -> ["OH", "OPP"]; unknown fragments are dropped. */
export function toGroups(position: string): PositionGroup[] {
  return position
    .split("/")
    .map((p) => p.trim())
    .filter((p): p is PositionGroup => (POSITION_GROUPS as readonly string[]).includes(p));
}

/** Empty filter means "no position filter" — everything matches. */
export function matchesPos(position: string, filter: readonly PositionGroup[]): boolean {
  if (filter.length === 0) return true;
  const groups = toGroups(position);
  return groups.some((g) => filter.includes(g));
}
