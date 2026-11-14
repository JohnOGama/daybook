const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A small ring filled to the match percentage, with the number beside it.
export function MatchRingComponent({ pct }: { pct: number }) {
  return (
    <span className="flex items-center gap-2 font-semibold tabular-nums">
      <svg viewBox="0 0 36 36" aria-hidden className="size-7 -rotate-90">
        <circle cx={18} cy={18} r={RADIUS} fill="none" strokeWidth={4} className="stroke-muted" />
        <circle cx={18} cy={18} r={RADIUS} fill="none" strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(pct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`} className="stroke-signal" />
      </svg>
      {pct}%
    </span>
  );
}
