"use client";

import { useMemo } from "react";
import Link from "next/link";
import EmptyState from "@/components/layout/EmptyState";
import RateCell from "@/components/stats/RateCell";
import FilterBar from "@/components/filters/FilterBar";
import { useFilters } from "@/components/filters/useFilters";
import { filterSessions } from "@/lib/filters";
import { rateColorClass } from "@/lib/format";
import { matchesPos } from "@/lib/positions";
import { shortName, type PlayerLite, type SessionLite } from "@/lib/payload";
import { connectionMatrix } from "@/lib/queries";

export interface ConnectionPayload {
  players: PlayerLite[];
  sessions: SessionLite[];
  shRows: Array<{
    sessionId: string;
    setterId: string;
    hitterId: string;
    k: number;
    eUnf: number;
    eBlk: number;
    ta: number;
  }>;
}

export default function ConnectionExplorer({ payload }: { payload: ConnectionPayload }) {
  const [filters, update] = useFilters();
  const playerById = useMemo(
    () => new Map(payload.players.map((p) => [p.id, p])),
    [payload.players]
  );
  const name = (id: string) => {
    const p = playerById.get(id);
    return p ? shortName(p) : id;
  };

  const visibleSessions = useMemo(
    () => filterSessions(payload.sessions, filters),
    [payload.sessions, filters]
  );

  const { setters, hitters, cellMap, cellCount } = useMemo(() => {
    const sessionIds = new Set(visibleSessions.map((s) => s.id));
    const cells = connectionMatrix(payload.shRows, sessionIds);

    // Column order: real setters first by volume, then libero out-of-system setters.
    const setterVolume = new Map<string, number>();
    for (const c of cells) setterVolume.set(c.setterId, (setterVolume.get(c.setterId) ?? 0) + c.ta);
    const setters = [...setterVolume.keys()].sort((a, b) => {
      const aS = playerById.get(a)?.position === "S" ? 0 : 1;
      const bS = playerById.get(b)?.position === "S" ? 0 : 1;
      return aS - bS || (setterVolume.get(b) ?? 0) - (setterVolume.get(a) ?? 0);
    });

    const hitterVolume = new Map<string, number>();
    for (const c of cells) hitterVolume.set(c.hitterId, (hitterVolume.get(c.hitterId) ?? 0) + c.ta);
    const hitters = [...hitterVolume.keys()]
      .filter((id) => {
        const p = playerById.get(id);
        return !p || matchesPos(p.position, filters.pos);
      })
      .sort((a, b) => (hitterVolume.get(b) ?? 0) - (hitterVolume.get(a) ?? 0));

    return {
      setters,
      hitters,
      cellMap: new Map(cells.map((c) => [`${c.setterId}|${c.hitterId}`, c])),
      cellCount: cells.length,
    };
  }, [payload.shRows, visibleSessions, playerById, filters.pos]);

  return (
    <div>
      <FilterBar
        filters={filters}
        onChange={update}
        show={["pos", "kind", "dates"]}
        sessions={payload.sessions}
      />

      {cellCount === 0 || hitters.length === 0 ? (
        <EmptyState>No setter-hitter data matches these filters.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-navy-700 bg-card">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-navy-700 text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-medium">
                  Hitter \ Setter
                </th>
                {setters.map((sid) => (
                  <th key={sid} className="px-2 py-2 text-center font-medium">
                    <Link href={`/players/${sid}`} className="hover:underline">
                      {name(sid)}
                    </Link>
                    {playerById.get(sid)?.position !== "S" ? (
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        OOS
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hitters.map((hid) => (
                <tr key={hid} className="border-b border-navy-700/50 last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-4 py-1.5">
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
                          <span className="block px-1 py-1 text-ink-faint">—</span>
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
      <p className="mt-2 text-[11px] text-muted-foreground">
        Cell color follows hitting %: orange = below zero, blue = strong. Greyed numbers have under
        10 attempts. Tap a cell for the pair&apos;s trend.
      </p>
    </div>
  );
}
