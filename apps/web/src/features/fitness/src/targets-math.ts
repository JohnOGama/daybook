import type { Activity, MacroPreset, Profile, Sex, Targets } from './fitness-types';

export const ACTIVITY_FACTORS: Record<Activity, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };

// Share of calories from protein, carbs and fat.
export const PRESET_SPLITS: Record<MacroPreset, { protein: number; carbs: number; fat: number }> = {
  balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  highProtein: { protein: 0.4, carbs: 0.3, fat: 0.3 },
  lowCarb: { protein: 0.4, carbs: 0.2, fat: 0.4 },
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };
const toMg = (grams: number) => Math.round((grams * 1000) / 100) * 100;

export function ageOn(birthDate: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

export function bmi(weightG: number, heightMm: number): number {
  const metres = heightMm / 1000;
  return Math.round((weightG / 1000 / (metres * metres)) * 10) / 10;
}

export function bmiBand(value: number): 'Underweight' | 'Healthy' | 'Overweight' | 'Obese' {
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Healthy';
  return value < 30 ? 'Overweight' : 'Obese';
}

// Mifflin-St Jeor.
export function restingKcal({ sex, weightG, heightMm, age }: { sex: Sex; weightG: number; heightMm: number; age: number }): number {
  return Math.round((10 * weightG) / 1000 + (6.25 * heightMm) / 10 - 5 * age + (sex === 'male' ? 5 : -161));
}

export const dailyKcal = (resting: number, activity: Activity) => Math.round(resting * ACTIVITY_FACTORS[activity]);

// Resting and daily energy from the formula, or null until sex, birth date, height and weight are all known.
export function energyFor(profile: Profile, weightG: number | null, today: string): { resting: number; daily: number } | null {
  if (!profile.sex || !profile.birthDate || !profile.heightMm || !weightG) return null;
  const resting = restingKcal({ sex: profile.sex, weightG, heightMm: profile.heightMm, age: ageOn(profile.birthDate, today) });
  return { resting, daily: dailyKcal(resting, profile.activity) };
}

export function goalKcalPerDay(profile: Profile): number {
  if (profile.goal === 'maintain') return 0;
  const perDay = Math.round(((profile.paceGPerWeek / 1000) * profile.forecast.kcalPerKg) / 7);
  return profile.goal === 'lose' ? -perDay : perDay;
}

// `daily` replaces the formula's daily energy, for when it is measured from the owner's own logs.
export function targetsFor(profile: Profile, weightG: number | null, today: string, daily?: number): Targets | null {
  const { macros } = profile;
  if (macros.method === 'manual') return { kcal: macros.kcal, proteinMg: macros.proteinMg, carbsMg: macros.carbsMg, fatMg: macros.fatMg };
  const energy = energyFor(profile, weightG, today);
  if (!energy || !weightG) return null;
  const kcal = Math.max(0, (daily ?? energy.daily) + goalKcalPerDay(profile));
  if (macros.method === 'preset') {
    const split = PRESET_SPLITS[macros.preset];
    return {
      kcal,
      proteinMg: toMg((kcal * split.protein) / KCAL_PER_G.protein),
      carbsMg: toMg((kcal * split.carbs) / KCAL_PER_G.carbs),
      fatMg: toMg((kcal * split.fat) / KCAL_PER_G.fat),
    };
  }
  const proteinMg = toMg(((macros.proteinMgPerKg / 1000) * weightG) / 1000);
  const rest = Math.max(0, kcal - (proteinMg / 1000) * KCAL_PER_G.protein);
  return {
    kcal,
    proteinMg,
    carbsMg: toMg((rest * macros.carbsPct) / 100 / KCAL_PER_G.carbs),
    fatMg: toMg((rest * (100 - macros.carbsPct)) / 100 / KCAL_PER_G.fat),
  };
}

export function targetWarnings(profile: Profile, weightG: number | null, today: string): string[] {
  const energy = energyFor(profile, weightG, today);
  const targets = targetsFor(profile, weightG, today);
  if (!energy || !targets || !weightG) return [];
  const warnings: string[] = [];
  if (targets.kcal < energy.resting) {
    warnings.push(`This target is below your resting energy (${energy.resting.toLocaleString()} kcal), which is hard to keep up safely.`);
  }
  if (profile.goal !== 'maintain' && profile.paceGPerWeek > weightG * 0.01) {
    warnings.push('This pace is more than 1% of your body weight a week. A slower pace is easier to hold.');
  }
  return warnings;
}
