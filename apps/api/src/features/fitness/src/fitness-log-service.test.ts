import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { fitnessFoods, spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { FitnessFoodService } from './fitness-food-service.ts';
import { addLogsSchema, daysSchema } from './fitness-schemas.ts';
import { FitnessService } from './fitness-service.ts';

const numbers = { kcal: 325, proteinMg: 6725, carbsMg: 70_425, fatMg: 700, fiberMg: 1000 };

describe('food log', () => {
  let db: Db;
  let svc: FitnessFoodService;
  let space: string;
  let theirs: string;
  let rice: string;

  const addSpace = async (userId: string) => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'Body', tool: 'fitness' }).returning();
    return row.id;
  };
  const log = (day: string, foodId: string | null = rice, name = 'Rice, white, cooked') => ({
    id: crypto.randomUUID(),
    day,
    meal: 'lunch' as const,
    eaten: true,
    foodId,
    name,
    quantityMilli: 250_000,
    servingLabel: 'g',
    amountMg: 250_000,
    ...numbers,
  });

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new FitnessFoodService(db, new FitnessService(db));
    space = await addSpace('u1');
    theirs = await addSpace('u2');
    [{ id: rice }] = await db.insert(fitnessFoods).values({ fdcId: 1, name: 'Rice, white, cooked', kcal: 130, proteinMg: 2690, carbsMg: 28_170, fatMg: 280, fiberMg: 400 }).returning();
  });

  it('returns the logs of the days asked for and no others', async () => {
    const [monday, tuesday] = [log('2026-11-09'), log('2026-11-10')];
    await svc.addLogs('u1', space, [monday, tuesday]);
    expect(await svc.logs('u1', space, '2026-11-09', '2026-11-09')).toEqual([monday]);
    expect(await svc.logs('u1', space, '2026-11-01', '2026-11-30')).toHaveLength(2);
    expect(await svc.logs('u1', space, '2026-11-11', '2026-11-30')).toEqual([]);
    await expect(svc.logs('u1', theirs, '2026-11-01', '2026-11-30')).rejects.toThrow(NotFoundException);
  });

  it('keeps a logged row, with its name and numbers, after its food is deleted', async () => {
    const food = { id: crypto.randomUUID(), spaceId: space, name: 'Adobo', kcal: 200, proteinMg: 15_000, carbsMg: 3000, fatMg: 14_000, fiberMg: 0, servings: [] };
    await svc.createFood('u1', food);
    const row = log('2026-11-09', food.id, 'Adobo');
    await svc.addLogs('u1', space, [row]);
    await svc.removeFood('u1', food.id);
    expect(await svc.logs('u1', space, '2026-11-09', '2026-11-09')).toEqual([{ ...row, foodId: null }]);
  });

  it("does not link a log to another person's food", async () => {
    const food = { id: crypto.randomUUID(), spaceId: theirs, name: 'Theirs', kcal: 1, proteinMg: 0, carbsMg: 0, fatMg: 0, fiberMg: 0, servings: [] };
    await svc.createFood('u2', food);
    await svc.addLogs('u1', space, [log('2026-11-09', food.id, 'Copied name')]);
    expect((await svc.logs('u1', space, '2026-11-09', '2026-11-09'))[0]).toMatchObject({ foodId: null, name: 'Copied name' });
  });

  it('ticks, changes and deletes a row, for its owner only', async () => {
    const row = { ...log('2026-11-09'), eaten: false };
    await svc.addLogs('u1', space, [row]);
    await expect(svc.updateLog('u2', row.id, { eaten: true })).rejects.toThrow(NotFoundException);
    await svc.updateLog('u1', row.id, { eaten: true, meal: 'dinner', amountMg: 100_000, quantityMilli: 100_000, kcal: 130 });
    expect((await svc.logs('u1', space, '2026-11-09', '2026-11-09'))[0]).toMatchObject({ eaten: true, meal: 'dinner', amountMg: 100_000, kcal: 130 });
    await expect(svc.removeLog('u2', row.id)).rejects.toThrow(NotFoundException);
    await svc.removeLog('u1', row.id);
    expect(await svc.logs('u1', space, '2026-11-09', '2026-11-09')).toEqual([]);
  });

  it('lists the foods logged most recently, newest first, each once', async () => {
    const [{ id: bread }] = await db.insert(fitnessFoods).values({ fdcId: 2, name: 'Bread, rye', kcal: 259, proteinMg: 8500, carbsMg: 48_300, fatMg: 3300, fiberMg: 5800 }).returning();
    await svc.addLogs('u1', space, [log('2026-11-08')]);
    await svc.addLogs('u1', space, [log('2026-11-09', bread, 'Bread, rye')]);
    await svc.addLogs('u1', space, [log('2026-11-10', null, 'Typed by hand')]);
    expect((await svc.recentFoods('u1', space)).map((food) => food.name)).toEqual(['Bread, rye', 'Rice, white, cooked']);
    await svc.addLogs('u1', space, [{ ...log('2026-11-11'), quantityMilli: 2000, servingLabel: '1 cup', amountMg: 316_000 }]);
    expect((await svc.recentFoods('u1', space))[0]).toMatchObject({ name: 'Rice, white, cooked', last: { quantityMilli: 2000, servingLabel: '1 cup' } });
    expect(await svc.recentFoods('u2', theirs)).toEqual([]);
  });

  it('refuses zero or negative amounts, too many rows, and a backwards or oversized range', () => {
    const body = (changes: object) => ({ spaceId: space, logs: [{ ...log('2026-11-09'), ...changes }] });
    expect(addLogsSchema.safeParse(body({})).success).toBe(true);
    expect(addLogsSchema.safeParse(body({ amountMg: 0 })).success).toBe(false);
    expect(addLogsSchema.safeParse(body({ amountMg: -5 })).success).toBe(false);
    expect(addLogsSchema.safeParse(body({ quantityMilli: 0 })).success).toBe(false);
    expect(addLogsSchema.safeParse(body({ meal: 'brunch' })).success).toBe(false);
    expect(addLogsSchema.safeParse({ spaceId: space, logs: [] }).success).toBe(false);
    expect(daysSchema.safeParse({ spaceId: space, from: '2026-11-01', to: '2026-11-30' }).success).toBe(true);
    expect(daysSchema.safeParse({ spaceId: space, from: '2026-11-30', to: '2026-11-01' }).success).toBe(false);
    expect(daysSchema.safeParse({ spaceId: space, from: '2024-01-01', to: '2026-11-01' }).success).toBe(false);
  });
});
