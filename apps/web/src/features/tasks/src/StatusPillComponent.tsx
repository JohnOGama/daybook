'use client';

import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { STATUS_LABELS, STATUSES, type Task, type TaskStatus } from './task-types';

const PILL_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-800',
  on_hold: 'bg-violet-100 text-violet-800',
};

export function StatusPillComponent({ task }: { task: Task }) {
  const { update } = useTaskMutations();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Status of ${task.title}: ${STATUS_LABELS[task.status]}`}
        className={cn(
          'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
          PILL_COLORS[task.status],
        )}
      >
        {STATUS_LABELS[task.status]}
        <ChevronDown className="size-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={task.status}
          onValueChange={(status) =>
            update.mutate({ id: task.id, input: { status: status as TaskStatus } })
          }
        >
          {STATUSES.map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              {STATUS_LABELS[status]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
