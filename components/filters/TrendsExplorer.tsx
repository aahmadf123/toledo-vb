"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import TrendChart, { type TrendSeries } from "@/components/charts/TrendChart";
import { fmtDate, SERIES_COLORS } from "@/lib/format";
import { rollingAvg } from "@/lib/metrics";

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
}

export interface TrendsPayload {
  sessions: TrendsSession[];
  entities: TrendsEntity[];
  metrics: Array<{ id: string; label: string; fmt: "rate3" | "pct1" | "rating" }>;
  /** series[metricId][entityId][sessionIndex] = { value, attempts } */
  series: Record<string, Record<string, Array<{ value: number | null; attempts: number }>>>;
}

const MAX_ENTITIES = 6;

export default function TrendsExplorer({ payload }: { payload: TrendsPayload }) {
  const searchParams = useSearchParams();

  const [metricId, setMetricId] = useState(
    () => searchParams.get("metric") ?? payload.metrics[0]?.id ?? "hitPct"
  );
  const [selected, setSelected] = useState<string[]>(() => {
    const who = searchParams.get("who");
    const ids = who ? who.split(",") : ["team"];
    return ids.filter((id) => payload.entities.some((e) => e.id === id)).slice(0, MAX_ENTITIES);
  });
  const [kind, setKind] = useState(() => searchParams.get("kind") ?? "all");
  const [drill, setDrill] = useState(() => searchParams.get("drill") ?? "all");
  const [from, setFrom] = useState(() => searchParams.get("from") ?? "");
  const [to, setTo] = useState(() => searchParams.get("to") ?? "");

  const syncUrl = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(next)) {
        if (v && v !== "all") params.set(k, v);
        else params.delete(k);
      }
      window.history.replaceState(null, "", `?${params.toString()}`);
    },
    []
  );

  const drills = useMemo(
    () => [...new Set(payload.sessions.map((s) => s.drill).filter((d): d is string => !!d))],
    [payload.sessions]
  );

  const visibleSessions = useMemo(
    () =>
      payload.sessions
        .map((s, i) => ({ ...s, index: i }))
        .filter((s) => kind === "all" || s.kind === kind)
        .filter((s) => drill === "all" || s.drill === drill)
        .filter((s) => (!from || s.date >= from) && (!to || s.date <= to)),
    [payload.sessions, kind, drill, from, to]
  );

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
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_ENTITIES
          ? prev
          : [...prev, id];
      // Never let the chart go empty — and only sync the URL with a
      // selection that is actually being applied.
      if (next.length === 0) return prev;
      syncUrl({ who: next.join(",") });
      return next;
    });
  };

  const selectClass =
    "rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-800";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className={selectClass}
          value={metric.id}
          onChange={(e) => {
            setMetricId(e.target.value);
            syncUrl({ metric: e.target.value });
          }}
          aria-label="Metric"
        >
          {payload.metrics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            syncUrl({ kind: e.target.value });
          }}
          aria-label="Session kind"
        >
          <option value="all">All sessions</option>
          <option value="practice">Practices</option>
          <option value="scrimmage">Scrimmages</option>
          <option value="match">Matches</option>
        </select>
        <select
          className={selectClass}
          value={drill}
          onChange={(e) => {
            setDrill(e.target.value);
            syncUrl({ drill: e.target.value });
          }}
          aria-label="Drill"
        >
          <option value="all">All drills</option>
          {drills.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            syncUrl({ from: e.target.value });
          }}
          aria-label="From date"
        >
          <option value="">From start</option>
          {payload.sessions.map((s) => (
            <option key={s.id} value={s.date}>
              from {fmtDate(s.date)}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            syncUrl({ to: e.target.value });
          }}
          aria-label="To date"
        >
          <option value="">To latest</option>
          {payload.sessions.map((s) => (
            <option key={s.id} value={s.date}>
              to {fmtDate(s.date)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {payload.entities.map((e) => {
          const slot = selected.indexOf(e.id);
          return (
            <button
              key={e.id}
              onClick={() => toggleEntity(e.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                slot !== -1
                  ? "border-transparent text-white"
                  : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
              }`}
              style={slot !== -1 ? { backgroundColor: SERIES_COLORS[slot % SERIES_COLORS.length] } : undefined}
            >
              {e.name}
            </button>
          );
        })}
      </div>

      {visibleSessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          No sessions match these filters.
        </p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <TrendChart
            labels={visibleSessions.map((s) => fmtDate(s.date))}
            series={series}
            fmt={metric.fmt}
          />
          <p className="mt-1 px-1 text-[11px] text-neutral-400">
            Sessions where a player took no attempts are skipped, not shown as zero.
            {selected.length > 1 ? " Rolling average shows when a single line is selected." : ""}
          </p>
        </div>
      )}
    </div>
  );
}
