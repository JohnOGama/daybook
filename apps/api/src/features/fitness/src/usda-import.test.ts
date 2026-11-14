import { expect, it } from 'vitest';
import { fitnessFoodServings, fitnessFoods } from '../../../shared/db/schema.ts';
import { createTestDb } from '../../../shared/db/test-db.ts';
import { foodsFromSrLegacy, saveBuiltInFoods } from './usda-import.ts';

const nutrient = (number: string, amount: number) => ({ nutrient: { number }, amount });

it('reads SR Legacy foods into per-100 g numbers and household servings', () => {
  const json = {
    SRLegacyFoods: [
      {
        fdcId: 168878,
        description: 'Rice, white, long-grain, regular, enriched, cooked',
        foodCategory: { description: 'Cereal Grains and Pasta' },
        foodNutrients: [nutrient('208', 130), nutrient('203', 2.69), nutrient('205', 28.17), nutrient('204', 0.28), nutrient('291', 0.4), nutrient('301', 10)],
        foodPortions: [
          { amount: 1, modifier: 'cup', gramWeight: 158 },
          { amount: 0.5, modifier: 'tbsp', gramWeight: 7.4 },
          { amount: 1, modifier: '', gramWeight: 0 },
        ],
      },
      { fdcId: 2, description: 'Oil, olive', foodNutrients: [nutrient('208', 884), nutrient('204', 100)], foodPortions: [] },
      { fdcId: 3, description: 'No energy listed', foodNutrients: [nutrient('203', 1)] },
    ],
  };
  expect(foodsFromSrLegacy(json)).toEqual([
    {
      fdcId: 168878,
      name: 'Rice, white, long-grain, regular, enriched, cooked',
      category: 'Cereal Grains and Pasta',
      kcal: 130,
      proteinMg: 2690,
      carbsMg: 28_170,
      fatMg: 280,
      fiberMg: 400,
      servings: [
        { label: '1 cup', amountMg: 158_000 },
        { label: '0.5 tbsp', amountMg: 7400 },
      ],
    },
    { fdcId: 2, name: 'Oil, olive', category: null, kcal: 884, proteinMg: 0, carbsMg: 0, fatMg: 100_000, fiberMg: 0, servings: [] },
  ]);
});

it('refuses a file that is not an SR Legacy download', () => {
  expect(() => foodsFromSrLegacy({ FoundationFoods: [] })).toThrow();
});

it('saves the foods once however often the import runs, updating numbers and replacing servings', async () => {
  const db = await createTestDb();
  const rice = { fdcId: 1, name: 'Rice', category: null, kcal: 130, proteinMg: 2690, carbsMg: 28_170, fatMg: 280, fiberMg: 400, servings: [{ label: '1 cup', amountMg: 158_000 }] };
  await saveBuiltInFoods(db, [rice, { ...rice, fdcId: 2, name: 'Oil', servings: [] }]);
  await saveBuiltInFoods(db, [{ ...rice, kcal: 131, servings: [{ label: '1 tbsp', amountMg: 10_000 }] }]);
  const foods = await db.select().from(fitnessFoods);
  expect(foods.map(({ name, kcal, spaceId }) => ({ name, kcal, spaceId })).sort((a, b) => a.name.localeCompare(b.name))).toEqual([
    { name: 'Oil', kcal: 130, spaceId: null },
    { name: 'Rice', kcal: 131, spaceId: null },
  ]);
  expect((await db.select().from(fitnessFoodServings)).map(({ label }) => label)).toEqual(['1 tbsp']);
});
