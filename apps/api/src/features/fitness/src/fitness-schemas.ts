import { z } from 'zod';

const spaceId = z.uuid();
const day = z.iso.date();

export const spaceQuerySchema = z.object({ spaceId });

const macrosSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('preset'), preset: z.enum(['balanced', 'highProtein', 'lowCarb']) }),
  z.object({ method: z.literal('perKg'), proteinMgPerKg: z.number().int().min(500).max(4000), carbsPct: z.number().int().min(0).max(100) }),
  z.object({
    method: z.literal('manual'),
    kcal: z.number().int().min(500).max(10_000),
    proteinMg: z.number().int().min(0).max(1_000_000),
    carbsMg: z.number().int().min(0).max(2_000_000),
    fatMg: z.number().int().min(0).max(1_000_000),
  }),
]);

export const profileSchema = z.object({
  sex: z.enum(['male', 'female']).nullable(),
  birthDate: day.nullable(),
  heightMm: z.number().int().min(500).max(2500).nullable(),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'veryActive']),
  goal: z.enum(['lose', 'maintain', 'gain']),
  goalWeightG: z.number().int().min(20_000).max(400_000).nullable(),
  paceGPerWeek: z.number().int().min(0).max(1500),
  macros: macrosSchema,
  forecast: z.object({
    horizonDays: z.number().int().min(7).max(365),
    kcalPerKg: z.number().int().min(5000).max(9000),
    trendDays: z.number().int().min(7).max(60),
    energy: z.enum(['formula', 'measured']),
  }),
});
export type Profile = z.infer<typeof profileSchema>;

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

export const saveProfileSchema = profileSchema.extend({ spaceId });

const id = z.uuid();
const mgPer100g = z.number().int().min(0).max(100_000);

const foodFields = {
  name: z.string().trim().min(1).max(120),
  kcal: z.number().int().min(0).max(900),
  proteinMg: mgPer100g,
  carbsMg: mgPer100g,
  fatMg: mgPer100g,
  fiberMg: mgPer100g,
};
const servingFields = { label: z.string().trim().min(1).max(40), amountMg: z.number().int().min(1).max(5_000_000) };

export const searchFoodsSchema = z.object({ spaceId, q: z.string().max(100).default('') });
export const foodSchema = z.object(foodFields);
export const newFoodSchema = z.object({ id, spaceId, ...foodFields, servings: z.array(z.object({ id, ...servingFields })).max(20) });
export const newServingSchema = z.object({ id, spaceId, ...servingFields });
export type FoodInput = z.infer<typeof foodSchema>;
export type NewFoodInput = z.infer<typeof newFoodSchema>;
export type NewServingInput = z.infer<typeof newServingSchema> & { foodId: string };

const MAX_RANGE_DAYS = 400;
const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

export const daysSchema = z
  .object({ spaceId, from: day, to: day })
  .refine(({ from, to }) => from <= to && daysBetween(from, to) <= MAX_RANGE_DAYS, 'Ask for at most 400 days, oldest first');

const totalMg = z.number().int().min(0).max(20_000_000);

// A food as it was when logged or planned: its own name and numbers.
export const foodItemFields = {
  foodId: id.nullable(),
  name: z.string().trim().min(1).max(120),
  quantityMilli: z.number().int().min(1).max(100_000_000),
  servingLabel: z.string().trim().min(1).max(40),
  amountMg: z.number().int().min(1).max(20_000_000),
  kcal: z.number().int().min(0).max(50_000),
  proteinMg: totalMg,
  carbsMg: totalMg,
  fatMg: totalMg,
  fiberMg: totalMg,
};
export const meal = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

const logSchema = z.object({ id, day, meal, eaten: z.boolean(), ...foodItemFields });
export const addLogsSchema = z.object({ spaceId, logs: z.array(logSchema).min(1).max(100) });
export const updateLogSchema = z.object({ meal, eaten: z.boolean(), ...foodItemFields }).partial();
export type LogInput = z.infer<typeof logSchema>;
export type LogChanges = z.infer<typeof updateLogSchema>;

const title = z.string().trim().min(1).max(80);
// A whole-document save names the version it was edited from, so a stale one can be refused.
const editedVersion = { version: z.number().int().min(0) };
export type Versioned = { version: number };

export const mealPlanSchema = z.object({ name: title, items: z.array(z.object({ meal, ...foodItemFields })).min(1).max(100) });
export const newMealPlanSchema = mealPlanSchema.extend({ id, spaceId });
export const saveMealPlanSchema = mealPlanSchema.extend(editedVersion);
export type MealPlanInput = z.infer<typeof mealPlanSchema>;

export const weightSchema = z.object({ spaceId, day, weightG: z.number().int().min(20_000).max(400_000) });
export const weightQuerySchema = z.object({ spaceId, day });
export const MAX_GLASSES = 30;
export const waterSchema = z.object({ spaceId, day, glasses: z.number().int().min(0).max(MAX_GLASSES) });

export const MUSCLES = [
  'neck',
  'traps',
  'shoulders',
  'chest',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'lats',
  'middleBack',
  'lowerBack',
  'glutes',
  'abductors',
  'adductors',
  'quads',
  'hamstrings',
  'calves',
] as const;
const muscles = z.array(z.enum(MUSCLES)).max(MUSCLES.length);
const exerciseKind = z.enum(['weight', 'reps', 'time']);

export const exerciseSchema = z.object({
  name: title,
  kind: exerciseKind,
  equipment: z.string().trim().min(1).max(40).nullable(),
  primary: muscles,
  secondary: muscles,
});
export const newExerciseSchema = exerciseSchema.extend({ id, spaceId });
export type ExerciseInput = z.infer<typeof exerciseSchema>;

const count = (most: number) => z.number().int().min(0).max(most).nullable();
const workoutSet = z.object({ reps: count(1000), weightG: count(1_000_000), seconds: count(86_400), meters: count(1_000_000), done: z.boolean() });
// An exercise as it was when added: its own name and muscles, so later edits to the exercise never change a past workout.
const workoutItem = z.object({ exerciseId: id.nullable(), name: title, kind: exerciseKind, primary: muscles, secondary: muscles, sets: z.array(workoutSet).max(30) });

export const templateSchema = z.object({ name: title, items: z.array(workoutItem).min(1).max(60) });
export const newTemplateSchema = templateSchema.extend({ id, spaceId });
export const saveTemplateSchema = templateSchema.extend(editedVersion);
export const workoutSchema = z.object({ day, name: title, items: z.array(workoutItem).max(60) });
export const newWorkoutSchema = workoutSchema.extend({ id, spaceId });
export const saveWorkoutSchema = workoutSchema.extend(editedVersion);
export type TemplateInput = z.infer<typeof templateSchema>;
export type WorkoutInput = z.infer<typeof workoutSchema>;

// Summary figures only; the size cap keeps a whole diary from being passed through.
// Only these figures go to the AI for a macro suggestion: never a name, a food or a workout.
export const fitnessMacrosSchema = z.object({
  spaceId,
  figures: z.object({
    age: z.number().int().min(13).max(120),
    sex: z.enum(['male', 'female']),
    heightCm: z.number().min(50).max(250),
    weightKg: z.number().min(20).max(400),
    goalWeightKg: z.number().min(20).max(400).nullable(),
    goal: z.enum(['lose', 'maintain', 'gain']),
    paceKgPerWeek: z.number().min(0).max(1.5),
    activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'veryActive']),
    dailyKcal: z.number().int().min(500).max(8000),
  }),
});

export const fitnessReadSchema = z.object({
  spaceId,
  summary: z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 8_000, 'Summary too long'),
});
