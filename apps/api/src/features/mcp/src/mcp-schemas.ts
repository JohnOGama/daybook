import { z } from 'zod';
import { meal } from '../../fitness/index.ts';

// What AI apps send: the units people say (grams, servings, kg, seconds, meters). The tools convert to what Daybook stores.

const spaceId = z.uuid().optional().describe('The Fitness space, from list_fitness_spaces. Leave it out when the person has only one.');
const day = z.iso.date().describe("The user's local date, YYYY-MM-DD. Always send it; Daybook never guesses today.");
const grams = (most: number) => z.number().min(0).max(most);

const foodById = z.object({
  foodId: z.uuid().describe('A food id from search_foods.'),
  grams: z.number().min(0.1).max(20_000).describe('How much was eaten, in grams.'),
});
const servingsOfFood = z.object({
  foodId: z.uuid().describe('A food id from search_foods.'),
  servingId: z.uuid().describe("One of that food's serving ids from search_foods."),
  servings: z.number().min(0.01).max(100).describe('How many of that serving were eaten.'),
});
const oneOffFood = z.object({
  name: z.string().trim().min(1).max(120),
  grams: z.number().min(0.1).max(20_000).describe('Your estimate of the weight eaten, in grams.'),
  kcal: z.number().min(0).max(50_000).describe('Your estimate for the whole amount eaten.'),
  proteinG: grams(20_000),
  carbsG: grams(20_000),
  fatG: grams(20_000),
  fiberG: grams(20_000),
});
export const foodItemInput = z.union([foodById, servingsOfFood, oneOffFood]);
export type FoodItemInput = z.infer<typeof foodItemInput>;

export const logFoodInput = z.object({ spaceId, day, meal, items: z.array(foodItemInput).min(1).max(30) });

const workoutSetInput = z.object({
  reps: z.number().int().min(0).max(1000).optional(),
  kg: z.number().min(0).max(1000).optional(),
  seconds: z.number().int().min(0).max(86_400).optional(),
  meters: z.number().min(0).max(1_000_000).optional(),
});
const workoutExerciseInput = z
  .object({
    exerciseId: z.uuid().optional().describe('An exercise id from search_exercises.'),
    name: z.string().trim().min(1).max(80).optional().describe('Only when search_exercises finds nothing that fits.'),
    sets: z.array(workoutSetInput).min(1).max(30),
  })
  .refine(({ exerciseId, name }) => exerciseId || name, 'Give an exerciseId or a name');
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseInput>;

export const logWorkoutInput = z.object({ spaceId, day, name: z.string().trim().min(1).max(80), exercises: z.array(workoutExerciseInput).min(1).max(60) });
export const searchInput = z.object({ spaceId, query: z.string().trim().min(1).max(100) });
export const dayInput = z.object({ spaceId, day });
export const logWeightInput = z.object({ spaceId, day, kg: z.number().min(20).max(400) });
export const removeFoodLogInput = z.object({ logId: z.uuid().describe('A food log id from get_day or log_food.') });
export const removeWorkoutInput = z.object({ workoutId: z.uuid().describe('A workout id from get_day or log_workout.') });

export type LogFoodInput = z.infer<typeof logFoodInput>;
export type LogWorkoutInput = z.infer<typeof logWorkoutInput>;
export type SearchInput = z.infer<typeof searchInput>;
export type DayInput = z.infer<typeof dayInput>;
export type LogWeightInput = z.infer<typeof logWeightInput>;
