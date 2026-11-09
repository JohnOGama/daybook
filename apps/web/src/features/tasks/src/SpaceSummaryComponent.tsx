'use client';

import { CheckCircle2, Circle, Flag } from 'lucide-react';
import { Skeleton } from 'skullet/react';
import { useSpaceTodayTasks } from '../hooks/useSpaceTodayTasks';
import { daySummary } from './day-summary';
import { SAMPLE_TASKS } from './sample-tasks';

const MAX_LISTED_TASKS = 5;

export function SpaceSummaryComponent({ spaceId }: { spaceId: string }) {
  const { data, isPending, isError } = useSpaceTodayTasks(spaceId);

  if (isError) return <p className="text-destructive">Could not load this space.</p>;

  const tasks = isPending ? SAMPLE_TASKS : (data ?? []);
  const { total, done, percent, highLeft } = daySummary(tasks);
  const openFirst = [...tasks].sort((a, b) => Number(a.finished) - Number(b.finished));
  const hiddenCount = tasks.length - MAX_LISTED_TASKS;

  return (
    <Skeleton loading={isPending} label="Loading space summary">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold tabular-nums">{percent}%</span>
        <span className="text-muted-foreground tabular-nums">
          {done} of {total} done today
        </span>
      </div>
      <div aria-hidden className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div className="progress-fill h-full rounded-full bg-signal" style={{ transform: `translateX(${percent - 100}%)` }} />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
        <Flag className="size-3 fill-current text-signal" aria-hidden />
        {highLeft} high priority left
      </p>
      {tasks.length === 0 ? (
        <p className="mt-2 border-t pt-2 text-muted-foreground">Nothing planned for today.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5 border-t pt-2">
          {openFirst.slice(0, MAX_LISTED_TASKS).map((task) => {
            const Icon = task.finished ? CheckCircle2 : Circle;
            return (
              <li key={task.id} className="flex items-center gap-1.5">
                <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                <span className={task.finished ? 'truncate text-muted-foreground line-through' : 'truncate'}>{task.title}</span>
                {task.highPriority && !task.finished && (
                  <Flag className="ml-auto size-3 shrink-0 fill-current text-signal" aria-label="High priority" />
                )}
              </li>
            );
          })}
          {hiddenCount > 0 && <li className="text-muted-foreground">+{hiddenCount} more</li>}
        </ul>
      )}
    </Skeleton>
  );
}
