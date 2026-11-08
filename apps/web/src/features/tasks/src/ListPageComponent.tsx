'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useToday } from '@/shared/hooks/useToday';
import { formatDayHeading } from '@/shared/utils/date-formatter';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTasks } from '../hooks/useTasks';
import { daySummary } from './day-summary';
import { filterTasks } from './filter-tasks';
import { TaskFormDialogComponent } from './TaskFormDialogComponent';
import { TaskProgressComponent } from './TaskProgressComponent';
import { TasksHeaderComponent } from './TasksHeaderComponent';
import { TaskTableComponent } from './TaskTableComponent';
import { TaskToolbarComponent } from './TaskToolbarComponent';
import type { Task } from './task-types';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const withoutFinished = (tasks: Task[]) =>
  tasks
    .filter((task) => !task.finished)
    .map((task) => ({ ...task, subtasks: task.subtasks.filter((subtask) => !subtask.finished) }));

export function ListPageComponent() {
  const params = useSearchParams();
  const today = useToday();
  const dayParam = params.get('day');
  const day = dayParam && DAY_PATTERN.test(dayParam) ? dayParam : today;
  const { data: tasks = [], isPending, isError } = useTasks({ from: day, to: day });
  const { filters } = useTaskFilters();
  const [creating, setCreating] = useState(false);

  const filtered = filterTasks(tasks, filters);
  const visible = params.get('closed') === '0' ? withoutFinished(filtered) : filtered;

  const { total } = daySummary(tasks);
  const count = `${total} ${total === 1 ? 'task' : 'tasks'}`;

  return (
    <>
      <TasksHeaderComponent
        title={formatDayHeading(day)}
        subtitle={day === today ? `Today · ${count}` : count}
      />
      <TaskToolbarComponent day={day} today={today} onNewTask={() => setCreating(true)} />
      <TaskProgressComponent tasks={tasks} />
      {isError && <p className="px-6 py-8 text-sm text-destructive">Could not load tasks. Please try again.</p>}
      {isPending && <p className="px-6 py-8 text-sm text-muted-foreground">Loading tasks…</p>}
      {!isPending && !isError && visible.length > 0 && <TaskTableComponent tasks={visible} />}
      {!isPending && !isError && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-sm text-muted-foreground">
          {tasks.length === 0 ? 'Nothing planned for this day.' : 'No tasks match these filters.'}
          {tasks.length === 0 && <Button onClick={() => setCreating(true)}>New task</Button>}
        </div>
      )}
      <TaskFormDialogComponent mode="new" defaultDay={day} open={creating} onOpenChange={setCreating} />
    </>
  );
}
