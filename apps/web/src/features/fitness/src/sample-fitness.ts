import { addDays } from '@/shared/utils/date-formatter';
import { type Day, DEFAULT_PROFILE, type Fitness, type FoodLog, type Meal } from './fitness-types';

// Stands in for real data while it loads, so the skeleton has the page's shape.
export function sampleFitness(today: string): Fitness {
  return {
    profile: { ...DEFAULT_PROFILE, sex: 'male', birthDate: '1995-01-01', heightMm: 1750, goal: 'lose', goalWeightG: 72_000 },
    weights: [14, 7, 0].map((daysAgo, index) => ({ day: addDays(today, -daysAgo), weightG: 76_000 - index * 400 })),
    mealPlans: [],
    templates: [],
    aiEnabled: false,
  };
}

const sampleLog = (id: string, day: string, meal: Meal, name: string, kcal: number): FoodLog => ({
  id,
  day,
  meal,
  eaten: true,
  foodId: null,
  name,
  quantityMilli: 100_000,
  servingLabel: 'g',
  amountMg: 100_000,
  kcal,
  proteinMg: 20_000,
  carbsMg: 30_000,
  fatMg: 10_000,
  fiberMg: 2000,
});

export function sampleDay(day: string): Day {
  return {
    logs: [
      sampleLog('sample-1', day, 'breakfast', 'Oats with milk', 320),
      sampleLog('sample-2', day, 'lunch', 'Rice, white, cooked', 325),
      sampleLog('sample-3', day, 'lunch', 'Chicken breast, grilled', 280),
      sampleLog('sample-4', day, 'dinner', 'Salmon with vegetables', 450),
    ],
    workouts: [],
    water: [{ day, glasses: 5 }],
  };
}
