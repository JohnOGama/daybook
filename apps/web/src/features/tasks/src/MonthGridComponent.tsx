'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils/cn';
import { dayEntries, dayListHref } from './calendar-grid';
import { STATUS_ACCENTS, type Task } from './task-types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type MonthGridProps = {
  days: string[];
  month: string;
  today: string;
  tasks: Task[];
  filterParams: URLSearchParams;
  onSelectTask: (task: Task) => void;
};

function entryColor(task: Task): string {
  if (task.finished) return 'text-muted-foreground line-through';
  if (task.highPriority) return 'bg-signal text-background';
  return cn('bg-current/15', STATUS_ACCENTS[task.status]);
}

export function MonthGridComponent({ days, month, today, tasks, filterParams, onSelectTask }: MonthGridProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto px-4 pb-6 md:px-6">
      <div className="grid min-w-[640px] grid-cols-7 overflow-hidden rounded-2xl border bg-card">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="bg-secondary px-2.5 py-2 text-xs font-medium text-muted-foreground">
            {weekday}
          </div>
        ))}
        {days.map((day, index) => {
          const { shown, more } = dayEntries(tasks.filter((task) => task.day === day));
          const inMonth = day.startsWith(month);
          const href = dayListHref(day, today, filterParams);
          return (
            <div
              key={day}
              onClick={() => router.push(href)}
              className={cn(
                'min-h-23 min-w-0 cursor-pointer border-t p-1.5',
                index % 7 !== 0 && 'border-l',
                !inMonth && 'bg-muted/30',
              )}
            >
              <Link
                href={href}
                onClick={(event) => event.stopPropagation()}
                className={cn(
                  'mb-0.5 grid size-5.5 place-items-center rounded-full text-xs font-medium',
                  inMonth ? 'text-foreground' : 'text-muted-foreground',
                  day === today && 'bg-foreground text-background',
                )}
              >
                {Number(day.slice(8))}
              </Link>
              {shown.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectTask(task);
                  }}
                  className={cn(
                    'mt-0.5 block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium',
                    entryColor(task),
                  )}
                >
                  {task.title}
                </button>
              ))}
              {more > 0 && <p className="mt-0.5 px-1.5 text-[11px] text-muted-foreground">+{more} more</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
