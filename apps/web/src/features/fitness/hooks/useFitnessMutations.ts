'use client';

import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '../src/fitness-api';
import type { Day, Exercise, Fitness, FoodLog, MealPlan, Profile, Weight, Workout, WorkoutTemplate } from '../src/fitness-types';
import { useFitnessSpaceId } from './useFitness';

// Runs fitness requests one at a time, so editing a new row can't reach the server before the row exists.
const scope = { id: 'fitness' };

type LogChanges = Partial<Omit<FoodLog, 'id' | 'day'>>;

export function useFitnessMutations() {
  const queryClient = useQueryClient();
  const spaceId = useFitnessSpaceId() as string;
  const fitnessKey = ['fitness', spaceId];
  const daysKey = ['fitness-days', spaceId];

  // Patches every cached query under `key` straight away, and puts them all back if the request fails.
  function useChange<T, D>(key: QueryKey, request: (input: T) => Promise<void>, apply: (data: D, input: T, queryKey: QueryKey) => D) {
    return useMutation({
      scope,
      mutationFn: request,
      onMutate: async (input: T) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueriesData<D>({ queryKey: key });
        for (const [queryKey, data] of previous) {
          if (data) queryClient.setQueryData<D>(queryKey, apply(data, input, queryKey));
        }
        return previous;
      },
      onError: (error: Error, _input, previous) => {
        for (const [queryKey, data] of previous ?? []) queryClient.setQueryData(queryKey, data);
        toast.error(error.message);
      },
    });
  }

  // A days query is keyed [..., from, to]; a row belongs in it when its day falls inside.
  const inRange = (day: string, queryKey: QueryKey) => day >= (queryKey[2] as string) && day <= (queryKey[3] as string);

  const saveProfile = useChange<Profile, Fitness>(
    fitnessKey,
    (profile) => api.saveProfile({ spaceId, profile }),
    (fitness, profile) => ({ ...fitness, profile }),
  );

  const addLogs = useChange<FoodLog[], Day>(
    daysKey,
    (logs) => api.addLogs({ spaceId, logs }),
    (day, logs, queryKey) => ({ ...day, logs: [...day.logs, ...logs.filter((log) => inRange(log.day, queryKey))] }),
  );

  const updateLog = useChange<{ id: string; changes: LogChanges }, Day>(daysKey, api.updateLog, (day, { id, changes }) => ({
    ...day,
    logs: day.logs.map((log) => (log.id === id ? { ...log, ...changes } : log)),
  }));

  const removeLog = useChange<string, Day>(daysKey, api.deleteLog, (day, id) => ({ ...day, logs: day.logs.filter((log) => log.id !== id) }));

  function deleteLogWithUndo(log: FoodLog) {
    removeLog.mutate(log.id);
    toast(`Removed ${log.name}`, { action: { label: 'Undo', onClick: () => addLogs.mutate([log]) } });
  }

  // One weigh-in per day: a second one on the same day replaces the first.
  const saveWeight = useChange<Weight, Fitness>(
    fitnessKey,
    (weight) => api.saveWeight({ ...weight, spaceId }),
    (fitness, weight) => ({
      ...fitness,
      weights: [...fitness.weights.filter(({ day }) => day !== weight.day), weight].sort((a, b) => a.day.localeCompare(b.day)),
    }),
  );
  const removeWeight = useChange<string, Fitness>(
    fitnessKey,
    (day) => api.deleteWeight({ spaceId, day }),
    (fitness, day) => ({ ...fitness, weights: fitness.weights.filter((weight) => weight.day !== day) }),
  );

  function deleteWeightWithUndo(weight: Weight) {
    removeWeight.mutate(weight.day);
    toast('Weigh-in deleted', { action: { label: 'Undo', onClick: () => saveWeight.mutate(weight) } });
  }

  const addMealPlan = useChange<MealPlan, Fitness>(
    fitnessKey,
    (plan) => api.createMealPlan({ ...plan, spaceId }),
    (fitness, plan) => ({ ...fitness, mealPlans: [...fitness.mealPlans, plan] }),
  );
  const saveMealPlan = useChange<MealPlan, Fitness>(fitnessKey, api.saveMealPlan, (fitness, plan) => ({
    ...fitness,
    mealPlans: fitness.mealPlans.map((existing) => (existing.id === plan.id ? plan : existing)),
  }));
  const removeMealPlan = useChange<string, Fitness>(fitnessKey, api.deleteMealPlan, (fitness, id) => ({
    ...fitness,
    mealPlans: fitness.mealPlans.filter((plan) => plan.id !== id),
  }));

  function deleteMealPlanWithUndo(plan: MealPlan) {
    removeMealPlan.mutate(plan.id);
    toast(`Deleted ${plan.name}`, { action: { label: 'Undo', onClick: () => addMealPlan.mutate(plan) } });
  }

  const addTemplate = useChange<WorkoutTemplate, Fitness>(
    fitnessKey,
    (template) => api.createTemplate({ ...template, spaceId }),
    (fitness, template) => ({ ...fitness, templates: [...fitness.templates, template] }),
  );
  const saveTemplate = useChange<WorkoutTemplate, Fitness>(fitnessKey, api.saveTemplate, (fitness, template) => ({
    ...fitness,
    templates: fitness.templates.map((existing) => (existing.id === template.id ? template : existing)),
  }));
  const removeTemplate = useChange<string, Fitness>(fitnessKey, api.deleteTemplate, (fitness, id) => ({
    ...fitness,
    templates: fitness.templates.filter((template) => template.id !== id),
  }));

  function deleteTemplateWithUndo(template: WorkoutTemplate) {
    removeTemplate.mutate(template.id);
    toast(`Deleted ${template.name}`, { action: { label: 'Undo', onClick: () => addTemplate.mutate(template) } });
  }

  const addWorkout = useChange<Workout, Day>(
    daysKey,
    (workout) => api.createWorkout({ ...workout, spaceId }),
    (day, workout, queryKey) => (inRange(workout.day, queryKey) ? { ...day, workouts: [...day.workouts, workout] } : day),
  );
  const saveWorkout = useChange<Workout, Day>(daysKey, api.saveWorkout, (day, workout) => ({
    ...day,
    workouts: day.workouts.map((existing) => (existing.id === workout.id ? workout : existing)),
  }));
  const removeWorkout = useChange<string, Day>(daysKey, api.deleteWorkout, (day, id) => ({ ...day, workouts: day.workouts.filter((workout) => workout.id !== id) }));

  function deleteWorkoutWithUndo(workout: Workout) {
    removeWorkout.mutate(workout.id);
    toast(`Deleted ${workout.name}`, { action: { label: 'Undo', onClick: () => addWorkout.mutate(workout) } });
  }

  const exercisesKey = ['fitness-exercises', spaceId];
  const addExercise = useChange<Exercise, Exercise[]>(
    exercisesKey,
    (exercise) => api.createExercise({ ...exercise, spaceId }),
    (exercises, exercise) => [...exercises, exercise].sort((a, b) => a.name.localeCompare(b.name)),
  );
  const removeExercise = useChange<string, Exercise[]>(exercisesKey, api.deleteExercise, (exercises, id) => exercises.filter((exercise) => exercise.id !== id));

  function deleteExerciseWithUndo(exercise: Exercise) {
    removeExercise.mutate(exercise.id);
    toast(`Deleted ${exercise.name}`, { action: { label: 'Undo', onClick: () => addExercise.mutate(exercise) } });
  }

  const refreshFoods = () => queryClient.invalidateQueries({ queryKey: ['fitness-foods', spaceId] });
  const onError = (error: Error) => toast.error(error.message);
  const createFood = useMutation({ scope, mutationFn: (food: Omit<Parameters<typeof api.createFood>[0], 'spaceId'>) => api.createFood({ ...food, spaceId }), onSuccess: refreshFoods, onError });
  const saveFood = useMutation({ scope, mutationFn: api.updateFood, onSuccess: refreshFoods, onError });
  const removeFood = useMutation({ scope, mutationFn: api.deleteFood, onSuccess: refreshFoods, onError });
  const addServing = useMutation({
    scope,
    mutationFn: (serving: api.NewServing & { foodId: string }) => api.addServing({ ...serving, spaceId }),
    onSuccess: refreshFoods,
    onError,
  });
  const removeServing = useMutation({ scope, mutationFn: api.deleteServing, onSuccess: refreshFoods, onError });

  return {
    saveProfile,
    addLogs,
    updateLog,
    deleteLogWithUndo,
    createFood,
    saveFood,
    removeFood,
    addServing,
    removeServing,
    addMealPlan,
    saveMealPlan,
    deleteMealPlanWithUndo,
    saveWeight,
    deleteWeightWithUndo,
    addTemplate,
    saveTemplate,
    deleteTemplateWithUndo,
    addWorkout,
    saveWorkout,
    deleteWorkoutWithUndo,
    addExercise,
    deleteExerciseWithUndo,
  };
}
