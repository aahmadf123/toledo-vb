import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import RateCell from "@/components/ui/RateCell";
import { getAttackBySetType, getPlayers, getSessions } from "@/lib/data";
import { fmtDate, rateColorClass } from "@/lib/format";
import { setTypeBreakdown } from "@/lib/queries";

export const metadata = { title: "Set Types — Toledo VB" };

export default async function SetTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; player?: string }>;
}) {
  const { from, to, player } = await searchParams;
  const players = getPlayers();
  const sessions = getSessions().filter((s) => s.setNumber === null);
  const attackRows = getAttackBySetType();

  const inRange = sessions.filter((s) => (!from || s.date >= from) && (!to || s.date <= to));
  const sessionIds = new Set(inRange.map((s) => s.id));
  const breakdown = setTypeBreakdown(attackRows, sessionIds, player || undefined);

  const withData = new Set(attackRows.map((r) => r.playerId));
  const dates = sessions.map((s) => s.date);
  const maxShare = Math.max(0.0001, ...breakdown.map((t) => t.taShare));

  return (
    <div>
      <PageHeader
        title="Set Types"
        subtitle="Where the sets go, and how they finish — attempt share next to efficiency"
      >
        <form className="flex flex-wrap gap-2" action="/set-types">
          <select name="player" defaultValue={player ?? ""} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm">
            <option value="">Whole team</option>
            {players
              .filter((p) => withData.has(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jersey} {p.last}
                </option>
              ))}
          </select>
          <select name="from" defaultValue={from ?? ""} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm">
            <option value="">From start</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                from {fmtDate(d)}
              </option>
            ))}
          </select>
          <select name="to" defaultValue={to ?? ""} className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm">
            <option value="">To latest</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                to {fmtDate(d)}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-rocket-blue px-3 py-1.5 text-sm font-medium text-white">
            Apply
          </button>
        </form>
      </PageHeader>

      {breakdown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          No set-type data in this range.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-4 py-2 font-medium">Set type</th>
                <th className="px-3 py-2 text-right font-medium">K</th>
                <th className="px-3 py-2 text-right font-medium">E</th>
                <th className="px-3 py-2 text-right font-medium">TA</th>
                <th className="px-3 py-2 font-medium">Attempt share</th>
                <th className="px-4 py-2 text-right font-medium">Hit %</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((t) => (
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
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1 overflow-hidden rounded-sm bg-neutral-100">
                        <div
                          className="h-full rounded-sm bg-rocket-blue"
                          style={{ width: `${(t.taShare / maxShare) * 100}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs tabular-nums text-neutral-500">
                        {(t.taShare * 100).toFixed(0)}%
                      </span>
                    </div>
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
      )}
      <p className="mt-2 text-[11px] text-neutral-400">
        Set codes are scoped to their grid: outsides/opposites PD is the DOG set, middles PD is Dog.
        Pick a player to see her personal distribution, or browse from a{" "}
        <Link href="/players" className="text-rocket-blue hover:underline">
          player profile
        </Link>
        .
      </p>
    </div>
  );
}
