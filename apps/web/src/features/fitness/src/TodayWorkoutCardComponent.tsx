'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { cn } from '@/shared/utils/cn';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { BodyDiagramComponent, strengthFromLoad } from './BodyDiagramComponent';
import type { FitnessViewProps, Workout, WorkoutTemplate } from './fitness-types';
import { StartWorkoutMenuComponent } from './FitnessWorkoutsComponent';
import { muscleLoad, setsDone } from './workout-math';

const RANGES = [
  { value: 'day', label: 'This day', describe: 'on this day' },
  { value: 'week', label: '7 days', describe: 'in the last 7 days' },
] as const;

type TodayWorkoutCardProps = {
  // The week up to the shown day; the day's own workouts are picked out of it.
  workouts: Workout[];
  templates: WorkoutTemplate[];
  day: string;
  hrefFor: FitnessViewProps['hrefFor'];
  canEdit: boolean;
  className?: string;
};

// The day's workout with one tap to finish it, and a large map of the muscles worked. Set-by-set ticking stays on the
// Workouts tab; here "Complete workout" ticks every set at once, with Undo.
export function TodayWorkoutCardComponent({ workouts, templates, day, hrefFor, canEdit, className }: TodayWorkoutCardProps) {
  const { saveWorkout } = useFitnessMutations();
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('day');
  const todays = workouts.filter((workout) => workout.day === day);
  const mapped = range === 'day' ? todays : workouts;
  const { describe } = RANGES.find(({ value }) => value === range) as (typeof RANGES)[number];

  function complete(workout: Workout) {
    // One `from` for the save and its Undo: mutations run in order, so Undo goes out with the version the first save got.
    const from = { version: workout.version ?? 0, conflicted: false };
    const finished = { ...workout, items: workout.items.map((item) => ({ ...item, sets: item.sets.map((set) => ({ ...set, done: true })) })) };
    saveWorkout.mutate({ workout: finished, from });
    toast(`Completed ${workout.name}`, { action: { label: 'Undo', onClick: () => saveWorkout.mutate({ workout, from }) } });
  }

  return (
    <SectionCardComponent
      title="Workout"
      className={cn('xl:min-h-0 xl:overflow-hidden', className)}
      action={
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Muscle map range"
          value={range}
          onValueChange={(next) => next && setRange(next as typeof range)}
        >
          {RANGES.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value} className="px-2.5 text-xs">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <div className="flex flex-col gap-5 px-4 pb-4 xl:min-h-0 xl:flex-1">
        {todays.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {todays.map((workout) => {
              const { done, total } = setsDone(workout);
              const finished = total > 0 && done === total;
              return (
                <li key={workout.id} className="flex flex-wrap items-center gap-3">
                  <Link
                    href={hrefFor({ view: 'workouts' })}
                    className="flex min-w-48 flex-1 flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium hover:underline">{workout.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {done} of {total} sets done
                      </span>
                    </span>
                    <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-signal transition-[width] duration-500" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                    </span>
                  </Link>
                  {canEdit && total > 0 && (
                    <Button size="sm" variant={finished ? 'outline' : 'default'} disabled={finished} onClick={() => complete(workout)}>
                      <Check aria-hidden />
                      {finished ? 'Completed' : 'Complete workout'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">No workout on this day.</p>
            {canEdit && <StartWorkoutMenuComponent templates={templates} day={day} />}
          </div>
        )}

        <BodyDiagramComponent
          label={`Muscles worked ${describe}`}
          strength={strengthFromLoad(muscleLoad(mapped))}
          groupLabels={['Most worked', 'Also worked']}
          // On extra-large screens the figure fills the card's height, as big as the screen allows, instead of its width.
          className="items-center gap-6 sm:flex-row sm:items-center [&_svg]:max-w-md sm:[&_svg]:w-3/5 xl:min-h-0 xl:flex-1 xl:[&_svg]:h-full xl:[&_svg]:w-auto xl:[&_svg]:max-w-[60%]"
        />
      </div>
    </SectionCardComponent>
  );
}
