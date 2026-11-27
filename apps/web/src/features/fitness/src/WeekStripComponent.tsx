import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { addDays, formatShortDay } from '@/shared/utils/date-formatter';
import { formatKcal } from './fitness-format';
import type { FitnessViewProps } from './fitness-types';
import type { DayIntake } from './forecast-math';

const weekday = (day: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

type WeekStripProps = {
  day: string;
  today: string;
  intake: DayIntake[];
  targetKcal: number | null;
  hrefFor: FitnessViewProps['hrefFor'];
  children?: ReactNode;
};

// The seven days up to the shown one, each with a small bar of calories against the target. It is both the day
// picker and the week at a glance; the arrows step one day and `children` sit at the end of the row.
export function WeekStripComponent({ day, today, intake, targetKcal, hrefFor, children }: WeekStripProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(day, index - 6));
  const kcalOn = new Map(intake.map((row) => [row.day, row.kcal]));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 basis-80 items-center gap-1">
        <Button asChild variant="ghost" size="icon" className="shrink-0" aria-label="Previous day">
          <Link href={hrefFor({ day: addDays(day, -1) })}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <ol className="flex min-w-0 flex-1 gap-1">
          {days.map((shown) => {
            const kcal = kcalOn.get(shown);
            const share = kcal === undefined ? 0 : targetKcal ? Math.min(kcal / targetKcal, 1) : 1;
            const current = shown === day;
            return (
              <li key={shown} className="min-w-0 flex-1">
                <Link
                  href={hrefFor({ day: shown })}
                  aria-label={`${formatShortDay(shown)}: ${kcal === undefined ? 'nothing logged' : formatKcal(kcal)}`}
                  aria-current={current ? 'date' : undefined}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                    current && 'border-foreground bg-card text-foreground hover:bg-card',
                  )}
                >
                  <span className="text-[11px] font-medium">{shown === today ? 'Today' : weekday(shown)}</span>
                  <span className="text-[15px] font-semibold text-foreground tabular-nums">{Number(shown.slice(8))}</span>
                  <span aria-hidden className="h-1 w-6 overflow-hidden rounded-full bg-muted">
                    <span className={cn('block h-full rounded-full bg-foreground/35 transition-[width] duration-500', current && 'bg-signal')} style={{ width: `${share * 100}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        <Button asChild variant="ghost" size="icon" className="shrink-0" aria-label="Next day">
          <Link href={hrefFor({ day: addDays(day, 1) })}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </div>
      {(day !== today || children) && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {day !== today && (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefFor({ day: today })}>Today</Link>
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
