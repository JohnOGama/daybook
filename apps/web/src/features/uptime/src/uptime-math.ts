import type { MonitorRow } from './uptime-types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatResponse = (ms: number | null) => {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${Number((ms / 1000).toFixed(1))} s`;
};

// A response time always in seconds, for the status pill's hover: 0.18 s, 2.4 s, 12.5 s.
export const formatSeconds = (ms: number) => `${Number((ms / 1000).toFixed(ms < 1000 ? 2 : 1))} s`;

export const formatUptime = (pct: number | null) => (pct === null ? '—' : `${pct}%`);

const count = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;

// The two largest units that matter, in words: 45 seconds, 12 minutes, 1 hour 5 minutes, 2 days 3 hours.
// Rounded down, so 59.6 seconds never reads as 60.
export function formatDuration(ms: number): string {
  if (ms < 1000) return 'under a second';
  if (ms < MINUTE) return count(Math.floor(ms / 1000), 'second');
  if (ms < HOUR) return count(Math.floor(ms / MINUTE), 'minute');
  const pair = (big: string, small: number, smallUnit: string) => (small > 0 ? `${big} ${count(small, smallUnit)}` : big);
  if (ms < DAY) return pair(count(Math.floor(ms / HOUR), 'hour'), Math.floor((ms % HOUR) / MINUTE), 'minute');
  return pair(count(Math.floor(ms / DAY), 'day'), Math.floor((ms % DAY) / HOUR), 'hour');
}

export function checkedAgo(iso: string | null, now: Date): string {
  if (!iso) return 'never';
  const ms = Math.max(0, now.getTime() - new Date(iso).getTime());
  if (ms < 5000) return 'just now';
  if (ms < MINUTE) return `${Math.floor(ms / 1000)} s ago`;
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  return `${Math.floor(ms / DAY)} d ago`;
}

// Paused sites don't count either way; a slow site is up, and one not checked yet is not.
export function upNow(monitors: MonitorRow[]): { up: number; total: number } {
  const watched = monitors.filter(({ paused }) => !paused);
  return { up: watched.filter(({ status }) => status === 'up' || status === 'slow').length, total: watched.length };
}
