import type { PipelineRun, PipelineStage, ShownStatus } from './pipelines-types';

// Matches the API's STALE_MS: a running run with no report for this long has stopped reporting.
const STALE_MS = 30 * 60_000;

const pad = (value: number) => String(value).padStart(2, '0');

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${pad(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${pad(Math.floor((seconds % 3600) / 60))}m`;
}

export const isStale = (run: PipelineRun, now: Date) => run.status === 'running' && now.getTime() - new Date(run.updatedAt).getTime() > STALE_MS;

export const shownStatus = (run: PipelineRun, now: Date): ShownStatus => (isStale(run, now) ? 'stopped' : run.status);

export const stageDuration = (stage: PipelineStage, now: Date) => new Date(stage.finishedAt ?? now).getTime() - new Date(stage.startedAt).getTime();

export const runDuration = (run: PipelineRun, now: Date) => new Date(run.finishedAt ?? (run.status === 'running' ? now : run.updatedAt)).getTime() - new Date(run.startedAt).getTime();

// Stages the last finished run had that this one hasn't reported yet, in that run's order.
export function pendingStages(run: PipelineRun, expected: string[]): string[] {
  const reported = new Set(run.stages.map((stage) => stage.name));
  return expected.filter((name) => !reported.has(name));
}

// "4 of 5": the stages reported so far, out of those plus the ones still expected.
export function progress(run: PipelineRun, expected: string[]): { at: number; of: number } {
  return { at: run.stages.length, of: run.stages.length + pendingStages(run, expected).length };
}

// A link only for http(s), so a report can't turn "Open in Jenkins" into javascript:.
export function safeLink(url: string | null): string | null {
  if (!url) return null;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

export function timeAgo(iso: string, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

// The newest message a stage sent, for the card's last line.
export function latestMessage(run: PipelineRun): { stage: string; message: string; at: string } | null {
  const withMessage = run.stages.filter((stage) => stage.message);
  const last = withMessage.at(-1);
  return last ? { stage: last.name, message: last.message as string, at: last.finishedAt ?? last.startedAt } : null;
}
