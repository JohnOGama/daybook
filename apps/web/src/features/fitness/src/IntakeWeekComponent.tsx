import Link from 'next/link';
import { SectionCardComponent } from '@/features/budget';
import { cn } from '@/shared/utils/cn';
import { addDays, formatShortDay } from '@/shared/utils/date-formatter';
import { formatKcal } from './fitness-format';
import type { FitnessViewProps } from './fitness-types';
import { averageIntake, type DayIntake } from './forecast-math';

const weekday = (day: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

type IntakeWeekProps = { intake: DayIntake[]; day: string; targetKcal: number | null; hrefFor: FitnessViewProps['hrefFor'] };

// Calories eaten on each of the seven days up to the shown one, against the daily target.
export function IntakeWeekComponent({ intake, day, targetKcal, hrefFor }: IntakeWeekProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(day, index - 6));
  const kcalOn = new Map(intake.map((row) => [row.day, row.kcal]));
  const top = Math.max(targetKcal ?? 0, ...days.map((shown) => kcalOn.get(shown) ?? 0), 1);
  const average = averageIntake(intake, day, 7);

  return (
    <SectionCardComponent
      title="Last 7 days"
      action={<span className="text-xs text-muted-foreground tabular-nums">{average ? `Avg ${formatKcal(average.average.kcal)}` : 'Nothing logged'}</span>}
    >
      <div className="px-4 pb-4">
        <div className="relative flex h-28 items-end gap-2">
          {targetKcal !== null && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/60" style={{ bottom: `${(targetKcal / top) * 100}%` }} />
          )}
          {days.map((shown) => {
            const kcal = kcalOn.get(shown);
            return (
              <Link
                key={shown}
                href={hrefFor({ day: shown })}
                aria-label={`${formatShortDay(shown)}: ${kcal === undefined ? 'nothing logged' : formatKcal(kcal)}`}
                aria-current={shown === day ? 'date' : undefined}
                className="group flex h-full flex-1 flex-col justify-end rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn('min-h-1 w-full rounded-md bg-foreground/20 transition-[height] duration-500 group-hover:bg-foreground/35', shown === day && 'bg-signal group-hover:bg-signal')}
                  style={{ height: `${((kcal ?? 0) / top) * 100}%` }}
                />
              </Link>
            );
          })}
        </div>
        <div aria-hidden className="mt-1.5 flex gap-2">
          {days.map((shown) => (
            <span key={shown} className={cn('flex-1 text-center text-[11px] text-muted-foreground', shown === day && 'font-semibold text-foreground')}>
              {weekday(shown)}
            </span>
          ))}
        </div>
        {targetKcal !== null && <p className="mt-2 text-xs text-muted-foreground">Dashed line: your {formatKcal(targetKcal)} target</p>}
      </div>
    </SectionCardComponent>
  );
}
