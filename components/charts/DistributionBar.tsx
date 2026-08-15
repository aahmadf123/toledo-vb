/**
 * 100% stacked reception-quality bar: 3 / 2 / 1 / 0-rated shares, lightness-
 * ordered so the story survives colorblindness and print; counts are printed
 * in any segment wide enough to hold them, so color never carries alone.
 */
const SEGMENTS = [
  { key: "rtg3", label: "3", bg: "#7dd3fc", text: "#0a1428" },
  { key: "rtg2", label: "2", bg: "#0284c7", text: "#f2f5fa" },
  { key: "rtg1", label: "1", bg: "#5c6f92", text: "#f2f5fa" },
  { key: "r0", label: "0 / error", bg: "#fb923c", text: "#0a1428" },
] as const;

export function DistributionLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {SEGMENTS.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: s.bg }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export default function DistributionBar({
  counts,
}: {
  counts: { rtg3: number; rtg2: number; rtg1: number; r0: number; srAtt: number };
}) {
  if (counts.srAtt === 0) return null;
  return (
    <div className="flex h-5 w-full gap-px overflow-hidden rounded-sm">
      {SEGMENTS.map((s) => {
        const n = counts[s.key];
        const pct = (n / counts.srAtt) * 100;
        if (n === 0) return null;
        return (
          <div
            key={s.key}
            className="flex items-center justify-center text-[10px] font-semibold tabular-nums"
            style={{ width: `${pct}%`, backgroundColor: s.bg, color: s.text }}
            title={`${s.label}: ${n} of ${counts.srAtt}`}
          >
            {pct >= 8 ? n : ""}
          </div>
        );
      })}
    </div>
  );
}
