'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { useActiveSpace } from '@/features/spaces';
import { Button } from '@/shared/components/ui/button';
import { useToday } from '@/shared/hooks/useToday';
import { formatDayHeading } from '@/shared/utils/date-formatter';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTasks } from '../hooks/useTasks';
import { openTaskCount } from './day-summary';
import { filterTasks } from './filter-tasks';
import { FiltersMenuComponent } from './FiltersMenuComponent';
import { hasKanban } from './kanban-columns';
import { KanbanBoardComponent } from './KanbanBoardComponent';
import { countOf } from './parse-task-list';
import { SAMPLE_TASKS } from './sample-tasks';
import { TaskFormDialogComponent } from './TaskFormDialogComponent';
import { TaskProgressComponent } from './TaskProgressComponent';
import { TasksHeaderComponent } from './TasksHeaderComponent';

export function KanbanPageComponent() {
  const router = useRouter();
  const today = useToday();
  const space = useActiveSpace();
  const { data, isPending, isError } = useTasks({ from: today, to: today });
  const { filters } = useTaskFilters();
  const [creating, setCreating] = useState(false);
  const unavailable = space !== undefined && !hasKanban(space);
  const spaceId = space?.id;
  const canEdit = space?.access !== 'view';

  useEffect(() => {
    if (unavailable) router.replace(`/list?space=${spaceId}`);
  }, [unavailable, spaceId, router]);

  if (unavailable) return null;

  const tasks = isPending ? SAMPLE_TASKS : (data ?? []);

  return (
    <div className="flex flex-col md:h-[calc(100dvh-1rem)]">
      <TasksHeaderComponent
        title={formatDayHeading(today)}
        subtitle={`${space?.title} · Today · ${countOf(openTaskCount(tasks), 'task')}`}
        subtitleLoading={isPending}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
        <Skeleton loading={isPending} label="Loading progress">
          <TaskProgressComponent tasks={tasks} />
        </Skeleton>
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
      {isError ? (
        <p className="px-6 py-8 text-sm text-destructive">Could not load tasks. Please try again.</p>
      ) : (
        <Skeleton loading={isPending} label="Loading board" className="min-h-0 flex-1 md:[&>[skullet-pane]]:h-full">
          <KanbanBoardComponent tasks={filterTasks(tasks, filters)} canEdit={canEdit} />
        </Skeleton>
      )}
      <TaskFormDialogComponent mode="new" defaultDay={today} open={creating} onOpenChange={setCreating} />
    </div>
  );
}
