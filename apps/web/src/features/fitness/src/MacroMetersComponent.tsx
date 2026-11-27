import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
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
      className="relative size-28 shrink-0 sm:size-32"
    >
      <svg viewBox="0 0 120 120" aria-hidden className="size-full -rotate-90">
        <circle cx={60} cy={60} r={RADIUS} fill="none" strokeWidth={10} className="stroke-muted" />
        {arc(shareOf(planned, target), 'stroke-signal/30')}
        {arc(shareOf(eaten, target), 'stroke-signal transition-[stroke-dasharray] duration-500')}
      </svg>
      <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{target ? `${Math.round((eaten / target) * 100)}%` : '—'}</span>
        <span className="text-[11px] text-muted-foreground">of target</span>
      </span>
    </div>
  );
}

function MacroBar({ label, eaten, planned, target }: { label: string; eaten: number; planned: number; target: number | undefined }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
      <span className="font-medium">{label}</span>
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
      <span className="tabular-nums">
        {formatGrams(eaten)}
        {target !== undefined && <span className="text-muted-foreground"> / {formatGrams(target)}</span>}
      </span>
    </div>
  );
}

export type QuickStat = { icon: ReactNode; label: string; value: string };

type MacroMetersProps = { totals: Targets; planned: Targets; targets: Targets | null; stats?: QuickStat[]; className?: string };

// The day at a glance: calories left, the three macros and a few quick figures. Only eaten food counts; planned food
// shows as the faint "if you finish" layer of the ring and bars, and as the planned amount under the headline.
export function MacroMetersComponent({ totals, planned, targets, stats = [], className }: MacroMetersProps) {
  const target = targets?.kcal;
  const left = target === undefined ? null : target - totals.kcal;
  const plannedOnly = planned.kcal - totals.kcal;
  const label = left === null ? 'Eaten today' : left < 0 ? 'Over today' : 'Left today';
  const detail = [left === null ? 'No target yet' : `${formatKcal(totals.kcal)} eaten`, plannedOnly > 0 && `${formatKcal(plannedOnly)} planned`].filter(Boolean).join(' · ');

  return (
    <section aria-label="Eaten today" className={cn('grid gap-5 rounded-xl border bg-card p-4 sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_14rem] lg:items-center lg:gap-7', className)}>
      <div className="flex items-center gap-4">
        <CalorieRing eaten={totals.kcal} planned={planned.kcal} target={target} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatKcal(left === null ? totals.kcal : Math.abs(left))}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{detail}</span>
        </div>
      </div>
      <div className="grid gap-3 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-7">
        <MacroBar label="Protein" eaten={totals.proteinMg} planned={planned.proteinMg} target={targets?.proteinMg} />
        <MacroBar label="Carbs" eaten={totals.carbsMg} planned={planned.carbsMg} target={targets?.carbsMg} />
        <MacroBar label="Fat" eaten={totals.fatMg} planned={planned.fatMg} target={targets?.fatMg} />
      </div>
      {stats.length > 0 && (
        <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {stats.map(({ icon, label: statLabel, value }) => (
            <div key={statLabel} className="flex items-center gap-2.5 rounded-xl bg-muted px-3 py-2 text-sm">
              {icon}
              <dt>{statLabel}</dt>
              <dd className="ml-auto font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
