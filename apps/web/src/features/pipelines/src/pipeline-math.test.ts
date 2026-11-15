import { describe, expect, it } from 'vitest';
import { formatDuration, isStale, pendingStages, progress, safeLink, shownStatus, timeAgo } from './pipeline-math';
import type { PipelineRun } from './pipelines-types';

const NOW = new Date('2026-11-16T10:00:00Z');
const run = (fields: Partial<PipelineRun> = {}): PipelineRun => ({
  id: 'r1',
  job: 'api',
  number: 142,
  status: 'running',
  url: null,
  branch: 'main',
  commit: 'a3f9c21',
  startedAt: '2026-11-16T09:57:25Z',
  updatedAt: '2026-11-16T09:59:56Z',
  finishedAt: null,
  finishReason: null,
  stages: [
    { name: 'Checkout', position: 0, status: 'passed', message: null, error: null, startedAt: '2026-11-16T09:57:25Z', finishedAt: '2026-11-16T09:57:37Z' },
    { name: 'Build', position: 1, status: 'passed', message: null, error: null, startedAt: '2026-11-16T09:57:37Z', finishedAt: '2026-11-16T09:58:41Z' },
    { name: 'Test', position: 2, status: 'passed', message: null, error: null, startedAt: '2026-11-16T09:58:41Z', finishedAt: '2026-11-16T09:59:29Z' },
    { name: 'Deploy', position: 3, status: 'running', message: 'Rolling out', error: null, startedAt: '2026-11-16T09:59:29Z', finishedAt: null },
  ],
  ...fields,
});

describe('pipeline math', () => {
  it('formats durations', () => {
    expect(formatDuration(12_000)).toBe('12s');
    expect(formatDuration(64_000)).toBe('1m 04s');
    expect(formatDuration(860_000)).toBe('14m 20s');
    expect(formatDuration(3_720_000)).toBe('1h 02m');
    expect(formatDuration(-5)).toBe('0s');
  });

  it('a running run 31 minutes old is stopped; a finished one never is', () => {
    const quiet = run({ updatedAt: new Date(NOW.getTime() - 31 * 60_000).toISOString() });
    expect(isStale(quiet, NOW)).toBe(true);
    expect(shownStatus(quiet, NOW)).toBe('stopped');
    expect(shownStatus(run(), NOW)).toBe('running');
    expect(isStale(run({ status: 'passed', updatedAt: '2026-11-01T00:00:00Z' }), NOW)).toBe(false);
  });

  it('progress counts the running stage against expected, and lists the stages still to come', () => {
    const expected = ['Checkout', 'Build', 'Test', 'Deploy', 'Smoke test'];
    expect(progress(run(), expected)).toEqual({ at: 4, of: 5 });
    expect(pendingStages(run(), expected)).toEqual(['Smoke test']);
    expect(progress(run(), [])).toEqual({ at: 4, of: 4 });
  });

  it('safeLink drops javascript: and keeps https', () => {
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink('https://jenkins.example.com/job/api/142/')).toBe('https://jenkins.example.com/job/api/142/');
    expect(safeLink(null)).toBeNull();
    expect(safeLink('not a url')).toBeNull();
  });

  it('says how long ago', () => {
    expect(timeAgo('2026-11-16T09:59:56Z', NOW)).toBe('4s ago');
    expect(timeAgo('2026-11-16T09:19:00Z', NOW)).toBe('41m ago');
    expect(timeAgo('2026-11-16T04:00:00Z', NOW)).toBe('6h ago');
    expect(timeAgo('2026-11-14T10:00:00Z', NOW)).toBe('2d ago');
  });
});
