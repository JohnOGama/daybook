import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDLE_LOCK_MS, useVaultSession } from '../hooks/useVaultSession';
import { VaultSessionProviderComponent } from './VaultSessionProviderComponent';

const key = {} as CryptoKey;
let session: ReturnType<typeof useVaultSession>;

function Probe() {
  session = useVaultSession();
  return null;
}

const renderSession = () =>
  render(
    <VaultSessionProviderComponent>
      <Probe />
    </VaultSessionProviderComponent>,
  );

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('starts locked and unlocks', () => {
  renderSession();
  expect(session.key).toBeNull();
  act(() => session.unlock(key));
  expect(session.key).toBe(key);
});

it('locks on request', () => {
  renderSession();
  act(() => session.unlock(key));
  act(() => session.lock());
  expect(session.key).toBeNull();
});

it('locks after 5 minutes with no activity', () => {
  expect(IDLE_LOCK_MS).toBe(300_000);
  renderSession();
  act(() => session.unlock(key));
  act(() => vi.advanceTimersByTime(299_999));
  expect(session.key).toBe(key);
  act(() => vi.advanceTimersByTime(1));
  expect(session.key).toBeNull();
});

it.each(['pointerDown', 'pointerMove', 'keyDown', 'wheel'] as const)('resets the idle timer on %s', (event) => {
  renderSession();
  act(() => session.unlock(key));
  act(() => vi.advanceTimersByTime(200_000));
  act(() => {
    fireEvent[event](window);
  });
  act(() => vi.advanceTimersByTime(200_000));
  expect(session.key).toBe(key);
});

it('forgets the key when it unmounts', () => {
  const { unmount } = renderSession();
  act(() => session.unlock(key));
  unmount();
  renderSession();
  expect(session.key).toBeNull();
});
