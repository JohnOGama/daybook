'use client';

import { Check, ChevronDown } from 'lucide-react';
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
import { STATUS_ACCENTS, STATUS_LABELS, STATUSES, type Task, type TaskStatus } from './task-types';

export function StatusPillComponent({ task }: { task: Task }) {
  const { update } = useTaskMutations();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Status of ${task.title}: ${STATUS_LABELS[task.status]}`}
        className={cn(
          'inline-flex h-6 items-center gap-1 rounded-full bg-current/15 pr-2.5 pl-1.5 text-xs font-semibold whitespace-nowrap',
          STATUS_ACCENTS[task.status],
        )}
      >
        <StatusIconComponent status={task.status} />
        {STATUS_LABELS[task.status]}
        <ChevronDown className="size-3" aria-hidden />
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
