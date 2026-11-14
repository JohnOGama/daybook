import { expect, it } from 'vitest';
import { DEFAULT_PROFILE, type Profile } from './fitness-types';
import { ageOn, bmi, bmiBand, dailyKcal, restingKcal, targetsFor, targetWarnings } from './targets-math';

const today = '2026-11-13';
const profile: Profile = { ...DEFAULT_PROFILE, sex: 'male', birthDate: '1996-11-13', heightMm: 1800, goal: 'lose', paceGPerWeek: 500 };

it('works out age, BMI and its band', () => {
  expect(ageOn('1996-11-13', today)).toBe(30);
  expect(ageOn('1996-11-14', today)).toBe(29);
  expect(bmi(80_000, 1800)).toBe(24.7);
  expect(bmiBand(24.7)).toBe('Healthy');
  expect(bmiBand(18.4)).toBe('Underweight');
  expect(bmiBand(25)).toBe('Overweight');
  expect(bmiBand(30)).toBe('Obese');
});

it('works out resting and daily energy with Mifflin-St Jeor', () => {
  expect(restingKcal({ sex: 'male', weightG: 80_000, heightMm: 1800, age: 30 })).toBe(1780);
  expect(restingKcal({ sex: 'female', weightG: 60_000, heightMm: 1650, age: 30 })).toBe(1320);
  expect(dailyKcal(1780, 'moderate')).toBe(2759);
});

it('sets calorie and macro targets from the goal, pace and macro method', () => {
  expect(targetsFor(profile, 80_000, today)).toEqual({ kcal: 2209, proteinMg: 165_700, carbsMg: 220_900, fatMg: 73_600 });
  expect(targetsFor({ ...profile, goal: 'gain' }, 80_000, today)?.kcal).toBe(3309);
  expect(targetsFor({ ...profile, goal: 'maintain' }, 80_000, today)?.kcal).toBe(2759);
  expect(targetsFor({ ...profile, macros: { method: 'perKg', proteinMgPerKg: 2000, carbsPct: 50 } }, 80_000, today)).toEqual({
    kcal: 2209,
    proteinMg: 160_000,
    carbsMg: 196_100,
    fatMg: 87_200,
  });
  const manual = { method: 'manual', kcal: 2000, proteinMg: 150_000, carbsMg: 200_000, fatMg: 60_000 } as const;
  expect(targetsFor({ ...DEFAULT_PROFILE, macros: manual }, null, today)).toEqual({ kcal: 2000, proteinMg: 150_000, carbsMg: 200_000, fatMg: 60_000 });
});

it('gives no targets, and no nonsense numbers, while height, weight, sex or birth date is missing', () => {
  expect(targetsFor({ ...profile, heightMm: null }, 80_000, today)).toBeNull();
  expect(targetsFor(profile, null, today)).toBeNull();
  expect(targetsFor(DEFAULT_PROFILE, 80_000, today)).toBeNull();
  expect(targetWarnings(DEFAULT_PROFILE, null, today)).toEqual([]);
});

it('warns about a target below resting energy and a pace above 1% of body weight a week', () => {
  expect(targetWarnings(profile, 80_000, today)).toEqual([]);
  expect(targetWarnings({ ...profile, paceGPerWeek: 1200 }, 80_000, today)).toHaveLength(2);
});
