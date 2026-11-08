'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/utils/cn';
import { formatShortDate } from '@/shared/utils/date-formatter';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { PriorityPillComponent } from './PriorityPillComponent';
import { StatusPillComponent } from './StatusPillComponent';
import { TaskFormDialogComponent, type TaskFormMode } from './TaskFormDialogComponent';
import { TaskRowMenuComponent } from './TaskRowMenuComponent';
import type { Task } from './task-types';

type TaskRowProps = {
  task: Task;
  expanded?: boolean;
  onToggleExpanded?: () => void;
};

export function TaskRowComponent({ task, expanded, onToggleExpanded }: TaskRowProps) {
  const { setFinished } = useTaskMutations();
  const [formMode, setFormMode] = useState<TaskFormMode>();
  const isSubtask = task.parentId !== null;
  const finished = setFinished.isPending ? setFinished.variables.finished : task.finished;

  const finishBox = (
    <Checkbox
      aria-label={`Finish ${task.title}`}
      checked={finished}
      onCheckedChange={(checked) => setFinished.mutate({ id: task.id, finished: checked === true })}
      className="data-[state=checked]:border-brand data-[state=checked]:bg-brand"
    />
  );

  return (
    <tr className="h-[46px] border-b">
      <td className="pl-4">
        {task.subtasks.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${task.title}`}
            onClick={onToggleExpanded}
            className="grid size-5 place-items-center rounded-full border border-slate-400 text-slate-500"
          >
            {expanded ? (
              <ChevronDown className="size-3" strokeWidth={2.5} aria-hidden />
            ) : (
              <ChevronRight className="size-3" strokeWidth={2.5} aria-hidden />
            )}
          </button>
        )}
      </td>
      <td>{!isSubtask && finishBox}</td>
      <td className="pr-3">
        <div className={cn('flex items-center gap-3', isSubtask && 'pl-1')}>
          {isSubtask && finishBox}
          <span className={cn('truncate font-medium', finished && 'text-slate-400 line-through')}>
            {task.title}
          </span>
        </div>
      </td>
      <td>{!task.finished && <StatusPillComponent task={task} />}</td>
      <td>
        <PriorityPillComponent task={task} />
      </td>
      <td className="text-[13px] text-muted-foreground">{formatShortDate(task.createdAt)}</td>
      <td className="pr-2">
        <TaskRowMenuComponent task={task} onOpenForm={setFormMode} />
        {formMode && (
          <TaskFormDialogComponent
            mode={formMode}
            task={task}
            defaultDay={task.day}
            open
            onOpenChange={(open) => !open && setFormMode(undefined)}
          />
        )}
      </td>
    </tr>
  );
}
