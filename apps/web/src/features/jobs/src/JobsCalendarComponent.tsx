'use client';

import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { formatMonthHeading, monthGrid, shiftMonth } from '@/shared/utils/month-grid';
import { type CalendarEntry, calendarEntries } from './jobs-math';
import { type Job, STATUS_DOT } from './jobs-types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHOWN_PER_DAY = 3;

// Interviews first in a day, then status changes, then follow-ups.
const ORDER: Record<CalendarEntry['kind'], number> = { interview: 0, status: 1, followUp: 2 };

function Entry({ entry, onSelect }: { entry: CalendarEntry; onSelect: (jobId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.jobId)}
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
        entry.kind === 'interview' ? 'bg-foreground font-medium text-background hover:bg-foreground/85' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {entry.kind === 'interview' ? (
        <CalendarClock className="size-3 shrink-0" aria-hidden />
      ) : (
        <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', entry.status ? STATUS_DOT[entry.status] : 'bg-muted-foreground')} />
      )}
      <span className="truncate">{entry.label}</span>
    </button>
  );
}

type JobsCalendarProps = { jobs: Job[]; today: string; onSelect: (jobId: string) => void };

// A month of the job hunt: booked interviews stand out, with applications, replies and follow-ups around them.
export function JobsCalendarComponent({ jobs, today, onSelect }: JobsCalendarProps) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const days = monthGrid(month);
  const entries = calendarEntries(jobs).sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
  const onDay = (day: string) => entries.filter((entry) => entry.day === day);
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));

  return (
    <section aria-label="Job hunt calendar" className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft aria-hidden />
        </Button>
        <h2 className="min-w-40 text-center text-sm font-semibold">{formatMonthHeading(month)}</h2>
        <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight aria-hidden />
        </Button>
        {month !== today.slice(0, 7) && (
          <Button variant="outline" size="sm" className="ml-1" onClick={() => setMonth(today.slice(0, 7))}>
            This month
          </Button>
        )}
        <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <span aria-hidden className="size-2.5 rounded-sm bg-foreground" />
          Interview
        </span>
      </div>

      <div className="overflow-x-auto">
        <div role="grid" aria-label={formatMonthHeading(month)} className="min-w-[640px] overflow-hidden rounded-xl border bg-card">
          <div role="row" className="grid grid-cols-7 border-b bg-muted">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} role="columnheader" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {weekday}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]} role="row" className="grid grid-cols-7 border-b last:border-b-0">
              {week.map((day) => {
                const items = onDay(day);
                const expanded = openDay === day;
                const shown = expanded ? items : items.slice(0, SHOWN_PER_DAY);
                const inMonth = day.startsWith(month);
                return (
                  <div
                    key={day}
                    role="gridcell"
                    aria-label={`${day}${items.length > 0 ? `, ${items.length} ${items.length === 1 ? 'entry' : 'entries'}` : ''}`}
                    className={cn('flex min-h-24 min-w-0 flex-col gap-0.5 border-r p-1 last:border-r-0', !inMonth && 'bg-muted/40')}
                  >
                    <span
                      aria-current={day === today ? 'date' : undefined}
                      className={cn(
                        'grid size-6 place-items-center self-start rounded-full text-xs tabular-nums',
                        inMonth ? 'text-foreground' : 'text-muted-foreground',
                        day === today && 'bg-foreground font-semibold text-background',
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {shown.map((entry, index) => (
                      <Entry key={`${entry.jobId}-${entry.kind}-${index}`} entry={entry} onSelect={onSelect} />
                    ))}
                    {items.length > SHOWN_PER_DAY && (
                      <button
                        type="button"
                        onClick={() => setOpenDay(expanded ? null : day)}
                        className="self-start rounded-md px-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {expanded ? 'Show less' : `+${items.length - SHOWN_PER_DAY} more`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
