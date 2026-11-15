import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Day, Workout } from '../src/fitness-types';
import { useFitnessMutations } from './useFitnessMutations';

const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('sonner', () => ({ toast }));
vi.mock('./useFitness', () => ({ useFitnessSpaceId: () => 's1' }));

const key = ['fitness-days', 's1', '2026-11-01', '2026-11-30'];
const workout: Workout = { id: 'w1', day: '2026-11-10', name: 'Push day', items: [], version: 2 };
let queryClient: QueryClient;

function renderMutations() {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return renderHook(() => useFitnessMutations(), { wrapper }).result;
}

const cached = () => queryClient.getQueryData<Day>(key)?.workouts[0];
const sentBody = (fetch: ReturnType<typeof vi.fn>, call: number) => JSON.parse(fetch.mock.calls[call][1].body);

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData<Day>(key, { logs: [], workouts: [workout] });
});
afterEach(() => vi.unstubAllGlobals());

it('sends the cached version, even from a stale draft, and keeps the one the server returns', async () => {
  const fetch = vi.fn(async () => Response.json({ version: fetch.mock.calls.length + 2 }));
  vi.stubGlobal('fetch', fetch);
  const result = renderMutations();

  act(() => result.current.saveWorkout.mutate({ ...workout, name: 'A' }));
  act(() => result.current.saveWorkout.mutate({ ...workout, name: 'B' }));
  await waitFor(() => expect(cached()).toMatchObject({ name: 'B', version: 4 }));

  expect(sentBody(fetch, 0)).toMatchObject({ name: 'A', version: 2 });
  expect(sentBody(fetch, 1)).toMatchObject({ name: 'B', version: 3 });
});

it('puts the workout back and offers a reload when someone else saved first', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'Changed by someone else' }, { status: 409 })));
  const result = renderMutations();

  act(() => result.current.saveWorkout.mutate({ ...workout, name: 'Mine' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(cached()).toEqual(workout);

  const [message, options] = toast.error.mock.calls[0];
  expect(message).toBe('Changed by someone else');
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  options.action.onClick();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['fitness-days', 's1'] });
});
