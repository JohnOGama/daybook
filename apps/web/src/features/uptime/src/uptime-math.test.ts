import { describe, expect, it } from 'vitest';
import { checkedAgo, formatDuration, formatResponse, formatUptime, upNow } from './uptime-math';
import type { MonitorRow } from './uptime-types';

describe('uptime-math', () => {
  it.each([
    [182, '182 ms'],
    [999, '999 ms'],
    [3400, '3.4 s'],
    [10_000, '10 s'],
    [null, '—'],
  ])('formats a response of %s as %s', (ms, text) => {
    expect(formatResponse(ms)).toBe(text);
  });

  it.each([
    [99.2, '99.2%'],
    [100, '100%'],
    [0, '0%'],
    [null, '—'],
  ])('formats uptime %s as %s', (pct, text) => {
    expect(formatUptime(pct)).toBe(text);
  });

  it.each([
    [45_000, '45 s'],
    [12 * 60_000, '12 min'],
    [65 * 60_000, '1 h 5 min'],
    [2 * 3_600_000, '2 h'],
    [(2 * 24 + 3) * 3_600_000, '2 d 3 h'],
  ])('formats a duration of %s ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });

  const now = new Date('2026-11-21T12:00:00Z');
  it.each([
    [null, 'never'],
    ['2026-11-21T11:59:57Z', 'just now'],
    ['2026-11-21T11:59:48Z', '12 s ago'],
    ['2026-11-21T11:57:00Z', '3 min ago'],
    ['2026-11-21T09:00:00Z', '3 h ago'],
  ])('says a check at %s was %s', (iso, text) => {
    expect(checkedAgo(iso, now)).toBe(text);
  });

  it('counts sites up now, leaving paused ones out', () => {
    const row = (status: MonitorRow['status'], paused = false) => ({ status, paused }) as MonitorRow;
    expect(upNow([row('up'), row('slow'), row('down'), row('down', true), row(null)])).toEqual({ up: 2, total: 4 });
  });
});
