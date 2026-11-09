'use client';

import { useState } from 'react';
import { InlineTitleInputComponent } from '@/shared/components/InlineTitleInputComponent';
import { cn } from '@/shared/utils/cn';
import { useTaskMutations } from '../hooks/useTaskMutations';
import type { Task } from './task-types';

export function TaskTitleComponent({ task, finished }: { task: Task; finished: boolean }) {
  const { update } = useTaskMutations();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <InlineTitleInputComponent
        label={`Title of ${task.title}`}
        value={task.title}
        onSave={(title) => update.mutate({ id: task.id, input: { title } })}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      className={cn('truncate font-medium', finished && 'text-muted-foreground line-through')}
    >
      {task.title}
    </span>
  );
}
