'use client';

import { CalendarClock, CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import { badgeVariants } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { useToday } from '@/shared/hooks/useToday';
import { cn } from '@/shared/utils/cn';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { DUE_TONE_CLASSES, dueLabel, dueTone } from './due-date';
import type { Task } from './task-types';

const PILL_CLASS = cn(badgeVariants({ variant: 'outline' }), 'gap-1 px-1.5 [&>svg]:size-3.5');

// The due date as a small label, coloured by how close it is. Read-only; used on Kanban cards too.
export function DueLabelComponent({ task, className }: { task: Pick<Task, 'dueDay' | 'finished'>; className?: string }) {
  const today = useToday();
  if (!task.dueDay) return null;
  const tone = dueTone(task.dueDay, today, task.finished);
  return (
    <span className={cn('inline-flex items-center gap-1', DUE_TONE_CLASSES[tone], className)}>
      <CalendarClock className="size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="sr-only">Due </span>
        {dueLabel(task.dueDay, today)}
        {tone === 'overdue' && <span className="sr-only">, overdue</span>}
      </span>
    </span>
  );
}

// The Due cell in the task table: the date (or an "add" button on hover), which opens a date picker.
export function DueDateComponent({ task, readOnly }: { task: Task; readOnly?: boolean }) {
  const { update } = useTaskMutations();
  const [open, setOpen] = useState(false);
  const setDue = (dueDay: string | null) => update.mutate({ id: task.id, input: { dueDay } });

  if (readOnly) return task.dueDay ? <DueLabelComponent task={task} className={PILL_CLASS} /> : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {task.dueDay ? (
          <button type="button" aria-label={`Change due date of ${task.title}`} className={cn(PILL_CLASS, 'cursor-pointer hover:bg-accent')}>
            <DueLabelComponent task={task} />
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Add a due date to ${task.title}`}
            className={cn(PILL_CLASS, 'cursor-pointer text-muted-foreground hover:bg-accent md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100')}
          >
            <CalendarPlus aria-hidden />
            Add
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-60 flex-col gap-2 p-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Due date</span>
          <Input type="date" autoFocus value={task.dueDay ?? ''} onChange={(event) => event.target.value && setDue(event.target.value)} />
        </label>
        {task.dueDay && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => {
              setDue(null);
              setOpen(false);
            }}
          >
            Remove due date
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
