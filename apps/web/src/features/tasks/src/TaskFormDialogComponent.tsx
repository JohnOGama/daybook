'use client';

import { type FormEvent, useState } from 'react';
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

function TaskForm({ mode, task, defaultDay, onOpenChange }: Omit<TaskFormDialogProps, 'open'>) {
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
          />
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{DIALOG_TITLES[formProps.mode]}</DialogTitle>
        </DialogHeader>
        <TaskForm {...formProps} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}
