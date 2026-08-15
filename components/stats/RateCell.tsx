import { fmtNum1, fmtPct, fmtRate, fmtRating } from "@/lib/format";
import { MIN_ATTEMPTS } from "@/lib/metrics";

/**
 * The one way a rate is rendered anywhere in the app: greyed out with an
 * attempts badge whenever the sample is below MIN_ATTEMPTS, so a 1-for-1
 * hitting day never reads as a 1.000 season.
 */
export default function RateCell({
  value,
  attempts,
  fmt = "rate3",
  minAttempts = MIN_ATTEMPTS,
}: {
  value: number | null;
  attempts: number;
  fmt?: "rate3" | "pct1" | "rating" | "num1";
  minAttempts?: number;
}) {
  const text =
    fmt === "pct1"
      ? fmtPct(value)
      : fmt === "rating"
        ? fmtRating(value)
        : fmt === "num1"
          ? fmtNum1(value)
          : fmtRate(value);
  const small = attempts < minAttempts;
  return (
    <span className={small ? "text-ink-muted/70" : undefined}>
      {text}
      {small && value !== null ? (
        <sup className="ml-0.5 text-[10px] text-ink-muted" title={`${attempts} attempts`}>
          {attempts}
        </sup>
      ) : null}
    </span>
  );
}
