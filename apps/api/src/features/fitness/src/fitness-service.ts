import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, between, eq, isNull, sql } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { fitnessMealPlans, fitnessProfiles, fitnessWater, fitnessWeights, fitnessWorkoutTemplates, spaces } from '../../../shared/db/schema.ts';
import { DEFAULT_PROFILE, type MealPlanInput, type Profile, profileSchema, type Versioned } from './fitness-schemas.ts';

@Injectable()
export class FitnessService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // Everything small enough to load at once. Food logs and workouts grow without limit and load by day.
  async load(userId: string, spaceId: string) {
    await this.assertSpace(userId, spaceId);
    const [[row], weights, mealPlans, templates] = await Promise.all([
      this.db.select().from(fitnessProfiles).where(eq(fitnessProfiles.spaceId, spaceId)),
      this.db
        .select({ day: fitnessWeights.day, weightG: fitnessWeights.weightG })
        .from(fitnessWeights)
        .where(eq(fitnessWeights.spaceId, spaceId))
        .orderBy(asc(fitnessWeights.day)),
      this.db
        .select({ id: fitnessMealPlans.id, name: fitnessMealPlans.name, items: fitnessMealPlans.items, version: fitnessMealPlans.version })
        .from(fitnessMealPlans)
        .where(eq(fitnessMealPlans.spaceId, spaceId))
        .orderBy(asc(fitnessMealPlans.createdAt), asc(fitnessMealPlans.id)),
      this.db
        .select({
          id: fitnessWorkoutTemplates.id,
          name: fitnessWorkoutTemplates.name,
          items: fitnessWorkoutTemplates.items,
          version: fitnessWorkoutTemplates.version,
        })
        .from(fitnessWorkoutTemplates)
        .where(eq(fitnessWorkoutTemplates.spaceId, spaceId))
        .orderBy(asc(fitnessWorkoutTemplates.createdAt), asc(fitnessWorkoutTemplates.id)),
    ]);
    // A profile saved by an older version that no longer fits falls back to the defaults.
    const profile = profileSchema.safeParse(row?.profile);
    return { profile: profile.success ? profile.data : DEFAULT_PROFILE, weights, mealPlans, templates };
  }

  async saveProfile(userId: string, spaceId: string, profile: Profile): Promise<void> {
    await this.assertSpace(userId, spaceId);
    await this.db
      .insert(fitnessProfiles)
      .values({ spaceId, userId, profile })
      .onConflictDoUpdate({ target: fitnessProfiles.spaceId, set: { profile } });
  }

  async saveWeight(userId: string, spaceId: string, day: string, weightG: number): Promise<void> {
    await this.assertSpace(userId, spaceId);
    await this.db
      .insert(fitnessWeights)
      .values({ spaceId, userId, day, weightG })
      .onConflictDoUpdate({ target: [fitnessWeights.spaceId, fitnessWeights.day], set: { weightG } });
  }

  async water(userId: string, spaceId: string, from: string, to: string): Promise<{ day: string; glasses: number }[]> {
    return this.db
      .select({ day: fitnessWater.day, glasses: fitnessWater.glasses })
      .from(fitnessWater)
      .where(and(eq(fitnessWater.spaceId, spaceId), eq(fitnessWater.userId, userId), between(fitnessWater.day, from, to)))
      .orderBy(asc(fitnessWater.day));
  }

  async saveWater(userId: string, spaceId: string, day: string, glasses: number): Promise<void> {
    await this.assertSpace(userId, spaceId);
    await this.db
      .insert(fitnessWater)
      .values({ spaceId, userId, day, glasses })
      .onConflictDoUpdate({ target: [fitnessWater.spaceId, fitnessWater.day], set: { glasses } });
  }

  async removeWeight(userId: string, spaceId: string, day: string): Promise<void> {
    const removed = await this.db
      .delete(fitnessWeights)
      .where(and(eq(fitnessWeights.spaceId, spaceId), eq(fitnessWeights.userId, userId), eq(fitnessWeights.day, day)))
      .returning({ id: fitnessWeights.id });
    if (removed.length === 0) throw new NotFoundException('Weigh-in not found');
  }

  async createMealPlan(userId: string, plan: MealPlanInput & { id: string; spaceId: string }): Promise<void> {
    await this.assertSpace(userId, plan.spaceId);
    await this.db.insert(fitnessMealPlans).values({ ...plan, userId });
  }

  async saveMealPlan(userId: string, id: string, { version, ...plan }: MealPlanInput & Versioned): Promise<Versioned> {
    const owned = and(eq(fitnessMealPlans.id, id), eq(fitnessMealPlans.userId, userId));
    const [saved] = await this.db
      .update(fitnessMealPlans)
      .set({ ...plan, version: sql`${fitnessMealPlans.version} + 1` })
      .where(and(owned, eq(fitnessMealPlans.version, version)))
      .returning({ version: fitnessMealPlans.version });
    if (saved) return saved;
    const [exists] = await this.db.select({ id: fitnessMealPlans.id }).from(fitnessMealPlans).where(owned);
    throw exists ? new ConflictException('Changed by someone else') : new NotFoundException('Meal plan not found');
  }

  async removeMealPlan(userId: string, id: string): Promise<void> {
    const removed = await this.db
      .delete(fitnessMealPlans)
      .where(and(eq(fitnessMealPlans.id, id), eq(fitnessMealPlans.userId, userId)))
      .returning({ id: fitnessMealPlans.id });
    if (removed.length === 0) throw new NotFoundException('Meal plan not found');
  }

  async assertSpace(userId: string, spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId), eq(spaces.tool, 'fitness'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Fitness space not found');
  }
}
