"use client";

import { useMemo } from "react";
import Link from "next/link";
import EmptyState from "@/components/layout/EmptyState";
import DistributionBar, { DistributionLegend } from "@/components/charts/DistributionBar";
import SetComparison from "@/components/charts/SetComparison";
import PositionBadge from "@/components/stats/PositionBadge";
import RateCell from "@/components/stats/RateCell";
import { filterSelectClass } from "@/components/filters/FilterBar";
import { usePageParam } from "@/components/filters/usePageParam";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fmtDateLong, fmtRate, fmtRating, SERIES_COLORS } from "@/lib/format";
import { matchHitPct, passerRating, sumCounts } from "@/lib/metrics";
import { shortName, type PlayerLite, type SessionLite } from "@/lib/payload";
import { boxTotals, passingDistribution, type BoxTotalsRow, type MetricData } from "@/lib/queries";

export interface BoxFamily {
  parent: SessionLite;
  sets: Array<SessionLite & { setNumber: number }>;
}

export interface BoxPayload {
  players: PlayerLite[];
  families: BoxFamily[];
  boxLines: MetricData["boxLines"];
}

/** Per-set comparison metrics: raw counts plus the two box rates. */
const SET_METRICS = [
  { id: "kills", label: "Kills", fmt: "num1" as const, count: "kills" as const },
  { id: "digs", label: "Digs", fmt: "num1" as const, count: "digs" as const },
  { id: "ace", label: "Aces", fmt: "num1" as const, count: "ace" as const },
  { id: "bTot", label: "Blocks", fmt: "num1" as const, count: "bTot" as const },
  { id: "ast", label: "Assists", fmt: "num1" as const, count: "ast" as const },
  { id: "boxHitPct", label: "Hit %", fmt: "rate3" as const, count: null },
  { id: "boxPasserRating", label: "Passer rating", fmt: "rating" as const, count: null },
];

export default function BoxExplorer({ payload }: { payload: BoxPayload }) {
  const latest = payload.families[payload.families.length - 1];
  const [familyId, setFamilyId] = usePageParam("session", latest?.parent.id ?? "");
  const [view, setView] = usePageParam("view", "box");
  const [setChoice, setSetChoice] = usePageParam("set", "all");
  const [metricId, setMetricId] = usePageParam("metric", "kills");

  const family = payload.families.find((f) => f.parent.id === familyId) ?? latest;
  const playerById = useMemo(
    () => new Map(payload.players.map((p) => [p.id, p])),
    [payload.players]
  );

  const chosenSessionIds = useMemo(() => {
    if (!family) return new Set<string>();
    if (setChoice === "all") return new Set([family.parent.id]);
    const set = family.sets.find((s) => String(s.setNumber) === setChoice);
    return new Set(set ? [set.id] : [family.parent.id]);
  }, [family, setChoice]);

  const totals = useMemo(
    () => boxTotals(payload.boxLines, chosenSessionIds),
    [payload.boxLines, chosenSessionIds]
  );
  const teamCounts = useMemo(() => {
    const rows = payload.boxLines.filter(
      (r) => chosenSessionIds.has(r.sessionId) && r.playerId === "team"
    );
    return rows.length === 0
      ? null
      : sumCounts(rows, [
          "sp",
          "ace",
          "sErr",
          "sAtt",
          "rtg3",
          "rtg2",
          "rtg1",
          "srErr",
          "srAtt",
          "kills",
          "aErr",
          "aAtt",
          "ast",
          "setAtt",
          "bSolo",
          "bAst",
          "bTot",
          "digs",
          "fbRcv",
          "fbSnt",
        ]);
  }, [payload.boxLines, chosenSessionIds]);

  const passing = useMemo(
    () => passingDistribution(payload.boxLines, chosenSessionIds),
    [payload.boxLines, chosenSessionIds]
  );

  const setMetric = SET_METRICS.find((m) => m.id === metricId) ?? SET_METRICS[0];
  const bySet = useMemo(() => {
    if (!family || family.sets.length === 0) return null;
    const value = (entity: string, sessionId: string): number | null => {
      const rows = payload.boxLines.filter(
        (r) => r.sessionId === sessionId && r.playerId === entity
      );
      if (rows.length === 0) return null;
      if (setMetric.count) return sumCounts(rows, [setMetric.count])[setMetric.count];
      const c = sumCounts(rows, ["kills", "aErr", "aAtt", "rtg3", "rtg2", "rtg1", "srAtt"]);
      return setMetric.id === "boxHitPct" ? matchHitPct(c) : passerRating(c);
    };

    // Chart: the heaviest players for this metric's own sample. The team total
    // is deliberately excluded — it would dwarf every player bar.
    const playerVolume = new Map<string, number>();
    for (const r of payload.boxLines) {
      if (!family.sets.some((s) => s.id === r.sessionId) || r.playerId === "team") continue;
      const w =
        setMetric.id === "boxPasserRating"
          ? r.srAtt
          : setMetric.id === "boxHitPct"
            ? r.aAtt
            : r[setMetric.count ?? "sp"];
      playerVolume.set(r.playerId, (playerVolume.get(r.playerId) ?? 0) + w);
    }
    const entities = [...playerVolume.entries()]
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    return {
      labels: family.sets.map((s) => `Set ${s.setNumber}`),
      series: entities.map((id, i) => ({
        id,
        name: playerById.get(id) ? shortName(playerById.get(id)!) : id,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
      })),
      values: entities.map((id) => family.sets.map((s) => value(id, s.id))),
      rows: [...playerVolume.keys()].map((pid) => ({
        player: playerById.get(pid),
        pid,
        perSet: family.sets.map((s) => value(pid, s.id)),
        full: value(pid, family.parent.id),
      })),
    };
  }, [family, payload.boxLines, setMetric, playerById]);

  if (!family) {
    return (
      <EmptyState>
        No box scores ingested yet — they appear when a scrimmage or match box-score CSV lands in
        OneDrive.
      </EmptyState>
    );
  }

  const name = (id: string) => {
    const p = playerById.get(id);
    return p ? `${p.first} ${p.last}` : id;
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className={filterSelectClass}
          value={family.parent.id}
          onChange={(e) => setFamilyId(e.target.value)}
          aria-label="Session"
        >
          {payload.families.map((f) => (
            <option key={f.parent.id} value={f.parent.id}>
              {fmtDateLong(f.parent.date)} · {f.parent.label}
            </option>
          ))}
        </select>
        {family.sets.length > 0 ? (
          <ToggleGroup
            value={[setChoice]}
            onValueChange={(v) => setSetChoice(v[0] ?? "all")}
            aria-label="Set"
          >
            <ToggleGroupItem
              value="all"
              size="sm"
              variant="outline"
              className="border-navy-700 text-ink-muted data-pressed:border-gold data-pressed:bg-gold data-pressed:text-navy-950"
            >
              Full
            </ToggleGroupItem>
            {family.sets.map((s) => (
              <ToggleGroupItem
                key={s.id}
                value={String(s.setNumber)}
                size="sm"
                variant="outline"
                className="border-navy-700 text-ink-muted data-pressed:border-gold data-pressed:bg-gold data-pressed:text-navy-950"
              >
                Set {s.setNumber}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as string)}>
        <TabsList>
          <TabsTrigger value="box">Box score</TabsTrigger>
          <TabsTrigger value="sets" disabled={family.sets.length === 0}>
            By set
          </TabsTrigger>
          <TabsTrigger value="passing">Passing</TabsTrigger>
        </TabsList>

        <TabsContent value="box" className="mt-4">
          {totals.length === 0 ? (
            <EmptyState>No box lines for this selection.</EmptyState>
          ) : (
            <BoxTable totals={totals} teamCounts={teamCounts} name={name} playerById={playerById} />
          )}
        </TabsContent>

        <TabsContent value="sets" className="mt-4">
          {bySet ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={filterSelectClass}
                  value={setMetric.id}
                  onChange={(e) => setMetricId(e.target.value)}
                  aria-label="Metric"
                >
                  {SET_METRICS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Chart shows the five heaviest contributors; the table has everyone.
                </span>
              </div>
              <div className="rounded-xl border border-navy-700 bg-card p-3">
                <SetComparison
                  labels={bySet.labels}
                  series={bySet.series}
                  values={bySet.values}
                  fmt={setMetric.fmt}
                />
              </div>
              <div className="overflow-x-auto rounded-xl border border-navy-700 bg-card">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-navy-700 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Player</th>
                      {bySet.labels.map((l) => (
                        <th key={l} className="px-3 py-2 text-right font-medium">
                          {l}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-right font-medium">Full</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySet.rows
                      .sort((a, b) => (b.full ?? -Infinity) - (a.full ?? -Infinity))
                      .map((r) => (
                        <tr key={r.pid} className="border-b border-navy-700/50 last:border-0">
                          <td className="px-4 py-2">
                            <Link href={`/players/${r.pid}`} className="hover:underline">
                              {name(r.pid)}
                            </Link>
                          </td>
                          {r.perSet.map((v, i) => (
                            <td key={i} className="px-3 py-2 text-right tabular-nums">
                              {v === null ? (
                                <span className="text-ink-faint">—</span>
                              ) : setMetric.fmt === "rate3" ? (
                                fmtRate(v)
                              ) : setMetric.fmt === "rating" ? (
                                fmtRating(v)
                              ) : (
                                v
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right font-semibold tabular-nums">
                            {r.full === null ? (
                              <span className="text-ink-faint">—</span>
                            ) : setMetric.fmt === "rate3" ? (
                              fmtRate(r.full)
                            ) : setMetric.fmt === "rating" ? (
                              fmtRating(r.full)
                            ) : (
                              r.full
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState>This session has no per-set box scores.</EmptyState>
          )}
        </TabsContent>

        <TabsContent value="passing" className="mt-4">
          {passing.length === 0 ? (
            <EmptyState>No reception attempts in this selection.</EmptyState>
          ) : (
            <div className="rounded-xl border border-navy-700 bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">Reception quality (3-2-1-0)</h2>
                <DistributionLegend />
              </div>
              <ul className="space-y-2.5">
                {passing.map((r) => (
                  <li key={r.playerId} className="flex items-center gap-3">
                    <Link
                      href={`/players/${r.playerId}`}
                      className="w-36 shrink-0 truncate text-sm hover:underline"
                    >
                      {name(r.playerId)}
                    </Link>
                    <div className="flex-1">
                      <DistributionBar counts={r} />
                    </div>
                    <span className="w-12 text-right text-sm font-semibold tabular-nums">
                      {fmtRating(r.rating)}
                    </span>
                    <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                      {r.srAtt} att
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Passer rating = (3·threes + 2·twos + ones) / attempts, computed from the true
                reception counts — segment widths are shares of attempts.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const numCell = "px-2 py-1.5 text-right tabular-nums";
const groupHead = "border-b border-navy-700 px-2 pt-2 pb-1 text-center font-medium";

function BoxTable({
  totals,
  teamCounts,
  name,
  playerById,
}: {
  totals: BoxTotalsRow[];
  teamCounts: Record<string, number> | null;
  name: (id: string) => string;
  playerById: Map<string, PlayerLite>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-navy-700 bg-card">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th rowSpan={2} className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-medium">
              Player
            </th>
            <th rowSpan={2} className="border-b border-navy-700 px-2 py-2 text-right font-medium">
              SP
            </th>
            <th colSpan={4} className={groupHead}>
              Serving
            </th>
            <th colSpan={6} className={groupHead}>
              Receiving
            </th>
            <th colSpan={4} className={groupHead}>
              Attacking
            </th>
            <th colSpan={3} className={groupHead}>
              Setting
            </th>
            <th colSpan={3} className={groupHead}>
              Blocking
            </th>
            <th colSpan={3} className={groupHead}>
              Defense
            </th>
          </tr>
          <tr className="border-b border-navy-700 [&>th]:px-2 [&>th]:pb-2 [&>th]:text-right [&>th]:font-medium">
            <th>Ace</th>
            <th>SE</th>
            <th>SA</th>
            <th>Rtg</th>
            <th>3</th>
            <th>2</th>
            <th>1</th>
            <th>RE</th>
            <th>RA</th>
            <th>Rtg</th>
            <th>K</th>
            <th>E</th>
            <th>TA</th>
            <th>Hit %</th>
            <th>Ast</th>
            <th>SetA</th>
            <th>Ast %</th>
            <th>BS</th>
            <th>BA</th>
            <th>BT</th>
            <th>Digs</th>
            <th>FBR</th>
            <th>FBS</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((r) => {
            const p = playerById.get(r.playerId);
            return (
              <tr key={r.playerId} className="border-b border-navy-700/50">
                <td className="sticky left-0 z-10 bg-card px-4 py-1.5 whitespace-nowrap">
                  <Link href={`/players/${r.playerId}`} className="hover:underline">
                    {name(r.playerId)}
                  </Link>
                  {p ? (
                    <span className="ml-1.5">
                      <PositionBadge position={p.position} />
                    </span>
                  ) : null}
                </td>
                <td className={numCell}>{r.counts.sp}</td>
                <td className={numCell}>{r.counts.ace}</td>
                <td className={numCell}>{r.counts.sErr}</td>
                <td className={numCell}>{r.counts.sAtt}</td>
                <td className={numCell}>{fmtRating(r.serveRating)}</td>
                <td className={numCell}>{r.counts.rtg3}</td>
                <td className={numCell}>{r.counts.rtg2}</td>
                <td className={numCell}>{r.counts.rtg1}</td>
                <td className={numCell}>{r.counts.srErr}</td>
                <td className={numCell}>{r.counts.srAtt}</td>
                <td className={numCell}>
                  <RateCell value={r.passerRating} attempts={r.counts.srAtt} fmt="rating" />
                </td>
                <td className={numCell}>{r.counts.kills}</td>
                <td className={numCell}>{r.counts.aErr}</td>
                <td className={numCell}>{r.counts.aAtt}</td>
                <td className={numCell}>
                  <RateCell value={r.hitPct} attempts={r.counts.aAtt} />
                </td>
                <td className={numCell}>{r.counts.ast}</td>
                <td className={numCell}>{r.counts.setAtt}</td>
                <td className={numCell}>
                  <RateCell value={r.setPct} attempts={r.counts.setAtt} fmt="pct1" />
                </td>
                <td className={numCell}>{r.counts.bSolo}</td>
                <td className={numCell}>{r.counts.bAst}</td>
                <td className={numCell}>{r.counts.bTot}</td>
                <td className={numCell}>{r.counts.digs}</td>
                <td className={numCell}>{r.counts.fbRcv}</td>
                <td className={numCell}>{r.counts.fbSnt}</td>
              </tr>
            );
          })}
        </tbody>
        {teamCounts ? (
          <tfoot>
            <tr className="border-t border-navy-700 bg-navy-800/60 font-semibold">
              <td className="sticky left-0 z-10 bg-navy-800 px-4 py-2">Team</td>
              <td className={numCell}>{teamCounts.sp}</td>
              <td className={numCell}>{teamCounts.ace}</td>
              <td className={numCell}>{teamCounts.sErr}</td>
              <td className={numCell}>{teamCounts.sAtt}</td>
              <td className={numCell}>—</td>
              <td className={numCell}>{teamCounts.rtg3}</td>
              <td className={numCell}>{teamCounts.rtg2}</td>
              <td className={numCell}>{teamCounts.rtg1}</td>
              <td className={numCell}>{teamCounts.srErr}</td>
              <td className={numCell}>{teamCounts.srAtt}</td>
              <td className={numCell}>
                {fmtRating(
                  passerRating({
                    rtg3: teamCounts.rtg3,
                    rtg2: teamCounts.rtg2,
                    rtg1: teamCounts.rtg1,
                    srAtt: teamCounts.srAtt,
                  })
                )}
              </td>
              <td className={numCell}>{teamCounts.kills}</td>
              <td className={numCell}>{teamCounts.aErr}</td>
              <td className={numCell}>{teamCounts.aAtt}</td>
              <td className={numCell}>
                {fmtRate(
                  matchHitPct({
                    kills: teamCounts.kills,
                    aErr: teamCounts.aErr,
                    aAtt: teamCounts.aAtt,
                  })
                )}
              </td>
              <td className={numCell}>{teamCounts.ast}</td>
              <td className={numCell}>{teamCounts.setAtt}</td>
              <td className={numCell}>—</td>
              <td className={numCell}>{teamCounts.bSolo}</td>
              <td className={numCell}>{teamCounts.bAst}</td>
              <td className={numCell}>{teamCounts.bTot}</td>
              <td className={numCell}>{teamCounts.digs}</td>
              <td className={numCell}>{teamCounts.fbRcv}</td>
              <td className={numCell}>{teamCounts.fbSnt}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
