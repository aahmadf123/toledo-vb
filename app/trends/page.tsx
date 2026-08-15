import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import TrendsExplorer, { type TrendsPayload } from "@/components/filters/TrendsExplorer";
import { getAttackBySetType, getPlayers, getSessions, getTeamStatLines } from "@/lib/data";
import { METRICS, metricPoint, sessionLabel } from "@/lib/queries";

export const metadata = { title: "Trends — Toledo VB" };

export default function TrendsPage() {
  const sessions = getSessions().filter((s) => s.setNumber === null);
  const players = getPlayers();
  const teamLines = getTeamStatLines();
  const attackRows = getAttackBySetType();

  const entities = [
    { id: "team", name: "Team" },
    ...players.map((p) => ({ id: p.id, name: `${p.jersey} ${p.last}` })),
  ];

  // The full metric x entity x session table is precomputed server-side; the
  // client explorer only filters and windows it, so every interaction is
  // instant and the URL stays shareable.
  const series: TrendsPayload["series"] = {};
  for (const metric of METRICS) {
    series[metric.id] = {};
    for (const entity of entities) {
      series[metric.id][entity.id] = sessions.map((s) =>
        metricPoint(metric.id, entity.id, s.id, teamLines, attackRows)
      );
    }
  }

  const payload: TrendsPayload = {
    sessions: sessions.map((s) => ({
      id: s.id,
      date: s.date,
      kind: s.kind,
      drill: s.drill,
      label: sessionLabel(s),
    })),
    entities,
    metrics: METRICS.map((m) => ({ id: m.id, label: m.label, fmt: m.fmt })),
    series,
  };

  return (
    <div>
      <PageHeader
        title="Trends"
        subtitle="Any metric, session by session, for the team or any players"
      />
      <Suspense>
        <TrendsExplorer payload={payload} />
      </Suspense>
    </div>
  );
}
