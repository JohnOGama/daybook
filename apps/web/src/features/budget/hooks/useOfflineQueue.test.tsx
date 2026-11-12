import { onlineManager, QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useOfflineQueue } from './useOfflineQueue';

afterEach(() => onlineManager.setOnline(true));

it('holds a change made offline, counts it, and sends it once back online', async () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const send = vi.fn(async () => undefined);
  const { result } = renderHook(() => ({ queue: useOfflineQueue(), save: useMutation({ mutationFn: send }) }), { wrapper });

  act(() => onlineManager.setOnline(false));
  expect(result.current.queue.online).toBe(false);
  act(() => result.current.save.mutate());
  await waitFor(() => expect(result.current.queue.waiting).toBe(1));
  expect(send).not.toHaveBeenCalled();

  act(() => onlineManager.setOnline(true));
  await waitFor(() => expect(result.current.queue.waiting).toBe(0));
  expect(send).toHaveBeenCalledTimes(1);
});
