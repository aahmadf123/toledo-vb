/**
 * Monochrome position tag. Deliberately not hue-coded — color in this app is
 * reserved for data semantics (rates, series), so positions read as quiet
 * structure, not as a competing color system.
 */
export default function PositionBadge({ position }: { position: string }) {
  return (
    <span className="inline-flex items-center rounded border border-navy-700 px-1.5 py-px text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
      {position}
    </span>
  );
}
