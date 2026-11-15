import { ExternalLink } from 'lucide-react';
import { DrawerCloseButtonComponent } from '@/shared/components/DrawerCloseButtonComponent';
import { DrawerContent, DrawerDescription, DrawerTitle } from '@/shared/components/ui/drawer';
import { cn } from '@/shared/utils/cn';
import { usePipelineRun } from '../hooks/usePipelineRun';
import { formatDuration, pendingStages, runDuration, safeLink, shownStatus, stageDuration } from './pipeline-math';
import type { PipelineRun } from './pipelines-types';
import { RunStatusComponent, StageIconComponent } from './RunStatusComponent';

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

type RunDrawerProps = { initial: PipelineRun; expected: string[]; now: Date };

// One run in full, in a drawer on the right: every stage with its times and message, and the error a failed stage sent.
export function RunDrawerComponent({ initial, expected, now }: RunDrawerProps) {
  const run = usePipelineRun(initial.id, initial).data ?? initial;
  const status = shownStatus(run, now);
  const link = safeLink(run.url);
  const after = pendingStages(run, expected);

  return (
    <DrawerContent
      onInteractOutside={(event) => event.preventDefault()}
      className="gap-4 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-4 data-[vaul-drawer-direction=right]:inset-y-3 data-[vaul-drawer-direction=right]:right-3 data-[vaul-drawer-direction=right]:w-[calc(100%-1.5rem)] data-[vaul-drawer-direction=right]:sm:max-w-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <DrawerTitle className="text-lg tracking-tight">
              {run.job} #{run.number}
            </DrawerTitle>
            <RunStatusComponent status={status} />
          </div>
          <DrawerDescription>
            {[run.branch, run.commit?.slice(0, 7), `started ${time(run.startedAt)}`, `took ${formatDuration(runDuration(run, now))}`].filter(Boolean).join(' · ')}
            {run.finishReason === 'aborted' && ' · Aborted'}
          </DrawerDescription>
        </div>
        <DrawerCloseButtonComponent />
      </div>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border px-3 text-[13px] font-medium hover:bg-accent">
          Open in Jenkins
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}

      <ol aria-label="Stages" className="flex flex-col">
        {run.stages.map((stage, index) => (
          <li key={stage.name} className="flex gap-3.5">
            <div className="flex flex-col items-center pt-0.5">
              <StageIconComponent status={stage.status} />
              {(index < run.stages.length - 1 || after.length > 0) && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-4">
              <span className="flex justify-between gap-2 text-sm font-medium">
                {stage.name}
                <span className="text-xs font-normal text-muted-foreground">{stage.status === 'skipped' ? 'Skipped' : formatDuration(stageDuration(stage, now))}</span>
              </span>
              {stage.message && <span className={cn('text-[13px] break-words', stage.status === 'failed' && 'text-destructive')}>{stage.message}</span>}
              {stage.error && (
                <figure className="overflow-hidden rounded-lg border border-destructive/40 bg-background">
                  <figcaption className="border-b px-3 py-1.5 text-xs text-muted-foreground">Error sent by Jenkins</figcaption>
                  <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-words">{stage.error}</pre>
                </figure>
              )}
              <span className="text-xs text-muted-foreground">
                {time(stage.startedAt)}
                {stage.finishedAt && ` → ${time(stage.finishedAt)}`}
              </span>
            </div>
          </li>
        ))}
        {after.map((name) => (
          <li key={name} className="flex gap-3.5 text-muted-foreground">
            <div className="pt-0.5">
              <StageIconComponent status={run.status === 'running' ? 'pending' : 'skipped'} />
            </div>
            <div className="flex flex-col gap-0.5 pb-4">
              <span className="text-sm font-medium">{name}</span>
              <span className="text-xs">{run.status === 'running' ? 'Waiting' : run.status === 'failed' ? 'Skipped: an earlier stage failed' : 'Skipped'}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-auto text-xs text-muted-foreground">Each line is one report from the Jenkinsfile, shown the moment it arrives.</p>
    </DrawerContent>
  );
}
