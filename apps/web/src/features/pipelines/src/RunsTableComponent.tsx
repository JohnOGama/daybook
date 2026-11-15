import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { cn } from '@/shared/utils/cn';
import { formatDuration, latestMessage, runDuration, shownStatus, timeAgo } from './pipeline-math';
import type { PipelineRun } from './pipelines-types';
import { RunStatusComponent } from './RunStatusComponent';

type RunsTableProps = { runs: PipelineRun[]; now: Date; onOpen(runId: string): void };

// The newest runs across every job; picking one opens it in the drawer.
export function RunsTableComponent({ runs, now, onOpen }: RunsTableProps) {
  return (
    <section aria-label="Recent runs" className="flex flex-col gap-2.5">
      <h2 className="text-sm font-semibold text-muted-foreground">Recent runs</h2>
      <div className="overflow-x-auto rounded-xl border">
        <Table className="min-w-[44rem] text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Last message</TableHead>
              <TableHead className="text-right">Took</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const status = shownStatus(run, now);
              const last = run.stages.at(-1);
              const message = latestMessage(run);
              return (
                <TableRow key={run.id} className={cn(status === 'running' && 'bg-status-progress/5')}>
                  <TableCell className="font-medium">
                    <button type="button" className="hover:underline" onClick={() => onOpen(run.id)}>
                      {run.job} #{run.number}
                    </button>
                  </TableCell>
                  <TableCell>
                    <RunStatusComponent status={status} />
                  </TableCell>
                  <TableCell>{last ? `${last.name} (${run.stages.length} reported)` : '—'}</TableCell>
                  <TableCell className={cn('max-w-80 truncate text-muted-foreground', status === 'failed' && 'text-destructive')}>{message?.message ?? ''}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDuration(runDuration(run, now))}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{timeAgo(run.startedAt, now)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
