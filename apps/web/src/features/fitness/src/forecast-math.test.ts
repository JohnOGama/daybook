import { expect, it } from 'vitest';
import { addDays } from '@/shared/utils/date-formatter';
import { DEFAULT_PROFILE, type FoodLog, type Weight } from './fitness-types';
import { averageIntake, type DayIntake, forecast, intakeByDay, measuredDailyKcal, planGPerDay, smoothed, trendForecastGPerDay, trendGPerDay } from './forecast-math';

const today = '2026-11-13';
const intake = (daysAgo: number, kcal: number): DayIntake => ({ day: addDays(today, -daysAgo), kcal, proteinMg: 100_000, carbsMg: 200_000, fatMg: 50_000 });
const weight = (daysAgo: number, weightG: number): Weight => ({ day: addDays(today, -daysAgo), weightG });

it('projects weight forward and says when the goal is reached', () => {
  expect(trendForecastGPerDay(2200, 2750, 7700)).toBeCloseTo(-71.43, 2);
  const losing = forecast({ startG: 80_000, goalG: 79_000, today, horizonDays: 30, gPerDay: -71.43 });
  expect(losing.reachedOn).toBe('2026-11-27');
  expect(losing.points).toHaveLength(31);
  expect(losing.points[0]).toEqual({ day: today, weightG: 80_000 });
  expect(losing.points[7].weightG).toBe(79_500);
  expect(losing.points.slice(14).every((point) => point.weightG === 79_000)).toBe(true);
});

it('says the goal is not being approached when heading away, standing still, or there is no goal', () => {
  expect(forecast({ startG: 80_000, goalG: 79_000, today, horizonDays: 30, gPerDay: 50 }).reachedOn).toBeNull();
  expect(forecast({ startG: 80_000, goalG: 79_000, today, horizonDays: 30, gPerDay: 0 }).reachedOn).toBeNull();
  expect(forecast({ startG: 80_000, goalG: null, today, horizonDays: 30, gPerDay: -50 }).reachedOn).toBeNull();
  expect(forecast({ startG: 80_000, goalG: 70_000, today, horizonDays: 30, gPerDay: -50 }).reachedOn).toBeNull();
  expect(forecast({ startG: 80_000, goalG: 80_000, today, horizonDays: 30, gPerDay: -50 }).reachedOn).toBe(today);
});

it('turns the goal and pace into a daily change', () => {
  expect(planGPerDay({ ...DEFAULT_PROFILE, goal: 'lose', paceGPerWeek: 700 })).toBe(-100);
  expect(planGPerDay({ ...DEFAULT_PROFILE, goal: 'gain', paceGPerWeek: 350 })).toBe(50);
  expect(planGPerDay({ ...DEFAULT_PROFILE, goal: 'maintain', paceGPerWeek: 700 })).toBe(0);
});

it('averages only the days that have food logged', () => {
  expect(averageIntake([], today, 7)).toBeNull();
  expect(averageIntake([intake(0, 2000), intake(2, 2200), intake(5, 2400), intake(9, 9000)], today, 7)).toEqual({
    days: 3,
    average: { kcal: 2200, proteinMg: 100_000, carbsMg: 200_000, fatMg: 50_000 },
  });
});

it('adds up eaten food per day and leaves out days with nothing eaten', () => {
  const log = (day: string, eaten: boolean): FoodLog => ({ id: day + eaten, day, meal: 'lunch', eaten, foodId: null, name: 'Rice', quantityMilli: 1000, servingLabel: 'g', amountMg: 1000, kcal: 300, proteinMg: 10_000, carbsMg: 50_000, fatMg: 5000, fiberMg: 0 });
  expect(intakeByDay([log('2026-11-12', true), log('2026-11-12', true), log('2026-11-12', false), log('2026-11-13', false)])).toEqual([
    { day: '2026-11-12', kcal: 600, proteinMg: 20_000, carbsMg: 100_000, fatMg: 10_000 },
  ]);
});

it('finds the weight trend over the window, and none from a single weigh-in', () => {
  expect(trendGPerDay([weight(0, 80_000)], today, 14)).toBeNull();
  expect(trendGPerDay([], today, 14)).toBeNull();
  expect(trendGPerDay([weight(10, 81_000), weight(5, 80_500), weight(0, 80_000)], today, 14)).toBeCloseTo(-100, 5);
  expect(trendGPerDay([weight(40, 90_000), weight(30, 85_000)], today, 14)).toBeNull();
});

it('smooths weigh-ins without moving the first one', () => {
  const line = smoothed([weight(2, 80_000), weight(1, 81_000), weight(0, 80_000)]);
  expect(line[0].weightG).toBe(80_000);
  expect(line[1].weightG).toBe(80_100);
  expect(line).toHaveLength(3);
});

it('measures daily energy from intake and weight change only with three weeks of both', () => {
  const days = (count: number) => Array.from({ length: count }, (_, index) => intake(index, 2200));
  expect(measuredDailyKcal(days(10), [weight(9, 80_900), weight(0, 80_000)], today, 7700)).toBeNull();
  expect(measuredDailyKcal(days(28), [weight(5, 80_500), weight(0, 80_000)], today, 7700)).toBeNull();
  // Losing 100 g a day on 2,200 kcal means burning about 770 kcal more than eaten.
  expect(measuredDailyKcal(days(28), [weight(21, 82_100), weight(0, 80_000)], today, 7700)).toBe(2970);
});
