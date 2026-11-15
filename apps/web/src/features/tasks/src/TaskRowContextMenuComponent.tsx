'use client';

import type { ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import { useTaskMutations } from '../hooks/useTaskMutations';
import type { TaskFormMode } from './TaskFormDialogComponent';
import type { Task } from './task-types';

type TaskRowContextMenuProps = {
  task: Task;
  onOpenForm: (mode: TaskFormMode) => void;
  onDelete: () => void;
  canEdit?: boolean;
  children: ReactNode;
};

export function TaskRowContextMenuComponent({ task, onOpenForm, onDelete, canEdit = true, children }: TaskRowContextMenuProps) {
  const { copy } = useTaskMutations();

  if (!canEdit) return children;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onOpenForm('edit')}>Edit</ContextMenuItem>
        {task.parentId === null && (
          <ContextMenuItem onSelect={() => copy.mutate({ id: task.id })}>Duplicate</ContextMenuItem>
        )}
        <ContextMenuItem onSelect={onDelete}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
