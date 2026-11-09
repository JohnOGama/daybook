'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { countOf, describeTaskList, type PastedTask, parseTaskList, totalInList } from './parse-task-list';
import { StatusIconComponent } from './StatusIconComponent';
import type { Task } from './task-types';

type PasteTasksFormProps = { defaultDay: string; initialText: string; parent?: Task; onDone: () => void };

function PreviewRows({ items }: { items: PastedTask[] }) {
  return items.map((item, index) => (
    <li key={index}>
      <span className="flex items-start gap-2 py-0.5">
        <StatusIconComponent status="todo" />
        <span className="min-w-0 break-words">{item.title}</span>
      </span>
      {item.subtasks.length > 0 && (
        <ul className="pl-5 text-muted-foreground">
          <PreviewRows items={item.subtasks} />
        </ul>
      )}
    </li>
  ));
}

export function PasteTasksFormComponent({ defaultDay, initialText, parent, onDone }: PasteTasksFormProps) {
  const { createMany, createManySubtasks } = useTaskMutations();
  const [text, setText] = useState(initialText);
  const [day, setDay] = useState(defaultDay);
  const [saving, setSaving] = useState(false);
  const list = parseTaskList(text);
  const summary = parent ? countOf(totalInList(list), 'subtask') : describeTaskList(list);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (parent) await createManySubtasks.mutateAsync({ parentId: parent.id, list });
      else await createMany.mutateAsync({ day, list });
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
          placeholder={parent ? '- [ ] A subtask\n    - [ ] One under it' : '- [ ] A task\n    - [ ] A subtask under it'}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="max-h-32 min-h-24 overflow-y-auto font-mono md:text-xs"
        />
      </div>
      {!parent && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-list-day">Day</Label>
          <Input id="task-list-day" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
        </div>
      )}
      {list.length > 0 && (
        <ul aria-label="Preview" className="max-h-48 overflow-y-auto rounded-md border p-2 text-sm">
          <PreviewRows items={list} />
        </ul>
      )}
      <Button type="submit" disabled={list.length === 0 || (!parent && day === '') || saving}>
        {list.length > 0 ? `Create ${summary}` : 'Create'}
      </Button>
    </form>
  );
}
