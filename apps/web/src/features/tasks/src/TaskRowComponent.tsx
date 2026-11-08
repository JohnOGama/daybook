'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/utils/cn';
import { formatShortDate } from '@/shared/utils/date-formatter';
import { STATUS_LABELS, type Task } from './task-types';

type TaskRowProps = {
  task: Task;
  expanded?: boolean;
  onToggleExpanded?: () => void;
};

const STATUS_PILL = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-800',
  on_hold: 'bg-violet-100 text-violet-800',
};

export function TaskRowComponent({ task, expanded, onToggleExpanded }: TaskRowProps) {
  const isSubtask = task.parentId !== null;

  return (
    <tr className="h-[46px] border-b">
      <td className="pl-4">
        {task.subtasks.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${task.title}`}
            onClick={onToggleExpanded}
            className="grid size-5 place-items-center rounded-full border border-slate-400 text-slate-500"
          >
            {expanded ? (
              <ChevronDown className="size-3" strokeWidth={2.5} aria-hidden />
            ) : (
              <ChevronRight className="size-3" strokeWidth={2.5} aria-hidden />
            )}
          </button>
        )}
      </td>
      <td>
        {!isSubtask && (
          <Checkbox
            aria-label={`Finish ${task.title}`}
            checked={task.finished}
            disabled
            className="data-[state=checked]:border-brand data-[state=checked]:bg-brand"
          />
        )}
      </td>
      <td className="pr-3">
        <div className={cn('flex items-center gap-3', isSubtask && 'pl-1')}>
          {isSubtask && (
            <Checkbox
              aria-label={`Finish ${task.title}`}
              checked={task.finished}
              disabled
              className="data-[state=checked]:border-brand data-[state=checked]:bg-brand"
            />
          )}
          <span className={cn('truncate font-medium', task.finished && 'text-slate-400 line-through')}>
            {task.title}
          </span>
        </div>
      </td>
      <td>
        {!task.finished && (
          <span
            className={cn(
              'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
              STATUS_PILL[task.status],
            )}
          >
            {STATUS_LABELS[task.status]}
          </span>
        )}
      </td>
      <td>
        {task.highPriority && (
          <span className="inline-flex h-6 items-center rounded-full bg-orange-100 px-2.5 text-xs font-semibold text-orange-800">
            High
          </span>
        )}
      </td>
      <td className="text-[13px] text-muted-foreground">{formatShortDate(task.createdAt)}</td>
      <td className="pr-4" />
    </tr>
  );
}
