'use client';

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
import { useTaskMutations } from '../hooks/useTaskMutations';
import { describeTaskList } from './parse-task-list';
import type { Task } from './task-types';

type ClearTableDialogProps = {
  tasks: Task[];
  someHidden: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ClearTableDialogComponent({ tasks, someHidden, open, onOpenChange }: ClearTableDialogProps) {
  const { removeMany } = useTaskMutations();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear this table?</AlertDialogTitle>
          <AlertDialogDescription>
            This moves {describeTaskList(tasks)} to Trash. You can restore anything from there.
            {someHidden && ' Tasks that are not showing stay where they are.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => removeMany.mutate(tasks.map(({ id }) => id))}>
            Clear table
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
