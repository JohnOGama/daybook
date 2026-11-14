import type { ExerciseKind, Workout, WorkoutItem, WorkoutSet, WorkoutTemplate } from './fitness-types';
import { type Muscle, MUSCLES } from './muscles';

const copyItems = (items: WorkoutItem[]): WorkoutItem[] =>
  items.map((item) => ({ ...item, primary: [...item.primary], secondary: [...item.secondary], sets: item.sets.map((set) => ({ ...set, done: false })) }));

// A workout keeps its own copy, so editing the template later never changes a day already trained.
export const workoutFromTemplate = (template: WorkoutTemplate, day: string, id: string): Workout => ({ id, day, name: template.name, items: copyItems(template.items) });
export const templateFromWorkout = (name: string, workout: Workout, id: string): WorkoutTemplate => ({ id, name, items: copyItems(workout.items) });

// Built-in and custom exercises match on their id; one typed in by hand matches on its name.
const sameExercise = (a: Pick<WorkoutItem, 'exerciseId' | 'name'>, b: Pick<WorkoutItem, 'exerciseId' | 'name'>) =>
  a.exerciseId !== null || b.exerciseId !== null ? a.exerciseId === b.exerciseId : a.name === b.name;

// The sets actually done in the latest earlier workout that has any for this exercise.
export function lastTime(item: Pick<WorkoutItem, 'exerciseId' | 'name'>, before: string, workouts: Workout[]): { day: string; sets: WorkoutSet[] } | null {
  const earlier = workouts.filter((workout) => workout.day < before).sort((a, b) => b.day.localeCompare(a.day));
  for (const workout of earlier) {
    const sets = workout.items.filter((other) => sameExercise(item, other)).flatMap((other) => other.sets.filter((set) => set.done));
    if (sets.length > 0) return { day: workout.day, sets };
  }
  return null;
}

// Done sets per muscle: a full set for a primary muscle, half for a secondary one.
export function muscleLoad(workouts: Workout[]): Record<Muscle, number> {
  const load = Object.fromEntries(MUSCLES.map((muscle) => [muscle, 0])) as Record<Muscle, number>;
  for (const item of workouts.flatMap((workout) => workout.items)) {
    const done = item.sets.filter((set) => set.done).length;
    for (const muscle of item.primary) load[muscle] += done;
    for (const muscle of item.secondary) load[muscle] += done / 2;
  }
  return load;
}

export function musclesOf(items: Pick<WorkoutItem, 'primary' | 'secondary'>[]): { primary: Muscle[]; secondary: Muscle[] } {
  const primary = new Set(items.flatMap((item) => item.primary));
  const secondary = new Set(items.flatMap((item) => item.secondary));
  return { primary: MUSCLES.filter((muscle) => primary.has(muscle)), secondary: MUSCLES.filter((muscle) => secondary.has(muscle) && !primary.has(muscle)) };
}

export function setsDone(workout: Workout): { done: number; total: number } {
  const sets = workout.items.flatMap((item) => item.sets);
  return { done: sets.filter((set) => set.done).length, total: sets.length };
}

const trim = (value: number, digits: number) => Number(value.toFixed(digits));

function formatSet(set: WorkoutSet, kind: ExerciseKind): string {
  if (kind === 'time') {
    const parts = [set.seconds === null ? null : `${trim(set.seconds / 60, 1)} min`, set.meters === null ? null : `${trim(set.meters / 1000, 2)} km`];
    return parts.filter(Boolean).join(', ') || '—';
  }
  const reps = set.reps === null ? '—' : String(set.reps);
  return kind === 'weight' && set.weightG !== null ? `${reps} at ${trim(set.weightG / 1000, 2)} kg` : reps;
}

// "3 × 8 at 60 kg" when every set is the same, otherwise each set in turn.
export function formatSets(sets: WorkoutSet[], kind: ExerciseKind): string {
  if (sets.length === 0) return 'No sets';
  const written = sets.map((set) => formatSet(set, kind));
  return sets.length > 1 && written.every((text) => text === written[0]) ? `${sets.length} × ${written[0]}` : written.join(', ');
}
