'use client';

import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useTaskMutations } from '../hooks/useTaskMutations';
import type { TaskFormMode } from './TaskFormDialogComponent';
import type { Task } from './task-types';

type TaskRowMenuProps = {
  task: Task;
  onOpenForm: (mode: TaskFormMode) => void;
};

export function TaskRowMenuComponent({ task, onOpenForm }: TaskRowMenuProps) {
  const { remove } = useTaskMutations();
  const [confirming, setConfirming] = useState(false);
  const isTopLevel = task.parentId === null;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${task.title}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onOpenForm('edit')}>Edit</DropdownMenuItem>
          {isTopLevel && (
            <DropdownMenuItem onSelect={() => onOpenForm('subtask')}>Add subtask</DropdownMenuItem>
          )}
          {isTopLevel && !task.finished && (
            <DropdownMenuItem onSelect={() => onOpenForm('move')}>Move to another day</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setConfirming(true)}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{task.title}"{task.subtasks.length > 0 ? ' and its subtasks' : ''} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(task.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
