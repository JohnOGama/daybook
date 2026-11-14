import { expect, it } from 'vitest';
import { parseAmount } from './fitness-format';
import type { Food, FoodLog } from './fitness-types';
import { dayTotals, formatQuantity, itemFor, plannedTotals, servingsFor } from './food-math';

const rice: Food = {
  id: 'rice',
  name: 'Rice, white, cooked',
  category: null,
  custom: false,
  kcal: 130,
  proteinMg: 2690,
  carbsMg: 28_170,
  fatMg: 280,
  fiberMg: 400,
  servings: [{ id: 'cup', label: '1 cup', amountMg: 158_000, custom: false }],
};

it('works out a logged amount from grams or from a household serving', () => {
  expect(itemFor(rice, 250, { label: 'g', amountMg: 1000 })).toEqual({
    foodId: 'rice',
    name: 'Rice, white, cooked',
    quantityMilli: 250_000,
    servingLabel: 'g',
    amountMg: 250_000,
    kcal: 325,
    proteinMg: 6725,
    carbsMg: 70_425,
    fatMg: 700,
    fiberMg: 1000,
  });
  expect(itemFor(rice, 1.5, { label: '1 cup', amountMg: 158_000 })).toMatchObject({ amountMg: 237_000, kcal: 308, quantityMilli: 1500, servingLabel: '1 cup' });
});

it('offers weight units for every food, then the food’s own servings', () => {
  expect(servingsFor(rice).map((serving) => serving.label)).toEqual(['g', 'kg', 'oz', 'lb', '1 cup']);
  expect(servingsFor({ ...rice, servings: [] }).map((serving) => serving.label)).toEqual(['g', 'kg', 'oz', 'lb']);
});

it('reads a comma as a decimal point and refuses anything that is not a positive number', () => {
  expect(parseAmount('1,5')).toBe(1.5);
  expect(parseAmount(' 250 ')).toBe(250);
  for (const bad of ['', '0', '-2', 'abc', '1.5.2', 'Infinity']) expect(parseAmount(bad)).toBeNull();
});

it('counts only what was eaten, and separately what the plan would add up to', () => {
  const log = (eaten: boolean): FoodLog => ({ ...itemFor(rice, 100, { label: 'g', amountMg: 1000 }), id: String(eaten), day: '2026-11-13', meal: 'lunch', eaten });
  const logs = [log(true), log(false)];
  expect(dayTotals(logs)).toEqual({ kcal: 130, proteinMg: 2690, carbsMg: 28_170, fatMg: 280 });
  expect(plannedTotals(logs)).toEqual({ kcal: 260, proteinMg: 5380, carbsMg: 56_340, fatMg: 560 });
  expect(dayTotals([])).toEqual({ kcal: 0, proteinMg: 0, carbsMg: 0, fatMg: 0 });
});

it('writes an amount the way it was typed', () => {
  expect(formatQuantity({ quantityMilli: 250_000, servingLabel: 'g' })).toBe('250 g');
  expect(formatQuantity({ quantityMilli: 1500, servingLabel: '1 cup' })).toBe('1.5 × 1 cup');
  expect(formatQuantity({ quantityMilli: 2000, servingLabel: 'my bowl' })).toBe('2 my bowl');
});
