import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { FitnessPageComponent } from './FitnessPageComponent';
import { type Day, DEFAULT_PROFILE, type Fitness, type Food, type FoodLog, type Profile, type WorkoutItem } from './fitness-types';

const { useFitness, useFitnessDays, useFoodSearch, mutations, query } = vi.hoisted(() => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(async () => undefined), isPending: false });
  return {
    useFitness: vi.fn(),
    useFitnessDays: vi.fn(),
    useFoodSearch: vi.fn(),
    mutations: {
      saveProfile: mutation(),
      addLogs: mutation(),
      updateLog: mutation(),
      deleteLogWithUndo: vi.fn(),
      createFood: mutation(),
      saveFood: mutation(),
      removeFood: mutation(),
      addServing: mutation(),
      removeServing: mutation(),
      addMealPlan: mutation(),
      saveMealPlan: mutation(),
      deleteMealPlanWithUndo: vi.fn(),
      saveWeight: mutation(),
      deleteWeightWithUndo: vi.fn(),
      addTemplate: mutation(),
      saveTemplate: mutation(),
      deleteTemplateWithUndo: vi.fn(),
      addWorkout: mutation(),
      saveWorkout: mutation(),
      deleteWorkoutWithUndo: vi.fn(),
      addExercise: mutation(),
      deleteExerciseWithUndo: vi.fn(),
    },
    query: { current: 'space=s1' },
  };
});

vi.mock('../hooks/useFitness', () => ({ useFitness, useFitnessSpaceId: () => 's1' }));
vi.mock('../hooks/useFitnessDays', () => ({ useFitnessDays }));
vi.mock('../hooks/useFoodSearch', () => ({ useFoodSearch }));
vi.mock('../hooks/useExercises', () => ({ useExercises: () => ({ data: [], isPending: false, isError: false }) }));
vi.mock('../hooks/useMyFoods', () => ({ useMyFoods: () => ({ data: [], isPending: false, isError: false }) }));
vi.mock('../hooks/useFitnessMutations', () => ({ useFitnessMutations: () => mutations }));
const ai = vi.hoisted(() => ({ fetchFitnessRead: vi.fn() }));
vi.mock('./fitness-api', async (original) => ({ ...(await original<typeof import('./fitness-api')>()), ...ai }));
vi.mock('@/features/spaces', () => ({ useActiveSpace: () => ({ id: 's1', title: 'Body', tool: 'fitness' }) }));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-13' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(query.current) }));

const profile: Profile = { ...DEFAULT_PROFILE, sex: 'male', birthDate: '1996-11-13', heightMm: 1800, goal: 'lose', paceGPerWeek: 500 };
const empty: Fitness = { profile: DEFAULT_PROFILE, weights: [], mealPlans: [], templates: [], aiEnabled: false };
const withTargets: Fitness = { ...empty, profile, weights: [{ day: '2026-11-01', weightG: 82_000 }, { day: '2026-11-12', weightG: 80_000 }] };

const rice: Food = { id: 'rice', name: 'Rice, white, cooked', category: null, custom: false, kcal: 130, proteinMg: 2690, carbsMg: 28_170, fatMg: 280, fiberMg: 400, servings: [] };
const riceLog = (id: string, eaten: boolean): FoodLog => ({
  id,
  day: '2026-11-13',
  meal: 'lunch',
  eaten,
  foodId: 'rice',
  name: 'Rice, white, cooked',
  quantityMilli: 250_000,
  servingLabel: 'g',
  amountMg: 250_000,
  kcal: 325,
  proteinMg: 6725,
  carbsMg: 70_425,
  fatMg: 700,
  fiberMg: 1000,
});

const show = (fitness: Fitness, search = 'space=s1', day: Day = { logs: [], workouts: [] }) => {
  query.current = search;
  useFitness.mockReturnValue({ data: fitness, isPending: false, isError: false });
  useFitnessDays.mockReturnValue({ data: day, isPending: false, isError: false });
  useFoodSearch.mockReturnValue({ data: [rice], isPending: false, isError: false });
  render(<FitnessPageComponent />);
};
const tile = (label: string) => screen.getByText(label).parentElement as HTMLElement;

beforeEach(() => vi.clearAllMocks());

it('asks for height and weight before showing targets, and never shows a broken number', () => {
  show(empty, 'space=s1&view=settings');
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByText('Add your height and weight to see targets')).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
});

it('shows the calorie target and BMI worked out from the profile and the latest weigh-in', () => {
  show(withTargets, 'space=s1&view=settings');
  expect(screen.getByText('2,209 kcal')).toBeInTheDocument();
  expect(screen.getByText(/BMI 24.7 \(Healthy\)/)).toBeInTheDocument();
});

it('counts only eaten food against the target, and ticking a planned row marks it eaten', async () => {
  show(withTargets, 'space=s1', { logs: [riceLog('eaten', true), riceLog('planned', false)], workouts: [] });
  expect(within(tile('Calories')).getByText('325 kcal')).toBeInTheDocument();
  expect(within(tile('Calories')).getByText('1,884 kcal left of 2,209 kcal')).toBeInTheDocument();
  expect(screen.getByText(/If you finish what is planned: 650 kcal/)).toBeInTheDocument();
  const [eaten, planned] = screen.getAllByRole('checkbox', { name: 'Eaten: Rice, white, cooked' });
  expect(eaten).toBeChecked();
  await userEvent.click(planned);
  expect(mutations.updateLog.mutate).toHaveBeenCalledWith({ id: 'planned', changes: { eaten: true } });
});

it('shows an empty day without targets as zeros and a prompt, not broken numbers', () => {
  show(empty);
  expect(within(tile('Calories')).getByText('0 kcal')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Set up your profile' })).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
});

it('adds a searched food to a meal by amount, and refuses an amount of zero', async () => {
  show(withTargets);
  await userEvent.click(screen.getByRole('button', { name: 'Add food to Lunch' }));
  const sheet = within(screen.getByRole('dialog'));
  await userEvent.click(sheet.getByRole('button', { name: /Rice, white, cooked/ }));
  const amount = sheet.getByLabelText('Amount');
  const add = sheet.getByRole('button', { name: 'Add to day' });
  await userEvent.clear(amount);
  await userEvent.type(amount, '0');
  expect(add).toBeDisabled();
  await userEvent.clear(amount);
  await userEvent.type(amount, '250');
  expect(sheet.getByLabelText('Calories and macros for this amount')).toHaveTextContent('325 kcal');
  await userEvent.click(add);
  expect(mutations.addLogs.mutate).toHaveBeenCalledWith([
    expect.objectContaining({ day: '2026-11-13', meal: 'lunch', eaten: true, foodId: 'rice', amountMg: 250_000, kcal: 325, servingLabel: 'g' }),
  ]);
});

it('applies a meal plan to the shown day as planned rows', async () => {
  const { id: _id, day: _day, eaten: _eaten, ...item } = riceLog('x', true);
  const plan = { id: 'p1', name: 'Cutting day', items: [item, { ...item, meal: 'dinner' as const }] };
  show({ ...withTargets, mealPlans: [plan] }, 'space=s1&day=2026-11-10');
  await userEvent.click(screen.getByRole('button', { name: 'Meal plan' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Apply “Cutting day”' }));
  expect(mutations.addLogs.mutate).toHaveBeenCalledWith([
    expect.objectContaining({ day: '2026-11-10', meal: 'lunch', eaten: false, kcal: 325 }),
    expect.objectContaining({ day: '2026-11-10', meal: 'dinner', eaten: false }),
  ]);
});

it('lists meal plans in the library with their size', () => {
  const { id: _id, day: _day, eaten: _eaten, ...item } = riceLog('x', true);
  show({ ...withTargets, mealPlans: [{ id: 'p1', name: 'Cutting day', items: [item, item] }] }, 'space=s1&view=library');
  expect(screen.getByRole('button', { name: /Cutting day/ })).toHaveTextContent('2 foods · 650 kcal');
});

it('asks for a first weigh-in on Progress instead of drawing an empty forecast', () => {
  show(empty, 'space=s1&view=progress');
  expect(screen.getByText('Add your first weigh-in to see where your weight is heading.')).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /Forecast/ })).not.toBeInTheDocument();
  expect(screen.getAllByText('Nothing logged')).toHaveLength(2);
  expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
});

it('shows BMI, the forecast and the date the plan reaches the goal weight', async () => {
  show({ ...withTargets, profile: { ...profile, goalWeightG: 75_000 } }, 'space=s1&view=progress', { logs: [riceLog('a', true)], workouts: [] });
  expect(within(tile('BMI')).getByText('24.7')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Forecast of your weight over the next 90 days' })).toBeInTheDocument();
  expect(screen.getByText('Reaches 75.0 kg around 22 Jan 2027.')).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Last 7 days/ })).getByText('325 kcal / 2,209 kcal')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Weight in kg'), '79,5');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(mutations.saveWeight.mutate).toHaveBeenCalledWith({ day: '2026-11-13', weightG: 79_500 });
});

const bench = (done: boolean[]): WorkoutItem => ({
  exerciseId: 'bench',
  name: 'Bench press',
  kind: 'weight',
  primary: ['chest'],
  secondary: ['triceps'],
  sets: done.map((isDone) => ({ reps: 8, weightG: 60_000, seconds: null, meters: null, done: isDone })),
});

it('starts a workout from a template on the shown day with nothing ticked', async () => {
  show({ ...withTargets, templates: [{ id: 't1', name: 'Push day', items: [bench([true, true])] }] }, 'space=s1&view=workouts&day=2026-11-10');
  await userEvent.click(screen.getByRole('button', { name: 'Start workout' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'From “Push day”' }));
  expect(mutations.addWorkout.mutate).toHaveBeenCalledWith(expect.objectContaining({ day: '2026-11-10', name: 'Push day', items: [bench([false, false])] }));
});

it('saves a set as done when it is ticked, shows last time, and lights up the muscles worked', async () => {
  const earlier = { id: 'w0', day: '2026-11-06', name: 'Push day', items: [bench([true, true, true])] };
  const todays = { id: 'w1', day: '2026-11-13', name: 'Push day', items: [bench([false, false])] };
  show(withTargets, 'space=s1&view=workouts', { logs: [], workouts: [earlier, todays] });
  expect(screen.getByText('Last time (6 Nov): 3 × 8 at 60 kg')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Primary' })).getByText('Chest')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Push day.*3 of 3 sets/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Bench press, set 2 done' }));
  expect(mutations.saveWorkout.mutate).toHaveBeenCalledWith({ ...todays, items: [bench([false, true])] });
  expect(screen.getByText('1 of 2 sets done')).toBeInTheDocument();
});

it('shows the day’s workout on Today and the week’s training on Progress', () => {
  const todays = { id: 'w1', day: '2026-11-13', name: 'Push day', items: [bench([true, false])] };
  show(withTargets, 'space=s1', { logs: [], workouts: [todays] });
  expect(screen.getByRole('link', { name: /Push day.*1 of 2 sets done/ })).toBeInTheDocument();
});

it('shades the muscles trained in the last 7 days on Progress', () => {
  const todays = { id: 'w1', day: '2026-11-13', name: 'Push day', items: [bench([true, true])] };
  show(withTargets, 'space=s1&view=progress', { logs: [], workouts: [todays] });
  expect(screen.getByRole('img', { name: 'Muscles trained in the last 7 days' })).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Most trained' })).getByText('Chest')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Also trained' })).getByText('Triceps')).toBeInTheDocument();
});

it('lists workout templates in the library with their size', () => {
  show({ ...withTargets, templates: [{ id: 't1', name: 'Push day', items: [bench([false, false])] }] }, 'space=s1&view=library');
  expect(screen.getByRole('button', { name: /Push day/ })).toHaveTextContent('1 exercise · 2 sets');
});

it('offers the AI read only when the server has it on, and sends figures without food or workout names', async () => {
  show(withTargets, 'space=s1&view=progress');
  expect(screen.queryByRole('button', { name: 'Ask the AI' })).not.toBeInTheDocument();
  expect(screen.getByText(/Add a Gemini API key/)).toBeInTheDocument();
});

it('writes the AI read on request and labels it as an estimate', async () => {
  ai.fetchFitnessRead.mockResolvedValue({ headline: 'You are on track.', points: ['Weight is trending down.', 'Protein is a little low.'] });
  const todays = { id: 'w1', day: '2026-11-13', name: 'Secret session', items: [bench([true])] };
  show({ ...withTargets, aiEnabled: true }, 'space=s1&view=progress', { logs: [riceLog('a', true)], workouts: [todays] });
  await userEvent.click(screen.getByRole('button', { name: 'Ask the AI' }));
  expect(await screen.findByText('You are on track.')).toBeInTheDocument();
  expect(screen.getByText('AI estimate from your summary figures. Not medical advice.')).toBeInTheDocument();
  const sent = JSON.stringify(ai.fetchFitnessRead.mock.calls[0][0]);
  expect(sent).toContain('"currentWeightKg":80');
  expect(sent).not.toMatch(/Rice|Secret session|Bench press/);
});

it('shows the week, weight and muscle map beside the day, with quick logging', async () => {
  const todays = { id: 'w1', day: '2026-11-13', name: 'Push day', items: [bench([true, true])] };
  const earlier = { id: 'w0', day: '2026-11-10', name: 'Legs', items: [{ ...bench([true]), primary: ['quads' as const], secondary: [] }] };
  show(withTargets, 'space=s1', { logs: [riceLog('a', true)], workouts: [earlier, todays] });
  expect(screen.getByRole('img', { name: 'Weight over the last 60 days' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /325 kcal/ })).toHaveAttribute('aria-current', 'date');
  expect(within(screen.getByRole('group', { name: 'Most worked' })).getByText('Chest')).toBeInTheDocument();
  expect(screen.queryByText('Quads')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: '7 days' }));
  expect(screen.getByRole('img', { name: 'Muscles worked in the last 7 days' })).toBeInTheDocument();
  expect(screen.getByText('Quads')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Weight in kg'), '79,5');
  await userEvent.click(screen.getByRole('button', { name: 'Log weight' }));
  expect(mutations.saveWeight.mutate).toHaveBeenCalledWith({ day: '2026-11-13', weightG: 79_500 });
  await userEvent.click(screen.getByRole('button', { name: 'Log food' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
