import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePageAutosave } from './usePageAutosave';

type Callbacks = { onSuccess: () => void; onError: () => void };

const { mutate, patchPage } = vi.hoisted(() => ({ mutate: vi.fn(), patchPage: vi.fn() }));
vi.mock('./usePageMutations', () => ({ usePageMutations: () => ({ save: { mutate }, patchPage }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const doc = { type: 'doc' };

it('shows edits at once but sends one merged save after a pause', () => {
  const { result } = renderHook(() => usePageAutosave('p'));
  act(() => result.current.schedule({ title: 'A' }));
  act(() => result.current.schedule({ content: doc }));
  expect(patchPage).toHaveBeenCalledTimes(2);
  expect(mutate).not.toHaveBeenCalled();
  expect(result.current.status).toBe('saving');

  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0][0]).toEqual({ id: 'p', changes: { title: 'A', content: doc } });

  act(() => (mutate.mock.calls[0][1] as Callbacks).onSuccess());
  expect(result.current.status).toBe('saved');
});

it('saves straight away when leaving the page', () => {
  const { result, unmount } = renderHook(() => usePageAutosave('p'));
  act(() => result.current.schedule({ title: 'A' }));
  unmount();
  expect(mutate).toHaveBeenCalledTimes(1);
});

it('saves when the browser tab is closing', () => {
  const { result } = renderHook(() => usePageAutosave('p'));
  act(() => result.current.schedule({ title: 'A' }));
  act(() => {
    window.dispatchEvent(new Event('pagehide'));
  });
  expect(mutate).toHaveBeenCalledTimes(1);
});

it('keeps failed changes and sends them with the next edit', () => {
  const { result } = renderHook(() => usePageAutosave('p'));
  act(() => result.current.schedule({ title: 'A' }));
  act(() => {
    vi.advanceTimersByTime(600);
  });
  act(() => (mutate.mock.calls[0][1] as Callbacks).onError());
  expect(result.current.status).toBe('failed');

  act(() => result.current.schedule({ content: doc }));
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(mutate.mock.calls[1][0]).toEqual({ id: 'p', changes: { title: 'A', content: doc } });
});

it('does nothing when there is nothing to save', () => {
  const { unmount } = renderHook(() => usePageAutosave('p'));
  unmount();
  expect(mutate).not.toHaveBeenCalled();
});
