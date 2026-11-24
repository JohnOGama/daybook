import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Day, Fitness, MealPlan, Workout } from '../src/fitness-types';
import { useFitnessMutations } from './useFitnessMutations';

const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('sonner', () => ({ toast }));
vi.mock('./useFitness', () => ({ useFitnessSpaceId: () => 's1' }));

const daysKey = ['fitness-days', 's1', '2026-11-01', '2026-11-30'];
const workout: Workout = { id: 'w1', day: '2026-11-10', name: 'Push day', items: [], version: 2 };
const plan: MealPlan = { id: 'p1', name: 'Cutting day', items: [], version: 2 };
let queryClient: QueryClient;

function renderMutations() {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return renderHook(() => useFitnessMutations(), { wrapper }).result;
}

const cachedWorkout = () => queryClient.getQueryData<Day>(daysKey)?.workouts[0];
const sentBody = (fetch: ReturnType<typeof vi.fn>, call: number) => JSON.parse(fetch.mock.calls[call][1].body);

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData<Day>(daysKey, { logs: [], workouts: [workout], water: [] });
});
afterEach(() => vi.unstubAllGlobals());

it('saves a meal plan over the version its form opened with, even after a refetch brought a newer one', async () => {
  const fetch = vi.fn(async () => Response.json({ version: 3 }));
  vi.stubGlobal('fetch', fetch);
  queryClient.setQueryData(['fitness', 's1'], { mealPlans: [{ ...plan, name: 'Theirs', version: 9 }], templates: [] } as unknown as Fitness);
  const result = renderMutations();

  act(() => result.current.saveMealPlan.mutate({ ...plan, name: 'Mine' }));

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(sentBody(fetch, 0)).toMatchObject({ name: 'Mine', version: 2 });
});

it('sends each queued workout save over the version the one before returned', async () => {
  const fetch = vi.fn(async () => Response.json({ version: fetch.mock.calls.length + 2 }));
  vi.stubGlobal('fetch', fetch);
  const result = renderMutations();
  const from = { version: 2, conflicted: false };

  act(() => result.current.saveWorkout.mutate({ workout: { ...workout, name: 'A' }, from }));
  act(() => result.current.saveWorkout.mutate({ workout: { ...workout, name: 'B' }, from }));
  await waitFor(() => expect(cachedWorkout()).toMatchObject({ name: 'B', version: 4 }));

  expect(sentBody(fetch, 0)).toMatchObject({ name: 'A', version: 2 });
  expect(sentBody(fetch, 1)).toMatchObject({ name: 'B', version: 3 });
  expect(from.version).toBe(4);
});

it('puts the workout back, marks the editor conflicted and offers a reload when someone else saved first', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'Changed by someone else' }, { status: 409 })));
  const result = renderMutations();
  const from = { version: 2, conflicted: false };

  act(() => result.current.saveWorkout.mutate({ workout: { ...workout, name: 'Mine' }, from }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(cachedWorkout()).toEqual(workout);
  expect(from.conflicted).toBe(true);

  const [message, options] = toast.error.mock.calls[0];
  expect(message).toBe('Changed by someone else');
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  options.action.onClick();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['fitness-days', 's1'] });
});
