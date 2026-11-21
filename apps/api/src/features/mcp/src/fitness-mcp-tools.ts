import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { fitnessFoodLogs, fitnessWorkouts, spaces } from '../../../shared/db/schema.ts';
import {
  type FoodDto,
  FitnessFoodService,
  FitnessService,
  FitnessWorkoutService,
  type LogInput,
  type WorkoutInput,
  foodItemFields,
  workoutSchema,
} from '../../fitness/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { GRAMS, formatAmount, grams, itemForFood, oneOffItem, totalsOf } from './food-amounts.ts';
import type { DayInput, FoodItemInput, LogFoodInput, LogWeightInput, LogWorkoutInput, SearchInput, WorkoutExerciseInput } from './mcp-schemas.ts';

// A problem the assistant should read and act on, sent back as a tool error rather than an HTTP error.
export class ToolError extends Error {}

type Space = { spaceId: string; ownerId: string };
type Meal = LogInput['meal'];
type WorkoutItem = WorkoutInput['items'][number];

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const SEARCH_LIMIT = 30;
const foodItemSchema = z.object(foodItemFields);

const NOT_FOUND = "That Fitness space wasn't found.";
const ENTRY_NOT_FOUND = "That entry wasn't found.";
const VIEW_ONLY = 'You can only view this space.';
const LOCKED = 'This space is locked with a password. Open it in Daybook instead.';

const viewOnlyOr = (message: string) => (error: unknown) => {
  throw new ToolError(error instanceof ForbiddenException ? VIEW_ONLY : message);
};

function kindOf({ sets }: WorkoutExerciseInput): WorkoutItem['kind'] {
  if (sets.some((set) => set.kg !== undefined)) return 'weight';
  if (sets.some((set) => set.seconds !== undefined || set.meters !== undefined)) return 'time';
  return 'reps';
}

// The Fitness tools AI apps call over MCP. Each acts as the person who approved the app, with the same access
// and lock rules as the browser, and writes under the space's owner like the app's own routes.
@Injectable()
export class FitnessMcpTools {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(FitnessService) private readonly fitness: FitnessService,
    @Inject(FitnessFoodService) private readonly foods: FitnessFoodService,
    @Inject(FitnessWorkoutService) private readonly training: FitnessWorkoutService,
  ) {}

  async listSpaces(userId: string): Promise<{ id: string; title: string; shared: boolean }[]> {
    const parent = alias(spaces, 'parent');
    const own = await this.db
      .select({ id: spaces.id, title: spaces.title })
      .from(spaces)
      .leftJoin(parent, eq(parent.id, spaces.parentId))
      .where(
        and(
          eq(spaces.userId, userId),
          eq(spaces.tool, 'fitness'),
          isNull(spaces.deletedAt),
          isNull(spaces.lockHash),
          or(isNull(spaces.parentId), isNull(parent.deletedAt)),
        ),
      )
      .orderBy(asc(spaces.title));
    const shared = (await this.access.sharedWith(userId)).filter(({ row, access }) => row.tool === 'fitness' && access === 'edit' && !row.lockHash);
    return [
      ...own.map((space) => ({ ...space, shared: false })),
      ...shared.map(({ row }) => ({ id: row.id, title: row.title, shared: true })),
    ];
  }

  async searchFoods(userId: string, { spaceId, query }: SearchInput) {
    const space = await this.space(userId, spaceId);
    const found = await this.foods.searchFoods(space.ownerId, space.spaceId, query);
    return {
      spaceId: space.spaceId,
      foods: found.map((food) => ({
        id: food.id,
        name: food.name,
        per100g: { kcal: food.kcal, proteinG: grams(food.proteinMg), carbsG: grams(food.carbsMg), fatG: grams(food.fatMg), fiberG: grams(food.fiberMg) },
        servings: food.servings.map(({ id, label, amountMg }) => ({ id, label, grams: grams(amountMg) })),
      })),
    };
  }

  async logFood(userId: string, { spaceId, day, meal, items }: LogFoodInput) {
    const space = await this.space(userId, spaceId);
    const ids = items.flatMap((item) => ('foodId' in item ? [item.foodId] : []));
    const known = new Map((await this.foods.foodsById(space.spaceId, ids)).map((food) => [food.id, food]));
    const logs: LogInput[] = items.map((item) => ({ id: randomUUID(), day, meal, eaten: true, ...this.itemFor(item, known) }));
    await this.foods.addLogs(space.ownerId, space.spaceId, logs);
    return {
      logged: logs.map((log) => ({ id: log.id, name: log.name, amount: formatAmount(log), kcal: log.kcal })),
      totals: await this.dayTotals(space, day),
    };
  }

  async searchExercises(userId: string, { spaceId, query }: SearchInput) {
    const space = await this.space(userId, spaceId);
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    // ponytail: filters the full exercise list in memory; fine for the ~900 built-in exercises.
    const all = await this.training.listExercises(space.ownerId, space.spaceId);
    const matches = all.filter(({ name }) => words.every((word) => name.toLowerCase().includes(word))).slice(0, SEARCH_LIMIT);
    return {
      spaceId: space.spaceId,
      exercises: matches.map(({ id, name, kind, primary, secondary }) => ({ id, name, kind, muscles: [...primary, ...secondary] })),
    };
  }

  async logWorkout(userId: string, { spaceId, day, name, exercises }: LogWorkoutInput) {
    const space = await this.space(userId, spaceId);
    const known = new Map((await this.training.listExercises(space.ownerId, space.spaceId)).map((exercise) => [exercise.id, exercise]));
    const items: WorkoutItem[] = exercises.map((exercise) => {
      const sets = exercise.sets.map((set) => ({
        reps: set.reps ?? null,
        weightG: set.kg === undefined ? null : Math.round(set.kg * 1000),
        seconds: set.seconds ?? null,
        meters: set.meters === undefined ? null : Math.round(set.meters),
        done: true,
      }));
      if (!exercise.exerciseId) return { exerciseId: null, name: exercise.name as string, kind: kindOf(exercise), primary: [], secondary: [], sets };
      const found = known.get(exercise.exerciseId);
      if (!found) throw new ToolError("That exercise isn't in this space. Use search_exercises first.");
      return { exerciseId: found.id, name: found.name, kind: found.kind, primary: found.primary, secondary: found.secondary, sets };
    });
    const workout = workoutSchema.safeParse({ day, name, items });
    if (!workout.success) throw new ToolError('That workout is too large to log.');
    const id = randomUUID();
    await this.training.createWorkout(space.ownerId, { ...workout.data, id, spaceId: space.spaceId });
    return { id, name: workout.data.name, exercises: items.length, sets: items.reduce((total, item) => total + item.sets.length, 0) };
  }

  async getDay(userId: string, { spaceId, day }: DayInput) {
    const space = await this.space(userId, spaceId);
    const [logs, workouts] = await Promise.all([
      this.foods.logs(space.ownerId, space.spaceId, day, day),
      this.training.workouts(space.ownerId, space.spaceId, day, day),
    ]);
    const meals = Object.fromEntries(MEALS.map((meal) => [meal, [] as unknown[]])) as Record<Meal, unknown[]>;
    for (const log of logs) {
      meals[log.meal].push({
        id: log.id,
        name: log.name,
        amount: formatAmount(log),
        kcal: log.kcal,
        proteinG: grams(log.proteinMg),
        carbsG: grams(log.carbsMg),
        fatG: grams(log.fatMg),
        fiberG: grams(log.fiberMg),
        planned: !log.eaten,
      });
    }
    return {
      day,
      meals,
      totals: totalsOf(logs.filter((log) => log.eaten)),
      workouts: workouts.map(({ id, name, items }) => ({ id, name, exercises: items.map((item) => ({ name: item.name, sets: item.sets.length })) })),
    };
  }

  async removeFoodLog(userId: string, { logId }: { logId: string }) {
    const { ownerId, spaceId } = await this.access.resolveRow(userId, fitnessFoodLogs, logId, 'edit').catch(viewOnlyOr(ENTRY_NOT_FOUND));
    await this.assertOpen(userId, spaceId);
    const [log] = await this.db.select({ name: fitnessFoodLogs.name }).from(fitnessFoodLogs).where(eq(fitnessFoodLogs.id, logId));
    await this.foods.removeLog(ownerId, logId).catch(viewOnlyOr(ENTRY_NOT_FOUND));
    return { removed: log.name };
  }

  async removeWorkout(userId: string, { workoutId }: { workoutId: string }) {
    const { ownerId, spaceId } = await this.access.resolveRow(userId, fitnessWorkouts, workoutId, 'edit').catch(viewOnlyOr(ENTRY_NOT_FOUND));
    await this.assertOpen(userId, spaceId);
    const [workout] = await this.db.select({ name: fitnessWorkouts.name }).from(fitnessWorkouts).where(eq(fitnessWorkouts.id, workoutId));
    await this.training.removeWorkout(ownerId, workoutId).catch(viewOnlyOr(ENTRY_NOT_FOUND));
    return { removed: workout.name };
  }

  async logWeight(userId: string, { spaceId, day, kg }: LogWeightInput) {
    const space = await this.space(userId, spaceId);
    await this.fitness.saveWeight(space.ownerId, space.spaceId, day, Math.round(kg * 1000));
    return { day, kg };
  }

  private itemFor(item: FoodItemInput, known: Map<string, FoodDto>) {
    let built;
    if ('foodId' in item) {
      const food = known.get(item.foodId);
      if (!food) throw new ToolError("That food isn't in this space. Use search_foods first.");
      if ('servingId' in item) {
        const serving = food.servings.find(({ id }) => id === item.servingId);
        if (!serving) throw new ToolError("That serving isn't one of this food's. Use search_foods to see its servings.");
        built = itemForFood(food, item.servings, serving);
      } else {
        built = itemForFood(food, item.grams, GRAMS);
      }
    } else {
      built = oneOffItem(item);
    }
    const checked = foodItemSchema.safeParse(built);
    if (!checked.success) throw new ToolError('That amount is too large to log.');
    return checked.data;
  }

  private async dayTotals(space: Space, day: string) {
    const logs = await this.foods.logs(space.ownerId, space.spaceId, day, day);
    return totalsOf(logs.filter((log) => log.eaten));
  }

  // The space a tool acts on: the one given, or the person's only editable Fitness space.
  private async space(userId: string, spaceId: string | undefined): Promise<Space> {
    if (!spaceId) {
      const choices = await this.listSpaces(userId);
      if (choices.length === 0) throw new ToolError("There's no Fitness space you can edit. Create one in Daybook first.");
      if (choices.length > 1) throw new ToolError(`Ask which Fitness space: ${choices.map(({ id, title }) => `${title} (${id})`).join(', ')}.`);
      spaceId = choices[0].id;
    }
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit').catch(viewOnlyOr(NOT_FOUND));
    await this.fitness.assertSpace(ownerId, spaceId).catch(viewOnlyOr(NOT_FOUND));
    await this.assertOpen(userId, spaceId);
    return { spaceId, ownerId };
  }

  // MCP requests carry no unlock cookie, so a password-locked space is out of reach.
  private async assertOpen(userId: string, spaceId: string): Promise<void> {
    if (!(await this.lock.isOpen(userId, spaceId, undefined))) throw new ToolError(LOCKED);
  }
}
