import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConflictError } from '@/shared/utils/conflict-error';
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
  client.setQueryData(['diagram', 's1'], { dbml: '', positions: {}, updatedAt: null, aiEnabled: true, version: 2 });
  saveDiagram.mockResolvedValue({ version: 3 });
});
afterEach(() => vi.useRealTimers());

it('shows changes at once and saves the latest one 800 ms after the last change', async () => {
  const { result } = renderHook(() => useDiagramAutosave('s1', 2), { wrapper });
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
  expect(saveDiagram).toHaveBeenCalledWith({ spaceId: 's1', ...second, version: 2 });
  expect(result.current.status).toBe('saved');
});

it('saves at once when flushed or when leaving the page', async () => {
  const { result, unmount } = renderHook(() => useDiagramAutosave('s1', 2), { wrapper });
  act(() => result.current.queue(first));
  await act(async () => result.current.flush());
  expect(saveDiagram).toHaveBeenCalledTimes(1);
  act(() => result.current.queue(second));
  unmount();
  expect(saveDiagram).toHaveBeenCalledTimes(2);
});

it('says when a save failed', async () => {
  saveDiagram.mockRejectedValue(new Error('The diagram could not be saved.'));
  const { result } = renderHook(() => useDiagramAutosave('s1', 2), { wrapper });
  act(() => result.current.queue(first));
  await act(async () => result.current.flush());
  expect(result.current.status).toBe('error');
  expect(toast.error).toHaveBeenCalledWith('The diagram could not be saved.');
});

it('sends the version it last saved, not one a background refetch brought in', async () => {
  const { result } = renderHook(() => useDiagramAutosave('s1', 2), { wrapper });
  act(() => result.current.queue(first));
  await act(async () => result.current.flush());
  expect(client.getQueryData(['diagram', 's1'])).toMatchObject({ version: 3 });

  client.setQueryData(['diagram', 's1'], { dbml: 'theirs', positions: {}, updatedAt: null, aiEnabled: true, version: 9 });
  act(() => result.current.queue(second));
  await act(async () => result.current.flush());
  expect(saveDiagram).toHaveBeenLastCalledWith({ spaceId: 's1', ...second, version: 3 });
});

it('waits for a save in flight before sending the next one with its version', async () => {
  let finish: (value: { version: number }) => void = () => {};
  saveDiagram.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  const { result } = renderHook(() => useDiagramAutosave('s1', 2), { wrapper });
  act(() => result.current.queue(first));
  act(() => void result.current.flush());
  act(() => result.current.queue(second));
  act(() => void result.current.flush());
  expect(saveDiagram).toHaveBeenCalledTimes(1);

  await act(async () => finish({ version: 3 }));
  expect(saveDiagram).toHaveBeenCalledTimes(2);
  expect(saveDiagram).toHaveBeenLastCalledWith({ spaceId: 's1', ...second, version: 3 });
});

it('stops saving once someone else has changed the diagram, until it is reloaded', async () => {
  saveDiagram.mockRejectedValueOnce(new ConflictError());
  const { result } = renderHook(() => useDiagramAutosave('s1', 2), { wrapper });
  act(() => result.current.queue(first));
  await act(async () => result.current.flush());
  expect(result.current.status).toBe('conflict');
  expect(toast.error).not.toHaveBeenCalled();

  act(() => result.current.queue(second));
  await act(async () => {
    vi.advanceTimersByTime(800);
  });
  expect(saveDiagram).toHaveBeenCalledTimes(1);

  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await act(async () => result.current.reload());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['diagram', 's1'] });
  expect(result.current.status).toBe('saved');
});
