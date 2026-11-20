import { cn } from '@/shared/utils/cn';
import { formatDuration, runDuration, shownStatus, timeAgo } from './pipeline-math';
import type { PipelineRun, ShownStatus } from './pipelines-types';

const DOT: Record<ShownStatus, string> = {
  running: 'bg-status-progress motion-safe:animate-pulse',
  passed: 'bg-status-done',
  failed: 'bg-destructive',
  stopped: 'bg-destructive',
};

type RunsTableProps = { runs: PipelineRun[]; now: Date; onOpen(runId: string): void };

// The newest runs across every job, as the compact list in the corner panel; picking one opens it in the drawer.
export function RunsTableComponent({ runs, now, onOpen }: RunsTableProps) {
  return (
    <section aria-label="Recent runs" className="flex min-h-0 flex-col gap-1.5">
      <h2 className="px-2 text-xs font-medium text-muted-foreground">Recent runs</h2>
      <ul className="-mx-1 flex min-h-0 flex-col overflow-y-auto overscroll-contain">
        {runs.map((run) => {
          const status = shownStatus(run, now);
          return (
            <li key={run.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-accent', status === 'running' && 'bg-status-progress/5')}>
              <span className={cn('size-2 shrink-0 rounded-full', DOT[status])} aria-hidden />
              <button type="button" className="min-w-0 flex-1 truncate text-left font-medium" onClick={() => onOpen(run.id)}>
                {run.job} #{run.number}
              </button>
              <span className="shrink-0 text-xs text-muted-foreground">{status === 'running' ? formatDuration(runDuration(run, now)) : timeAgo(run.startedAt, now)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
