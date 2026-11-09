'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { describeTaskList, parseTaskList } from './parse-task-list';
import { StatusIconComponent } from './StatusIconComponent';

type PasteTasksFormProps = { defaultDay: string; initialText: string; onDone: () => void };

function PreviewRow({ title }: { title: string }) {
  return (
    <span className="flex items-start gap-2 py-0.5">
      <StatusIconComponent status="todo" />
      <span className="min-w-0 break-words">{title}</span>
    </span>
  );
}

export function PasteTasksFormComponent({ defaultDay, initialText, onDone }: PasteTasksFormProps) {
  const { createMany } = useTaskMutations();
  const [text, setText] = useState(initialText);
  const [day, setDay] = useState(defaultDay);
  const [saving, setSaving] = useState(false);
  const list = parseTaskList(text);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await createMany.mutateAsync({ day, list });
      onDone();
    } catch {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-list">List</Label>
        <Textarea
          id="task-list"
          autoFocus
          placeholder={'- [ ] A task\n    - [ ] A subtask under it'}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="max-h-32 min-h-24 overflow-y-auto font-mono md:text-xs"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-list-day">Day</Label>
        <Input id="task-list-day" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
      </div>
      {list.length > 0 && (
        <ul aria-label="Preview" className="max-h-48 overflow-y-auto rounded-md border p-2 text-sm">
          {list.map((task, index) => (
            <li key={index}>
              <PreviewRow title={task.title} />
              {task.subtasks.length > 0 && (
                <ul className="pl-6 text-muted-foreground">
                  {task.subtasks.map((subtask, subtaskIndex) => (
                    <li key={subtaskIndex}>
                      <PreviewRow title={subtask} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button type="submit" disabled={list.length === 0 || day === '' || saving}>
        {list.length > 0 ? `Create ${describeTaskList(list)}` : 'Create'}
      </Button>
    </form>
  );
}
