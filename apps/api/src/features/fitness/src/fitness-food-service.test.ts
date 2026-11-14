import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { fitnessFoodServings, fitnessFoods, spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { FitnessFoodService } from './fitness-food-service.ts';
import { FitnessService } from './fitness-service.ts';

const numbers = { kcal: 130, proteinMg: 2690, carbsMg: 28_170, fatMg: 280, fiberMg: 400 };

describe('FitnessFoodService', () => {
  let db: Db;
  let svc: FitnessFoodService;
  let space: string;
  let theirs: string;
  let whiteRice: string;

  const addSpace = async (userId: string) => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'Body', tool: 'fitness' }).returning();
    return row.id;
  };
  const customFood = (spaceId: string, name: string) => ({
    id: crypto.randomUUID(),
    spaceId,
    name,
    ...numbers,
    servings: [{ id: crypto.randomUUID(), label: '1 bowl', amountMg: 180_000 }],
  });
  const names = async (q: string, userId = 'u1', spaceId = space) => (await svc.searchFoods(userId, spaceId, q)).map((food) => food.name);

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new FitnessFoodService(db, new FitnessService(db));
    space = await addSpace('u1');
    theirs = await addSpace('u2');
    const builtIn = await db
      .insert(fitnessFoods)
      .values([
        { fdcId: 1, name: 'Rice, white, cooked', ...numbers },
        { fdcId: 2, name: 'Rice, brown, long-grain, cooked', ...numbers },
        { fdcId: 3, name: 'Bread, rye', ...numbers },
      ])
      .returning();
    whiteRice = builtIn[0].id;
    await db.insert(fitnessFoodServings).values({ foodId: whiteRice, label: '1 cup', amountMg: 158_000 });
  });

  it('finds foods matching every word in any order, custom foods first, with their servings', async () => {
    await svc.createFood('u1', customFood(space, 'Cooked rice bowl'));
    expect(await names('rice COOKED')).toEqual(['Cooked rice bowl', 'Rice, white, cooked', 'Rice, brown, long-grain, cooked']);
    const [bowl, white] = await svc.searchFoods('u1', space, 'rice cooked');
    expect(bowl).toMatchObject({ custom: true, kcal: 130, servings: [{ label: '1 bowl', amountMg: 180_000, custom: true }] });
    expect(white).toMatchObject({ custom: false, category: null, servings: [{ label: '1 cup', amountMg: 158_000, custom: false }] });
    expect(await names('  ')).toEqual([]);
  });

  it('treats %, _ and quotes in a search as plain text', async () => {
    expect(await names('100%')).toEqual([]);
    expect(await names('_')).toEqual([]);
    expect(await names("rice' OR 1=1 --")).toEqual([]);
    expect(await names('\\')).toEqual([]);
  });

  it("keeps one person's custom foods and servings out of another's search", async () => {
    await svc.createFood('u2', customFood(theirs, 'Rice pudding'));
    await svc.addServing('u2', { id: crypto.randomUUID(), spaceId: theirs, foodId: whiteRice, label: 'my scoop', amountMg: 90_000 });
    expect(await names('rice pudding')).toEqual([]);
    expect((await svc.searchFoods('u1', space, 'white'))[0].servings.map((serving) => serving.label)).toEqual(['1 cup']);
    expect((await svc.searchFoods('u2', theirs, 'white'))[0].servings.map((serving) => serving.label)).toEqual(['1 cup', 'my scoop']);
    await expect(svc.searchFoods('u1', theirs, 'rice')).rejects.toThrow(NotFoundException);
    await expect(svc.createFood('u1', customFood(theirs, 'Sneaky'))).rejects.toThrow(NotFoundException);
  });

  it('lets a custom food be edited and deleted, but never a built-in one', async () => {
    const food = customFood(space, 'Adobo');
    await svc.createFood('u1', food);
    await svc.updateFood('u1', food.id, { name: 'Chicken adobo', ...numbers, kcal: 200 });
    expect((await svc.customFoods('u1', space)).map(({ name }) => name)).toEqual(['Chicken adobo']);
    await expect(svc.customFoods('u2', space)).rejects.toThrow(NotFoundException);
    expect(await svc.searchFoods('u1', space, 'adobo')).toMatchObject([{ name: 'Chicken adobo', kcal: 200 }]);
    await expect(svc.updateFood('u2', food.id, { name: 'x', ...numbers })).rejects.toThrow(NotFoundException);
    await expect(svc.removeFood('u2', food.id)).rejects.toThrow(NotFoundException);
    await svc.removeFood('u1', food.id);
    expect(await names('adobo')).toEqual([]);
    expect(await svc.customFoods('u1', space)).toEqual([]);
    await expect(svc.removeFood('u1', whiteRice)).rejects.toThrow(NotFoundException);
    await expect(svc.updateFood('u1', whiteRice, { name: 'x', ...numbers })).rejects.toThrow(NotFoundException);
  });

  it('lets a serving be added to a built-in food and removed again, but not a built-in serving', async () => {
    const id = crypto.randomUUID();
    await svc.addServing('u1', { id, spaceId: space, foodId: whiteRice, label: 'my bowl', amountMg: 180_000 });
    const [builtIn] = (await svc.searchFoods('u1', space, 'white'))[0].servings;
    await expect(svc.removeServing('u1', builtIn.id)).rejects.toThrow(NotFoundException);
    await expect(svc.removeServing('u2', id)).rejects.toThrow(NotFoundException);
    await svc.removeServing('u1', id);
    expect((await svc.searchFoods('u1', space, 'white'))[0].servings).toHaveLength(1);
  });
});
