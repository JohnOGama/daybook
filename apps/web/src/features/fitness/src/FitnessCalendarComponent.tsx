'use client';

import { Check, ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Skeleton } from 'skullet/react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { formatMonthHeading, monthGrid, shiftMonth } from '@/shared/utils/month-grid';
import { useFitnessDays } from '../hooks/useFitnessDays';
import { formatKcal, formatKg } from './fitness-format';
import type { FitnessViewProps } from './fitness-types';
import { intakeByDay } from './forecast-math';
import { sampleDay } from './sample-fitness';
import { targetsFor } from './targets-math';
import { setsDone } from './workout-math';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// A month of the space: calories eaten, workouts and weigh-ins per day. A day opens it on Today.
export function FitnessCalendarComponent({ fitness, today, day, hrefFor }: FitnessViewProps) {
  const month = day.slice(0, 7);
  const days = monthGrid(month);
  const { data, isPending, isError } = useFitnessDays(days[0], days.at(-1) as string);
  const sample = useMemo(() => sampleDay(day), [day]);
  const range = data ?? sample;
  const kcalByDay = new Map(intakeByDay(range.logs).map((intake) => [intake.day, intake.kcal]));
  const weightByDay = new Map(fitness.weights.map((weight) => [weight.day, weight.weightG]));
  const target = targetsFor(fitness.profile, fitness.weights.at(-1)?.weightG ?? null, today)?.kcal;
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const monthHref = (amount: number) => hrefFor({ view: 'calendar', day: `${shiftMonth(month, amount)}-01` });

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load this month. Please try again.
      </p>
    );
  }

  return (
    <section aria-label="Fitness calendar" className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" aria-label="Previous month">
          <Link href={monthHref(-1)}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-40 text-center text-sm font-semibold">{formatMonthHeading(month)}</h2>
        <Button asChild variant="ghost" size="icon" aria-label="Next month">
          <Link href={monthHref(1)}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
        {month !== today.slice(0, 7) && (
          <Button asChild variant="outline" size="sm" className="ml-1">
            <Link href={hrefFor({ view: 'calendar', day: today })}>This month</Link>
          </Button>
        )}
      </div>

      <Skeleton loading={isPending} label="Loading the month">
        <div className="overflow-x-auto">
          <div role="grid" aria-label={formatMonthHeading(month)} className="min-w-[640px] overflow-hidden rounded-xl border bg-card">
            <div role="row" className="grid grid-cols-7 border-b bg-muted">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} role="columnheader" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {weekday}
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0]} role="row" className="grid grid-cols-7 border-b last:border-b-0">
                {week.map((cell) => {
                  const kcal = kcalByDay.get(cell);
                  const weightG = weightByDay.get(cell);
                  const workouts = range.workouts.filter((workout) => workout.day === cell);
                  return (
                    <Link
                      key={cell}
                      role="gridcell"
                      href={hrefFor({ view: 'today', day: cell })}
                      aria-label={`Open ${cell} on Today`}
                      className={cn(
                        'flex min-h-28 min-w-0 flex-col gap-1 border-r p-1.5 outline-none last:border-r-0 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        !cell.startsWith(month) && 'bg-muted/40',
                      )}
                    >
                      <span
                        aria-current={cell === today ? 'date' : undefined}
                        className={cn(
                          'grid size-6 place-items-center rounded-full text-xs tabular-nums',
                          cell.startsWith(month) ? 'text-foreground' : 'text-muted-foreground',
                          cell === today && 'bg-foreground font-semibold text-background',
                        )}
                      >
                        {Number(cell.slice(8))}
                      </span>
                      {kcal !== undefined && (
                        <span className={cn('truncate text-xs font-medium tabular-nums', target !== undefined && kcal > target && 'text-destructive')}>
                          {formatKcal(kcal)}
                        </span>
                      )}
                      {workouts.map((workout) => {
                        const { done, total } = setsDone(workout);
                        const finished = total > 0 && done === total;
                        return (
                          <span
                            key={workout.id}
                            className={cn(
                              'flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs',
                              finished ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {finished ? <Check className="size-3 shrink-0" aria-hidden /> : <Dumbbell className="size-3 shrink-0" aria-hidden />}
                            <span className="truncate">{workout.name}</span>
                          </span>
                        );
                      })}
                      {weightG !== undefined && <span className="mt-auto truncate text-xs text-muted-foreground tabular-nums">{formatKg(weightG)}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Skeleton>
    </section>
  );
}
