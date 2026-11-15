import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NotebookPage } from '../src/page-types';
import { usePageMutations } from './usePageMutations';

vi.mock('@/features/spaces', () => ({ useActiveSpace: () => ({ id: 's1', tool: 'notebook' }) }));
const { toast } = vi.hoisted(() => ({ toast: { error: vi.fn() } }));
vi.mock('sonner', () => ({ toast }));

const page = (id: string): NotebookPage => ({ id, title: id, content: null, createdAt: '', version: 3 });
const key = ['pages', 's1'];
let queryClient: QueryClient;

function renderMutations() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePageMutations(), { wrapper }).result;
}

const order = () => queryClient.getQueryData<NotebookPage[]>(key)?.map(({ id }) => id);

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData(key, [page('a'), page('b'), page('c')]);
});

afterEach(() => vi.unstubAllGlobals());

it('moves the page in the list the moment it is dropped, before the save finishes', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  const result = renderMutations();
  act(() => result.current.reorder.mutate(['c', 'a', 'b']));
  expect(order()).toEqual(['c', 'a', 'b']);
});

it('puts the old order back if the save fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));
  const result = renderMutations();
  act(() => result.current.reorder.mutate(['c', 'a', 'b']));
  await waitFor(() => expect(order()).toEqual(['a', 'b', 'c']));
});

const doc = { type: 'doc' };
const versionOf = (id: string) => queryClient.getQueryData<NotebookPage[]>(key)?.find((page) => page.id === id)?.version;
const sentBody = (fetch: ReturnType<typeof vi.fn>, call: number) => JSON.parse(fetch.mock.calls[call][1].body);

it('sends the version the content was edited from and keeps the one the server returns', async () => {
  const fetch = vi.fn(async () => Response.json({ version: fetch.mock.calls.length + 3 }));
  vi.stubGlobal('fetch', fetch);
  const result = renderMutations();
  const base = { current: 3 };

  act(() => result.current.save.mutate({ id: 'a', changes: { content: doc }, base }));
  act(() => result.current.save.mutate({ id: 'a', changes: { content: doc }, base }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(versionOf('a')).toBe(5));

  expect(sentBody(fetch, 0)).toEqual({ content: doc, version: 3 });
  expect(sentBody(fetch, 1)).toEqual({ content: doc, version: 4 });
  expect(base.current).toBe(5);
});

it('never takes the version from a title-only save, which may be out of date', async () => {
  const fetch = vi.fn(async () => Response.json({ version: 1 }));
  vi.stubGlobal('fetch', fetch);
  const result = renderMutations();
  const base = { current: 3 };

  await act(async () => result.current.save.mutateAsync({ id: 'a', changes: { title: 'Renamed' }, base }));

  expect(sentBody(fetch, 0)).toEqual({ title: 'Renamed' });
  expect(base.current).toBe(3);
  expect(versionOf('a')).toBe(3);
});

it('does not retry or toast a save someone else got to first', async () => {
  const fetch = vi.fn(async () => Response.json({ message: 'Changed by someone else' }, { status: 409 }));
  vi.stubGlobal('fetch', fetch);
  const result = renderMutations();

  await act(async () => result.current.save.mutateAsync({ id: 'a', changes: { content: doc }, base: { current: 3 } }).catch(() => {}));

  expect(fetch).toHaveBeenCalledTimes(1);
  expect(toast.error).not.toHaveBeenCalled();
});
