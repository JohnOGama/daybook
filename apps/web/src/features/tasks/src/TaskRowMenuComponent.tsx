'use client';

import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveSpace, useSpaces } from '@/features/spaces';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useTaskMutations } from '../hooks/useTaskMutations';
import type { TaskFormMode } from './TaskFormDialogComponent';
import type { Task } from './task-types';

type TaskRowMenuProps = {
  task: Task;
  onOpenForm: (mode: TaskFormMode) => void;
  onDelete: () => void;
};

export function TaskRowMenuComponent({ task, onOpenForm, onDelete }: TaskRowMenuProps) {
  const { copy } = useTaskMutations();
  const { data: spaces = [] } = useSpaces();
  const activeId = useActiveSpace()?.id;
  const isTopLevel = task.parentId === null;
  const otherSpaces = spaces.filter((space) => space.tool === 'list' && space.id !== activeId);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${task.title}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onOpenForm('edit')}>Edit</DropdownMenuItem>
        {isTopLevel && <DropdownMenuItem onSelect={() => onOpenForm('subtask')}>Add subtask</DropdownMenuItem>}
        {isTopLevel && !task.finished && (
          <DropdownMenuItem onSelect={() => onOpenForm('move')}>Move to another day</DropdownMenuItem>
        )}
        {isTopLevel && <DropdownMenuItem onSelect={() => copy.mutate({ id: task.id })}>Duplicate</DropdownMenuItem>}
        {isTopLevel && otherSpaces.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Copy to</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherSpaces.map((space) => (
                <DropdownMenuItem
                  key={space.id}
                  onSelect={() =>
                    copy.mutate(
                      { id: task.id, targetSpaceId: space.id },
                      { onSuccess: () => toast.success(`Copied to ${space.title}`) },
                    )
                  }
                >
                  {space.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onSelect={onDelete}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
