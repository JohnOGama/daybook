import type { MonitorRow } from './uptime-types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatResponse = (ms: number | null) => {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${Number((ms / 1000).toFixed(1))} s`;
};

export const formatUptime = (pct: number | null) => (pct === null ? '—' : `${pct}%`);

// The two largest units that matter: 45 s, 12 min, 1 h 5 min, 2 d 3 h.
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return `${Math.round(ms / 1000)} s`;
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} min`;
  const pair = (big: number, bigUnit: string, small: number, smallUnit: string) => (small > 0 ? `${big} ${bigUnit} ${small} ${smallUnit}` : `${big} ${bigUnit}`);
  if (ms < DAY) return pair(Math.floor(ms / HOUR), 'h', Math.floor((ms % HOUR) / MINUTE), 'min');
  return pair(Math.floor(ms / DAY), 'd', Math.floor((ms % DAY) / HOUR), 'h');
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
