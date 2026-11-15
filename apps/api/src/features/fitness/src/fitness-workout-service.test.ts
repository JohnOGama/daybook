import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { fitnessExercises, spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { exerciseSchema, templateSchema, workoutSchema } from './fitness-schemas.ts';
import { FitnessService } from './fitness-service.ts';
import { FitnessWorkoutService } from './fitness-workout-service.ts';

const set = (done = false) => ({ reps: 8, weightG: 60_000, seconds: null, meters: null, done });
const bench = (sets = [set(), set()]) => ({
  exerciseId: null,
  name: 'Bench press',
  kind: 'weight' as const,
  primary: ['chest' as const],
  secondary: ['triceps' as const, 'shoulders' as const],
  sets,
});

describe('FitnessWorkoutService', () => {
  let db: Db;
  let svc: FitnessWorkoutService;
  let fitness: FitnessService;
  let space: string;
  let theirs: string;

  const addSpace = async (userId: string) => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'Body', tool: 'fitness' }).returning();
    return row.id;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    fitness = new FitnessService(db);
    svc = new FitnessWorkoutService(db, fitness);
    space = await addSpace('u1');
    theirs = await addSpace('u2');
    await db.insert(fitnessExercises).values({ name: 'Squat', kind: 'weight', equipment: 'barbell', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'] });
  });

  it('lists built-in exercises for everyone and custom ones only in their own space', async () => {
    const mine = { id: crypto.randomUUID(), spaceId: space, name: 'Band pull', kind: 'reps' as const, equipment: null, primary: ['lats' as const], secondary: [] };
    await svc.createExercise('u1', mine);
    expect(await svc.listExercises('u1', space)).toMatchObject([
      { name: 'Band pull', kind: 'reps', primary: ['lats'], secondary: [], custom: true },
      { name: 'Squat', kind: 'weight', equipment: 'barbell', primary: ['quads'], secondary: ['glutes'], custom: false },
    ]);
    expect((await svc.listExercises('u2', theirs)).map((exercise) => exercise.name)).toEqual(['Squat']);
    await expect(svc.listExercises('u1', theirs)).rejects.toThrow(NotFoundException);
  });

  it('lets a custom exercise be edited and deleted, but never a built-in one', async () => {
    const mine = { id: crypto.randomUUID(), spaceId: space, name: 'Band pull', kind: 'reps' as const, equipment: null, primary: ['lats' as const], secondary: [] };
    await svc.createExercise('u1', mine);
    const squat = (await svc.listExercises('u1', space)).find((exercise) => !exercise.custom)!;
    const changes = { name: 'Band pull-apart', kind: 'reps' as const, equipment: 'band', primary: ['middleBack' as const], secondary: ['shoulders' as const] };
    await svc.updateExercise('u1', mine.id, changes);
    expect((await svc.listExercises('u1', space))[0]).toMatchObject({ ...changes, custom: true });
    await expect(svc.updateExercise('u2', mine.id, changes)).rejects.toThrow(NotFoundException);
    await expect(svc.updateExercise('u1', squat.id, changes)).rejects.toThrow(NotFoundException);
    await expect(svc.removeExercise('u1', squat.id)).rejects.toThrow(NotFoundException);
    await svc.removeExercise('u1', mine.id);
    expect(await svc.listExercises('u1', space)).toHaveLength(1);
  });

  it('refuses a muscle outside the seventeen and an unknown kind', () => {
    const exercise = { name: 'Curl', kind: 'weight', equipment: null, primary: ['biceps'], secondary: ['forearms'] };
    expect(exerciseSchema.safeParse(exercise).success).toBe(true);
    expect(exerciseSchema.safeParse({ ...exercise, primary: ['wings'] }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...exercise, kind: 'vibes' }).success).toBe(false);
  });

  it('keeps a workout made from a template unchanged when the template is edited or deleted', async () => {
    const template = { id: crypto.randomUUID(), spaceId: space, name: 'Push day', items: [bench()] };
    await svc.createTemplate('u1', template);
    expect((await fitness.load('u1', space)).templates).toEqual([{ id: template.id, name: 'Push day', items: [bench()], version: 0 }]);
    const workout = { id: crypto.randomUUID(), spaceId: space, day: '2026-11-13', name: 'Push day', items: [bench([set(true), set()])] };
    await svc.createWorkout('u1', workout);
    expect(await svc.saveTemplate('u1', template.id, { name: 'Push', items: [bench([set()])], version: 0 })).toEqual({ version: 1 });
    await expect(svc.saveTemplate('u1', template.id, { name: 'Stale', items: [bench()], version: 0 })).rejects.toThrow(ConflictException);
    expect((await fitness.load('u1', space)).templates).toMatchObject([{ name: 'Push', version: 1 }]);
    await expect(svc.saveTemplate('u2', template.id, { name: 'x', items: [bench()], version: 1 })).rejects.toThrow(NotFoundException);
    await svc.removeTemplate('u1', template.id);
    expect((await fitness.load('u1', space)).templates).toEqual([]);
    expect(await svc.workouts('u1', space, '2026-11-13', '2026-11-13')).toEqual([{ id: workout.id, day: '2026-11-13', name: 'Push day', items: workout.items, version: 0 }]);
  });

  it('saves a whole workout, lists workouts by day range, and deletes for the owner only', async () => {
    const workout = { id: crypto.randomUUID(), spaceId: space, day: '2026-11-13', name: 'Push day', items: [bench()] };
    await svc.createWorkout('u1', workout);
    expect(await svc.saveWorkout('u1', workout.id, { day: '2026-11-13', name: 'Push', items: [bench([set(true)])], version: 0 })).toEqual({ version: 1 });
    await expect(svc.saveWorkout('u1', workout.id, { day: '2026-11-13', name: 'Stale', items: [], version: 0 })).rejects.toThrow(ConflictException);
    expect(await svc.workouts('u1', space, '2026-11-01', '2026-11-30')).toMatchObject([{ name: 'Push', items: [{ sets: [{ done: true }] }], version: 1 }]);
    expect(await svc.workouts('u1', space, '2026-11-14', '2026-11-30')).toEqual([]);
    await expect(svc.saveWorkout('u2', workout.id, { day: '2026-11-13', name: 'x', items: [], version: 1 })).rejects.toThrow(NotFoundException);
    await expect(svc.removeWorkout('u2', workout.id)).rejects.toThrow(NotFoundException);
    await expect(svc.createWorkout('u1', { ...workout, id: crypto.randomUUID(), spaceId: theirs })).rejects.toThrow(NotFoundException);
    await expect(svc.createTemplate('u1', { id: crypto.randomUUID(), spaceId: theirs, name: 'x', items: [bench()] })).rejects.toThrow(NotFoundException);
    await svc.removeWorkout('u1', workout.id);
    expect(await svc.workouts('u1', space, '2026-11-01', '2026-11-30')).toEqual([]);
  });

  it('refuses oversized workouts and templates', () => {
    expect(workoutSchema.safeParse({ day: '2026-11-13', name: 'Push', items: [bench()] }).success).toBe(true);
    expect(workoutSchema.safeParse({ day: '2026-11-13', name: 'Push', items: Array.from({ length: 61 }, () => bench()) }).success).toBe(false);
    expect(workoutSchema.safeParse({ day: '2026-11-13', name: 'Push', items: [bench(Array.from({ length: 31 }, () => set()))] }).success).toBe(false);
    expect(workoutSchema.safeParse({ day: '2026-11-13', name: 'Push', items: [bench([{ ...set(), reps: -1 }])] }).success).toBe(false);
    expect(templateSchema.safeParse({ name: 'Empty', items: [] }).success).toBe(false);
  });
});
