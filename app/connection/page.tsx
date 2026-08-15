import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import ConnectionExplorer, {
  type ConnectionPayload,
} from "@/components/filters/ConnectionExplorer";
import { getPlayers, getSessions, getSetterHitter } from "@/lib/data";
import { toPlayerLite, toSessionLite } from "@/lib/payload";

export const metadata = { title: "Setter Connection — Toledo VB" };

export default function ConnectionPage() {
  const sessions = getSessions().filter((s) => s.setNumber === null);

  const payload: ConnectionPayload = {
    players: getPlayers().map(toPlayerLite),
    sessions: sessions.map(toSessionLite),
    shRows: getSetterHitter().map(({ sourceFile: _, ...r }) => r),
  };

  return (
    <div>
      <PageHeader
        title="Setter Connection"
        subtitle="Hitting % per setter-hitter pair. Libero columns are out-of-system sets — part of the story."
      />
      <Suspense>
        <ConnectionExplorer payload={payload} />
      </Suspense>
    </div>
  );
}
