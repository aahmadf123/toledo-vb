import Sparkline from "@/components/charts/Sparkline";
import { fmtPct, fmtRate, fmtRating } from "@/lib/format";

export default function KpiTile({
  label,
  value,
  fmt,
  delta,
  spark,
  attempts,
}: {
  label: string;
  value: number | null;
  fmt: "rate3" | "pct1" | "rating";
  /** Latest value minus the prior-5-session average, in metric units. */
  delta: number | null;
  spark: Array<number | null>;
  attempts: number;
}) {
  const fmtValue = (v: number | null) =>
    fmt === "pct1" ? fmtPct(v) : fmt === "rating" ? fmtRating(v) : fmtRate(v);
  const deltaText =
    delta === null
      ? null
      : `${delta >= 0 ? "▲" : "▼"} ${
          fmt === "pct1" ? fmtPct(Math.abs(delta)) : fmtValue(Math.abs(delta)).replace("-", "")
        } vs prior 5`;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums text-rocket-blue-dark">
          {fmtValue(value)}
        </span>
        {deltaText ? (
          <span
            className={`text-xs font-medium ${delta! >= 0 ? "text-sky-700" : "text-orange-700"}`}
          >
            {deltaText}
          </span>
        ) : null}
      </div>
      <Sparkline values={spark} />
      <p className="mt-1 text-[11px] text-neutral-400">{attempts} attempts, last session</p>
    </div>
  );
}
