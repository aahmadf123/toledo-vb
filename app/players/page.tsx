import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { getPlayers } from "@/lib/data";

export const metadata = { title: "Players — Toledo VB" };

export default function PlayersPage() {
  const players = getPlayers();
  return (
    <div>
      <PageHeader title="Players" subtitle="2026 roster" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/players/${p.id}`}
            className="group rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black tabular-nums text-rocket-gold [text-shadow:0_0_1px_#15397f]">
                {p.jersey}
              </span>
              <span className="text-xs font-semibold text-neutral-400">{p.position}</span>
            </div>
            <p className="mt-1 font-semibold text-rocket-blue-dark group-hover:underline">
              {p.first} {p.last}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {p.class} · {p.height}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
