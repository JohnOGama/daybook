import { isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../../shared/db/create-db.ts';
import { fitnessExercises } from '../../../shared/db/schema.ts';
import { type ExerciseInput, MUSCLES } from './fitness-schemas.ts';

type Muscle = (typeof MUSCLES)[number];

// The dataset's muscle names that differ from ours; the rest match.
const RENAMED: Record<string, Muscle> = { abdominals: 'abs', quadriceps: 'quads', 'middle back': 'middleBack', 'lower back': 'lowerBack' };
const TIMED_CATEGORIES = ['cardio', 'stretching'];

const datasetSchema = z.array(
  z.object({
    name: z.string().min(1),
    category: z.string().nullish(),
    equipment: z.string().nullish(),
    primaryMuscles: z.array(z.string()).default([]),
    secondaryMuscles: z.array(z.string()).default([]),
  }),
);

const musclesFrom = (names: string[]) => names.map((name) => RENAMED[name] ?? name).filter((name): name is Muscle => (MUSCLES as readonly string[]).includes(name));

// Reads free-exercise-db's exercises.json (public domain). Names, muscles and equipment only.
export function exercisesFromDataset(json: unknown): ExerciseInput[] {
  const seen = new Set<string>();
  return datasetSchema.parse(json).flatMap(({ name, category, equipment, primaryMuscles, secondaryMuscles }) => {
    const title = name.trim().slice(0, 80);
    if (seen.has(title)) return [];
    seen.add(title);
    const kind = TIMED_CATEGORIES.includes(category ?? '') ? 'time' : equipment === 'body only' ? 'reps' : 'weight';
    return [{ name: title, kind, equipment: equipment ?? null, primary: musclesFrom(primaryMuscles), secondary: musclesFrom(secondaryMuscles) } as const];
  });
}

// Safe to run again: built-in exercises are matched on their name.
export async function saveBuiltInExercises(db: Db, exercises: ExerciseInput[]): Promise<void> {
  if (exercises.length === 0) return;
  await db
    .insert(fitnessExercises)
    .values(exercises.map(({ name, kind, equipment, primary, secondary }) => ({ name, kind, equipment, primaryMuscles: primary, secondaryMuscles: secondary })))
    .onConflictDoUpdate({
      target: fitnessExercises.name,
      targetWhere: isNull(fitnessExercises.spaceId),
      set: { kind: sql`excluded.kind`, equipment: sql`excluded.equipment`, primaryMuscles: sql`excluded.primary_muscles`, secondaryMuscles: sql`excluded.secondary_muscles` },
    });
}
