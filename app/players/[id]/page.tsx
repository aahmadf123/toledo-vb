import { notFound } from "next/navigation";
import Link from "next/link";
import TrendChart from "@/components/charts/TrendChart";
import PageHeader from "@/components/layout/PageHeader";
import RateCell from "@/components/ui/RateCell";
import {
  getAttackBySetType,
  getPlayer,
  getPlayers,
  getSessions,
  getSetterHitter,
  getTeamStatLines,
} from "@/lib/data";
import { fmtDate, rateColorClass, SERIES_COLORS } from "@/lib/format";
import { rollingAvg } from "@/lib/metrics";
import {
  connectionMatrix,
  METRICS,
  metricPoint,
  setTypeBreakdown,
  type MetricId,
} from "@/lib/queries";

export function generateStaticParams() {
  return getPlayers().map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPlayer(id);
  return { title: p ? `${p.first} ${p.last} — Toledo VB` : "Player — Toledo VB" };
}

const SECTIONS: Record<string, MetricId[]> = {
  hitter: ["hitPct", "attackEff", "serveMadePct"],
  setter: ["serveMadePct"],
  libero: ["passerRating", "ppPct", "serveMadePct"],
};

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = getPlayer(id);
  if (!player) notFound();

  const sessions = getSessions().filter((s) => s.setNumber === null);
  const teamLines = getTeamStatLines();
  const attackRows = getAttackBySetType();
  const shRows = getSetterHitter();
  const players = getPlayers();
  const name = (pid: string) => {
    const p = players.find((x) => x.id === pid);
    return p ? `${p.jersey} ${p.last}` : pid;
  };

  const isHitter = /OH|OPP|MB/.test(player.position);
  const isSetter = player.position === "S";
  const metricIds = isHitter
    ? SECTIONS.hitter.concat(player.position.includes("OH") ? ["passerRating"] : [])
    : isSetter
      ? SECTIONS.setter
      : SECTIONS.libero;

  const charts = metricIds
    .map((mid) => {
      const def = METRICS.find((m) => m.id === mid)!;
      const points = sessions.map((s) => metricPoint(mid, player.id, s.id, teamLines, attackRows));
      const kept = sessions
        .map((s, i) => ({ s, p: points[i] }))
        .filter(({ p }) => p.attempts > 0);
      if (kept.length === 0) return null;
      const values = kept.map(({ p }) => p.value);
      return {
        def,
        labels: kept.map(({ s }) => fmtDate(s.date)),
        values,
        rolling: rollingAvg(values, 5),
      };
    })
    .filter((c) => c !== null);

  const allSessionIds = new Set(sessions.map((s) => s.id));
  const setTypes = setTypeBreakdown(attackRows, allSessionIds, player.id);
  const connections = connectionMatrix(shRows, allSessionIds).filter((c) =>
    isSetter ? c.setterId === player.id : c.hitterId === player.id
  );
  connections.sort((a, b) => b.ta - a.ta);

  return (
    <div>
      <PageHeader
        title={`#${player.jersey} ${player.first} ${player.last}`}
        subtitle={[
          player.position,
          player.class,
          player.height,
          player.hometown,
          player.previousSchool ? `prev. ${player.previousSchool}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <Link href="/players" className="text-xs font-medium text-rocket-blue hover:underline">
          ← All players
        </Link>
      </PageHeader>

      {charts.length === 0 && setTypes.length === 0 && connections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          No stats recorded yet for {player.first}.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map((c) => (
          <section key={c.def.id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <h2 className="mb-1 px-1 text-sm font-semibold text-rocket-blue-dark">{c.def.label}</h2>
            <TrendChart
              labels={c.labels}
              series={[
                { id: c.def.id, name: c.def.label, color: SERIES_COLORS[0], values: c.values },
                { id: `${c.def.id}-roll`, name: "5-session avg", color: SERIES_COLORS[0], dashed: true, values: c.rolling },
              ]}
              fmt={c.def.fmt}
            />
          </section>
        ))}
      </div>

      {setTypes.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-rocket-blue-dark">Hitting by set type (season)</h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="px-4 py-2 font-medium">Set</th>
                  <th className="px-3 py-2 text-right font-medium">K</th>
                  <th className="px-3 py-2 text-right font-medium">E</th>
                  <th className="px-3 py-2 text-right font-medium">TA</th>
                  <th className="px-3 py-2 text-right font-medium">Share</th>
                  <th className="px-4 py-2 text-right font-medium">Hit %</th>
                </tr>
              </thead>
              <tbody>
                {setTypes.map((t) => (
                  <tr key={`${t.grid}-${t.setCode}`} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-medium">{t.setName}</span>
                      <span className="ml-1.5 text-xs text-neutral-400">
                        {t.setCode} · {t.grid}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.k}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.e}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.ta}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                      {(t.taShare * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={`inline-block min-w-14 rounded px-1.5 py-0.5 text-center ${rateColorClass(t.hitPct)}`}>
                        <RateCell value={t.hitPct} attempts={t.ta} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {connections.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-rocket-blue-dark">
            {isSetter ? "Hitters on her sets (season)" : "Production by setter (season)"}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="px-4 py-2 font-medium">{isSetter ? "Hitter" : "Setter"}</th>
                  <th className="px-3 py-2 text-right font-medium">K</th>
                  <th className="px-3 py-2 text-right font-medium">E</th>
                  <th className="px-3 py-2 text-right font-medium">TA</th>
                  <th className="px-4 py-2 text-right font-medium">Hit %</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => {
                  const otherId = isSetter ? c.hitterId : c.setterId;
                  return (
                    <tr key={otherId} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-2">
                        <Link href={`/players/${otherId}`} className="hover:underline">
                          {name(otherId)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.k}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.eUnf + c.eBlk}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.ta}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <span className={`inline-block min-w-14 rounded px-1.5 py-0.5 text-center ${rateColorClass(c.hitPct)}`}>
                          <RateCell value={c.hitPct} attempts={c.ta} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
