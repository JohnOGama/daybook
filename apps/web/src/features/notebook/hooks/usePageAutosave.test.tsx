import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConflictError } from '@/shared/utils/conflict-error';
import { usePageAutosave } from './usePageAutosave';

type Callbacks = { onSuccess: () => void; onError: (error: Error) => void };

const { mutate, patchPage, reloadPage } = vi.hoisted(() => ({ mutate: vi.fn(), patchPage: vi.fn(), reloadPage: vi.fn() }));
vi.mock('./usePageMutations', () => ({ usePageMutations: () => ({ save: { mutate }, patchPage, reloadPage }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const doc = { type: 'doc' };

it('shows edits at once but sends one merged save after a pause', () => {
  const { result } = renderHook(() => usePageAutosave('p', 3));
  act(() => result.current.schedule({ title: 'A' }));
  act(() => result.current.schedule({ content: doc }));
  expect(patchPage).toHaveBeenCalledTimes(2);
  expect(mutate).not.toHaveBeenCalled();
  expect(result.current.status).toBe('saving');

  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0][0]).toEqual({ id: 'p', changes: { title: 'A', content: doc }, base: { current: 3 } });

  act(() => (mutate.mock.calls[0][1] as Callbacks).onSuccess());
  expect(result.current.status).toBe('saved');
});

it('saves straight away when leaving the page', () => {
  const { result, unmount } = renderHook(() => usePageAutosave('p', 3));
  act(() => result.current.schedule({ title: 'A' }));
  unmount();
  expect(mutate).toHaveBeenCalledTimes(1);
});

it('saves when the browser tab is closing', () => {
  const { result } = renderHook(() => usePageAutosave('p', 3));
  act(() => result.current.schedule({ title: 'A' }));
  act(() => {
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(mutate).toHaveBeenCalledTimes(1);
});

it('keeps failed changes and sends them with the next edit', () => {
  const { result } = renderHook(() => usePageAutosave('p', 3));
  act(() => result.current.schedule({ title: 'A' }));
  act(() => {
    vi.advanceTimersByTime(600);
  });
  act(() => (mutate.mock.calls[0][1] as Callbacks).onError(new Error('Offline')));
  expect(result.current.status).toBe('failed');

  act(() => result.current.schedule({ content: doc }));
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(mutate.mock.calls[1][0]).toMatchObject({ id: 'p', changes: { title: 'A', content: doc } });
});

it('does nothing when there is nothing to save', () => {
  const { unmount } = renderHook(() => usePageAutosave('p', 3));
  unmount();
  expect(mutate).not.toHaveBeenCalled();
});

function conflictOnFirstSave() {
  const hook = renderHook(() => usePageAutosave('p', 3));
  act(() => hook.result.current.schedule({ content: doc }));
  act(() => {
    vi.advanceTimersByTime(600);
  });
  act(() => (mutate.mock.calls[0][1] as Callbacks).onError(new ConflictError()));
  return hook;
}

it('stops saving once someone else has changed the page', () => {
  const { result, unmount } = conflictOnFirstSave();
  expect(result.current.status).toBe('conflict');

  act(() => result.current.schedule({ content: doc }));
  act(() => {
    vi.advanceTimersByTime(600);
  });
  unmount();
  expect(mutate).toHaveBeenCalledTimes(1);
});

it('reloads the page, drops local changes and saves again after that', async () => {
  const fresh = { id: 'p', title: 'Theirs', content: doc, createdAt: '', version: 7 };
  reloadPage.mockResolvedValue(fresh);
  const { result } = conflictOnFirstSave();

  let reloaded: unknown;
  await act(async () => {
    reloaded = await result.current.reload();
  });
  expect(reloadPage).toHaveBeenCalledWith('p');
  expect(reloaded).toBe(fresh);
  expect(result.current.status).toBe('saved');

  act(() => result.current.schedule({ title: 'B' }));
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(mutate).toHaveBeenCalledTimes(2);
  expect(mutate.mock.calls[1][0]).toEqual({ id: 'p', changes: { title: 'B' }, base: { current: 7 } });
});
