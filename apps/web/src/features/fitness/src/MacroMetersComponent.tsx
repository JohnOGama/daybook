import { formatGrams, formatKcal } from './fitness-format';
import type { Targets } from './fitness-types';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const shareOf = (value: number, target: number | undefined) => (target ? Math.min(value / target, 1) : 0);

function CalorieRing({ eaten, planned, target }: { eaten: number; planned: number; target: number | undefined }) {
  const arc = (share: number, className: string) =>
    share > 0 && (
      <circle
        cx={60}
        cy={60}
        r={RADIUS}
        fill="none"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        className={className}
      />
    );
  return (
    <div
      role="meter"
      aria-label="Calories against target"
      aria-valuemin={0}
      aria-valuemax={target ?? 0}
      aria-valuenow={target === undefined ? 0 : Math.min(eaten, target)}
      className="relative size-28 shrink-0"
    >
      <svg viewBox="0 0 120 120" aria-hidden className="size-full -rotate-90">
        <circle cx={60} cy={60} r={RADIUS} fill="none" strokeWidth={10} className="stroke-muted" />
        {arc(shareOf(planned, target), 'stroke-signal/30')}
        {arc(shareOf(eaten, target), 'stroke-signal transition-[stroke-dasharray] duration-500')}
      </svg>
      <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">{target ? `${Math.round((eaten / target) * 100)}%` : '—'}</span>
        <span className="text-[11px] text-muted-foreground">of target</span>
      </span>
    </div>
  );
}

function MacroBar({ label, eaten, planned, target }: { label: string; eaten: number; planned: number; target: number | undefined }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">
          {formatGrams(eaten)}
          {target !== undefined && <span className="text-muted-foreground"> / {formatGrams(target)}</span>}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} against target`}
        aria-valuemin={0}
        aria-valuemax={target ?? 0}
        aria-valuenow={target === undefined ? 0 : Math.min(eaten, target)}
        className="relative h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-signal/30" style={{ width: `${shareOf(planned, target) * 100}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-signal transition-[width] duration-500" style={{ width: `${shareOf(eaten, target) * 100}%` }} />
      </div>
    </div>
  );
}

type MacroMetersProps = { totals: Targets; planned: Targets; targets: Targets | null };

// What has been eaten against the day's targets. Planned food only shows as the faint "if you finish" layer.
export function MacroMetersComponent({ totals, planned, targets }: MacroMetersProps) {
  const target = targets?.kcal;
  const detail = target === undefined ? 'No target yet' : totals.kcal > target ? `${formatKcal(totals.kcal - target)} over ${formatKcal(target)}` : `${formatKcal(target - totals.kcal)} left of ${formatKcal(target)}`;
  return (
    <section aria-label="Eaten today" className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <CalorieRing eaten={totals.kcal} planned={planned.kcal} target={target} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">Calories</span>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatKcal(totals.kcal)}</span>
            <span className="text-xs text-muted-foreground">{detail}</span>
          </div>
        </div>
        <div className="grid flex-1 gap-3 sm:border-l sm:pl-5">
          <MacroBar label="Protein" eaten={totals.proteinMg} planned={planned.proteinMg} target={targets?.proteinMg} />
          <MacroBar label="Carbs" eaten={totals.carbsMg} planned={planned.carbsMg} target={targets?.carbsMg} />
          <MacroBar label="Fat" eaten={totals.fatMg} planned={planned.fatMg} target={targets?.fatMg} />
        </div>
      </div>
      {planned.kcal !== totals.kcal && (
        <p className="text-xs text-muted-foreground tabular-nums">
          If you finish what is planned: {formatKcal(planned.kcal)} · protein {formatGrams(planned.proteinMg)} · carbs {formatGrams(planned.carbsMg)} · fat{' '}
          {formatGrams(planned.fatMg)}
        </p>
      )}
    </section>
  );
}
