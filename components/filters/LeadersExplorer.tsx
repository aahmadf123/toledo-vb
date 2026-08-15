"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import EmptyState from "@/components/layout/EmptyState";
import PositionBadge from "@/components/stats/PositionBadge";
import RateCell from "@/components/stats/RateCell";
import DataTable from "@/components/tables/DataTable";
import FilterBar, { filterSelectClass } from "@/components/filters/FilterBar";
import { useFilters } from "@/components/filters/useFilters";
import { filterSessions } from "@/lib/filters";
import { MIN_ATTEMPTS } from "@/lib/metrics";
import { matchesPos } from "@/lib/positions";
import type { PlayerLite, SessionLite } from "@/lib/payload";
import {
  leaderboard,
  METRIC_BY_ID,
  METRICS,
  metricValue,
  type MetricData,
  type MetricId,
  type MetricSource,
} from "@/lib/queries";

export interface LeadersPayload {
  players: PlayerLite[];
  sessions: SessionLite[];
  data: MetricData;
}

const SOURCE_GROUPS: Array<{ source: MetricSource; label: string }> = [
  { source: "attack", label: "Set-type charting" },
  { source: "team", label: "Practice workbook" },
  { source: "box", label: "Box score" },
];

/** The columns of the all-stats table — one per headline metric. */
const TABLE_METRICS: MetricId[] = [
  "hitPct",
  "attackEff",
  "killPct",
  "passerRating",
  "ppPct",
  "serveMadePct",
  "boxHitPct",
  "boxPasserRating",
  "digsPerSet",
  "blocksPerSet",
  "assistsPerSet",
];

const SHORT_LABEL: Record<MetricId, string> = {
  hitPct: "Hit %",
  attackEff: "Eff",
  killPct: "Kill %",
  boxHitPct: "Hit % (box)",
  passerRating: "Pass avg",
  boxPasserRating: "Pass 3-2-1",
  ppPct: "PP %",
  fbsoPct: "FBSO %",
  inSysPct: "In-sys %",
  serveMadePct: "Srv made %",
  xps: "xPS",
  serveRating: "Srv rtg",
  digsPerSet: "Digs/set",
  blocksPerSet: "Blk/set",
  assistsPerSet: "Ast/set",
  acesPerSet: "Ace/set",
};

export default function LeadersExplorer({ payload }: { payload: LeadersPayload }) {
  const searchParams = useSearchParams();
  const [filters, update] = useFilters();
  const [metricId, setMetricId] = useState<MetricId>(() => {
    const m = searchParams.get("metric") as MetricId | null;
    return m && METRIC_BY_ID.has(m) ? m : "hitPct";
  });
  const [scope, setScope] = useState(() => searchParams.get("session") ?? "season");

  const syncParam = useCallback((key: string, value: string, defaultValue: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  const players = useMemo(
    () => payload.players.filter((p) => matchesPos(p.position, filters.pos)),
    [payload.players, filters.pos]
  );

  const sessionIds = useMemo(() => {
    if (scope !== "season") return new Set([scope]);
    return new Set(filterSessions(payload.sessions, filters).map((s) => s.id));
  }, [scope, payload.sessions, filters]);

  const def = METRIC_BY_ID.get(metricId)!;
  const rows = useMemo(
    () => leaderboard(metricId, players, sessionIds, payload.data),
    [metricId, players, sessionIds, payload.data]
  );
  const qualified = rows.filter((r) => r.qualified);
  const below = rows.filter((r) => !r.qualified);
  const maxValue = Math.max(0.0001, ...qualified.map((r) => r.value ?? 0));

  type AllStatsRow = { player: (typeof players)[number] } & Partial<
    Record<MetricId, { value: number | null; attempts: number }>
  >;
  const allStats = useMemo<AllStatsRow[]>(
    () =>
      players
        .map((player) => {
          const row: AllStatsRow = { player };
          for (const mid of TABLE_METRICS) {
            const d = METRIC_BY_ID.get(mid)!;
            if (!d.appliesTo(player.position)) continue;
            row[mid] = metricValue(mid, player.id, sessionIds, payload.data);
          }
          return row;
        })
        .filter((row) => TABLE_METRICS.some((mid) => (row[mid]?.attempts ?? 0) > 0)),
    [players, sessionIds, payload.data]
  );

  const columns = useMemo<ColumnDef<AllStatsRow, unknown>[]>(
    () => [
      {
        id: "player",
        header: "Player",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="w-6 text-right font-semibold text-muted-foreground tabular-nums">
              {row.original.player.jersey}
            </span>
            <Link href={`/players/${row.original.player.id}`} className="hover:underline">
              {row.original.player.first} {row.original.player.last}
            </Link>
            <PositionBadge position={row.original.player.position} />
          </span>
        ),
      },
      ...TABLE_METRICS.map((mid): ColumnDef<AllStatsRow, unknown> => {
        const d = METRIC_BY_ID.get(mid)!;
        return {
          id: mid,
          header: SHORT_LABEL[mid],
          accessorFn: (row) => row[mid]?.value ?? -Infinity,
          sortDescFirst: true,
          meta: { align: "right" },
          cell: ({ row }) => {
            const point = row.original[mid];
            if (!point || point.attempts === 0)
              return <span className="text-ink-faint">—</span>;
            return (
              <RateCell
                value={point.value}
                attempts={point.attempts}
                fmt={d.fmt}
                minAttempts={d.minAttempts ?? MIN_ATTEMPTS}
              />
            );
          },
        };
      }),
    ],
    []
  );

  return (
    <div>
      <FilterBar
        filters={filters}
        onChange={update}
        show={["pos", "kind", "dates"]}
        sessions={payload.sessions}
        leading={
          <>
            <select
              className={filterSelectClass}
              value={metricId}
              onChange={(e) => {
                setMetricId(e.target.value as MetricId);
                syncParam("metric", e.target.value, "hitPct");
              }}
              aria-label="Metric"
            >
              {SOURCE_GROUPS.map(({ source, label }) => (
                <optgroup key={source} label={label}>
                  {METRICS.filter((m) => m.source === source).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              className={filterSelectClass}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                syncParam("session", e.target.value, "season");
              }}
              aria-label="Scope"
            >
              <option value="season">Full season</option>
              {payload.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date} · {s.label}
                </option>
              ))}
            </select>
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState>
          No {def.label.toLowerCase()} data matches these filters
          {def.source === "box" ? " — box-score metrics need a session with a box score" : ""}.
        </EmptyState>
      ) : (
        <div className="rounded-xl border border-navy-700 bg-card">
          <h2 className="border-b border-navy-700 px-4 py-2.5 text-sm font-semibold text-ink">
            {def.label}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {scope === "season" ? "season" : "single session"}
            </span>
          </h2>
          <ol className="px-4 py-2">
            {qualified.map((r, i) => (
              <LeaderRow
                key={r.player.id}
                rank={i + 1}
                row={r}
                fmt={def.fmt}
                min={def.minAttempts ?? MIN_ATTEMPTS}
                barWidth={
                  r.value !== null && r.value > 0 ? (r.value / maxValue) * 100 : 0
                }
              />
            ))}
          </ol>
          {below.length > 0 ? (
            <>
              <p className="border-t border-navy-700/50 px-4 pt-2 text-[11px] text-muted-foreground">
                Below minimum sample ({def.minAttempts ?? MIN_ATTEMPTS})
              </p>
              <ol className="px-4 py-2 opacity-70">
                {below.map((r) => (
                  <LeaderRow
                    key={r.player.id}
                    rank={null}
                    row={r}
                    fmt={def.fmt}
                    min={def.minAttempts ?? MIN_ATTEMPTS}
                    barWidth={0}
                  />
                ))}
              </ol>
            </>
          ) : null}
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-ink">All players · all stats</h2>
        {allStats.length === 0 ? (
          <EmptyState>No stats match these filters.</EmptyState>
        ) : (
          <DataTable
            columns={columns}
            data={allStats}
            initialSort={[{ id: "hitPct", desc: true }]}
            stickyFirstCol
            minWidthClass="min-w-[880px]"
          />
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Click any column to sort. — means the stat doesn&apos;t apply to that position or has no
          data; greyed values are below the minimum sample.
        </p>
      </section>
    </div>
  );
}

function LeaderRow({
  rank,
  row,
  fmt,
  min,
  barWidth,
}: {
  rank: number | null;
  row: { player: { id: string; jersey: number; first: string; last: string; position: string }; value: number | null; attempts: number };
  fmt: "rate3" | "pct1" | "rating" | "num1";
  min: number;
  barWidth: number;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-navy-700/40 py-1.5 last:border-0">
      <span className="w-6 text-right font-display text-lg font-bold text-muted-foreground tabular-nums">
        {rank ?? "·"}
      </span>
      <Link
        href={`/players/${row.player.id}`}
        className="flex w-44 shrink-0 items-center gap-2 hover:underline"
      >
        <span className="truncate">
          <span className="mr-1.5 font-semibold text-muted-foreground tabular-nums">
            {row.player.jersey}
          </span>
          {row.player.first} {row.player.last}
        </span>
        <PositionBadge position={row.player.position} />
      </Link>
      <div className="hidden h-3 flex-1 overflow-hidden rounded-sm bg-white/5 sm:block">
        <div className="h-full rounded-sm bg-gold" style={{ width: `${barWidth}%` }} />
      </div>
      <span className="w-16 text-right font-semibold tabular-nums">
        <RateCell value={row.value} attempts={row.attempts} fmt={fmt} minAttempts={min} />
      </span>
      <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
        {row.attempts}
      </span>
    </li>
  );
}
