'use client';

import { useDraggable } from '@dnd-kit/core';
import { Flag, GripVertical, ListChecks } from 'lucide-react';
import type { PointerEventHandler, ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import type { Task } from './task-types';

type KanbanCardFaceProps = { task: Task; handle: ReactNode; onOpen?: () => void; className?: string };

export function KanbanCardFace({ task, handle, onOpen, className }: KanbanCardFaceProps) {
  const subtasksDone = task.subtasks.filter((subtask) => subtask.finished).length;

  return (
    <div className={cn('cursor-grab rounded-xl border bg-secondary p-2.5 active:cursor-grabbing', className)}>
      <div className="flex items-start gap-1.5">
        {handle}
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            'line-clamp-2 min-w-0 flex-1 text-left text-sm font-medium',
            task.finished && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </button>
        {task.highPriority && !task.finished && (
          <Flag className="mt-0.5 size-3.5 shrink-0 fill-current text-signal" aria-label="High priority" />
        )}
      </div>
      {task.subtasks.length > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 pl-5.5 text-xs text-muted-foreground tabular-nums">
          <ListChecks className="size-3.5" aria-hidden />
          <span aria-label={`${subtasksDone} of ${task.subtasks.length} subtasks done`}>
            {subtasksDone}/{task.subtasks.length}
          </span>
        </p>
      )}
    </div>
  );
}

export function KanbanCardComponent({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      onPointerDown={listeners?.onPointerDown as PointerEventHandler | undefined}
      className={cn('group', isDragging && 'opacity-40')}
    >
      <KanbanCardFace
        task={task}
        onOpen={onOpen}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Move ${task.title}`}
            className="grid h-5 w-4 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground/60 hover:text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <GripVertical className="size-3.5" aria-hidden />
          </button>
        }
      />
    </li>
  );
}
