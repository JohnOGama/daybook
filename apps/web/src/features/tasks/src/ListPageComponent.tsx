'use client';

import { Button } from '@/shared/components/ui/button';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Skeleton } from 'skullet/react';
import { useActiveSpace } from '@/features/spaces';
import { EmptyStateComponent } from '@/shared/components/EmptyStateComponent';
import { AllFinishedIcon, EmptyDayIcon, NoFilterMatchIcon } from '@/shared/components/EmptyStateIconsComponent';
import { useToday } from '@/shared/hooks/useToday';
import { formatDayHeading } from '@/shared/utils/date-formatter';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTasks } from '../hooks/useTasks';
import { ClearTableDialogComponent } from './ClearTableDialogComponent';
import { daySummary } from './day-summary';
import { filterTasks } from './filter-tasks';
import { SAMPLE_TASKS } from './sample-tasks';
import { TaskFormDialogComponent } from './TaskFormDialogComponent';
import { TaskProgressComponent } from './TaskProgressComponent';
import { TasksHeaderComponent } from './TasksHeaderComponent';
import { TaskTableComponent } from './TaskTableComponent';
import { TaskToolbarComponent } from './TaskToolbarComponent';
import type { Task } from './task-types';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const withoutFinished = (tasks: Task[]): Task[] =>
  tasks.filter((task) => !task.finished).map((task) => ({ ...task, subtasks: withoutFinished(task.subtasks) }));

export function ListPageComponent() {
  const params = useSearchParams();
  const today = useToday();
  const dayParam = params.get('day');
  const day = dayParam && DAY_PATTERN.test(dayParam) ? dayParam : today;
  const { data, isPending, isError } = useTasks({ from: day, to: day });
  const tasks = isPending ? SAMPLE_TASKS : (data ?? []);
  const { filters, clearFilters } = useTaskFilters();
  const [creating, setCreating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const spaceTitle = useActiveSpace()?.title;

  const filtered = filterTasks(tasks, filters);
  const visible = params.get('closed') === '0' ? withoutFinished(filtered) : filtered;
  const clearable = tasks.filter((task) => visible.some(({ id }) => id === task.id));

  const { total } = daySummary(tasks);
  const count = `${total} ${total === 1 ? 'task' : 'tasks'}`;

  function renderEmptyState() {
    if (tasks.length === 0) {
      return (
        <EmptyStateComponent
          icon={<EmptyDayIcon />}
          title={day === today ? 'Nothing planned for today' : 'Nothing planned for this day'}
          description="Add a task, and it carries forward until you finish it."
          action={<Button onClick={() => setCreating(true)}>New task</Button>}
        />
      );
    }
    if (filters.statuses.length > 0 || filters.high) {
      return (
        <EmptyStateComponent
          icon={<NoFilterMatchIcon />}
          title="No tasks match these filters"
          description="Finished tasks stay hidden while a filter is on."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      );
    }
    return (
      <EmptyStateComponent
        icon={<AllFinishedIcon />}
        title="Everything here is finished"
        description="Turn on Show closed to see these tasks."
      />
    );
  }

  return (
    <>
      <TasksHeaderComponent
        title={formatDayHeading(day)}
        subtitle={`${spaceTitle} · ${day === today ? `Today · ${count}` : count}`}
        subtitleLoading={isPending}
      />
      <TaskToolbarComponent
        onNewTask={() => setCreating(true)}
        onClearTable={!isPending && clearable.length > 0 ? () => setClearing(true) : undefined}
      >
        <Skeleton loading={isPending} label="Loading progress">
          <TaskProgressComponent tasks={tasks} />
        </Skeleton>
      </TaskToolbarComponent>
      <Skeleton loading={isPending} label="Loading tasks">
        {isError && <p className="px-6 py-8 text-sm text-destructive">Could not load tasks. Please try again.</p>}
        {!isError && visible.length > 0 && <TaskTableComponent tasks={visible} allTasks={tasks} />}
        {!isError && visible.length === 0 && renderEmptyState()}
      </Skeleton>
      <TaskFormDialogComponent mode="new" defaultDay={day} open={creating} onOpenChange={setCreating} />
      <ClearTableDialogComponent
        tasks={clearable}
        someHidden={clearable.length < tasks.length}
        open={clearing}
        onOpenChange={setClearing}
      />
    </>
  );
}
