import type { FoodDto, LogInput } from '../../fitness/index.ts';

type FoodItem = Omit<LogInput, 'id' | 'day' | 'meal' | 'eaten'>;
type Serving = { label: string; amountMg: number };

const PER_100G_MG = 100_000;
export const GRAMS: Serving = { label: 'g', amountMg: 1000 };

const mg = (grams: number) => Math.round(grams * 1000);
export const grams = (milligrams: number) => Math.round(milligrams / 100) / 10;

// The web's itemFor (food-math.ts): the amount eaten times the food's per-100 g numbers.
export function itemForFood(food: Pick<FoodDto, 'id' | 'name' | 'kcal' | 'proteinMg' | 'carbsMg' | 'fatMg' | 'fiberMg'>, quantity: number, serving: Serving): FoodItem {
  const amountMg = Math.round(quantity * serving.amountMg);
  const of = (per100g: number) => Math.round((per100g * amountMg) / PER_100G_MG);
  return {
    foodId: food.id,
    name: food.name,
    quantityMilli: Math.round(quantity * 1000),
    servingLabel: serving.label,
    amountMg,
    kcal: of(food.kcal),
    proteinMg: of(food.proteinMg),
    carbsMg: of(food.carbsMg),
    fatMg: of(food.fatMg),
    fiberMg: of(food.fiberMg),
  };
}

export function oneOffItem(input: { name: string; grams: number; kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }): FoodItem {
  return {
    foodId: null,
    name: input.name,
    quantityMilli: mg(input.grams),
    servingLabel: GRAMS.label,
    amountMg: mg(input.grams),
    kcal: Math.round(input.kcal),
    proteinMg: mg(input.proteinG),
    carbsMg: mg(input.carbsG),
    fatMg: mg(input.fatG),
    fiberMg: mg(input.fiberG),
  };
}

// The web's formatQuantity: "120 g", "2 large egg", "1 × 250 ml cup".
export function formatAmount({ quantityMilli, servingLabel }: Pick<FoodItem, 'quantityMilli' | 'servingLabel'>): string {
  const quantity = Number((quantityMilli / 1000).toFixed(2));
  return /^\d/.test(servingLabel) ? `${quantity} × ${servingLabel}` : `${quantity} ${servingLabel}`;
}

export type Totals = { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };

export function totalsOf(items: Pick<FoodItem, 'kcal' | 'proteinMg' | 'carbsMg' | 'fatMg' | 'fiberMg'>[]): Totals {
  const sum = (pick: (item: (typeof items)[number]) => number) => items.reduce((total, item) => total + pick(item), 0);
  return {
    kcal: sum((item) => item.kcal),
    proteinG: grams(sum((item) => item.proteinMg)),
    carbsG: grams(sum((item) => item.carbsMg)),
    fatG: grams(sum((item) => item.fatMg)),
    fiberG: grams(sum((item) => item.fiberMg)),
  };
}
