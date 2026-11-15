import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchDays } from './fitness-api';
import type { Day, Workout } from './fitness-types';
import { WorkoutEditorComponent } from './WorkoutEditorComponent';

const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('sonner', () => ({ toast }));
vi.mock('../hooks/useFitness', () => ({ useFitnessSpaceId: () => 's1' }));
vi.mock('../hooks/useExercises', () => ({ useExercises: () => ({ data: [], isPending: false, isError: false }) }));

const key = ['fitness-days', 's1', '2026-11-01', '2026-11-30'];
const opened: Workout = { id: 'w1', day: '2026-11-10', name: 'Push day', items: [], version: 2 };
let queryClient: QueryClient;
let onServer: Workout;
let putReply: () => Response;
const fetch = vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'PUT' ? putReply() : Response.json({ logs: [], workouts: [onServer] })));
const puts = () => fetch.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([, init]) => JSON.parse(init?.body as string));

// Shows the workout the way the workouts list does: from the days query, one editor per workout id.
function Harness() {
  const { data } = useQuery({ queryKey: key, queryFn: () => fetchDays('s1', '2026-11-01', '2026-11-30'), staleTime: Infinity });
  const workout = data?.workouts[0];
  return workout ? <WorkoutEditorComponent key={workout.id} workout={workout} history={[]} /> : null;
}

function show() {
  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
  return screen.getByRole('textbox', { name: 'Workout name' });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetch);
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData<Day>(key, { logs: [], workouts: [opened] });
  onServer = opened;
  putReply = () => Response.json({ version: 3 });
});
afterEach(() => vi.unstubAllGlobals());

it('saves over the version it opened with, even after a refetch brought someone else’s newer one', async () => {
  const name = show();
  queryClient.setQueryData<Day>(key, { logs: [], workouts: [{ ...opened, name: 'Theirs', version: 9 }] });

  fireEvent.change(name, { target: { value: 'Mine' } });

  await waitFor(() => expect(puts()).toHaveLength(1), { timeout: 2000 });
  expect(puts()[0]).toMatchObject({ name: 'Mine', version: 2 });
});

it('sends nothing after a refused save, and starts over from the saved workout once reloaded', async () => {
  putReply = () => Response.json({ message: 'Changed by someone else' }, { status: 409 });
  const name = show();

  fireEvent.change(name, { target: { value: 'Mine' } });
  await waitFor(() => expect(toast.error).toHaveBeenCalled(), { timeout: 2000 });

  fireEvent.change(name, { target: { value: 'Mine again' } });
  await pause(700);
  expect(puts()).toHaveLength(1);

  onServer = { ...opened, name: 'Theirs', version: 5 };
  const [, options] = toast.error.mock.calls[0];
  options.action.onClick();
  await waitFor(() => expect(name).toHaveValue('Theirs'));

  putReply = () => Response.json({ version: 6 });
  fireEvent.change(name, { target: { value: 'Theirs, then mine' } });
  await waitFor(() => expect(puts()).toHaveLength(2), { timeout: 2000 });
  expect(puts()[1]).toMatchObject({ name: 'Theirs, then mine', version: 5 });
});
