import { throwIfConflict } from '@/shared/utils/conflict-error';
import type { Day, Exercise, Fitness, Food, FoodLog, MealPlan, Profile, Water, Weight, Workout, WorkoutTemplate } from './fitness-types';

async function request(method: string, path: string, body: unknown, failure: string): Promise<Response> {
  const response = await fetch(`/api/fitness${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  throwIfConflict(response);
  if (!response.ok) throw new Error(failure);
  return response;
}

async function send(method: string, path: string, body: unknown, failure: string): Promise<void> {
  await request(method, path, body, failure);
}

// Whole-document saves name the version they were edited from and get the new one back.
type Saved = { version: number };
const saveDocument = async (path: string, body: { version: number }, failure: string): Promise<Saved> =>
  (await request('PUT', path, body, failure)).json();

async function load<T>(path: string, query: Record<string, string>, failure: string): Promise<T> {
  const response = await fetch(`/api/fitness${path}?${new URLSearchParams(query)}`);
  if (!response.ok) throw new Error(failure);
  return response.json();
}

export const fetchFitness = (spaceId: string) => load<Fitness>('', { spaceId }, 'Could not load this fitness space');

export const saveProfile = (input: { spaceId: string; profile: Profile }) =>
  send('PUT', '/profile', { spaceId: input.spaceId, ...input.profile }, 'Your settings could not be saved. Please try again.');

export const fetchDays = (spaceId: string, from: string, to: string) => load<Day>('/days', { spaceId, from, to }, 'Could not load these days');

export const searchFoods = (spaceId: string, q: string) => load<Food[]>('/foods', { spaceId, q }, 'Could not search foods');
export const fetchRecentFoods = (spaceId: string) => load<Food[]>('/foods/recent', { spaceId }, 'Could not load your recent foods');

export type NewServing = { id: string; label: string; amountMg: number };
type FoodNumbers = Pick<Food, 'name' | 'kcal' | 'proteinMg' | 'carbsMg' | 'fatMg' | 'fiberMg'>;

export const createFood = (input: FoodNumbers & { id: string; spaceId: string; servings: NewServing[] }) =>
  send('POST', '/foods', input, 'That food could not be saved. Please try again.');
export const updateFood = ({ id, food }: { id: string; food: FoodNumbers }) =>
  send('PATCH', `/foods/${id}`, food, 'That food could not be saved. Please try again.');
export const deleteFood = (id: string) => send('DELETE', `/foods/${id}`, undefined, 'That food could not be deleted. Please try again.');
export const addServing = ({ foodId, ...serving }: NewServing & { spaceId: string; foodId: string }) =>
  send('POST', `/foods/${foodId}/servings`, serving, 'That serving could not be saved. Please try again.');
export const deleteServing = (id: string) => send('DELETE', `/servings/${id}`, undefined, 'That serving could not be deleted. Please try again.');

export const addLogs = (input: { spaceId: string; logs: FoodLog[] }) => send('POST', '/logs', input, 'That could not be added to your day. Please try again.');
export const updateLog = ({ id, changes }: { id: string; changes: Partial<Omit<FoodLog, 'id' | 'day'>> }) =>
  send('PATCH', `/logs/${id}`, changes, 'That change could not be saved. Please try again.');
export const deleteLog = (id: string) => send('DELETE', `/logs/${id}`, undefined, 'That could not be removed. Please try again.');

export const fetchMyFoods = (spaceId: string) => load<Food[]>('/foods/mine', { spaceId }, 'Could not load your foods');

export const createMealPlan = (input: MealPlan & { spaceId: string }) => send('POST', '/meal-plans', input, 'That meal plan could not be saved. Please try again.');
export const saveMealPlan = ({ id, ...plan }: MealPlan & Saved) => saveDocument(`/meal-plans/${id}`, plan, 'That meal plan could not be saved. Please try again.');
export const deleteMealPlan = (id: string) => send('DELETE', `/meal-plans/${id}`, undefined, 'That meal plan could not be deleted. Please try again.');

export const saveWater = (input: Water & { spaceId: string }) => send('PUT', '/water', input, 'That could not be saved. Please try again.');
export const saveWeight = (input: Weight & { spaceId: string }) => send('PUT', '/weights', input, 'That weigh-in could not be saved. Please try again.');
export const deleteWeight = ({ spaceId, day }: { spaceId: string; day: string }) =>
  send('DELETE', `/weights?${new URLSearchParams({ spaceId, day })}`, undefined, 'That weigh-in could not be deleted. Please try again.');

export const fetchExercises = (spaceId: string) => load<Exercise[]>('/exercises', { spaceId }, 'Could not load the exercise list');
export const createExercise = ({ custom: _custom, ...exercise }: Exercise & { spaceId: string }) =>
  send('POST', '/exercises', exercise, 'That exercise could not be saved. Please try again.');
export const deleteExercise = (id: string) => send('DELETE', `/exercises/${id}`, undefined, 'That exercise could not be deleted. Please try again.');

export const createTemplate = (input: WorkoutTemplate & { spaceId: string }) => send('POST', '/templates', input, 'That template could not be saved. Please try again.');
export const saveTemplate = ({ id, ...template }: WorkoutTemplate & Saved) => saveDocument(`/templates/${id}`, template, 'That template could not be saved. Please try again.');
export const deleteTemplate = (id: string) => send('DELETE', `/templates/${id}`, undefined, 'That template could not be deleted. Please try again.');

export const createWorkout = (input: Workout & { spaceId: string }) => send('POST', '/workouts', input, 'That workout could not be saved. Please try again.');
export const saveWorkout = ({ id, ...workout }: Workout & Saved) => saveDocument(`/workouts/${id}`, workout, 'Your workout could not be saved. Please try again.');
export const deleteWorkout = (id: string) => send('DELETE', `/workouts/${id}`, undefined, 'That workout could not be deleted. Please try again.');

export type MacroFigures = {
  age: number;
  sex: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  goalWeightKg: number | null;
  goal: 'lose' | 'maintain' | 'gain';
  paceKgPerWeek: number;
  activity: string;
  dailyKcal: number;
};
export type MacroSuggestion = { proteinGPerKg: number; carbsPct: number; reason: string };

export async function suggestMacros(input: { spaceId: string; figures: MacroFigures }): Promise<MacroSuggestion> {
  const response = await fetch('/api/fitness/ai/macros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (response.status === 429) throw new Error('The AI service is busy. Please try again in a minute.');
  if (!response.ok) throw new Error("The AI couldn't suggest macros just now. The standard split is used instead.");
  return response.json();
}

export type FitnessRead = { headline: string; points: string[] };

export async function fetchFitnessRead(input: { spaceId: string; summary: Record<string, unknown> }): Promise<FitnessRead> {
  const response = await fetch('/api/fitness/ai/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  if (response.status === 429) throw new Error('The AI service is busy. Please try again in a minute.');
  if (!response.ok) throw new Error("The AI couldn't help with that just now. Please try again.");
  return response.json();
}
