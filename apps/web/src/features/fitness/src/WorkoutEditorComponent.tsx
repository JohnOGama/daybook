'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import type { EditedFrom } from '@/shared/utils/conflict-error';
import { Input } from '@/shared/components/ui/input';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { BodyDiagramComponent, strengthFromMuscles } from './BodyDiagramComponent';
import type { Workout } from './fitness-types';
import { musclesOf, setsDone, templateFromWorkout } from './workout-math';
import { WorkoutItemsEditorComponent } from './WorkoutItemsEditorComponent';

const SAVE_DELAY_MS = 600;

type WorkoutEditorProps = { workout: Workout; history: Workout[] };

// One day's workout. Typing saves after a short pause, ticks save at once, and leaving saves whatever is pending.
export function WorkoutEditorComponent({ workout, history }: WorkoutEditorProps) {
  const { saveWorkout, deleteWorkoutWithUndo, addTemplate } = useFitnessMutations();
  const [draft, setDraft] = useState(workout);
  const from = useRef<EditedFrom>({ version: workout.version ?? 0, conflicted: false }).current;
  const pending = useRef<Workout | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const save = useRef(saveWorkout.mutate);
  save.current = saveWorkout.mutate;

  const flush = useRef(() => {
    clearTimeout(timer.current);
    if (pending.current && !from.conflicted) save.current({ workout: pending.current, from });
    pending.current = null;
  }).current;

  useEffect(() => flush, [flush]);

  // After a refused save nothing more is sent. Once a reload brings the saved workout in, the editor starts over from it.
  useEffect(() => {
    if (!from.conflicted || (workout.version ?? 0) === from.version) return;
    from.version = workout.version ?? 0;
    from.conflicted = false;
    pending.current = null;
    setDraft(workout);
  }, [workout, from]);

  function change(next: Workout, now: boolean) {
    if (from.conflicted) return;
    setDraft(next);
    pending.current = next;
    clearTimeout(timer.current);
    if (now) flush();
    else timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  const { done, total } = setsDone(draft);

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Workout name"
          maxLength={80}
          className="h-9 max-w-64 font-medium"
          value={draft.name}
          onChange={(event) => event.target.value.trim() && change({ ...draft, name: event.target.value }, false)}
        />
        <span className="text-sm text-muted-foreground tabular-nums">
          {done} of {total} sets done
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground"
          disabled={draft.items.length === 0}
          onClick={() => {
            addTemplate.mutate(templateFromWorkout(draft.name, draft, crypto.randomUUID()));
            toast.success('Saved as a workout template. Find it in Library.');
          }}
        >
          Save as template
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => {
            pending.current = null;
            clearTimeout(timer.current);
            deleteWorkoutWithUndo(draft);
          }}
        >
          Delete
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <WorkoutItemsEditorComponent items={draft.items} onChange={(items, now) => change({ ...draft, items }, now)} workout={{ day: draft.day, history }} />
        <BodyDiagramComponent label={`Muscles worked by ${draft.name}`} strength={strengthFromMuscles(musclesOf(draft.items))} />
      </div>
    </div>
  );
}
