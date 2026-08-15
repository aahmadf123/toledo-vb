import Sparkline from "@/components/charts/Sparkline";
import { fmtNum1, fmtPct, fmtRate, fmtRating } from "@/lib/format";

export default function KpiTile({
  label,
  value,
  fmt,
  delta,
  spark,
  attempts,
  sampleNoun = "attempts",
}: {
  label: string;
  value: number | null;
  fmt: "rate3" | "pct1" | "rating" | "num1";
  /** Latest value minus the prior-5-session average, in metric units. */
  delta: number | null;
  spark: Array<number | null>;
  attempts: number;
  /** What the sample counts: "attempts" for rates, "sets" for per-set stats. */
  sampleNoun?: string;
}) {
  const fmtValue = (v: number | null) =>
    fmt === "pct1"
      ? fmtPct(v)
      : fmt === "rating"
        ? fmtRating(v)
        : fmt === "num1"
          ? fmtNum1(v)
          : fmtRate(v);
  const deltaText =
    delta === null
      ? null
      : `${delta >= 0 ? "▲" : "▼"} ${
          fmt === "pct1" ? fmtPct(Math.abs(delta)) : fmtValue(Math.abs(delta)).replace("-", "")
        } vs prior 5`;

  return (
    <div className="rounded-xl border border-navy-700 bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold text-ink tabular-nums">
          {fmtValue(value)}
        </span>
        {deltaText ? (
          <span
            className={`text-xs font-medium ${delta! >= 0 ? "text-sky-300" : "text-orange-300"}`}
          >
            {deltaText}
          </span>
        ) : null}
      </div>
      <Sparkline values={spark} />
      <p className="mt-1 text-[11px] text-muted-foreground">
        {attempts} {sampleNoun}, last session
      </p>
    </div>
  );
}
