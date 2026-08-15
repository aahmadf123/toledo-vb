import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import RateCell from "@/components/ui/RateCell";
import { getPlayers, getSessions, getSetterHitter } from "@/lib/data";
import { fmtDate, rateColorClass } from "@/lib/format";
import { connectionMatrix } from "@/lib/queries";

export const metadata = { title: "Setter Connection — Toledo VB" };

export default async function ConnectionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const players = getPlayers();
  const sessions = getSessions().filter((s) => s.setNumber === null);
  const shRows = getSetterHitter();

  const inRange = sessions.filter((s) => (!from || s.date >= from) && (!to || s.date <= to));
  const cells = connectionMatrix(shRows, new Set(inRange.map((s) => s.id)));

  const name = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p ? `${p.jersey} ${p.last}` : id;
  };

  // Column order: real setters first by volume, then libero setters.
  const setterVolume = new Map<string, number>();
  for (const c of cells) setterVolume.set(c.setterId, (setterVolume.get(c.setterId) ?? 0) + c.ta);
  const setters = [...setterVolume.keys()].sort((a, b) => {
    const aS = players.find((p) => p.id === a)?.position === "S" ? 0 : 1;
    const bS = players.find((p) => p.id === b)?.position === "S" ? 0 : 1;
    return aS - bS || (setterVolume.get(b) ?? 0) - (setterVolume.get(a) ?? 0);
  });
  const hitterVolume = new Map<string, number>();
  for (const c of cells) hitterVolume.set(c.hitterId, (hitterVolume.get(c.hitterId) ?? 0) + c.ta);
  const hitters = [...hitterVolume.keys()].sort(
    (a, b) => (hitterVolume.get(b) ?? 0) - (hitterVolume.get(a) ?? 0)
  );
  const cellMap = new Map(cells.map((c) => [`${c.setterId}|${c.hitterId}`, c]));

  const dates = sessions.map((s) => s.date);

  return (
    <div>
      <PageHeader
        title="Setter Connection"
        subtitle="Hitting % per setter-hitter pair. Libero columns are out-of-system sets — part of the story."
      >
        <form className="flex gap-2" action="/connection">
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

      {cells.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          No setter-hitter data in this range.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                <th className="px-4 py-2 text-left font-medium">Hitter \ Setter</th>
                {setters.map((sid) => (
                  <th key={sid} className="px-2 py-2 text-center font-medium">
                    <Link href={`/players/${sid}`} className="hover:underline">
                      {name(sid)}
                    </Link>
                    {players.find((p) => p.id === sid)?.position !== "S" ? (
                      <span className="block text-[10px] font-normal text-neutral-400">OOS</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hitters.map((hid) => (
                <tr key={hid} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-1.5">
                    <Link href={`/players/${hid}`} className="hover:underline">
                      {name(hid)}
                    </Link>
                  </td>
                  {setters.map((sid) => {
                    const cell = cellMap.get(`${sid}|${hid}`);
                    return (
                      <td key={sid} className="px-1 py-1 text-center">
                        {cell ? (
                          <Link
                            href={`/connection/${sid}/${hid}`}
                            className={`block rounded px-1 py-1 tabular-nums transition-opacity hover:opacity-75 ${rateColorClass(cell.hitPct)}`}
                            title={`${cell.k}K ${cell.eUnf + cell.eBlk}E on ${cell.ta} attempts`}
                          >
                            <RateCell value={cell.hitPct} attempts={cell.ta} />
                            <span className="block text-[10px] opacity-70">{cell.ta} att</span>
                          </Link>
                        ) : (
                          <span className="block px-1 py-1 text-neutral-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-neutral-400">
        Cell color follows hitting %: orange = below zero, blue = strong. Greyed numbers have under
        10 attempts. Tap a cell for the pair&apos;s trend.
      </p>
    </div>
  );
}
