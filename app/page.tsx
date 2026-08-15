import Link from "next/link";
import FreshnessStamp from "@/components/layout/FreshnessStamp";
import PageHeader from "@/components/layout/PageHeader";
import KpiTile from "@/components/kpi/KpiTile";
import RateCell from "@/components/ui/RateCell";
import { getAttackBySetType, getPlayers, getSessions, getTeamStatLines } from "@/lib/data";
import { fmtDateLong } from "@/lib/format";
import { metricPoint, sessionLabel, type MetricId } from "@/lib/queries";

export const metadata = { title: "Overview — Toledo VB" };

const KPIS: Array<{ id: MetricId; label: string; fmt: "rate3" | "pct1" | "rating" }> = [
  { id: "hitPct", label: "Team hitting %", fmt: "rate3" },
  { id: "passerRating", label: "Passer rating", fmt: "rating" },
  { id: "fbsoPct", label: "FBSO %", fmt: "pct1" },
  { id: "serveMadePct", label: "Serve made %", fmt: "pct1" },
];

export default function OverviewPage() {
  const sessions = getSessions().filter((s) => s.setNumber === null);
  const teamLines = getTeamStatLines();
  const attackRows = getAttackBySetType();
  const players = getPlayers();

  if (sessions.length === 0) {
    return (
      <div>
        <PageHeader title="Overview" subtitle="Toledo volleyball, Fall 2026" />
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          No sessions ingested yet. Data appears here after the first OneDrive sync.
        </p>
      </div>
    );
  }

  const latest = sessions[sessions.length - 1];

  const kpis = KPIS.map((kpi) => {
    const points = sessions
      .map((s) => ({ session: s, ...metricPoint(kpi.id, "team", s.id, teamLines, attackRows) }))
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

  // Latest-session leaders: hitting lines with a meaningful sample.
  const latestAttack = players
    .map((p) => ({
      player: p,
      ...metricPoint("hitPct", p.id, latest.id, teamLines, attackRows),
    }))
    .filter((r) => r.attempts > 0)
    .sort((a, b) => (b.value ?? -9) - (a.value ?? -9))
    .slice(0, 6);

  return (
    <div>
      <PageHeader title="Overview" subtitle={`Fall 2026 · data through ${fmtDateLong(latest.date)}`}>
        <FreshnessStamp />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiTile
            key={k.id}
            label={k.label}
            value={k.value}
            fmt={k.fmt}
            delta={k.delta}
            spark={k.spark}
            attempts={k.attempts}
          />
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-rocket-blue-dark">
            Latest session · {fmtDateLong(latest.date)} — {sessionLabel(latest)}
          </h2>
          <Link href="/trends" className="text-xs font-medium text-rocket-blue hover:underline">
            Explore trends →
          </Link>
        </div>
        {latestAttack.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="px-4 py-2 font-medium">Hitting leaders</th>
                  <th className="px-3 py-2 text-right font-medium">Hit %</th>
                  <th className="px-4 py-2 text-right font-medium">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {latestAttack.map((r) => (
                  <tr key={r.player.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/players/${r.player.id}`} className="hover:underline">
                        <span className="mr-2 inline-block w-6 text-right font-semibold tabular-nums text-neutral-400">
                          {r.player.jersey}
                        </span>
                        {r.player.first} {r.player.last}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <RateCell value={r.value} attempts={r.attempts} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-500">
                      {r.attempts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No attack-by-set-type data for this session.</p>
        )}
      </section>
    </div>
  );
}
