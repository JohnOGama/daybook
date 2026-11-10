'use client';

import { MoreVertical } from 'lucide-react';
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

function CopyToMenu({ task }: { task: Task }) {
  const { copy } = useTaskMutations();
  const { data: spaces = [] } = useSpaces();
  const activeId = useActiveSpace()?.id;
  const otherSpaces = spaces.filter((space) => space.tool === 'list' && space.id !== activeId);

  if (otherSpaces.length === 0) return null;

  return (
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
  );
}

export function TaskRowMenuComponent({ task, onOpenForm, onDelete }: TaskRowMenuProps) {
  const { copy } = useTaskMutations();
  const isTopLevel = task.parentId === null;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${task.title}`}
          className="size-8 text-muted-foreground data-[state=open]:bg-muted"
        >
          <MoreVertical aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onOpenForm('edit')}>Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onOpenForm('subtask')}>Add subtask</DropdownMenuItem>
        {isTopLevel && !task.finished && (
          <DropdownMenuItem onSelect={() => onOpenForm('move')}>Move to another day</DropdownMenuItem>
        )}
        {isTopLevel && <DropdownMenuItem onSelect={() => copy.mutate({ id: task.id })}>Duplicate</DropdownMenuItem>}
        {isTopLevel && <CopyToMenu task={task} />}
        <DropdownMenuItem onSelect={onDelete}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
