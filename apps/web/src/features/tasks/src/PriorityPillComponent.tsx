'use client';

import { Flag } from 'lucide-react';
import { badgeVariants } from '@/shared/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import { useTaskMutations } from '../hooks/useTaskMutations';
import type { Task } from './task-types';

const PILL_CLASS = cn(badgeVariants({ variant: 'outline' }), 'gap-1 px-1.5 text-muted-foreground [&>svg]:size-3.5');

export function PriorityPillComponent({ task }: { task: Task }) {
  const { update } = useTaskMutations();
  const toggle = () => update.mutate({ id: task.id, input: { highPriority: !task.highPriority } });

  if (task.highPriority) {
    return (
      <button
        type="button"
        aria-label={`Remove high priority from ${task.title}`}
        disabled={task.finished}
        onClick={toggle}
        className={cn(PILL_CLASS, !task.finished && 'cursor-pointer hover:bg-accent')}
      >
        <Flag className="fill-current text-signal" aria-hidden />
        High
      </button>
    );
  }

  if (task.finished) return null;

  return (
    <button
      type="button"
      aria-label={`Mark ${task.title} high priority`}
      onClick={toggle}
      className={cn(PILL_CLASS, 'cursor-pointer hover:bg-accent')}
    >
      <Flag aria-hidden />
      Normal
    </button>
  );
}
