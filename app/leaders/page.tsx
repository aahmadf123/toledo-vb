import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import LeadersExplorer, { type LeadersPayload } from "@/components/filters/LeadersExplorer";
import {
  getAttackBySetType,
  getMatchBoxLines,
  getPlayers,
  getSessions,
  getTeamStatLines,
} from "@/lib/data";
import { toPlayerLite, toSessionLite } from "@/lib/payload";

export const metadata = { title: "Leaders — Toledo VB" };

export default function LeadersPage() {
  const sessions = getSessions().filter((s) => s.setNumber === null);

  const payload: LeadersPayload = {
    players: getPlayers().map(toPlayerLite),
    sessions: sessions.map(toSessionLite),
    data: {
      teamLines: getTeamStatLines().map((r) => ({
        sessionId: r.sessionId,
        playerId: r.playerId,
        attacking: r.attacking,
        reception: r.reception,
        serving: r.serving,
      })),
      attackRows: getAttackBySetType().map((r) => ({
        sessionId: r.sessionId,
        playerId: r.playerId,
        k: r.k,
        e: r.e,
        ta: r.ta,
      })),
      boxLines: getMatchBoxLines().map(({ sourceFile: _, ...r }) => r),
    },
  };

  return (
    <div>
      <PageHeader
        title="Leaders"
        subtitle="Who leads the team in anything — season or single session, by position"
      />
      <Suspense>
        <LeadersExplorer payload={payload} />
      </Suspense>
    </div>
  );
}
