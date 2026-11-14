import { addDays } from '@/shared/utils/date-formatter';
import type { Day, Goal, Profile, Targets, Weight } from './fitness-types';
import { averageIntake, forecast, intakeByDay, measuredDailyKcal, planGPerDay, trendForecastGPerDay, trendGPerDay } from './forecast-math';
import { MUSCLE_LABELS, MUSCLES } from './muscles';
import { ageOn, bmi, energyFor, targetsFor } from './targets-math';
import { muscleLoad } from './workout-math';

const GOAL_WORDS: Record<Goal, string> = { lose: 'lose weight', maintain: 'maintain weight', gain: 'gain weight' };

const kg = (grams: number) => Number((grams / 1000).toFixed(1));
const g = (mg: number) => Math.round(mg / 1000);

function intakeSummary(average: { days: number; average: Targets } | null) {
  if (!average) return null;
  const { kcal, proteinMg, carbsMg, fatMg } = average.average;
  return { daysLogged: average.days, averageKcal: kcal, averageProteinG: g(proteinMg), averageCarbsG: g(carbsMg), averageFatG: g(fatMg) };
}

type SummaryInput = { profile: Profile; weights: Weight[]; days: Day; today: string };

// Everything the AI read is sent. Figures only: no food, exercise or workout names, no notes, no space title.
export function fitnessSummary({ profile, weights, days, today }: SummaryInput): Record<string, unknown> {
  const current = weights.at(-1)?.weightG ?? null;
  const intake = intakeByDay(days.logs);
  const targets = targetsFor(profile, current, today);
  const energy = energyFor(profile, current, today);
  const measured = measuredDailyKcal(intake, weights, today, profile.forecast.kcalPerKg);
  const dailyKcal = profile.forecast.energy === 'measured' && measured !== null ? measured : (energy?.daily ?? null);
  const week = averageIntake(intake, today, 7);
  const trend = trendGPerDay(weights, today, profile.forecast.trendDays);
  const load = muscleLoad(days.workouts.filter(({ day }) => day > addDays(today, -7)));
  const reachedOn = (gPerDay: number) =>
    forecast({ startG: current as number, goalG: profile.goalWeightG, today, horizonDays: profile.forecast.horizonDays, gPerDay }).reachedOn ?? 'not within the forecast window';

  return {
    age: profile.birthDate ? ageOn(profile.birthDate, today) : null,
    sex: profile.sex,
    heightCm: profile.heightMm ? profile.heightMm / 10 : null,
    activityLevel: profile.activity,
    goal: GOAL_WORDS[profile.goal],
    goalWeightKg: profile.goalWeightG ? kg(profile.goalWeightG) : null,
    paceKgPerWeek: profile.goal === 'maintain' ? null : profile.paceGPerWeek / 1000,
    currentWeightKg: current ? kg(current) : null,
    bmi: current && profile.heightMm ? bmi(current, profile.heightMm) : null,
    weightTrendKgPerWeek: trend === null ? null : Number(((trend * 7) / 1000).toFixed(2)),
    estimatedDailyEnergyKcal: dailyKcal,
    dailyTargets: targets ? { kcal: targets.kcal, proteinG: g(targets.proteinMg), carbsG: g(targets.carbsMg), fatG: g(targets.fatMg) } : null,
    last7Days: intakeSummary(week),
    last30Days: intakeSummary(averageIntake(intake, today, 30)),
    doneSetsPerMuscleLast7Days: Object.fromEntries(MUSCLES.filter((muscle) => load[muscle] > 0).map((muscle) => [MUSCLE_LABELS[muscle], load[muscle]])),
    forecast:
      current && profile.goalWeightG
        ? {
            onPlanReachesGoalOn: profile.goal === 'maintain' ? 'goal is to maintain' : reachedOn(planGPerDay(profile)),
            onTrendReachesGoalOn: week && dailyKcal !== null ? reachedOn(trendForecastGPerDay(week.average.kcal, dailyKcal, profile.forecast.kcalPerKg)) : 'not enough food logged',
          }
        : null,
  };
}
