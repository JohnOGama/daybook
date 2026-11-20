import type { UptimeStatus } from './check-site.ts';

export type { UptimeStatus };
export type UptimeKind = 'web' | 'api';
// One half hour of the last 24: the worst result in it, or none when nothing was checked.
export type Bar = UptimeStatus | 'none';

export type MonitorRow = {
  id: string;
  name: string;
  url: string;
  kind: UptimeKind;
  paused: boolean;
  status: UptimeStatus | null;
  lastCheckedAt: string | null;
  lastResponseMs: number | null;
  lastError: string | null;
  downSince: string | null;
  // 48 half hours, oldest first.
  bars: Bar[];
  // 0–100 with one decimal; null when nothing was checked.
  uptime24h: number | null;
};

export type UptimeView = { monitors: MonitorRow[]; uptime24h: number | null; incidents7d: number; lastCheckedAt: string | null };

export type Incident = { id: string; startedAt: string; endedAt: string | null; reason: string | null };

export type MonitorDetail = MonitorRow & {
  uptime7d: number | null;
  uptime30d: number | null;
  // 48 half-hour average response times in ms, oldest first; null where nothing answered.
  responseBars: (number | null)[];
  // Ongoing ones and those from the last 30 days, newest first, at most 50.
  incidents: Incident[];
};
