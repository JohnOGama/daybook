import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { fitnessExercises, fitnessFoodLogs, fitnessFoodServings, fitnessFoods, fitnessWeights, fitnessWorkouts, spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertFolder, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { FitnessFoodService, FitnessService, FitnessWorkoutService } from '../../fitness/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { FitnessMcpTools } from './fitness-mcp-tools.ts';

const day = '2026-11-21';

describe('FitnessMcpTools', () => {
  let db: Db;
  let tools: FitnessMcpTools;
  let foods: FitnessFoodService;
  let home: string;
  let egg: string;
  let largeEgg: string;

  async function addFood(values: Partial<typeof fitnessFoods.$inferInsert> & { name: string }) {
    const id = randomUUID();
    await db.insert(fitnessFoods).values({ id, kcal: 0, proteinMg: 0, carbsMg: 0, fatMg: 0, fiberMg: 0, ...values });
    return id;
  }

  const logRows = () => db.select().from(fitnessFoodLogs);

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    home = await insertSpace(db, 'u1', { tool: 'fitness', title: 'Home' });
    const fitness = new FitnessService(db);
    foods = new FitnessFoodService(db, fitness);
    tools = new FitnessMcpTools(db, new SpaceAccessService(db), new SpaceLockService(db), fitness, foods, new FitnessWorkoutService(db, fitness));
    egg = await addFood({ name: 'Egg, whole, boiled', kcal: 155, proteinMg: 13_000, carbsMg: 1100, fatMg: 11_000, fiberMg: 0 });
    largeEgg = randomUUID();
    await db.insert(fitnessFoodServings).values({ id: largeEgg, foodId: egg, label: 'large egg', amountMg: 50_000 });
  });

  it('lists Fitness spaces the person can edit, leaving out view-only, locked, trashed and other tools', async () => {
    const shared = await insertSpace(db, 'u2', { tool: 'fitness', title: 'Team' });
    const viewOnly = await insertSpace(db, 'u2', { tool: 'fitness', title: 'Coach' });
    await insertShare(db, { spaceId: shared, ownerId: 'u2', email: 'u1@example.com', role: 'edit' });
    await insertShare(db, { spaceId: viewOnly, ownerId: 'u2', email: 'u1@example.com', role: 'view' });
    await insertSpace(db, 'u1', { tool: 'fitness', title: 'Locked', lockHash: 'hash' });
    await insertSpace(db, 'u1', { tool: 'fitness', title: 'Trashed', deletedAt: new Date() });
    const folder = await insertFolder(db, 'u1');
    await insertSpace(db, 'u1', { tool: 'fitness', title: 'In trashed folder', parentId: folder });
    await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, folder));
    await insertSpace(db, 'u1', { tool: 'budget', title: 'Money' });
    expect(await tools.listSpaces('u1')).toEqual([
      { id: home, title: 'Home', shared: false },
      { id: shared, title: 'Team', shared: true },
    ]);
  });

  it('uses the only Fitness space when none is given, and asks which when there are several', async () => {
    await tools.logWeight('u1', { day, kg: 80 });
    expect((await db.select().from(fitnessWeights))[0].spaceId).toBe(home);
    const gym = await insertSpace(db, 'u1', { tool: 'fitness', title: 'Gym' });
    const asked = tools.logWeight('u1', { day, kg: 80 });
    await expect(asked).rejects.toThrow(`Ask which Fitness space: Gym (${gym}), Home (${home}).`);
  });

  it('says there is nothing to log into when the person has no Fitness space', async () => {
    await expect(tools.logWeight('u2', { day, kg: 80 })).rejects.toThrow("There's no Fitness space you can edit. Create one in Daybook first.");
  });

  it('logs a food by id and grams from its per-100 g numbers', async () => {
    await tools.logFood('u1', { day, meal: 'breakfast', items: [{ foodId: egg, grams: 120 }] });
    expect(await logRows()).toMatchObject([
      { foodId: egg, day, meal: 'breakfast', eaten: true, servingLabel: 'g', quantityMilli: 120_000, amountMg: 120_000, kcal: 186, proteinMg: 15_600, carbsMg: 1320, fatMg: 13_200, fiberMg: 0, userId: 'u1', spaceId: home },
    ]);
  });

  it("logs a number of a food's servings", async () => {
    const result = await tools.logFood('u1', { day, meal: 'breakfast', items: [{ foodId: egg, servingId: largeEgg, servings: 2 }] });
    expect(await logRows()).toMatchObject([{ quantityMilli: 2000, servingLabel: 'large egg', amountMg: 100_000, kcal: 155 }]);
    expect(result.logged).toEqual([{ id: expect.any(String), name: 'Egg, whole, boiled', amount: '2 large egg', kcal: 155 }]);
    expect(result.totals).toEqual({ kcal: 155, proteinG: 13, carbsG: 1.1, fatG: 11, fiberG: 0 });
  });

  it("logs a one-off food from the assistant's estimate without creating a food", async () => {
    const before = (await db.select().from(fitnessFoods)).length;
    await tools.logFood('u1', { day, meal: 'snack', items: [{ name: 'Toast with butter', grams: 40, kcal: 150, proteinG: 4, carbsG: 18, fatG: 7, fiberG: 1.5 }] });
    expect(await logRows()).toMatchObject([
      { foodId: null, name: 'Toast with butter', servingLabel: 'g', quantityMilli: 40_000, amountMg: 40_000, kcal: 150, proteinMg: 4000, carbsMg: 18_000, fatMg: 7000, fiberMg: 1500 },
    ]);
    expect(await db.select().from(fitnessFoods)).toHaveLength(before);
  });

  it('refuses a food id the space cannot see', async () => {
    const elsewhere = await insertSpace(db, 'u1', { tool: 'fitness', title: 'Gym' });
    const theirs = await addFood({ name: 'Protein bar', spaceId: elsewhere, userId: 'u1' });
    const logging = tools.logFood('u1', { spaceId: home, day, meal: 'snack', items: [{ foodId: theirs, grams: 50 }] });
    await expect(logging).rejects.toThrow("That food isn't in this space. Use search_foods first.");
    expect(await logRows()).toEqual([]);
  });

  it("refuses a serving id that is not one of the food's servings", async () => {
    const toast = await addFood({ name: 'Toast' });
    const logging = tools.logFood('u1', { day, meal: 'snack', items: [{ foodId: toast, servingId: largeEgg, servings: 1 }] });
    await expect(logging).rejects.toThrow("That serving isn't one of this food's. Use search_foods to see its servings.");
  });

  it('refuses a view-only shared space and a locked space', async () => {
    const coach = await insertSpace(db, 'u2', { tool: 'fitness', title: 'Coach' });
    await insertShare(db, { spaceId: coach, ownerId: 'u2', email: 'u1@example.com', role: 'view' });
    await expect(tools.logWeight('u1', { spaceId: coach, day, kg: 80 })).rejects.toThrow('You can only view this space.');
    const locked = await insertSpace(db, 'u1', { tool: 'fitness', title: 'Locked', lockHash: 'hash' });
    await expect(tools.logWeight('u1', { spaceId: locked, day, kg: 80 })).rejects.toThrow('This space is locked with a password. Open it in Daybook instead.');
    expect(await db.select().from(fitnessWeights)).toEqual([]);
  });

  it('logs into a shared space the person can edit, under its owner', async () => {
    const team = await insertSpace(db, 'u2', { tool: 'fitness', title: 'Team' });
    await insertShare(db, { spaceId: team, ownerId: 'u2', email: 'u1@example.com', role: 'edit' });
    await tools.logFood('u1', { spaceId: team, day, meal: 'lunch', items: [{ foodId: egg, grams: 50 }] });
    expect(await logRows()).toMatchObject([{ spaceId: team, userId: 'u2' }]);
  });

  it("refuses a space that isn't a Fitness space", async () => {
    const money = await insertSpace(db, 'u1', { tool: 'budget', title: 'Money' });
    for (const spaceId of [money, randomUUID()]) {
      await expect(tools.logWeight('u1', { spaceId, day, kg: 80 })).rejects.toThrow("That Fitness space wasn't found.");
    }
  });

  it("refuses an amount whose numbers are past the app's limits", async () => {
    const oil = await addFood({ name: 'Olive oil', kcal: 900, fatMg: 100_000 });
    await expect(tools.logFood('u1', { day, meal: 'dinner', items: [{ foodId: oil, grams: 20_000 }] })).rejects.toThrow('That amount is too large to log.');
    expect(await logRows()).toEqual([]);
  });

  it("logs a workout with every set done, taking a found exercise's name and muscles, and a named one with none", async () => {
    const bench = randomUUID();
    await db.insert(fitnessExercises).values({ id: bench, name: 'Bench press', kind: 'weight', equipment: 'barbell', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] });
    const result = await tools.logWorkout('u1', {
      day,
      name: 'Push day',
      exercises: [
        { exerciseId: bench, sets: [{ kg: 60, reps: 8 }, { kg: 60, reps: 8 }] },
        { name: 'Plank', sets: [{ seconds: 60 }] },
      ],
    });
    expect(result).toEqual({ id: expect.any(String), name: 'Push day', exercises: 2, sets: 3 });
    const [workout] = await db.select().from(fitnessWorkouts);
    expect(workout).toMatchObject({ day, name: 'Push day', spaceId: home, userId: 'u1' });
    expect(workout.items).toEqual([
      { exerciseId: bench, name: 'Bench press', kind: 'weight', primary: ['chest'], secondary: ['triceps'], sets: [
        { reps: 8, weightG: 60_000, seconds: null, meters: null, done: true },
        { reps: 8, weightG: 60_000, seconds: null, meters: null, done: true },
      ] },
      { exerciseId: null, name: 'Plank', kind: 'time', primary: [], secondary: [], sets: [{ reps: null, weightG: null, seconds: 60, meters: null, done: true }] },
    ]);
  });

  it('logs a named exercise with only meters as a time exercise, so the app shows its distance', async () => {
    await tools.logWorkout('u1', { day, name: 'Run', exercises: [{ name: 'Run', sets: [{ meters: 5000 }] }] });
    const [workout] = await db.select().from(fitnessWorkouts);
    expect(workout.items).toMatchObject([{ name: 'Run', kind: 'time', sets: [{ meters: 5000, seconds: null }] }]);
  });

  it("refuses an exercise id the space can't see", async () => {
    const logging = tools.logWorkout('u1', { day, name: 'Legs', exercises: [{ exerciseId: randomUUID(), sets: [{ reps: 5 }] }] });
    await expect(logging).rejects.toThrow("That exercise isn't in this space. Use search_exercises first.");
  });

  it('gives a day by meal with totals counting eaten rows only, and its workouts', async () => {
    await tools.logFood('u1', { day, meal: 'breakfast', items: [{ foodId: egg, grams: 100 }] });
    await foods.addLogs('u1', home, [
      { id: randomUUID(), day, meal: 'dinner', eaten: false, foodId: null, name: 'Planned pasta', quantityMilli: 1000, servingLabel: 'plate', amountMg: 300_000, kcal: 500, proteinMg: 0, carbsMg: 0, fatMg: 0, fiberMg: 0 },
    ]);
    await tools.logFood('u1', { day: '2026-11-20', meal: 'lunch', items: [{ foodId: egg, grams: 100 }] });
    await tools.logWorkout('u1', { day, name: 'Run', exercises: [{ name: 'Run', sets: [{ meters: 5000, seconds: 1500 }] }] });
    const result = await tools.getDay('u1', { day });
    expect(result.meals.breakfast).toEqual([{ id: expect.any(String), name: 'Egg, whole, boiled', amount: '100 g', kcal: 155, proteinG: 13, carbsG: 1.1, fatG: 11, fiberG: 0, planned: false }]);
    expect(result.meals.dinner).toMatchObject([{ name: 'Planned pasta', amount: '1 plate', planned: true }]);
    expect(result.meals.lunch).toEqual([]);
    expect(result.totals).toEqual({ kcal: 155, proteinG: 13, carbsG: 1.1, fatG: 11, fiberG: 0 });
    expect(result.workouts).toEqual([{ id: expect.any(String), name: 'Run', exercises: [{ name: 'Run', sets: 1 }] }]);
  });

  it("removes a log and a workout, but not another person's", async () => {
    const { logged } = await tools.logFood('u1', { day, meal: 'breakfast', items: [{ foodId: egg, grams: 100 }] });
    const workout = await tools.logWorkout('u1', { day, name: 'Run', exercises: [{ name: 'Run', sets: [{ seconds: 600 }] }] });
    await expect(tools.removeFoodLog('u2', { logId: logged[0].id })).rejects.toThrow("That entry wasn't found.");
    await expect(tools.removeWorkout('u2', { workoutId: workout.id })).rejects.toThrow("That entry wasn't found.");
    expect(await tools.removeFoodLog('u1', { logId: logged[0].id })).toEqual({ removed: 'Egg, whole, boiled' });
    expect(await tools.removeWorkout('u1', { workoutId: workout.id })).toEqual({ removed: 'Run' });
    expect(await logRows()).toEqual([]);
    expect(await db.select().from(fitnessWorkouts)).toEqual([]);
  });

  it('saves a weigh-in in kg', async () => {
    expect(await tools.logWeight('u1', { day, kg: 81.5 })).toEqual({ day, kg: 81.5 });
    expect(await db.select().from(fitnessWeights)).toMatchObject([{ day, weightG: 81_500, spaceId: home, userId: 'u1' }]);
  });

  it('searches foods and exercises, giving per-100 g numbers in grams', async () => {
    await db.insert(fitnessExercises).values({ id: randomUUID(), name: 'Bench press', kind: 'weight', equipment: null, primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] });
    expect(await tools.searchFoods('u1', { query: 'egg' })).toEqual({
      spaceId: home,
      foods: [{ id: egg, name: 'Egg, whole, boiled', per100g: { kcal: 155, proteinG: 13, carbsG: 1.1, fatG: 11, fiberG: 0 }, servings: [{ id: largeEgg, label: 'large egg', grams: 50 }] }],
    });
    expect(await tools.searchExercises('u1', { query: 'bench' })).toEqual({
      spaceId: home,
      exercises: [{ id: expect.any(String), name: 'Bench press', kind: 'weight', muscles: ['chest', 'triceps'] }],
    });
  });
});
