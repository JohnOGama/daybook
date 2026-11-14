import { and, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../../shared/db/create-db.ts';
import { fitnessFoodServings, fitnessFoods } from '../../../shared/db/schema.ts';

export type ImportedFood = {
  fdcId: number;
  name: string;
  category: string | null;
  kcal: number;
  proteinMg: number;
  carbsMg: number;
  fatMg: number;
  fiberMg: number;
  servings: { label: string; amountMg: number }[];
};

// USDA nutrient numbers.
const ENERGY_KCAL = '208';
const PROTEIN = '203';
const CARBS = '205';
const FAT = '204';
const FIBRE = '291';

const srLegacySchema = z.object({
  SRLegacyFoods: z.array(
    z.object({
      fdcId: z.number().int(),
      description: z.string().min(1),
      foodCategory: z.object({ description: z.string() }).optional(),
      foodNutrients: z.array(z.object({ nutrient: z.object({ number: z.string() }), amount: z.number().optional() })).default([]),
      foodPortions: z.array(z.object({ amount: z.number().optional(), modifier: z.string().optional(), gramWeight: z.number().optional() })).default([]),
    }),
  ),
});

// Reads the SR Legacy JSON download from FoodData Central. Amounts in the file are per 100 g.
export function foodsFromSrLegacy(json: unknown): ImportedFood[] {
  const foods: ImportedFood[] = [];
  for (const food of srLegacySchema.parse(json).SRLegacyFoods) {
    const amounts = new Map(food.foodNutrients.map(({ nutrient, amount }) => [nutrient.number, amount ?? 0]));
    const kcal = amounts.get(ENERGY_KCAL);
    if (kcal === undefined) continue;
    const mg = (number: string) => Math.round((amounts.get(number) ?? 0) * 1000);
    foods.push({
      fdcId: food.fdcId,
      name: food.description,
      category: food.foodCategory?.description ?? null,
      kcal: Math.round(kcal),
      proteinMg: mg(PROTEIN),
      carbsMg: mg(CARBS),
      fatMg: mg(FAT),
      fiberMg: mg(FIBRE),
      servings: food.foodPortions
        .filter((portion) => portion.modifier && portion.gramWeight && portion.gramWeight > 0)
        .map((portion) => ({ label: `${portion.amount ?? 1} ${portion.modifier}`, amountMg: Math.round((portion.gramWeight as number) * 1000) })),
    });
  }
  return foods;
}

const BATCH = 500;

// Safe to run again: foods are matched on their USDA id and their built-in servings are replaced.
export async function saveBuiltInFoods(db: Db, foods: ImportedFood[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (let start = 0; start < foods.length; start += BATCH) {
      const batch = foods.slice(start, start + BATCH);
      const saved = await tx
        .insert(fitnessFoods)
        .values(batch.map(({ servings: _servings, ...food }) => food))
        .onConflictDoUpdate({
          target: fitnessFoods.fdcId,
          set: {
            name: sql`excluded.name`,
            category: sql`excluded.category`,
            kcal: sql`excluded.kcal`,
            proteinMg: sql`excluded.protein_mg`,
            carbsMg: sql`excluded.carbs_mg`,
            fatMg: sql`excluded.fat_mg`,
            fiberMg: sql`excluded.fiber_mg`,
          },
        })
        .returning({ id: fitnessFoods.id, fdcId: fitnessFoods.fdcId });
      const idOf = new Map(saved.map(({ id, fdcId }) => [fdcId, id]));
      await tx.delete(fitnessFoodServings).where(and(isNull(fitnessFoodServings.spaceId), inArray(fitnessFoodServings.foodId, [...idOf.values()])));
      const servings = batch.flatMap((food) => food.servings.map((serving) => ({ ...serving, foodId: idOf.get(food.fdcId) as string })));
      if (servings.length > 0) await tx.insert(fitnessFoodServings).values(servings);
    }
  });
}
