'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils/cn';
import { dayListHref, weekLayout } from './calendar-grid';
import { countOf } from './parse-task-list';
import { STATUS_ACCENTS, type Task } from './task-types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Day number, three entry lines, "+N more", then the rest of the cell.
const WEEK_ROWS = 'auto repeat(3, auto) auto minmax(0.375rem, 1fr)';

const weeksOf = (days: string[]) =>
  Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7));

type MonthGridProps = {
  days: string[];
  month: string;
  today: string;
  tasks: Task[];
  filterParams: URLSearchParams;
  onSelectTask?: (task: Task) => void;
};

function entryColor(task: Task): string {
  if (task.finished) return 'bg-muted text-muted-foreground line-through';
  if (task.highPriority) return 'bg-signal text-background';
  return cn('bg-current/15', STATUS_ACCENTS[task.status]);
}

export function MonthGridComponent({ days, month, today, tasks, filterParams, onSelectTask }: MonthGridProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto px-4 pb-6 md:px-6">
      <div className="min-w-[640px] overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="bg-secondary px-2.5 py-2 text-xs font-medium text-muted-foreground">
              {weekday}
            </div>
          ))}
        </div>
        {weeksOf(days).map((week) => {
          const { entries, more } = weekLayout(week, tasks);
          return (
            <div key={week[0]} className="grid min-h-23 grid-cols-7 border-t" style={{ gridTemplateRows: WEEK_ROWS }}>
              {week.map((day, column) => {
                const href = dayListHref(day, today, filterParams);
                const inMonth = day.startsWith(month);
                return (
                  <div key={day} className="contents">
                    <div
                      onClick={() => router.push(href)}
                      style={{ gridColumn: column + 1, gridRow: '1 / -1' }}
                      className={cn('cursor-pointer', column !== 0 && 'border-l', !inMonth && 'bg-muted/30')}
                    />
                    <div className="pointer-events-none px-1.5 pt-1.5" style={{ gridColumn: column + 1, gridRow: 1 }}>
                      <Link
                        href={href}
                        className={cn(
                          'pointer-events-auto mb-0.5 grid size-5.5 place-items-center rounded-full text-xs font-medium',
                          inMonth ? 'text-foreground' : 'text-muted-foreground',
                          day === today && 'bg-foreground text-background',
                        )}
                      >
                        {Number(day.slice(8))}
                      </Link>
                    </div>
                    {more[column] > 0 && (
                      <p
                        className="pointer-events-none mt-0.5 px-3 text-[11px] text-muted-foreground"
                        style={{ gridColumn: column + 1, gridRow: 5 }}
                      >
                        +{more[column]} more
                      </p>
                    )}
                  </div>
                );
              })}
              {entries.map(({ task, line, column, span, days: length, openStart, openEnd }) => (
                <button
                  key={task.id}
                  type="button"
                  disabled={!onSelectTask}
                  onClick={() => onSelectTask?.(task)}
                  style={{ gridColumn: `${column + 1} / span ${span}`, gridRow: line + 2 }}
                  className={cn(
                    'relative mx-1.5 mt-0.5 block min-w-0 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium',
                    openStart && 'ml-0 rounded-l-none',
                    openEnd && 'mr-0 rounded-r-none',
                    entryColor(task),
                  )}
                >
                  {length > 1 ? `${task.title} · ${countOf(length, 'day')}` : task.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
