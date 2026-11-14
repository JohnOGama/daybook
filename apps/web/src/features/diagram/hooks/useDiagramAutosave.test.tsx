import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDiagramAutosave } from './useDiagramAutosave';

const { saveDiagram, toast } = vi.hoisted(() => ({ saveDiagram: vi.fn(), toast: { error: vi.fn() } }));
vi.mock('../src/diagram-api', () => ({ saveDiagram }));
vi.mock('sonner', () => ({ toast }));

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const first = { dbml: 'Table a { id int }', positions: { a: { x: 0, y: 0 } } };
const second = { dbml: 'Table b { id int }', positions: { b: { x: 1, y: 1 } } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  client = new QueryClient();
  client.setQueryData(['diagram', 's1'], { dbml: '', positions: {}, updatedAt: null, aiEnabled: true });
  saveDiagram.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

it('shows changes at once and saves the latest one 800 ms after the last change', async () => {
  const { result } = renderHook(() => useDiagramAutosave('s1'), { wrapper });
  act(() => result.current.queue(first));
  act(() => {
    vi.advanceTimersByTime(300);
  });
  act(() => result.current.queue(second));
  expect(client.getQueryData(['diagram', 's1'])).toMatchObject(second);
  act(() => {
    vi.advanceTimersByTime(799);
  });
  expect(saveDiagram).not.toHaveBeenCalled();
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
  expect(saveDiagram).toHaveBeenCalledTimes(1);
  expect(saveDiagram).toHaveBeenCalledWith({ spaceId: 's1', ...second });
  expect(result.current.status).toBe('saved');
});

it('saves at once when flushed or when leaving the page', async () => {
  const { result, unmount } = renderHook(() => useDiagramAutosave('s1'), { wrapper });
  act(() => result.current.queue(first));
  await act(async () => result.current.flush());
  expect(saveDiagram).toHaveBeenCalledTimes(1);
  act(() => result.current.queue(second));
  unmount();
  expect(saveDiagram).toHaveBeenCalledTimes(2);
});

it('says when a save failed', async () => {
  saveDiagram.mockRejectedValue(new Error('The diagram could not be saved.'));
  const { result } = renderHook(() => useDiagramAutosave('s1'), { wrapper });
  act(() => result.current.queue(first));
  await act(async () => result.current.flush());
  expect(result.current.status).toBe('error');
  expect(toast.error).toHaveBeenCalledWith('The diagram could not be saved.');
});
