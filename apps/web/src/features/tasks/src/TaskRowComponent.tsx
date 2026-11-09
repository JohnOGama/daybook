'use client';

import { Checkbox } from '@/shared/components/ui/checkbox';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { formatShortDate, formatShortDay } from '@/shared/utils/date-formatter';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { PriorityPillComponent } from './PriorityPillComponent';
import { StatusPillComponent } from './StatusPillComponent';
import { TaskDeleteDialogComponent } from './TaskDeleteDialogComponent';
import { TaskFormDialogComponent, type TaskFormMode } from './TaskFormDialogComponent';
import { TaskRowContextMenuComponent } from './TaskRowContextMenuComponent';
import { TaskRowMenuComponent } from './TaskRowMenuComponent';
import { TaskTitleComponent } from './TaskTitleComponent';
import type { Task } from './task-types';

type TaskRowProps = {
  task: Task;
  rowIndex: number;
  canReorder: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
};

export function TaskRowComponent({ task, rowIndex, canReorder, expanded, onToggleExpanded }: TaskRowProps) {
  const { setFinished } = useTaskMutations();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const [formMode, setFormMode] = useState<TaskFormMode>();
  const [deleting, setDeleting] = useState(false);
  const isSubtask = task.parentId !== null;
  const { finished } = task;

  const finishBox = (
    <Checkbox
      aria-label={`Finish ${task.title}`}
      checked={finished}
      onCheckedChange={(checked) => setFinished.mutate({ id: task.id, finished: checked === true })}
      className={cn(setFinished.isPending && finished && 'confirm-pulse')}
    />
  );

  const rowStyle = {
    '--row-index': rowIndex,
    transform: CSS.Translate.toString(transform),
    transition,
  } as CSSProperties;

  return (
    <>
      <TaskRowContextMenuComponent task={task} onOpenForm={setFormMode} onDelete={() => setDeleting(true)}>
        <tr
          ref={setNodeRef}
          style={rowStyle}
          className={cn('row-enter group h-[46px] border-b bg-card last:border-b-0', isDragging && 'relative z-10 shadow-md')}
        >
          <td className="pl-1.5">
            <div className="flex items-center gap-0.5">
              {canReorder ? (
                <button
                  type="button"
                  ref={setActivatorNodeRef}
                  {...attributes}
                  {...listeners}
                  aria-label={`Reorder ${task.title}`}
                  className="grid h-6 w-4 cursor-grab touch-none place-items-center text-muted-foreground/60 group-hover:opacity-100 hover:text-muted-foreground focus-visible:opacity-100 active:cursor-grabbing md:opacity-0"
                >
                  <GripVertical className="size-3.5" aria-hidden />
                </button>
              ) : (
                <span className="w-4" aria-hidden />
              )}
              {task.subtasks.length > 0 && (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${task.title}`}
                  onClick={onToggleExpanded}
                  className="grid size-5 place-items-center text-muted-foreground"
                >
                  {expanded ? (
                    <ChevronDown className="size-4" aria-hidden />
                  ) : (
                    <ChevronRight className="size-4" aria-hidden />
                  )}
                </button>
              )}
            </div>
          </td>
          <td>{!isSubtask && finishBox}</td>
          <td className="pr-3">
            <div className={cn('flex items-center gap-3', isSubtask && 'pl-1')}>
              {isSubtask && finishBox}
              <TaskTitleComponent task={task} finished={finished} />
            </div>
          </td>
          <td className="pl-3">{!task.finished && <StatusPillComponent task={task} />}</td>
          <td className="pl-3">
            <PriorityPillComponent task={task} />
          </td>
          <td className="truncate pl-3 text-[13px] text-muted-foreground">{formatShortDate(task.createdAt)}</td>
          <td className="truncate pl-3 text-[13px] text-muted-foreground">
            {task.completedOn ? formatShortDay(task.completedOn) : '-'}
          </td>
          <td className="pr-2">
            <TaskRowMenuComponent task={task} onOpenForm={setFormMode} onDelete={() => setDeleting(true)} />
          </td>
        </tr>
      </TaskRowContextMenuComponent>
      {formMode && (
        <TaskFormDialogComponent
          mode={formMode}
          task={task}
          defaultDay={task.day}
          open
          onOpenChange={(open) => !open && setFormMode(undefined)}
        />
      )}
      <TaskDeleteDialogComponent task={task} open={deleting} onOpenChange={setDeleting} />
    </>
  );
}
