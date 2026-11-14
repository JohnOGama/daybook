import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fitnessExercises, spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { exercisesFromDataset, saveBuiltInExercises } from './exercise-import.ts';
import { exerciseSchema } from './fitness-schemas.ts';

it('maps the dataset’s muscles, equipment and category onto exercises', () => {
  const dataset = [
    { name: 'Barbell Squat', category: 'strength', equipment: 'barbell', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'lower back', 'wings'] },
    { name: 'Crunches', category: 'strength', equipment: 'body only', primaryMuscles: ['abdominals'], secondaryMuscles: [] },
    { name: 'Running, Treadmill', category: 'cardio', equipment: 'machine', primaryMuscles: ['quadriceps'], secondaryMuscles: ['calves', 'middle back'] },
    { name: 'Hamstring Stretch', category: 'stretching', equipment: null, primaryMuscles: ['hamstrings'], secondaryMuscles: [] },
    { name: 'Crunches', category: 'strength', equipment: 'body only', primaryMuscles: ['abdominals'], secondaryMuscles: [] },
  ];
  expect(exercisesFromDataset(dataset)).toEqual([
    { name: 'Barbell Squat', kind: 'weight', equipment: 'barbell', primary: ['quads'], secondary: ['glutes', 'lowerBack'] },
    { name: 'Crunches', kind: 'reps', equipment: 'body only', primary: ['abs'], secondary: [] },
    { name: 'Running, Treadmill', kind: 'time', equipment: 'machine', primary: ['quads'], secondary: ['calves', 'middleBack'] },
    { name: 'Hamstring Stretch', kind: 'time', equipment: null, primary: ['hamstrings'], secondary: [] },
  ]);
});

it('refuses a file that is not the exercise dataset', () => {
  expect(() => exercisesFromDataset({ exercises: [] })).toThrow();
});

it('saves built-in exercises once however often the import runs, beside a custom one of the same name', async () => {
  const db = await createTestDb();
  await insertUser(db, 'u1');
  const [space] = await db.insert(spaces).values({ userId: 'u1', kind: 'space', title: 'Body', tool: 'fitness' }).returning();
  await db.insert(fitnessExercises).values({ spaceId: space.id, userId: 'u1', name: 'Squat', kind: 'reps', primaryMuscles: [], secondaryMuscles: [] });
  const squat = { name: 'Squat', kind: 'weight' as const, equipment: 'barbell', primary: ['quads' as const], secondary: [] };
  await saveBuiltInExercises(db, [squat]);
  await saveBuiltInExercises(db, [{ ...squat, equipment: 'machine' }]);
  const rows = await db.select().from(fitnessExercises);
  expect(rows.map(({ kind, equipment, spaceId }) => ({ kind, equipment, custom: spaceId !== null })).sort((a, b) => a.kind.localeCompare(b.kind))).toEqual([
    { kind: 'reps', equipment: null, custom: true },
    { kind: 'weight', equipment: 'machine', custom: false },
  ]);
});

it('ships a bundled list in which every exercise is valid and named once', async () => {
  const bundled: unknown[] = JSON.parse(await readFile(new URL('../data/exercises.json', import.meta.url), 'utf8'));
  expect(bundled.length).toBeGreaterThan(500);
  expect(bundled.every((exercise) => exerciseSchema.safeParse(exercise).success)).toBe(true);
  expect(new Set(bundled.map((exercise) => (exercise as { name: string }).name)).size).toBe(bundled.length);
});
