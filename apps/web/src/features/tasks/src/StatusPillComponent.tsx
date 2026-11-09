'use client';

import { Check } from 'lucide-react';
import { badgeVariants } from '@/shared/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { StatusIconComponent } from './StatusIconComponent';
import { STATUS_LABELS, STATUSES, type Task, type TaskStatus } from './task-types';

export function StatusPillComponent({ task }: { task: Task }) {
  const { update } = useTaskMutations();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Status of ${task.title}: ${STATUS_LABELS[task.status]}`}
        className={cn(
          badgeVariants({ variant: 'outline' }),
          'cursor-pointer gap-1 px-1.5 text-muted-foreground outline-none hover:bg-accent [&>svg]:size-3.5',
        )}
      >
        <StatusIconComponent status={task.status} />
        {STATUS_LABELS[task.status]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuRadioGroup
          value={task.status}
          onValueChange={(status) =>
            update.mutate({ id: task.id, input: { status: status as TaskStatus } })
          }
        >
          {STATUSES.map((status) => (
            <DropdownMenuRadioItem
              key={status}
              value={status}
              className="pl-2 text-xs tracking-wide uppercase data-[state=checked]:bg-accent data-[state=checked]:font-semibold [&>span:first-child]:hidden"
            >
              <StatusIconComponent status={status} />
              {STATUS_LABELS[status]}
              {status === task.status && <Check className="ml-auto" aria-hidden />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
