import { Flag } from 'lucide-react';
import { daySummary } from './day-summary';
import type { Task } from './task-types';

export function TaskProgressComponent({ tasks }: { tasks: Task[] }) {
  const { total, done, percent, highLeft } = daySummary(tasks);

  if (total === 0) return null;

  return (
    <section aria-label="Progress" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] tabular-nums">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Tasks finished"
        className="h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-muted"
      >
        <div className="progress-fill h-full rounded-full bg-signal" style={{ transform: `translateX(${percent - 100}%)` }} />
      </div>
      <p className="font-semibold">{percent}%</p>
      <p className="text-muted-foreground">
        {done} of {total} done
      </p>
      {highLeft > 0 && (
        <p className="flex items-center gap-1.5 text-signal">
          <Flag className="size-3 fill-current" aria-hidden />
          {highLeft} high priority left
        </p>
      )}
    </section>
  );
}
