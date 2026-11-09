import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { TrashItem } from '../src/trash-types';
import { useRestoreItem } from './useRestoreItem';

const { restoreItem } = vi.hoisted(() => ({ restoreItem: vi.fn() }));

vi.mock('../src/trash-api', () => ({ restoreItem }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const item: TrashItem = { id: 't1', type: 'task', title: 'T', location: 'Home', deletedAt: '' };

let client: QueryClient;
const setup = () =>
  renderHook(() => useRestoreItem(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  }).result;

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient();
  client.setQueryData(['trash'], [item]);
});

it('leaves the trash list at once', async () => {
  restoreItem.mockReturnValue(new Promise(() => {}));
  const result = setup();
  act(() => result.current.mutate(item));
  await waitFor(() => expect(client.getQueryData(['trash'])).toEqual([]));
});

it('goes back in the list if the server refuses', async () => {
  restoreItem.mockRejectedValue(new Error('nope'));
  const result = setup();
  await act(async () => {
    await result.current.mutateAsync(item).catch(() => {});
  });
  expect(client.getQueryData(['trash'])).toEqual([item]);
});

it('reloads spaces and tasks after restoring', async () => {
  restoreItem.mockResolvedValue(undefined);
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const result = setup();
  await act(() => result.current.mutateAsync(item));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['spaces'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
});

it('reloads the trash, since restoring can bring back a parent too', async () => {
  restoreItem.mockResolvedValue(undefined);
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const result = setup();
  await act(() => result.current.mutateAsync(item));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trash'] });
});
