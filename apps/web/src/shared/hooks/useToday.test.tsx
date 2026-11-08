import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useToday } from './useToday';

afterEach(() => vi.useRealTimers());

it('updates on window focus after midnight', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 9, 23, 59));
  const { result } = renderHook(() => useToday());
  expect(result.current).toBe('2026-11-09');
  vi.setSystemTime(new Date(2026, 10, 10, 0, 1));
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
  expect(result.current).toBe('2026-11-10');
});
