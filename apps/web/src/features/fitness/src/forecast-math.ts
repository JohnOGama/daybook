import { addDays } from '@/shared/utils/date-formatter';
import type { FoodLog, Profile, Targets, Weight } from './fitness-types';
import { totalsOf } from './food-math';

// What was eaten on one day. Days with nothing eaten have no entry, so they never count as zero.
export type DayIntake = Targets & { day: string };

const SMOOTHING = 0.1;
const MEASURE_WINDOW_DAYS = 35;
const MEASURE_SPAN_DAYS = 21;
const MEASURE_LOGGED_DAYS = 14;

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;
const daysBetween = (from: string, to: string) => Math.round(dayNumber(to) - dayNumber(from));
// The rows from the last `days` days up to today, oldest first.
const within = <T extends { day: string }>(rows: T[], today: string, days: number) =>
  rows.filter(({ day }) => day > addDays(today, -days) && day <= today).sort((a, b) => a.day.localeCompare(b.day));

export function intakeByDay(logs: FoodLog[]): DayIntake[] {
  const days = new Map<string, FoodLog[]>();
  for (const log of logs) {
    if (log.eaten) days.set(log.day, [...(days.get(log.day) ?? []), log]);
  }
  return [...days].map(([day, eaten]) => ({ day, ...totalsOf(eaten) })).sort((a, b) => a.day.localeCompare(b.day));
}

export function averageIntake(intake: DayIntake[], today: string, days: number): { days: number; average: Targets } | null {
  const logged = within(intake, today, days);
  if (logged.length === 0) return null;
  const total = totalsOf(logged);
  const mean = (value: number) => Math.round(value / logged.length);
  return { days: logged.length, average: { kcal: mean(total.kcal), proteinMg: mean(total.proteinMg), carbsMg: mean(total.carbsMg), fatMg: mean(total.fatMg) } };
}

// An exponential moving average that allows for gaps between weigh-ins, to see past day-to-day swings.
export function smoothed(weights: Weight[]): Weight[] {
  let level = weights[0]?.weightG ?? 0;
  return weights.map(({ day, weightG }, index) => {
    const gap = index === 0 ? 0 : daysBetween(weights[index - 1].day, day);
    level += (1 - (1 - SMOOTHING) ** gap) * (weightG - level);
    return { day, weightG: Math.round(level) };
  });
}

// Least-squares slope of the weigh-ins in the window, in grams per day.
function slope(weights: Weight[]): number | null {
  if (weights.length < 2) return null;
  const xs = weights.map(({ day }) => dayNumber(day));
  const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const meanY = weights.reduce((sum, { weightG }) => sum + weightG, 0) / weights.length;
  const spread = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  if (spread === 0) return null;
  return xs.reduce((sum, x, index) => sum + (x - meanX) * (weights[index].weightG - meanY), 0) / spread;
}

export const trendGPerDay = (weights: Weight[], today: string, days: number) => slope(within(weights, today, days + 1));

// Daily energy worked out from the owner's own logs: what they ate, less what their weight change accounts for.
export function measuredDailyKcal(intake: DayIntake[], weights: Weight[], today: string, kcalPerKg: number): number | null {
  const eaten = within(intake, today, MEASURE_WINDOW_DAYS);
  const weighed = within(weights, today, MEASURE_WINDOW_DAYS);
  const span = (rows: { day: string }[]) => (rows.length < 2 ? 0 : daysBetween(rows[0].day, rows[rows.length - 1].day));
  const gPerDay = slope(weighed);
  if (eaten.length < MEASURE_LOGGED_DAYS || span(eaten) < MEASURE_SPAN_DAYS || span(weighed) < MEASURE_SPAN_DAYS || gPerDay === null) return null;
  const average = eaten.reduce((sum, { kcal }) => sum + kcal, 0) / eaten.length;
  return Math.round(average - (gPerDay / 1000) * kcalPerKg);
}

export function planGPerDay(profile: Profile): number {
  if (profile.goal === 'maintain') return 0;
  return ((profile.goal === 'lose' ? -1 : 1) * profile.paceGPerWeek) / 7;
}

export const trendForecastGPerDay = (averageKcal: number, dailyKcal: number, kcalPerKg: number) => ((averageKcal - dailyKcal) / kcalPerKg) * 1000;

type ForecastInput = { startG: number; goalG: number | null; today: string; horizonDays: number; gPerDay: number };

// One point per day from today. Weight stops changing once the goal is reached.
export function forecast({ startG, goalG, today, horizonDays, gPerDay }: ForecastInput): { points: Weight[]; reachedOn: string | null } {
  const towardsGoal = goalG !== null && (goalG === startG || Math.sign(goalG - startG) === Math.sign(gPerDay));
  let reachedOn: string | null = null;
  const points = Array.from({ length: horizonDays + 1 }, (_, index) => {
    const day = addDays(today, index);
    const projected = startG + gPerDay * index;
    const reached = towardsGoal && (gPerDay < 0 ? projected <= (goalG as number) : projected >= (goalG as number));
    if (reached && reachedOn === null) reachedOn = day;
    return { day, weightG: Math.round(reached ? (goalG as number) : projected) };
  });
  return { points, reachedOn };
}
