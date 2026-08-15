"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import TrendChart, { type TrendSeries } from "@/components/charts/TrendChart";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar, { filterSelectClass } from "@/components/filters/FilterBar";
import { useFilters } from "@/components/filters/useFilters";
import { filterSessions } from "@/lib/filters";
import { fmtDate, SERIES_COLORS } from "@/lib/format";
import { rollingAvg } from "@/lib/metrics";
import { matchesPos } from "@/lib/positions";
import type { MetricFmt, MetricSource } from "@/lib/queries";

export interface TrendsSession {
  id: string;
  date: string;
  kind: string;
  drill: string | null;
  label: string;
}

export interface TrendsEntity {
  id: string; // "team" or player id
  name: string;
  /** Roster position; absent for the team entity. */
  position?: string;
}

export interface TrendsPayload {
  sessions: TrendsSession[];
  entities: TrendsEntity[];
  metrics: Array<{ id: string; label: string; fmt: MetricFmt; source: MetricSource }>;
  /** series[metricId][entityId][sessionIndex] = { value, attempts } */
  series: Record<string, Record<string, Array<{ value: number | null; attempts: number }>>>;
}

const MAX_ENTITIES = 6;

const SOURCE_GROUPS: Array<{ source: MetricSource; label: string }> = [
  { source: "attack", label: "Set-type charting" },
  { source: "team", label: "Practice workbook" },
  { source: "box", label: "Box score" },
];

export default function TrendsExplorer({ payload }: { payload: TrendsPayload }) {
  const searchParams = useSearchParams();
  const [filters, update] = useFilters();

  const [metricId, setMetricId] = useState(
    () => searchParams.get("metric") ?? payload.metrics[0]?.id ?? "hitPct"
  );
  const setMetric = useCallback(
    (id: string) => {
      setMetricId(id);
      const params = new URLSearchParams(window.location.search);
      if (id === (payload.metrics[0]?.id ?? "hitPct")) params.delete("metric");
      else params.set("metric", id);
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    },
    [payload.metrics]
  );

  const drills = useMemo(
    () => [...new Set(payload.sessions.map((s) => s.drill).filter((d): d is string => !!d))],
    [payload.sessions]
  );

  const visibleSessions = useMemo(() => {
    const kept = new Set(filterSessions(payload.sessions, filters).map((s) => s.id));
    return payload.sessions.map((s, i) => ({ ...s, index: i })).filter((s) => kept.has(s.id));
  }, [payload.sessions, filters]);

  // Position filter narrows the chip list; team is always available.
  const visibleEntities = useMemo(
    () =>
      payload.entities.filter(
        (e) => e.id === "team" || !e.position || matchesPos(e.position, filters.pos)
      ),
    [payload.entities, filters.pos]
  );

  // Selection lives in the global `who` param; a chart is never empty — with
  // nothing (or nothing visible) selected, the team line shows.
  const selected = useMemo(() => {
    const visible = new Set(visibleEntities.map((e) => e.id));
    const picked = filters.who.filter((id) => visible.has(id)).slice(0, MAX_ENTITIES);
    return picked.length > 0 ? picked : ["team"];
  }, [filters.who, visibleEntities]);

  const metric = payload.metrics.find((m) => m.id === metricId) ?? payload.metrics[0];

  const series = useMemo<TrendSeries[]>(() => {
    const table = payload.series[metric.id] ?? {};
    const out: TrendSeries[] = [];
    selected.forEach((entityId, slot) => {
      const entity = payload.entities.find((e) => e.id === entityId);
      const points = table[entityId] ?? [];
      const values = visibleSessions.map((s) => {
        const p = points[s.index];
        return p && p.attempts > 0 ? p.value : null;
      });
      const color = SERIES_COLORS[slot % SERIES_COLORS.length];
      out.push({ id: entityId, name: entity?.name ?? entityId, color, values });
      if (selected.length === 1) {
        out.push({
          id: `${entityId}-roll`,
          name: "5-session avg",
          color,
          dashed: true,
          values: rollingAvg(values, 5),
        });
      }
    });
    return out;
  }, [payload, metric.id, selected, visibleSessions]);

  const toggleEntity = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : selected.length >= MAX_ENTITIES
        ? selected
        : [...selected, id];
    // Never let the chart go empty.
    if (next.length === 0) return;
    update({ who: next });
  };

  return (
    <div>
      <FilterBar
        filters={filters}
        onChange={update}
        show={["pos", "kind", "drill", "dates"]}
        sessions={payload.sessions}
        drills={drills}
        leading={
          <select
            className={filterSelectClass}
            value={metric.id}
            onChange={(e) => setMetric(e.target.value)}
            aria-label="Metric"
          >
            {SOURCE_GROUPS.map(({ source, label }) => {
              const group = payload.metrics.filter((m) => m.source === source);
              if (group.length === 0) return null;
              return (
                <optgroup key={source} label={label}>
                  {group.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {visibleEntities.map((e) => {
          const slot = selected.indexOf(e.id);
          return (
            <button
              key={e.id}
              onClick={() => toggleEntity(e.id)}
              aria-pressed={slot !== -1}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 focus-visible:outline-none ${
                slot !== -1
                  ? "border-transparent text-white"
                  : "border-navy-700 bg-navy-800 text-ink-muted hover:text-ink"
              }`}
              style={
                slot !== -1
                  ? { backgroundColor: SERIES_COLORS[slot % SERIES_COLORS.length] }
                  : undefined
              }
            >
              {e.name}
            </button>
          );
        })}
      </div>

      {visibleSessions.length === 0 ? (
        <EmptyState>No sessions match these filters.</EmptyState>
      ) : (
        <div className="rounded-xl border border-navy-700 bg-card p-3">
          <TrendChart
            labels={visibleSessions.map((s) => fmtDate(s.date))}
            series={series}
            fmt={metric.fmt}
          />
          <p className="mt-1 px-1 text-[11px] text-muted-foreground">
            Sessions where a player took no attempts are skipped, not shown as zero.
            {selected.length > 1 ? " Rolling average shows when a single line is selected." : ""}
            {metric.source === "box"
              ? " Box-score metrics only exist for sessions with a box score."
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}
