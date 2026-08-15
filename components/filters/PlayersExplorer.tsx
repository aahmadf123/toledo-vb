"use client";

import Link from "next/link";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/filters/FilterBar";
import { useFilters } from "@/components/filters/useFilters";
import { matchesPos } from "@/lib/positions";
import type { PlayerLite } from "@/lib/payload";

export interface RosterPlayer extends PlayerLite {
  class: string;
  height: string;
}

export default function PlayersExplorer({ players }: { players: RosterPlayer[] }) {
  const [filters, update] = useFilters();
  const visible = players.filter((p) => matchesPos(p.position, filters.pos));

  return (
    <div>
      <FilterBar filters={filters} onChange={update} show={["pos"]} />
      {visible.length === 0 ? (
        <EmptyState>No players in this position group.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((p) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="group rounded-xl border border-navy-700 bg-card p-4 transition-colors hover:bg-navy-800 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold text-gold tabular-nums">
                  {p.jersey}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">{p.position}</span>
              </div>
              <p className="mt-1 font-semibold text-ink group-hover:underline">
                {p.first} {p.last}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {p.class} · {p.height}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
