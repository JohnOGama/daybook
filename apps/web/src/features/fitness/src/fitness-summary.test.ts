import { expect, it } from 'vitest';
import { fitnessSummary } from './fitness-summary';
import { type Day, DEFAULT_PROFILE, type FoodLog, type Profile } from './fitness-types';

const today = '2026-11-13';
const profile: Profile = { ...DEFAULT_PROFILE, sex: 'male', birthDate: '1996-11-13', heightMm: 1800, goal: 'lose', goalWeightG: 75_000, paceGPerWeek: 500 };
const log = (day: string, name: string): FoodLog => ({ id: day, day, meal: 'lunch', eaten: true, foodId: null, name, quantityMilli: 1000, servingLabel: 'g', amountMg: 1000, kcal: 2000, proteinMg: 150_000, carbsMg: 200_000, fatMg: 60_000, fiberMg: 0 });
const days: Day = {
  water: [],
  logs: [log('2026-11-12', 'Secret snack'), log('2026-11-13', 'Private pasta')],
  workouts: [
    {
      id: 'w1',
      day: '2026-11-12',
      name: 'Leg day at the hidden gym',
      items: [{ exerciseId: null, name: 'Hidden squat', kind: 'weight', primary: ['quads'], secondary: ['glutes'], sets: [1, 2, 3].map(() => ({ reps: 8, weightG: 100_000, seconds: null, meters: null, done: true })) }],
    },
  ],
};
const weights = [
  { day: '2026-11-03', weightG: 81_000 },
  { day: '2026-11-13', weightG: 80_000 },
];

it('sends figures only: no food names, exercise names or workout names', () => {
  const sent = JSON.stringify(fitnessSummary({ profile, weights, days, today }));
  for (const secret of ['Secret snack', 'Private pasta', 'Leg day', 'hidden gym', 'Hidden squat']) expect(sent).not.toContain(secret);
  expect(sent.length).toBeLessThan(8000);
});

it('summarises the profile, intake, training and forecast', () => {
  expect(fitnessSummary({ profile, weights, days, today })).toMatchObject({
    age: 30,
    sex: 'male',
    heightCm: 180,
    goal: 'lose weight',
    goalWeightKg: 75,
    paceKgPerWeek: 0.5,
    currentWeightKg: 80,
    bmi: 24.7,
    weightTrendKgPerWeek: -0.7,
    dailyTargets: { kcal: 2209, proteinG: 166, carbsG: 221, fatG: 74 },
    last7Days: { daysLogged: 2, averageKcal: 2000, averageProteinG: 150, averageCarbsG: 200, averageFatG: 60 },
    doneSetsPerMuscleLast7Days: { Quads: 3, Glutes: 1.5 },
    forecast: { onPlanReachesGoalOn: '2027-01-22' },
  });
});

it('says what is missing instead of sending broken numbers', () => {
  const summary = fitnessSummary({ profile: DEFAULT_PROFILE, weights: [], days: { logs: [], workouts: [], water: [] }, today });
  expect(JSON.stringify(summary)).not.toMatch(/NaN|Infinity/);
  expect(summary).toMatchObject({ currentWeightKg: null, dailyTargets: null, last7Days: null, last30Days: null, doneSetsPerMuscleLast7Days: {} });
});
