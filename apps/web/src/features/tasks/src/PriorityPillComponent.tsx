'use client';

import { Flag } from 'lucide-react';
import { useTaskMutations } from '../hooks/useTaskMutations';
import type { Task } from './task-types';

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
        className="inline-flex size-6 items-center justify-center rounded-full text-signal"
      >
        <Flag className="size-3.5 fill-current" aria-hidden />
      </button>
    );
  }

  if (task.finished) return null;

  return (
    <button
      type="button"
      aria-label={`Mark ${task.title} high priority`}
      onClick={toggle}
      className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground/60 hover:text-signal"
    >
      <Flag className="size-3.5" aria-hidden />
    </button>
  );
}
