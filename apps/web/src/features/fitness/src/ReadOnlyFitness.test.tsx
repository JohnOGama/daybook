import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { FitnessPageComponent } from './FitnessPageComponent';
import { type Day, DEFAULT_PROFILE, type Fitness, type FoodLog, type Workout } from './fitness-types';

const { useFitness, useFitnessDays, mutations, query } = vi.hoisted(() => ({
  useFitness: vi.fn(),
  useFitnessDays: vi.fn(),
  mutations: new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) => (target[key] ??= Object.assign(vi.fn(), { mutate: vi.fn(), mutateAsync: vi.fn(async () => undefined) })),
  }) as Record<string, { mutate: ReturnType<typeof vi.fn> }>,
  query: { current: 'space=s1' },
}));

vi.mock('../hooks/useFitness', () => ({ useFitness, useFitnessSpaceId: () => 's1' }));
vi.mock('../hooks/useFitnessDays', () => ({ useFitnessDays }));
vi.mock('../hooks/useFoodSearch', () => ({ useFoodSearch: () => ({ data: [], isPending: false, isError: false }) }));
vi.mock('../hooks/useExercises', () => ({ useExercises: () => ({ data: [{ id: 'mine', name: 'My curl', custom: true, kind: 'weight', primary: ['biceps'], secondary: [] }], isPending: false, isError: false }) }));
vi.mock('../hooks/useMyFoods', () => ({ useMyFoods: () => ({ data: [], isPending: false, isError: false }) }));
vi.mock('../hooks/useFitnessMutations', () => ({ useFitnessMutations: () => mutations }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Body', tool: 'fitness' }),
  useSpaceAccess: () => ({ access: 'view', canEdit: false, isOwner: false }),
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => <span>View only</span>,
}));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-13' }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(query.current), useRouter: () => router }));

const fitness: Fitness = {
  profile: DEFAULT_PROFILE,
  weights: [{ day: '2026-11-12', weightG: 80_000 }],
  mealPlans: [{ id: 'p', name: 'Cut day', items: [] }],
  templates: [{ id: 't', name: 'Push', items: [] }],
  aiEnabled: true,
};
const log: FoodLog = {
  id: 'l',
  day: '2026-11-13',
  meal: 'lunch',
  eaten: true,
  foodId: 'rice',
  name: 'Rice',
  quantityMilli: 250_000,
  servingLabel: 'g',
  amountMg: 250_000,
  kcal: 325,
  proteinMg: 6725,
  carbsMg: 70_425,
  fatMg: 700,
  fiberMg: 1000,
};
const workout: Workout = {
  id: 'w',
  day: '2026-11-13',
  name: 'Push day',
  items: [{ exerciseId: null, name: 'Bench press', kind: 'weight', primary: ['chest'], secondary: [], sets: [{ reps: 8, weightG: 60_000, seconds: null, meters: null, done: true }] }],
};
const day: Day = { logs: [log], workouts: [workout], water: [{ day: '2026-11-13', glasses: 3 }] };

const show = (view: string) => {
  query.current = `space=s1&view=${view}`;
  useFitness.mockReturnValue({ data: fitness, isPending: false, isError: false });
  useFitnessDays.mockReturnValue({ data: day, isPending: false, isError: false });
  render(<FitnessPageComponent />);
};

beforeEach(() => vi.clearAllMocks());

it.each(['today', 'workouts', 'progress', 'library', 'settings'])('offers a viewer nothing that changes the %s view', (view) => {
  show(view);
  expect(screen.getByText('View only')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^(add|log|start|meal plan|new|delete|remove|save|ask|apply)/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
});

it('still shows a viewer the food and workout of the day', () => {
  show('today');
  expect(screen.getByText('Rice')).toBeInTheDocument();
  expect(screen.getByText('Push day')).toBeInTheDocument();
});
