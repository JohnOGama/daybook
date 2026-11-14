import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, between, desc, eq, ilike, inArray, isNotNull, isNull, max, or, sql } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { fitnessFoodLogs, fitnessFoodServings, fitnessFoods } from '../../../shared/db/schema.ts';
import type { FoodInput, LogChanges, LogInput, NewFoodInput, NewServingInput } from './fitness-schemas.ts';
import { FitnessService } from './fitness-service.ts';

type FoodRow = typeof fitnessFoods.$inferSelect;

export type ServingDto = { id: string; label: string; amountMg: number; custom: boolean };
export type FoodDto = Pick<FoodRow, 'id' | 'name' | 'category' | 'kcal' | 'proteinMg' | 'carbsMg' | 'fatMg' | 'fiberMg'> & {
  custom: boolean;
  servings: ServingDto[];
};

const SEARCH_LIMIT = 30;
const SEARCH_WORDS = 6;
const RECENT_FOODS = 20;

// Makes %, _ and \ in typed text match themselves in a LIKE pattern.
const likeWord = (word: string) => `%${word.replace(/[\\%_]/g, '\\$&')}%`;

@Injectable()
export class FitnessFoodService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(FitnessService) private readonly fitness: FitnessService,
  ) {}

  // Every word must appear in the name. The space's own foods come first, then shorter names.
  async searchFoods(userId: string, spaceId: string, q: string): Promise<FoodDto[]> {
    await this.fitness.assertSpace(userId, spaceId);
    const words = q.trim().split(/\s+/).filter(Boolean).slice(0, SEARCH_WORDS);
    if (words.length === 0) return [];
    const rows = await this.db
      .select()
      .from(fitnessFoods)
      .where(and(this.visibleIn(fitnessFoods.spaceId, spaceId), ...words.map((word) => ilike(fitnessFoods.name, likeWord(word)))))
      .orderBy(sql`${fitnessFoods.spaceId} IS NULL`, sql`length(${fitnessFoods.name})`, asc(fitnessFoods.name))
      .limit(SEARCH_LIMIT);
    return this.withServings(rows, spaceId);
  }

  async customFoods(userId: string, spaceId: string): Promise<FoodDto[]> {
    await this.fitness.assertSpace(userId, spaceId);
    const rows = await this.db.select().from(fitnessFoods).where(eq(fitnessFoods.spaceId, spaceId)).orderBy(asc(fitnessFoods.name));
    return this.withServings(rows, spaceId);
  }

  // The given foods that this space may see, in the order asked for.
  async foodsById(spaceId: string, ids: string[]): Promise<FoodDto[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(fitnessFoods)
      .where(and(inArray(fitnessFoods.id, ids), this.visibleIn(fitnessFoods.spaceId, spaceId)));
    const foods = new Map((await this.withServings(rows, spaceId)).map((food) => [food.id, food]));
    return ids.flatMap((id) => foods.get(id) ?? []);
  }

  async createFood(userId: string, { servings, ...food }: NewFoodInput): Promise<void> {
    await this.fitness.assertSpace(userId, food.spaceId);
    await this.db.transaction(async (tx) => {
      await tx.insert(fitnessFoods).values({ ...food, userId });
      if (servings.length > 0) {
        await tx.insert(fitnessFoodServings).values(servings.map((serving) => ({ ...serving, foodId: food.id, spaceId: food.spaceId, userId })));
      }
    });
  }

  async updateFood(userId: string, id: string, changes: FoodInput): Promise<void> {
    const updated = await this.db.update(fitnessFoods).set(changes).where(this.ownFood(userId, id)).returning({ id: fitnessFoods.id });
    if (updated.length === 0) throw new NotFoundException('Food not found');
  }

  async removeFood(userId: string, id: string): Promise<void> {
    const removed = await this.db.delete(fitnessFoods).where(this.ownFood(userId, id)).returning({ id: fitnessFoods.id });
    if (removed.length === 0) throw new NotFoundException('Food not found');
  }

  async addServing(userId: string, serving: NewServingInput): Promise<void> {
    await this.fitness.assertSpace(userId, serving.spaceId);
    const [food] = await this.db
      .select({ id: fitnessFoods.id })
      .from(fitnessFoods)
      .where(and(eq(fitnessFoods.id, serving.foodId), this.visibleIn(fitnessFoods.spaceId, serving.spaceId)));
    if (!food) throw new NotFoundException('Food not found');
    await this.db.insert(fitnessFoodServings).values({ ...serving, userId });
  }

  async removeServing(userId: string, id: string): Promise<void> {
    const removed = await this.db
      .delete(fitnessFoodServings)
      .where(and(eq(fitnessFoodServings.id, id), eq(fitnessFoodServings.userId, userId)))
      .returning({ id: fitnessFoodServings.id });
    if (removed.length === 0) throw new NotFoundException('Serving not found');
  }

  async logs(userId: string, spaceId: string, from: string, to: string): Promise<LogInput[]> {
    await this.fitness.assertSpace(userId, spaceId);
    const rows = await this.db
      .select()
      .from(fitnessFoodLogs)
      .where(and(eq(fitnessFoodLogs.spaceId, spaceId), eq(fitnessFoodLogs.userId, userId), between(fitnessFoodLogs.day, from, to)))
      .orderBy(asc(fitnessFoodLogs.day), asc(fitnessFoodLogs.createdAt), asc(fitnessFoodLogs.id));
    return rows.map(({ spaceId: _space, userId: _user, createdAt: _created, meal, ...log }) => ({ ...log, meal: meal as LogInput['meal'] }));
  }

  async addLogs(userId: string, spaceId: string, logs: LogInput[]): Promise<void> {
    await this.fitness.assertSpace(userId, spaceId);
    const foodIds = logs.flatMap((log) => log.foodId ?? []);
    const known = new Set((await this.foodsById(spaceId, foodIds)).map((food) => food.id));
    // Rows added together keep the order they were sent in.
    const now = Date.now();
    await this.db.insert(fitnessFoodLogs).values(
      logs.map((log, index) => ({
        ...log,
        foodId: log.foodId && known.has(log.foodId) ? log.foodId : null,
        spaceId,
        userId,
        createdAt: new Date(now + index),
      })),
    );
  }

  async updateLog(userId: string, id: string, changes: LogChanges): Promise<void> {
    const updated = await this.db.update(fitnessFoodLogs).set(changes).where(this.ownLog(userId, id)).returning({ id: fitnessFoodLogs.id });
    if (updated.length === 0) throw new NotFoundException('Entry not found');
  }

  async removeLog(userId: string, id: string): Promise<void> {
    const removed = await this.db.delete(fitnessFoodLogs).where(this.ownLog(userId, id)).returning({ id: fitnessFoodLogs.id });
    if (removed.length === 0) throw new NotFoundException('Entry not found');
  }

  async recentFoods(userId: string, spaceId: string): Promise<FoodDto[]> {
    await this.fitness.assertSpace(userId, spaceId);
    const lastLogged = max(fitnessFoodLogs.createdAt);
    const rows = await this.db
      .select({ foodId: fitnessFoodLogs.foodId })
      .from(fitnessFoodLogs)
      .where(and(eq(fitnessFoodLogs.spaceId, spaceId), eq(fitnessFoodLogs.userId, userId), isNotNull(fitnessFoodLogs.foodId)))
      .groupBy(fitnessFoodLogs.foodId)
      .orderBy(desc(lastLogged))
      .limit(RECENT_FOODS);
    return this.foodsById(spaceId, rows.map((row) => row.foodId as string));
  }

  private ownLog(userId: string, id: string) {
    return and(eq(fitnessFoodLogs.id, id), eq(fitnessFoodLogs.userId, userId));
  }

  private async withServings(rows: FoodRow[], spaceId: string): Promise<FoodDto[]> {
    if (rows.length === 0) return [];
    const servings = await this.db
      .select()
      .from(fitnessFoodServings)
      .where(and(inArray(fitnessFoodServings.foodId, rows.map((row) => row.id)), this.visibleIn(fitnessFoodServings.spaceId, spaceId)))
      .orderBy(sql`${fitnessFoodServings.spaceId} IS NOT NULL`, asc(fitnessFoodServings.amountMg));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      kcal: row.kcal,
      proteinMg: row.proteinMg,
      carbsMg: row.carbsMg,
      fatMg: row.fatMg,
      fiberMg: row.fiberMg,
      custom: row.spaceId !== null,
      servings: servings
        .filter((serving) => serving.foodId === row.id)
        .map(({ id, label, amountMg, spaceId: owner }) => ({ id, label, amountMg, custom: owner !== null })),
    }));
  }

  // Built-in rows have no space; custom rows are seen only in their own.
  private visibleIn(column: typeof fitnessFoods.spaceId | typeof fitnessFoodServings.spaceId, spaceId: string) {
    return or(isNull(column), eq(column, spaceId));
  }

  private ownFood(userId: string, id: string) {
    return and(eq(fitnessFoods.id, id), eq(fitnessFoods.userId, userId), isNotNull(fitnessFoods.spaceId));
  }
}
