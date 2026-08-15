import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PlayersExplorer, { type RosterPlayer } from "@/components/filters/PlayersExplorer";
import { getPlayers } from "@/lib/data";

export const metadata = { title: "Players — Toledo VB" };

export default function PlayersPage() {
  const players: RosterPlayer[] = getPlayers().map((p) => ({
    id: p.id,
    jersey: p.jersey,
    first: p.first,
    last: p.last,
    position: p.position,
    class: p.class,
    height: p.height,
  }));

  return (
    <div>
      <PageHeader title="Players" subtitle="2026 roster" />
      <Suspense>
        <PlayersExplorer players={players} />
      </Suspense>
    </div>
  );
}
