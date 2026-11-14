'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { BodyDiagramComponent, strengthFromMuscles } from './BodyDiagramComponent';
import type { WorkoutTemplate } from './fitness-types';
import { musclesOf } from './workout-math';
import { WorkoutItemsEditorComponent } from './WorkoutItemsEditorComponent';

type WorkoutTemplateEditorProps = { template: WorkoutTemplate; isNew: boolean; onSave: (template: WorkoutTemplate) => void; onCancel: () => void; onDelete: () => void };

export function WorkoutTemplateEditorComponent({ template, isNew, onSave, onCancel, onDelete }: WorkoutTemplateEditorProps) {
  const [name, setName] = useState(template.name);
  const [items, setItems] = useState(template.items);
  const valid = name.trim() !== '' && items.length > 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (valid) onSave({ id: template.id, name: name.trim(), items });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Workout template name</span>
        <Input autoFocus={isNew} maxLength={80} placeholder="For example: Push day" className="max-w-sm" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <p className="text-sm text-muted-foreground">Set the sets you plan to do. When you start a workout from this template you tick each one off, changing the numbers if they differ.</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <WorkoutItemsEditorComponent items={items} onChange={(next) => setItems(next)} />
        <BodyDiagramComponent label={`Muscles worked by ${name.trim() || 'this template'}`} strength={strengthFromMuscles(musclesOf(items))} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!valid}>
          Save template
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {!isNew && (
          <Button type="button" variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
            Delete template
          </Button>
        )}
      </div>
    </form>
  );
}
