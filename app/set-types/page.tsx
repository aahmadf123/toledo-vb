import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import SetTypesExplorer, { type SetTypesPayload } from "@/components/filters/SetTypesExplorer";
import { getAttackBySetType, getPlayers, getSessions } from "@/lib/data";
import { toPlayerLite, toSessionLite } from "@/lib/payload";

export const metadata = { title: "Set Types — Toledo VB" };

export default function SetTypesPage() {
  const sessions = getSessions().filter((s) => s.setNumber === null);

  const payload: SetTypesPayload = {
    players: getPlayers().map(toPlayerLite),
    sessions: sessions.map(toSessionLite),
    attackRows: getAttackBySetType().map(({ sourceFile: _, ...r }) => r),
  };

  return (
    <div>
      <PageHeader
        title="Set Types"
        subtitle="Where the sets go, and how they finish — attempt share next to efficiency"
      />
      <Suspense>
        <SetTypesExplorer payload={payload} />
      </Suspense>
    </div>
  );
}
