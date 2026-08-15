import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import BoxExplorer, { type BoxPayload } from "@/components/filters/BoxExplorer";
import { getMatchBoxLines, getPlayers, getSessions } from "@/lib/data";
import { toPlayerLite, toSessionLite } from "@/lib/payload";
import { sessionFamilies } from "@/lib/queries";

export const metadata = { title: "Box Scores — Toledo VB" };

export default function BoxPage() {
  const boxLines = getMatchBoxLines();
  const withBox = new Set(boxLines.map((r) => r.sessionId));

  const families = sessionFamilies(getSessions())
    .filter((f) => withBox.has(f.parent.id) || f.sets.some((s) => withBox.has(s.id)))
    .map((f) => ({
      parent: toSessionLite(f.parent),
      sets: f.sets
        .filter((s) => s.setNumber !== null)
        .map((s) => ({ ...toSessionLite(s), setNumber: s.setNumber! })),
    }));

  const payload: BoxPayload = {
    players: getPlayers().map(toPlayerLite),
    families,
    boxLines: boxLines.map(({ sourceFile: _, ...r }) => r),
  };

  return (
    <div>
      <PageHeader
        title="Box Scores"
        subtitle="The full stat line for every scrimmage and match — set by set, pass by pass"
      />
      <Suspense>
        <BoxExplorer payload={payload} />
      </Suspense>
    </div>
  );
}
