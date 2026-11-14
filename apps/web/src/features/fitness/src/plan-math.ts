import type { FoodLog, MealPlan } from './fitness-types';

// Applying a plan copies it onto the day as planned rows; nothing counts until it is ticked.
export function logsFromPlan(plan: MealPlan, day: string, newId: () => string): FoodLog[] {
  return plan.items.map((item) => ({ ...item, id: newId(), day, eaten: false }));
}

export function planFromLogs(name: string, logs: FoodLog[], newId: () => string): MealPlan {
  return { id: newId(), name, items: logs.map(({ id: _id, day: _day, eaten: _eaten, ...item }) => item) };
}
