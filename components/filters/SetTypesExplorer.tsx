"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import EmptyState from "@/components/layout/EmptyState";
import RateCell from "@/components/stats/RateCell";
import DataTable from "@/components/tables/DataTable";
import FilterBar from "@/components/filters/FilterBar";
import { useFilters } from "@/components/filters/useFilters";
import { filterSessions } from "@/lib/filters";
import { rateColorClass } from "@/lib/format";
import { matchesPos } from "@/lib/positions";
import { type PlayerLite, type SessionLite } from "@/lib/payload";
import { setTypeBreakdown, type SetTypeAgg } from "@/lib/queries";

export interface SetTypesPayload {
  players: PlayerLite[];
  sessions: SessionLite[];
  attackRows: Array<{
    sessionId: string;
    playerId: string;
    grid: "OH" | "OPP" | "MB";
    setCode: string;
    setName: string;
    k: number;
    e: number;
    ta: number;
  }>;
}

export default function SetTypesExplorer({ payload }: { payload: SetTypesPayload }) {
  const [filters, update] = useFilters();

  const visibleSessions = useMemo(
    () => filterSessions(payload.sessions, filters),
    [payload.sessions, filters]
  );

  const breakdown = useMemo(() => {
    const sessionIds = new Set(visibleSessions.map((s) => s.id));
    const playerById = new Map(payload.players.map((p) => [p.id, p]));
    const rows = payload.attackRows
      .filter((r) => filters.who.length === 0 || filters.who.includes(r.playerId))
      .filter((r) => {
        const p = playerById.get(r.playerId);
        return !p || matchesPos(p.position, filters.pos);
      });
    return setTypeBreakdown(rows, sessionIds);
  }, [payload, visibleSessions, filters.who, filters.pos]);

  const maxShare = Math.max(0.0001, ...breakdown.map((t) => t.taShare));

  const columns = useMemo<ColumnDef<SetTypeAgg, unknown>[]>(
    () => [
      {
        id: "set",
        header: "Set type",
        accessorFn: (t) => t.setName,
        cell: ({ row }) => (
          <>
            <span className="font-medium">{row.original.setName}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">
              {row.original.setCode} · {row.original.grid}
            </span>
          </>
        ),
      },
      { id: "k", header: "K", accessorFn: (t) => t.k, meta: { align: "right" } },
      { id: "e", header: "E", accessorFn: (t) => t.e, meta: { align: "right" } },
      { id: "ta", header: "TA", accessorFn: (t) => t.ta, meta: { align: "right" } },
      {
        id: "share",
        header: "Attempt share",
        accessorFn: (t) => t.taShare,
        cell: ({ row }) => (
          <div className="flex min-w-32 items-center gap-2">
            <div className="h-3 flex-1 overflow-hidden rounded-sm bg-white/10">
              <div
                className="h-full rounded-sm bg-gold"
                style={{ width: `${(row.original.taShare / maxShare) * 100}%` }}
              />
            </div>
            <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
              {(row.original.taShare * 100).toFixed(0)}%
            </span>
          </div>
        ),
      },
      {
        id: "hitPct",
        header: "Hit %",
        accessorFn: (t) => t.hitPct ?? -Infinity,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span
            className={`inline-block min-w-14 rounded px-1.5 py-0.5 text-center ${rateColorClass(row.original.hitPct)}`}
          >
            <RateCell value={row.original.hitPct} attempts={row.original.ta} />
          </span>
        ),
      },
    ],
    [maxShare]
  );

  return (
    <div>
      <FilterBar
        filters={filters}
        onChange={update}
        show={["pos", "who", "dates"]}
        players={payload.players.filter((p) =>
          payload.attackRows.some((r) => r.playerId === p.id)
        )}
        sessions={payload.sessions}
      />

      {breakdown.length === 0 ? (
        <EmptyState>No set-type data matches these filters.</EmptyState>
      ) : (
        <DataTable
          columns={columns}
          data={breakdown}
          initialSort={[{ id: "ta", desc: true }]}
          minWidthClass="min-w-[520px]"
        />
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Set codes are scoped to their grid: outsides/opposites PD is the DOG set, middles PD is Dog.
        Sort any column, or narrow to a position group or player.
      </p>
    </div>
  );
}
