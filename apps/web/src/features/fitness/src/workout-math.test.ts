import { expect, it } from 'vitest';
import type { Workout, WorkoutItem, WorkoutSet, WorkoutTemplate } from './fitness-types';
import { MUSCLES } from './muscles';
import { formatSets, lastTime, muscleLoad, musclesOf, setsDone, templateFromWorkout, workoutFromTemplate } from './workout-math';

const set = (done: boolean, reps = 8, weightG = 60_000): WorkoutSet => ({ reps, weightG, seconds: null, meters: null, done });
const bench = (sets: WorkoutSet[]): WorkoutItem => ({ exerciseId: 'bench', name: 'Bench press', kind: 'weight', primary: ['chest'], secondary: ['triceps', 'shoulders'], sets });
const workout = (day: string, items: WorkoutItem[]): Workout => ({ id: day, day, name: 'Push day', items });

it('starts a workout from a template as its own copy with nothing ticked', () => {
  const template: WorkoutTemplate = { id: 't1', name: 'Push day', items: [bench([set(true), set(false)])] };
  const original = structuredClone(template);
  const started = workoutFromTemplate(template, '2026-11-13', 'w1');
  expect(started).toEqual({ id: 'w1', day: '2026-11-13', name: 'Push day', items: [bench([set(false), set(false)])] });
  started.items[0].sets[0].reps = 99;
  started.items[0].primary.push('lats');
  expect(template).toEqual(original);
});

it('saves a workout as a template without its ticks', () => {
  expect(templateFromWorkout('Push', workout('2026-11-13', [bench([set(true)])]), 't2')).toEqual({ id: 't2', name: 'Push', items: [bench([set(false)])] });
});

it('finds what was done last time, skipping later days and workouts with nothing ticked', () => {
  const history = [
    workout('2026-11-01', [bench([set(true, 8, 55_000)])]),
    workout('2026-11-08', [bench([set(true, 8, 60_000), set(false)])]),
    workout('2026-11-10', [bench([set(false)])]),
    workout('2026-11-20', [bench([set(true, 8, 70_000)])]),
  ];
  expect(lastTime(bench([]), '2026-11-13', history)).toEqual({ day: '2026-11-08', sets: [set(true, 8, 60_000)] });
  expect(lastTime(bench([]), '2026-11-01', history)).toBeNull();
  expect(lastTime({ ...bench([]), exerciseId: 'squat' }, '2026-11-13', history)).toBeNull();
  const custom = { ...bench([set(true)]), exerciseId: null, name: 'My press' };
  expect(lastTime(custom, '2026-11-13', [workout('2026-11-02', [custom])])?.day).toBe('2026-11-02');
});

it('counts done sets per muscle: one for a primary muscle, half for a secondary', () => {
  const load = muscleLoad([workout('2026-11-13', [bench([set(true), set(true), set(true), set(false)])])]);
  expect(load).toMatchObject({ chest: 3, triceps: 1.5, shoulders: 1.5, quads: 0 });
  expect(Object.keys(load)).toEqual([...MUSCLES]);
  expect(Object.values(muscleLoad([])).every((value) => value === 0)).toBe(true);
});

it('lists a muscle once, as primary when any exercise has it primary', () => {
  const dips: WorkoutItem = { exerciseId: 'dips', name: 'Dips', kind: 'reps', primary: ['triceps'], secondary: ['chest'], sets: [] };
  expect(musclesOf([bench([]), dips])).toEqual({ primary: ['chest', 'triceps'], secondary: ['shoulders'] });
  expect(musclesOf([])).toEqual({ primary: [], secondary: [] });
});

it('writes sets the short way, and counts how many are done', () => {
  expect(formatSets([set(true), set(true), set(true)], 'weight')).toBe('3 × 8 at 60 kg');
  expect(formatSets([set(true, 8, 60_000), set(true, 6, 62_500)], 'weight')).toBe('8 at 60 kg, 6 at 62.5 kg');
  expect(formatSets([{ ...set(true), weightG: null }, { ...set(true), weightG: null }], 'reps')).toBe('2 × 8');
  expect(formatSets([{ reps: null, weightG: null, seconds: 1500, meters: 5000, done: true }], 'time')).toBe('25 min, 5 km');
  expect(formatSets([], 'weight')).toBe('No sets');
  expect(setsDone(workout('2026-11-13', [bench([set(true), set(false)]), bench([set(true)])]))).toEqual({ done: 2, total: 3 });
});
