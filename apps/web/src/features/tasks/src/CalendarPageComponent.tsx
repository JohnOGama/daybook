'use client';

import { Button } from '@/shared/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Skeleton } from 'skullet/react';
import { useActiveSpace } from '@/features/spaces';
import { useToday } from '@/shared/hooks/useToday';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTasks } from '../hooks/useTasks';
import { formatMonthHeading, monthGrid, shiftMonth } from './calendar-grid';
import { openTaskCount } from './day-summary';
import { filterTasks } from './filter-tasks';
import { FiltersMenuComponent } from './FiltersMenuComponent';
import { MonthGridComponent } from './MonthGridComponent';
import { countOf } from './parse-task-list';
import { sampleMonthTasks } from './sample-tasks';
import { TaskFormDialogComponent } from './TaskFormDialogComponent';
import { TasksHeaderComponent } from './TasksHeaderComponent';
import type { Task } from './task-types';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function CalendarPageComponent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = useToday();
  const monthParam = params.get('month');
  const month = monthParam && MONTH_PATTERN.test(monthParam) ? monthParam : today.slice(0, 7);
  const days = monthGrid(month);

  const { data, isPending, isError } = useTasks({ from: days[0], to: days[days.length - 1] });
  const tasks = isPending ? sampleMonthTasks(days) : (data ?? []);
  const { data: todayTasks = [], isPending: isTodayPending } = useTasks({ from: today, to: today });
  const { filters } = useTaskFilters();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task>();

  const space = useActiveSpace();
  const spaceTitle = space?.title;
  const canEdit = space?.access !== 'view';
  const filterParams = new URLSearchParams(
    [...params].filter(([name]) => ['space', 'status', 'high'].includes(name)),
  );

  function goToMonth(target: string) {
    const next = new URLSearchParams(params);
    next.set('month', target);
    router.replace(`${pathname}?${next}`);
  }

  return (
    <>
      <TasksHeaderComponent
        title={formatMonthHeading(month)}
        subtitle={`${spaceTitle} · Today · ${countOf(openTaskCount(todayTasks), 'task')}`}
        subtitleLoading={isTodayPending}
      />
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
        <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => goToMonth(shiftMonth(month, -1))}>
          <ChevronLeft aria-hidden />
        </Button>
        <Button variant="outline" size="icon" aria-label="Next month" onClick={() => goToMonth(shiftMonth(month, 1))}>
          <ChevronRight aria-hidden />
        </Button>
        <Button size="sm" onClick={() => goToMonth(today.slice(0, 7))}>
          Today
        </Button>
        <div role="group" aria-label="Task actions" className="ml-auto flex items-center gap-1 rounded-xl border bg-card p-1">
          <FiltersMenuComponent />
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              New task
            </Button>
          )}
        </div>
      </div>
      {isError && <p className="px-6 pb-3 text-sm text-destructive">Could not load tasks. Please try again.</p>}
      <Skeleton loading={isPending} label="Loading tasks">
        <MonthGridComponent
          days={days}
          month={month}
          today={today}
          tasks={filterTasks(tasks, filters)}
          filterParams={filterParams}
          onSelectTask={canEdit ? setEditing : undefined}
        />
      </Skeleton>
      <TaskFormDialogComponent mode="new" defaultDay={today} open={creating} onOpenChange={setCreating} />
      {editing && (
        <TaskFormDialogComponent
          mode="edit"
          task={editing}
          defaultDay={editing.day}
          open
          onOpenChange={(open) => !open && setEditing(undefined)}
        />
      )}
    </>
  );
}
