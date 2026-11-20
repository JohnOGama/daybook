import type { UptimeStatus } from '@/features/spaces';

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
  uptime24h: number | null;
};

export type UptimeView = { monitors: MonitorRow[]; uptime24h: number | null; incidents7d: number; lastCheckedAt: string | null };

export type Incident = { id: string; startedAt: string; endedAt: string | null; reason: string | null };

export type MonitorDetail = MonitorRow & {
  uptime7d: number | null;
  uptime30d: number | null;
  responseBars: (number | null)[];
  incidents: Incident[];
};

export type MonitorInput = { id: string; name: string; url: string; kind: UptimeKind };
export type MonitorChanges = Partial<Omit<MonitorInput, 'id'>> & { paused?: boolean };
