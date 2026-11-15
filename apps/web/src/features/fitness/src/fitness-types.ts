import type { Muscle } from './muscles';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type Goal = 'lose' | 'maintain' | 'gain';
export type MacroPreset = 'balanced' | 'highProtein' | 'lowCarb';

// perKg: protein from body weight; of the calories left, carbsPct goes to carbs and the rest to fat.
export type Macros =
  | { method: 'preset'; preset: MacroPreset }
  | { method: 'perKg'; proteinMgPerKg: number; carbsPct: number }
  | { method: 'manual'; kcal: number; proteinMg: number; carbsMg: number; fatMg: number };

export type ForecastSettings = { horizonDays: number; kcalPerKg: number; trendDays: number; energy: 'formula' | 'measured' };

export type Profile = {
  sex: Sex | null;
  birthDate: string | null;
  heightMm: number | null;
  activity: Activity;
  goal: Goal;
  goalWeightG: number | null;
  paceGPerWeek: number;
  macros: Macros;
  forecast: ForecastSettings;
};

export const DEFAULT_PROFILE: Profile = {
  sex: null,
  birthDate: null,
  heightMm: null,
  activity: 'moderate',
  goal: 'maintain',
  goalWeightG: null,
  paceGPerWeek: 500,
  macros: { method: 'preset', preset: 'balanced' },
  forecast: { horizonDays: 90, kcalPerKg: 7700, trendDays: 14, energy: 'formula' },
};

// Food weight and macros are whole milligrams, energy whole kcal, body weight whole grams.
export type Targets = { kcal: number; proteinMg: number; carbsMg: number; fatMg: number };
export type Weight = { day: string; weightG: number };

export type Serving = { id: string; label: string; amountMg: number; custom: boolean };
// Nutrition is per 100 g.
export type Food = Targets & { id: string; name: string; category: string | null; custom: boolean; fiberMg: number; servings: Serving[] };

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABELS: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

// A food as it was when logged: its own name and numbers, so later edits to the food never change a past day.
export type FoodItem = Targets & {
  foodId: string | null;
  name: string;
  quantityMilli: number;
  servingLabel: string;
  amountMg: number;
  fiberMg: number;
};
export type FoodLog = FoodItem & { id: string; day: string; meal: Meal; eaten: boolean };
// `version` comes from the server; a row made in this browser has none until it is saved (it starts at 0).
export type MealPlan = { id: string; name: string; items: (FoodItem & { meal: Meal })[]; version?: number };

export type ExerciseKind = 'weight' | 'reps' | 'time';
export type Exercise = { id: string; name: string; kind: ExerciseKind; equipment: string | null; primary: Muscle[]; secondary: Muscle[]; custom: boolean };
export type WorkoutSet = { reps: number | null; weightG: number | null; seconds: number | null; meters: number | null; done: boolean };
export type WorkoutItem = { exerciseId: string | null; name: string; kind: ExerciseKind; primary: Muscle[]; secondary: Muscle[]; sets: WorkoutSet[] };
export type WorkoutTemplate = { id: string; name: string; items: WorkoutItem[]; version?: number };
export type Workout = { id: string; day: string; name: string; items: WorkoutItem[]; version?: number };

export type Day = { logs: FoodLog[]; workouts: Workout[] };
export type Fitness = { profile: Profile; weights: Weight[]; mealPlans: MealPlan[]; templates: WorkoutTemplate[]; aiEnabled: boolean };

export const FITNESS_VIEWS = ['today', 'workouts', 'progress', 'library', 'settings'] as const;
export type FitnessView = (typeof FITNESS_VIEWS)[number];

export type FitnessViewProps = {
  fitness: Fitness;
  today: string;
  day: string;
  hrefFor: (change: { view?: FitnessView; day?: string }) => string;
  // False for someone the space is shared with as "Can view": nothing that writes is offered.
  canEdit?: boolean;
};
