import Link from "next/link";
import FreshnessStamp from "@/components/layout/FreshnessStamp";
import PageHeader from "@/components/layout/PageHeader";
import KpiTile from "@/components/kpi/KpiTile";
import RateCell from "@/components/stats/RateCell";
import {
  getAttackBySetType,
  getMatchBoxLines,
  getPlayers,
  getSessions,
  getTeamStatLines,
} from "@/lib/data";
import { fmtDateLong, fmtRate, fmtRating } from "@/lib/format";
import { MIN_ATTEMPTS } from "@/lib/metrics";
import {
  leaderboard,
  METRIC_BY_ID,
  metricValue,
  sessionLabel,
  type MetricFmt,
  type MetricId,
} from "@/lib/queries";

export const metadata = { title: "Overview — Toledo VB" };

const KPIS: Array<{ id: MetricId; label: string; fmt: MetricFmt }> = [
  { id: "hitPct", label: "Team hitting %", fmt: "rate3" },
  { id: "passerRating", label: "Passer rating", fmt: "rating" },
  { id: "fbsoPct", label: "FBSO %", fmt: "pct1" },
  { id: "serveMadePct", label: "Serve made %", fmt: "pct1" },
];

const BOX_KPIS: Array<{ id: MetricId; label: string; fmt: MetricFmt }> = [
  { id: "digsPerSet", label: "Digs / set", fmt: "num1" },
  { id: "blocksPerSet", label: "Blocks / set", fmt: "num1" },
];

const PREVIEW_METRICS: MetricId[] = ["hitPct", "boxPasserRating", "digsPerSet"];

export default function OverviewPage() {
  const sessions = getSessions().filter((s) => s.setNumber === null);
  const players = getPlayers();
  const metricData = {
    teamLines: getTeamStatLines(),
    attackRows: getAttackBySetType(),
    boxLines: getMatchBoxLines(),
  };
  const hasBox = metricData.boxLines.length > 0;

  if (sessions.length === 0) {
    return (
      <div>
        <PageHeader title="Overview" subtitle="Toledo volleyball, Fall 2026" />
        <p className="rounded-xl border border-dashed border-navy-700 p-8 text-center text-sm text-muted-foreground">
          No sessions ingested yet. Data appears here after the first OneDrive sync.
        </p>
      </div>
    );
  }

  const latest = sessions[sessions.length - 1];
  const latestIds = new Set([latest.id]);
  const latestHasBox = metricData.boxLines.some((r) => r.sessionId === latest.id);

  const scorebug = [
    { label: "Hit %", raw: metricValue("hitPct", "team", latestIds, metricData).value, fmt: fmtRate },
    {
      label: "Pass",
      raw: metricValue("passerRating", "team", latestIds, metricData).value,
      fmt: fmtRating,
    },
    {
      label: "Serve made",
      raw: metricValue("serveMadePct", "team", latestIds, metricData).value,
      fmt: (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`),
    },
  ]
    .filter((s) => s.raw !== null)
    .map((s) => ({ label: s.label, value: s.fmt(s.raw) }));

  const kpis = [...KPIS, ...(hasBox ? BOX_KPIS : [])].map((kpi) => {
    const points = sessions
      .map((s) => ({ session: s, ...metricValue(kpi.id, "team", new Set([s.id]), metricData) }))
      .filter((p) => p.value !== null);
    const latestPoint = points[points.length - 1];
    const prior5 = points.slice(-6, -1).map((p) => p.value!);
    const delta =
      latestPoint && prior5.length > 0
        ? latestPoint.value! - prior5.reduce((a, b) => a + b, 0) / prior5.length
        : null;
    return {
      ...kpi,
      value: latestPoint?.value ?? null,
      attempts: latestPoint?.attempts ?? 0,
      delta,
      spark: points.slice(-10).map((p) => p.value),
    };
  });

  const allIds = new Set(sessions.map((s) => s.id));
  const previews = PREVIEW_METRICS.map((mid) => {
    const def = METRIC_BY_ID.get(mid)!;
    return { def, rows: leaderboard(mid, players, allIds, metricData).filter((r) => r.qualified).slice(0, 3) };
  }).filter((p) => p.rows.length > 0);

  // Latest-session leaders: hitting lines with a meaningful sample.
  const latestAttack = players
    .map((p) => ({
      player: p,
      ...metricValue("hitPct", p.id, latestIds, metricData),
    }))
    .filter((r) => r.attempts > 0)
    .sort((a, b) => (b.value ?? -9) - (a.value ?? -9))
    .slice(0, 6);

  return (
    <div>
      <PageHeader title="Overview" subtitle={`Fall 2026 · data through ${fmtDateLong(latest.date)}`}>
        <FreshnessStamp />
      </PageHeader>

      {/* Scorebug: the latest session as a broadcast strip. */}
      <section className="relative mb-6 overflow-hidden rounded-xl border border-navy-700 bg-navy-800">
        <span aria-hidden className="slash absolute inset-y-0 -left-1.5 w-3" />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4 pr-5 pl-6">
          <div>
            <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Latest session
            </p>
            <p className="font-display text-xl font-bold tracking-wide text-ink uppercase">
              {sessionLabel(latest)}
            </p>
            <p className="text-xs text-muted-foreground">
              {fmtDateLong(latest.date)} · {latest.kind}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-6">
            {scorebug.map((s) => (
              <div key={s.label} className="text-right">
                <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
                  {s.label}
                </p>
                <p className="font-display text-2xl font-bold text-gold tabular-nums">{s.value}</p>
              </div>
            ))}
            {latestHasBox ? (
              <Link
                href={`/box?session=${latest.id}`}
                className="text-xs font-medium text-gold hover:underline"
              >
                Box score →
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiTile
            key={k.id}
            label={k.label}
            value={k.value}
            fmt={k.fmt}
            delta={k.delta}
            spark={k.spark}
            attempts={k.attempts}
            sampleNoun={k.fmt === "num1" ? "sets" : "attempts"}
          />
        ))}
      </div>

      {previews.length > 0 ? (
        <section className="mt-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Season leaders</h2>
            <Link href="/leaders" className="text-xs font-medium text-gold hover:underline">
              All leaders →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {previews.map(({ def, rows }) => (
              <div key={def.id} className="rounded-xl border border-navy-700 bg-card p-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {def.label}
                </p>
                <ol className="mt-2 space-y-1.5">
                  {rows.map((r, i) => (
                    <li key={r.player.id} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-right font-display text-base font-bold text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <Link href={`/players/${r.player.id}`} className="truncate hover:underline">
                        {r.player.first} {r.player.last}
                      </Link>
                      <span className="ml-auto font-semibold tabular-nums">
                        <RateCell
                          value={r.value}
                          attempts={r.attempts}
                          fmt={def.fmt}
                          minAttempts={def.minAttempts ?? MIN_ATTEMPTS}
                        />
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Latest session · {fmtDateLong(latest.date)} — {sessionLabel(latest)}
          </h2>
          <Link href="/trends" className="text-xs font-medium text-gold hover:underline">
            Explore trends →
          </Link>
        </div>
        {latestAttack.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-navy-700 bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Hitting leaders</th>
                  <th className="px-3 py-2 text-right font-medium">Hit %</th>
                  <th className="px-4 py-2 text-right font-medium">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {latestAttack.map((r) => (
                  <tr key={r.player.id} className="border-b border-navy-700/50 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/players/${r.player.id}`} className="hover:underline">
                        <span className="mr-2 inline-block w-6 text-right font-semibold text-muted-foreground tabular-nums">
                          {r.player.jersey}
                        </span>
                        {r.player.first} {r.player.last}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <RateCell value={r.value} attempts={r.attempts} />
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                      {r.attempts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No attack-by-set-type data for this session.
          </p>
        )}
      </section>
    </div>
  );
}
