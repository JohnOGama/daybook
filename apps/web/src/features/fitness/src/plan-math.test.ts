import { expect, it } from 'vitest';
import type { FoodItem, FoodLog, MealPlan } from './fitness-types';
import { logsFromPlan, planFromLogs } from './plan-math';

const rice: FoodItem = { foodId: 'rice', name: 'Rice', quantityMilli: 250_000, servingLabel: 'g', amountMg: 250_000, kcal: 325, proteinMg: 6725, carbsMg: 70_425, fatMg: 700, fiberMg: 1000 };
const plan: MealPlan = { id: 'p1', name: 'Cutting day', items: [{ ...rice, meal: 'lunch' }, { ...rice, name: 'Oats', meal: 'breakfast' }] };
const counter = () => {
  let next = 0;
  return () => `id-${++next}`;
};

it('turns a plan into planned rows on the chosen day, each with a fresh id', () => {
  expect(logsFromPlan(plan, '2026-11-13', counter())).toEqual([
    { ...rice, meal: 'lunch', id: 'id-1', day: '2026-11-13', eaten: false },
    { ...rice, name: 'Oats', meal: 'breakfast', id: 'id-2', day: '2026-11-13', eaten: false },
  ]);
});

it('gives the day its own copy, so editing the plan later changes nothing already applied', () => {
  const copy: MealPlan = structuredClone(plan);
  const logs = logsFromPlan(copy, '2026-11-13', counter());
  copy.items[0].kcal = 9999;
  copy.items[0].name = 'Changed';
  expect(logs[0]).toMatchObject({ name: 'Rice', kcal: 325 });
});

it('saves a day as a plan without its ids, date or ticks', () => {
  const logs: FoodLog[] = [{ ...rice, id: 'a', day: '2026-11-13', meal: 'dinner', eaten: true }];
  expect(planFromLogs('Friday', logs, counter())).toEqual({ id: 'id-1', name: 'Friday', items: [{ ...rice, meal: 'dinner' }] });
});
