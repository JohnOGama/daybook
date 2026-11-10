import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { copySecret } from './copy-secret';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockClear();
  vi.stubGlobal('navigator', { clipboard: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('clears the clipboard after 30 seconds while focused', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  await copySecret('value');
  expect(writeText).toHaveBeenLastCalledWith('value');
  await vi.advanceTimersByTimeAsync(29_999);
  expect(writeText).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(writeText).toHaveBeenLastCalledWith('');
});

it('does not throw or clear when the tab is not focused', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(false);
  await copySecret('value');
  await vi.advanceTimersByTimeAsync(30_000);
  expect(writeText).not.toHaveBeenCalledWith('');
});

it('restarts the wait for each copy', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  await copySecret('a');
  await vi.advanceTimersByTimeAsync(20_000);
  await copySecret('b');
  await vi.advanceTimersByTimeAsync(20_000);
  expect(writeText).not.toHaveBeenCalledWith('');
});
