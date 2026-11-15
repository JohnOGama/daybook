import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { DEFAULT_PROFILE, mealPlanSchema, weightSchema } from './fitness-schemas.ts';
import { FitnessService } from './fitness-service.ts';

describe('FitnessService', () => {
  let db: Db;
  let svc: FitnessService;
  let space: string;
  let theirs: string;

  const addSpace = async (userId: string, tool: 'fitness' | 'budget' = 'fitness') => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'Body', tool }).returning();
    return row.id;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new FitnessService(db);
    space = await addSpace('u1');
    theirs = await addSpace('u2');
  });

  describe('profile', () => {
    it('starts with the default profile and saves a new one', async () => {
      expect(await svc.load('u1', space)).toMatchObject({ profile: DEFAULT_PROFILE, weights: [], mealPlans: [], templates: [] });
      const profile = { ...DEFAULT_PROFILE, sex: 'male' as const, birthDate: '1996-11-13', heightMm: 1800, goal: 'lose' as const };
      await svc.saveProfile('u1', space, profile);
      await svc.saveProfile('u1', space, { ...profile, paceGPerWeek: 250 });
      expect((await svc.load('u1', space)).profile).toEqual({ ...profile, paceGPerWeek: 250 });
    });

    it("refuses another user's space and a space of another tool", async () => {
      await expect(svc.load('u1', theirs)).rejects.toThrow(NotFoundException);
      await expect(svc.saveProfile('u1', theirs, DEFAULT_PROFILE)).rejects.toThrow(NotFoundException);
      await expect(svc.load('u1', await addSpace('u1', 'budget'))).rejects.toThrow(NotFoundException);
    });
  });

  describe('meal plans', () => {
    const item = { meal: 'lunch' as const, foodId: null, name: 'Rice', quantityMilli: 250_000, servingLabel: 'g', amountMg: 250_000, kcal: 325, proteinMg: 6725, carbsMg: 70_425, fatMg: 700, fiberMg: 1000 };

    it('saves a plan with its items, replaces it whole, and deletes it', async () => {
      const plan = { id: crypto.randomUUID(), spaceId: space, name: 'Cutting day', items: [item, { ...item, meal: 'dinner' as const }] };
      await svc.createMealPlan('u1', plan);
      expect((await svc.load('u1', space)).mealPlans).toEqual([{ id: plan.id, name: 'Cutting day', items: plan.items, version: 0 }]);
      expect(await svc.saveMealPlan('u1', plan.id, { name: 'Cut', items: [item], version: 0 })).toEqual({ version: 1 });
      expect((await svc.load('u1', space)).mealPlans).toEqual([{ id: plan.id, name: 'Cut', items: [item], version: 1 }]);
      await expect(svc.saveMealPlan('u1', plan.id, { name: 'Stale', items: [item], version: 0 })).rejects.toThrow(ConflictException);
      expect((await svc.load('u1', space)).mealPlans).toMatchObject([{ name: 'Cut', version: 1 }]);
      await svc.removeMealPlan('u1', plan.id);
      expect((await svc.load('u1', space)).mealPlans).toEqual([]);
    });

    it("keeps another user away from a plan, and refuses an empty or oversized one", async () => {
      const plan = { id: crypto.randomUUID(), spaceId: space, name: 'Mine', items: [item] };
      await svc.createMealPlan('u1', plan);
      await expect(svc.saveMealPlan('u2', plan.id, { name: 'x', items: [item], version: 0 })).rejects.toThrow(NotFoundException);
      await expect(svc.removeMealPlan('u2', plan.id)).rejects.toThrow(NotFoundException);
      await expect(svc.createMealPlan('u1', { ...plan, id: crypto.randomUUID(), spaceId: theirs })).rejects.toThrow(NotFoundException);
      expect(mealPlanSchema.safeParse({ name: 'Ok', items: [item] }).success).toBe(true);
      expect(mealPlanSchema.safeParse({ name: 'Empty', items: [] }).success).toBe(false);
      expect(mealPlanSchema.safeParse({ name: 'Huge', items: Array.from({ length: 101 }, () => item) }).success).toBe(false);
    });
  });

  describe('weights', () => {
    it('keeps one weigh-in per day, oldest first', async () => {
      await svc.saveWeight('u1', space, '2026-11-12', 80_500);
      await svc.saveWeight('u1', space, '2026-11-10', 81_000);
      await svc.saveWeight('u1', space, '2026-11-12', 80_000);
      expect((await svc.load('u1', space)).weights).toEqual([
        { day: '2026-11-10', weightG: 81_000 },
        { day: '2026-11-12', weightG: 80_000 },
      ]);
    });

    it('deletes a weigh-in for its owner only, and refuses a weight out of range', async () => {
      await svc.saveWeight('u1', space, '2026-11-12', 80_000);
      await expect(svc.removeWeight('u2', space, '2026-11-12')).rejects.toThrow(NotFoundException);
      await expect(svc.saveWeight('u2', space, '2026-11-12', 70_000)).rejects.toThrow(NotFoundException);
      await svc.removeWeight('u1', space, '2026-11-12');
      expect((await svc.load('u1', space)).weights).toEqual([]);
      expect(weightSchema.safeParse({ spaceId: space, day: '2026-11-12', weightG: 80_000 }).success).toBe(true);
      expect(weightSchema.safeParse({ spaceId: space, day: '2026-11-12', weightG: 19_999 }).success).toBe(false);
      expect(weightSchema.safeParse({ spaceId: space, day: '2026-11-12', weightG: 400_001 }).success).toBe(false);
    });
  });
});
