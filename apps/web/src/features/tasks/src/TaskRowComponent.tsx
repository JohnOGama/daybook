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
  depth?: number;
  rowIndex: number;
  canReorder: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
};

const INDENT_PX = 20;
// ponytail: indentation stops growing here so very deep titles stay readable; a breadcrumb view could replace it
const MAX_INDENT_LEVELS = 10;

export function TaskRowComponent({ task, depth = 0, rowIndex, canReorder, expanded, onToggleExpanded }: TaskRowProps) {
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

  const expandToggle = task.subtasks.length > 0 && (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${task.title}`}
      onClick={onToggleExpanded}
      className="grid size-5 place-items-center text-muted-foreground"
    >
      {expanded ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
    </button>
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
              {!isSubtask && expandToggle}
            </div>
          </td>
          <td>{!isSubtask && finishBox}</td>
          <td className="pr-3">
            <div
              className={cn('flex items-center', isSubtask ? 'gap-1.5' : 'gap-3')}
              style={isSubtask ? { paddingLeft: (Math.min(depth, MAX_INDENT_LEVELS) - 1) * INDENT_PX } : undefined}
            >
              {isSubtask && <span className="grid w-5 shrink-0 place-items-center">{expandToggle}</span>}
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
