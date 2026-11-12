import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NotebookPage } from '../src/page-types';
import { usePageMutations } from './usePageMutations';

vi.mock('@/features/spaces', () => ({ useActiveSpace: () => ({ id: 's1', tool: 'notebook' }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const page = (id: string): NotebookPage => ({ id, title: id, content: null, createdAt: '' });
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
