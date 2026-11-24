'use client';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { TableCell, TableRow } from '@/shared/components/ui/table';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { type CSSProperties, memo, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { formatShortDate, formatShortDay } from '@/shared/utils/date-formatter';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { DueDateComponent } from './DueDateComponent';
import { PriorityPillComponent } from './PriorityPillComponent';
import { StatusIconComponent } from './StatusIconComponent';
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
  enterIndex?: number;
  canReorder: boolean;
  canEdit?: boolean;
  expanded?: boolean;
  onToggleExpanded?: (id: string) => void;
};

const INDENT_PX = 20;
// ponytail: indentation stops growing here so very deep titles stay readable; a breadcrumb view could replace it
const MAX_INDENT_LEVELS = 10;

export const TaskRowComponent = memo(function TaskRowComponent({
  task,
  depth = 0,
  enterIndex,
  canReorder,
  canEdit = true,
  expanded,
  onToggleExpanded,
}: TaskRowProps) {
  const { setFinished } = useTaskMutations();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const [formMode, setFormMode] = useState<TaskFormMode>();
  const [deleting, setDeleting] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const isSubtask = task.parentId !== null;
  const { finished } = task;

  const finishBox = (
    <Checkbox
      aria-label={`Finish ${task.title}`}
      checked={finished}
      disabled={!canEdit}
      onCheckedChange={(checked) => {
        setJustFinished(checked === true);
        setFinished.mutate({ id: task.id, finished: checked === true });
      }}
      onAnimationEnd={() => setJustFinished(false)}
      className={cn(justFinished && 'confirm-pulse')}
    />
  );

  const expandToggle = task.subtasks.length > 0 && (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${task.title}`}
      onClick={() => onToggleExpanded?.(task.id)}
      className="grid size-5 place-items-center text-muted-foreground"
    >
      {expanded ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
    </button>
  );

  const rowStyle = {
    '--row-index': enterIndex,
    transform: CSS.Translate.toString(transform),
    transition,
  } as CSSProperties;

  return (
    <>
      <TaskRowContextMenuComponent
        task={task}
        canEdit={canEdit}
        onOpenForm={setFormMode}
        onDelete={() => setDeleting(true)}
      >
        <TableRow
          ref={setNodeRef}
          style={rowStyle}
          className={cn(
            'group h-[53px]',
            enterIndex !== undefined && 'row-enter',
            isDragging && 'relative z-10 bg-background shadow-md',
          )}
        >
          <TableCell className="py-0 pr-0 pl-1.5">
            <div className="flex items-center">
              {canReorder ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  ref={setActivatorNodeRef}
                  {...attributes}
                  {...listeners}
                  aria-label={`Reorder ${task.title}`}
                  className="size-7 cursor-grab touch-none text-muted-foreground hover:bg-transparent active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  <GripVertical className="size-3" aria-hidden />
                </Button>
              ) : (
                <span className="w-7" aria-hidden />
              )}
              {!isSubtask && expandToggle}
            </div>
          </TableCell>
          <TableCell className="p-0">{!isSubtask && finishBox}</TableCell>
          <TableCell className="py-0 pr-3 pl-0">
            <div
              className={cn('flex items-center', isSubtask ? 'gap-1.5' : 'gap-3')}
              style={isSubtask ? { paddingLeft: (Math.min(depth, MAX_INDENT_LEVELS) - 1) * INDENT_PX } : undefined}
            >
              {isSubtask && <span className="grid w-5 shrink-0 place-items-center">{expandToggle}</span>}
              {isSubtask && finishBox}
              <TaskTitleComponent task={task} finished={finished} readOnly={!canEdit} />
            </div>
          </TableCell>
          <TableCell className="px-3 py-0">
            {task.finished ? (
              <Badge variant="outline" className="gap-1 px-1.5 text-muted-foreground [&>svg]:size-3.5">
                <StatusIconComponent status="completed" />
                Completed
              </Badge>
            ) : (
              <StatusPillComponent task={task} readOnly={!canEdit} />
            )}
          </TableCell>
          <TableCell className="px-3 py-0">
            <PriorityPillComponent task={task} readOnly={!canEdit} />
          </TableCell>
          <TableCell className="px-3 py-0">
            <DueDateComponent task={task} readOnly={!canEdit} />
          </TableCell>
          <TableCell className="truncate px-3 py-0">{formatShortDate(task.createdAt)}</TableCell>
          <TableCell className="truncate px-3 py-0">{task.completedOn ? formatShortDay(task.completedOn) : '-'}</TableCell>
          <TableCell className="py-0 pr-2 pl-0 text-right">
            {canEdit && (
              <TaskRowMenuComponent task={task} onOpenForm={setFormMode} onDelete={() => setDeleting(true)} />
            )}
          </TableCell>
        </TableRow>
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
      {deleting && <TaskDeleteDialogComponent task={task} open onOpenChange={setDeleting} />}
    </>
  );
});
