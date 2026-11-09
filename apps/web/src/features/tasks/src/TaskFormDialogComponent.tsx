'use client';

import { type ClipboardEvent, type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { isTaskList } from './parse-task-list';
import { PasteTasksFormComponent } from './PasteTasksFormComponent';
import { StatusIconComponent } from './StatusIconComponent';
import { STATUS_LABELS, STATUSES, type Task, type TaskStatus } from './task-types';

export type TaskFormMode = 'new' | 'edit' | 'move' | 'subtask';

type TaskFormDialogProps = {
  mode: TaskFormMode;
  task?: Task;
  defaultDay: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DIALOG_TITLES: Record<TaskFormMode, string> = {
  new: 'New task',
  edit: 'Edit task',
  move: 'Move to another day',
  subtask: 'Add subtask',
};

type TaskFormProps = Omit<TaskFormDialogProps, 'open'> & { onPasteList: (text: string) => void };

function TaskForm({ mode, task, defaultDay, onOpenChange, onPasteList }: TaskFormProps) {
  const mutations = useTaskMutations();
  const isEdit = mode === 'edit';
  const [title, setTitle] = useState(isEdit && task ? task.title : '');
  const [day, setDay] = useState(defaultDay);
  const [status, setStatus] = useState<TaskStatus>(isEdit && task ? task.status : 'todo');
  const [highPriority, setHighPriority] = useState(isEdit && task ? task.highPriority : false);
  const [saving, setSaving] = useState(false);

  const hasDetails = mode !== 'move';
  const hasDay = mode === 'new' || mode === 'move';
  const canSave = (!hasDetails || title.trim().length > 0) && (!hasDay || day !== '');

  function save() {
    const fields = { title, status, highPriority };
    if (mode === 'new') return mutations.create.mutateAsync({ ...fields, day });
    if (mode === 'subtask') {
      return mutations.createSubtask.mutateAsync({ parentId: task!.id, input: fields });
    }
    return mutations.update.mutateAsync({
      id: task!.id,
      input: mode === 'move' ? { day } : fields,
    });
  }

  function handleTitlePaste(event: ClipboardEvent) {
    const text = event.clipboardData.getData('text/plain');
    if (mode !== 'new' || !isTaskList(text)) return;
    event.preventDefault();
    onPasteList(text);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await save();
      onOpenChange(false);
    } catch {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {hasDetails && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onPaste={handleTitlePaste}
          />
          {mode === 'new' && (
            <Button
              type="button"
              variant="link"
              className="h-auto self-start p-0 text-xs text-muted-foreground"
              onClick={() => onPasteList('')}
            >
              Paste a list instead
            </Button>
          )}
        </div>
      )}
      {hasDay && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-day">Day</Label>
          <Input
            id="task-day"
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </div>
      )}
      {hasDetails && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
              <SelectTrigger id="task-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    <StatusIconComponent status={item} />
                    {STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="task-high"
              checked={highPriority}
              onCheckedChange={(checked) => setHighPriority(checked === true)}
            />
            <Label htmlFor="task-high">High priority</Label>
          </div>
        </>
      )}
      <Button type="submit" disabled={!canSave || saving}>
        Save
      </Button>
    </form>
  );
}

export function TaskFormDialogComponent({ open, onOpenChange, ...formProps }: TaskFormDialogProps) {
  const [pastedText, setPastedText] = useState<string>();

  function handleOpenChange(next: boolean) {
    if (!next) setPastedText(undefined);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pastedText === undefined ? DIALOG_TITLES[formProps.mode] : 'Paste tasks'}</DialogTitle>
        </DialogHeader>
        {pastedText === undefined ? (
          <TaskForm {...formProps} onOpenChange={handleOpenChange} onPasteList={setPastedText} />
        ) : (
          <PasteTasksFormComponent
            defaultDay={formProps.defaultDay}
            initialText={pastedText}
            onDone={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
