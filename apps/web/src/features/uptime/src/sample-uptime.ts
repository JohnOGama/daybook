import type { Bar, MonitorRow, UptimeView } from './uptime-types';

const bars: Bar[] = new Array(48).fill('up');

const site = (id: string, name: string, url: string): MonitorRow => ({
  id,
  name,
  url,
  kind: 'web',
  paused: false,
  status: 'up',
  lastCheckedAt: null,
  lastResponseMs: 180,
  lastError: null,
  downSince: null,
  bars,
  uptime24h: 100,
});

// Shapes for the loading skeleton; never shown as real data.
export const SAMPLE_UPTIME: UptimeView = {
  monitors: [site('sample-1', 'Web app', 'https://example.com'), site('sample-2', 'API', 'https://api.example.com/api/health'), site('sample-3', 'Docs', 'https://docs.example.com')],
  uptime24h: 100,
  incidents7d: 0,
  lastCheckedAt: null,
};
