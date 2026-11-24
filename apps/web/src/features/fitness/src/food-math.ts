import type { Food, FoodItem, FoodLog, Targets } from './fitness-types';

export type ServingChoice = { label: string; amountMg: number };

export const WEIGHT_UNITS: ServingChoice[] = [
  { label: 'g', amountMg: 1000 },
  { label: 'kg', amountMg: 1_000_000 },
  { label: 'oz', amountMg: 28_350 },
  { label: 'lb', amountMg: 453_592 },
];

// Weight works for every food; spoons, cups and pieces only where the food says what they weigh.
export const servingsFor = (food: Food): ServingChoice[] => [...WEIGHT_UNITS, ...food.servings.map(({ label, amountMg }) => ({ label, amountMg }))];

const PER_100G_MG = 100_000;

// The same amount as last time, if that serving still exists.
export function lastItem(food: Food): FoodItem | null {
  const serving = food.last && servingsFor(food).find(({ label }) => label === food.last?.servingLabel);
  return food.last && serving ? itemFor(food, food.last.quantityMilli / 1000, serving) : null;
}

export function itemFor(food: Food, quantity: number, serving: ServingChoice): FoodItem {
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

// The same logged food at a new amount, scaled from its own numbers so it does not depend on the food still existing.
export function scaleItem<T extends FoodItem>(item: T, quantity: number): T {
  const factor = (quantity * 1000) / item.quantityMilli;
  const scaled = (value: number) => Math.round(value * factor);
  return {
    ...item,
    quantityMilli: Math.round(quantity * 1000),
    amountMg: Math.max(1, scaled(item.amountMg)),
    kcal: scaled(item.kcal),
    proteinMg: scaled(item.proteinMg),
    carbsMg: scaled(item.carbsMg),
    fatMg: scaled(item.fatMg),
    fiberMg: scaled(item.fiberMg),
  };
}

export function totalsOf(items: Targets[]): Targets {
  const totals = { kcal: 0, proteinMg: 0, carbsMg: 0, fatMg: 0 };
  for (const item of items) {
    totals.kcal += item.kcal;
    totals.proteinMg += item.proteinMg;
    totals.carbsMg += item.carbsMg;
    totals.fatMg += item.fatMg;
  }
  return totals;
}

// Planned rows never count until they are ticked as eaten.
export const dayTotals = (logs: FoodLog[]) => totalsOf(logs.filter((log) => log.eaten));
export const plannedTotals = (logs: FoodLog[]) => totalsOf(logs);

export function formatQuantity({ quantityMilli, servingLabel }: Pick<FoodItem, 'quantityMilli' | 'servingLabel'>): string {
  const quantity = Number((quantityMilli / 1000).toFixed(2));
  return /^\d/.test(servingLabel) ? `${quantity} × ${servingLabel}` : `${quantity} ${servingLabel}`;
}
