'use client';

import { Dumbbell } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from 'skullet/react';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { addDays, relativeDayLabel } from '@/shared/utils/date-formatter';
import { useFitnessDays } from '../hooks/useFitnessDays';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { DaySwitcherComponent } from './DaySwitcherComponent';
import type { FitnessViewProps, Workout, WorkoutTemplate } from './fitness-types';
import { setsDone, workoutFromTemplate } from './workout-math';
import { WorkoutEditorComponent } from './WorkoutEditorComponent';
import { WorkoutReadOnlyComponent } from './WorkoutReadOnlyComponent';

// Far enough back to find "last time" for most exercises and to list recent workouts.
const HISTORY_DAYS = 90;
const PAST_SHOWN = 15;

const SAMPLE_WORKOUT: Workout = {
  id: 'sample',
  day: '',
  name: 'Push day',
  items: ['Bench press', 'Overhead press'].map((name) => ({
    exerciseId: null,
    name,
    kind: 'weight',
    primary: ['chest'],
    secondary: ['triceps'],
    sets: [1, 2, 3].map(() => ({ reps: 8, weightG: 60_000, seconds: null, meters: null, done: false })),
  })),
};

type StartWorkoutMenuProps = { templates: WorkoutTemplate[]; day: string; disabled?: boolean };

// Starting a workout copies the template onto the day; nothing in it counts until its sets are ticked.
export function StartWorkoutMenuComponent({ templates, day, disabled }: StartWorkoutMenuProps) {
  const { addWorkout } = useFitnessMutations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Dumbbell aria-hidden />
          Start workout
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {templates.map((template) => (
          <DropdownMenuItem key={template.id} onSelect={() => addWorkout.mutate(workoutFromTemplate(template, day, crypto.randomUUID()))}>
            From “{template.name}”
          </DropdownMenuItem>
        ))}
        {templates.length === 0 && <DropdownMenuItem disabled>No templates yet. Make one in Library.</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => addWorkout.mutate({ id: crypto.randomUUID(), day, name: 'Workout', items: [] })}>Empty workout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FitnessWorkoutsComponent({ fitness, today, day, hrefFor, canEdit = true }: FitnessViewProps) {
  const { data, isPending, isError } = useFitnessDays(addDays(day, -HISTORY_DAYS), day);
  const history = data?.workouts ?? [];
  const onDay = isPending ? [{ ...SAMPLE_WORKOUT, day }] : history.filter((workout) => workout.day === day);
  const past = history
    .filter((workout) => workout.day < day)
    .reverse()
    .slice(0, PAST_SHOWN);

  return (
    <div className="flex flex-col gap-4">
      <DaySwitcherComponent day={day} today={today} hrefFor={hrefFor}>
        {canEdit && <StartWorkoutMenuComponent templates={fitness.templates} day={day} disabled={isPending} />}
      </DaySwitcherComponent>

      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Could not load your workouts. Please try again.
        </p>
      )}

      <Skeleton loading={isPending} label="Loading workouts">
        <div className="flex flex-col gap-4">
          {onDay.map((workout) => (
            <SectionCardComponent key={workout.id} title={workout.name}>
              {canEdit ? <WorkoutEditorComponent workout={workout} history={history} /> : <WorkoutReadOnlyComponent workout={workout} />}
            </SectionCardComponent>
          ))}
        </div>
      </Skeleton>

      {!isPending && !isError && onDay.length === 0 && (
        <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No workout on {relativeDayLabel(day, today).toLowerCase()}.{canEdit && ' Start one from a template, or an empty one, with “Start workout”.'}
        </p>
      )}

      {past.length > 0 && (
        <SectionCardComponent title="Earlier workouts">
          <ul className="px-2 pb-2">
            {past.map((workout) => {
              const { done, total } = setsDone(workout);
              return (
                <li key={workout.id}>
                  <Link
                    href={hrefFor({ view: 'workouts', day: workout.day })}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{workout.name}</span>
                      <span className="text-muted-foreground"> · {relativeDayLabel(workout.day, today)}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {done} of {total} sets
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCardComponent>
      )}
    </div>
  );
}
