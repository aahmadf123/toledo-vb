import { notFound } from "next/navigation";
import Link from "next/link";
import TrendChart from "@/components/charts/TrendChart";
import PageHeader from "@/components/layout/PageHeader";
import { getPlayer, getSessions, getSetterHitter } from "@/lib/data";
import { fmtDate, SERIES_COLORS } from "@/lib/format";
import { rollingAvg, setterHitPct } from "@/lib/metrics";

export function generateStaticParams() {
  const rows = getSetterHitter();
  const pairs = new Set(rows.map((r) => `${r.setterId}|${r.hitterId}`));
  return [...pairs].map((p) => {
    const [setterId, hitterId] = p.split("|");
    return { setterId, hitterId };
  });
}

export default async function PairPage({
  params,
}: {
  params: Promise<{ setterId: string; hitterId: string }>;
}) {
  const { setterId, hitterId } = await params;
  const setter = getPlayer(setterId);
  const hitter = getPlayer(hitterId);
  if (!setter || !hitter) notFound();

  const sessions = getSessions().filter((s) => s.setNumber === null);
  const rows = getSetterHitter().filter(
    (r) => r.setterId === setterId && r.hitterId === hitterId
  );
  if (rows.length === 0) notFound();

  const points = sessions
    .map((s) => {
      const mine = rows.filter((r) => r.sessionId === s.id);
      if (mine.length === 0) return null;
      const sum = mine.reduce(
        (a, r) => ({ k: a.k + r.k, eUnf: a.eUnf + r.eUnf, eBlk: a.eBlk + r.eBlk, ta: a.ta + r.ta }),
        { k: 0, eUnf: 0, eBlk: 0, ta: 0 }
      );
      return { date: s.date, value: setterHitPct(sum), ta: sum.ta };
    })
    .filter((p) => p !== null && p.ta > 0) as Array<{ date: string; value: number | null; ta: number }>;

  const totals = rows.reduce(
    (a, r) => ({ k: a.k + r.k, eUnf: a.eUnf + r.eUnf, eBlk: a.eBlk + r.eBlk, ta: a.ta + r.ta }),
    { k: 0, eUnf: 0, eBlk: 0, ta: 0 }
  );
  const seasonRate = setterHitPct(totals);
  const values = points.map((p) => p.value);

  return (
    <div>
      <PageHeader
        title={`${setter.last} → ${hitter.last}`}
        subtitle={`Season: ${totals.k}K ${totals.eUnf + totals.eBlk}E on ${totals.ta} attempts${
          seasonRate !== null ? ` · ${seasonRate >= 0 ? "" : "-"}.${Math.abs(seasonRate).toFixed(3).slice(2)}` : ""
        }`}
      >
        <Link href="/connection" className="text-xs font-medium text-gold hover:underline">
          ← Full matrix
        </Link>
      </PageHeader>
      <div className="rounded-xl border border-navy-700 bg-card p-3">
        <TrendChart
          labels={points.map((p) => fmtDate(p.date))}
          series={[
            {
              id: "pair",
              name: `${setter.last} → ${hitter.last}`,
              color: SERIES_COLORS[0],
              values,
            },
            {
              id: "roll",
              name: "5-session avg",
              color: SERIES_COLORS[0],
              dashed: true,
              values: rollingAvg(values, 5),
            },
          ]}
          fmt="rate3"
        />
      </div>
    </div>
  );
}
