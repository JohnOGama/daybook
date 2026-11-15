'use client';

import { BodyDiagramComponent, strengthFromMuscles } from './BodyDiagramComponent';
import type { Workout } from './fitness-types';
import { formatSets, musclesOf, setsDone } from './workout-math';

// A workout as plain text and the muscle diagram, for someone who can look but not change it.
export function WorkoutReadOnlyComponent({ workout }: { workout: Workout }) {
  const { done, total } = setsDone(workout);
  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <p className="text-sm text-muted-foreground tabular-nums">
        {done} of {total} sets done
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-3">
          {workout.items.map((item, index) => (
            <section key={index} aria-label={item.name} className="rounded-lg border p-3">
              <h4 className="text-sm font-semibold">{item.name}</h4>
              <p className="text-xs text-muted-foreground tabular-nums">{formatSets(item.sets, item.kind) || 'No sets'}</p>
            </section>
          ))}
        </div>
        <BodyDiagramComponent label={`Muscles worked by ${workout.name}`} strength={strengthFromMuscles(musclesOf(workout.items))} />
      </div>
    </div>
  );
}
