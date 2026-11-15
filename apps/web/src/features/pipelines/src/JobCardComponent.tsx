import { ExternalLink } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { formatDuration, latestMessage, pendingStages, safeLink, shownStatus, stageDuration, timeAgo } from './pipeline-math';
import { type PipelineJob, STATUS_LABELS } from './pipelines-types';
import { RunStatusComponent, StageIconComponent } from './RunStatusComponent';

const STEP: Record<string, string> = {
  running: 'border-status-progress/50 bg-status-progress/10',
  failed: 'border-destructive/50 bg-destructive/10',
  pending: 'border-dashed text-muted-foreground',
};
const BAR: Record<string, string> = { passed: 'bg-status-done', failed: 'bg-destructive', running: 'bg-status-progress', skipped: 'bg-muted', pending: 'bg-muted' };

type JobCardProps = { job: PipelineJob; now: Date; onOpen(runId: string): void };

// A job's newest run: its stages as steps (done, running, failed, still to come) and the last message a stage sent.
export function JobCardComponent({ job, now, onOpen }: JobCardProps) {
  const run = job.latest;
  const status = shownStatus(run, now);
  const link = safeLink(run.url);
  const message = latestMessage(run);
  const pending = pendingStages(run, job.expected);
  const meta = [`#${run.number}`, run.branch, run.commit?.slice(0, 7), status === 'running' || status === 'stopped' ? `started ${timeAgo(run.startedAt, now)}` : `finished ${timeAgo(run.finishedAt ?? run.updatedAt, now)}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <section aria-label={`${job.job}, ${STATUS_LABELS[status].toLowerCase()}`} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 className="text-base font-semibold">
          <button type="button" className="hover:underline" onClick={() => onOpen(run.id)}>
            {job.job}
          </button>
        </h2>
        <RunStatusComponent status={status} />
        <span className="text-[13px] text-muted-foreground">
          {meta}
          {run.finishReason === 'aborted' && ' · Aborted'}
        </span>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
            Open in Jenkins
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </div>

      <ol aria-label="Stages" className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
        {run.stages.map((stage) => (
          <li key={stage.name} className={cn('flex flex-col gap-1.5 rounded-xl border bg-popover px-3 py-2.5', STEP[stage.status])}>
            <span className={cn('h-[3px] rounded-full', BAR[stage.status])} aria-hidden />
            <span className="flex items-center gap-1.5 truncate text-sm font-medium">
              <StageIconComponent status={stage.status} />
              <span className="truncate">{stage.name}</span>
            </span>
            <span className={cn('text-xs text-muted-foreground', stage.status === 'running' && 'text-status-progress')}>
              {stage.status === 'running' ? `Running · ${formatDuration(stageDuration(stage, now))}` : stage.status === 'skipped' ? 'Skipped' : formatDuration(stageDuration(stage, now))}
            </span>
          </li>
        ))}
        {pending.map((name) => (
          <li key={name} className={cn('flex flex-col gap-1.5 rounded-xl border bg-popover px-3 py-2.5', STEP.pending)}>
            <span className={cn('h-[3px] rounded-full', BAR.pending)} aria-hidden />
            <span className="flex items-center gap-1.5 truncate text-sm font-medium">
              <StageIconComponent status={run.status === 'running' ? 'pending' : 'skipped'} />
              <span className="truncate">{name}</span>
            </span>
            <span className="text-xs">{run.status === 'running' ? 'Waiting' : 'Skipped'}</span>
          </li>
        ))}
      </ol>

      {message && (
        <p className="flex flex-wrap items-baseline gap-x-2.5 text-[13px]">
          <span className="text-muted-foreground">{message.stage} says</span>
          <span className="min-w-0 break-words">{message.message}</span>
          <span className="ml-auto text-muted-foreground">{timeAgo(message.at, now)}</span>
        </p>
      )}
    </section>
  );
}
