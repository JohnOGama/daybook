import { daySummary } from './day-summary';
import type { Task } from './task-types';

export function TaskProgressComponent({ tasks }: { tasks: Task[] }) {
  const { total, done, percent, highLeft } = daySummary(tasks);

  return (
    <section aria-label="Progress" className="mx-4 mb-3.5 rounded-2xl border p-4 md:mx-6">
      <div className="flex items-center justify-between">
        <p className="text-[26px] font-bold">
          {percent}
          <span className="ml-0.5 text-sm font-medium text-muted-foreground">%</span>
        </p>
        <p className="text-right text-xs text-muted-foreground">
          <b className="block text-[13px] font-semibold text-foreground">
            {done} of {total} done
          </b>
          {highLeft} high priority left
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Tasks finished"
        className="mt-2 h-[7px] rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
