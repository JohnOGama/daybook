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
        className="inline-flex h-6 items-center rounded-full bg-orange-100 px-2.5 text-xs font-semibold text-orange-800"
      >
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
      className="inline-flex size-6 items-center justify-center rounded-full text-slate-300 hover:text-orange-500"
    >
      <Flag className="size-3.5" aria-hidden />
    </button>
  );
}
