// The shared filter model behind every analysis page's FilterBar. Pure and
// client-safe: parsing/serialization here, the React hook in
// components/filters/useFilters.ts. Global URL param names — pos, who, kind,
// drill, from, to — mean the same thing on every page.

import { POSITION_GROUPS, type PositionGroup } from "@/lib/positions";

export interface Filters {
  /** Roster position groups; empty = all. */
  pos: PositionGroup[];
  /** Player ids; empty = everyone. */
  who: string[];
  kind: string;
  drill: string;
  from: string;
  to: string;
}

export const DEFAULT_FILTERS: Filters = {
  pos: [],
  who: [],
  kind: "all",
  drill: "all",
  from: "",
  to: "",
};

export function parseFilters(params: { get(name: string): string | null }): Filters {
  const csv = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
  return {
    pos: csv(params.get("pos")).filter((p): p is PositionGroup =>
      (POSITION_GROUPS as readonly string[]).includes(p)
    ),
    who: csv(params.get("who")),
    kind: params.get("kind") ?? "all",
    drill: params.get("drill") ?? "all",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
}

/** Default-valued params serialize to "" and are dropped from the URL. */
export function serializeFilters(f: Filters): Record<string, string> {
  return {
    pos: f.pos.join(","),
    who: f.who.join(","),
    kind: f.kind === "all" ? "" : f.kind,
    drill: f.drill === "all" ? "" : f.drill,
    from: f.from,
    to: f.to,
  };
}

/** Session-scope filters (kind, drill, date window) — position/player filtering is per-page. */
export function filterSessions<S extends { date: string; kind: string; drill: string | null }>(
  sessions: S[],
  f: Filters
): S[] {
  return sessions
    .filter((s) => f.kind === "all" || s.kind === f.kind)
    .filter((s) => f.drill === "all" || s.drill === f.drill)
    .filter((s) => (!f.from || s.date >= f.from) && (!f.to || s.date <= f.to));
}

export function countActiveFilters(f: Filters): number {
  return (
    (f.pos.length > 0 ? 1 : 0) +
    (f.who.length > 0 ? 1 : 0) +
    (f.kind !== "all" ? 1 : 0) +
    (f.drill !== "all" ? 1 : 0) +
    (f.from || f.to ? 1 : 0)
  );
}
