'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { ExercisePickerComponent } from './ExercisePickerComponent';
import type { Exercise, ExerciseKind, Workout, WorkoutItem, WorkoutSet } from './fitness-types';
import { formatSets, lastTime, nextTry } from './workout-math';

const MAX_SETS = 30;
const MAX_ITEMS = 60;

type Field = { key: keyof Omit<WorkoutSet, 'done'>; label: string; scale: number };

// What each kind of exercise records, shown in the unit people type: stored value / scale.
const FIELDS: Record<ExerciseKind, Field[]> = {
  weight: [
    { key: 'weightG', label: 'kg', scale: 1000 },
    { key: 'reps', label: 'reps', scale: 1 },
  ],
  reps: [{ key: 'reps', label: 'reps', scale: 1 }],
  time: [
    { key: 'seconds', label: 'min', scale: 60 },
    { key: 'meters', label: 'km', scale: 1000 },
  ],
};

const EMPTY_SET: WorkoutSet = { reps: null, weightG: null, seconds: null, meters: null, done: false };

// Empty is "not filled in"; zero is allowed (a bodyweight set weighs 0 kg).
function parseCount(text: string, scale: number): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 ? Math.round(value * scale) : null;
}

type SetRowProps = { exercise: string; number: number; set: WorkoutSet; kind: ExerciseKind; tickable: boolean; onChange: (set: WorkoutSet, now: boolean) => void; onRemove: () => void };

function SetRow({ exercise, number, set, kind, tickable, onChange, onRemove }: SetRowProps) {
  return (
    <li className="flex items-center gap-2">
      <span className="w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{number}</span>
      {FIELDS[kind].map(({ key, label, scale }) => (
        <label key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Input
            aria-label={`${exercise}, set ${number}, ${label}`}
            inputMode="decimal"
            autoComplete="off"
            className="h-8 w-16 text-sm text-foreground tabular-nums"
            defaultValue={set[key] === null ? '' : String(Number(((set[key] as number) / scale).toFixed(2)))}
            onChange={(event) => onChange({ ...set, [key]: parseCount(event.target.value, scale) }, false)}
          />
          {label}
        </label>
      ))}
      {tickable && (
        <Checkbox className="ml-1" checked={set.done} onCheckedChange={(checked) => onChange({ ...set, done: checked === true }, true)} aria-label={`${exercise}, set ${number} done`} />
      )}
      <Button type="button" variant="ghost" size="icon" aria-label={`Remove set ${number} of ${exercise}`} className="ml-auto size-7 text-muted-foreground" onClick={onRemove}>
        <X aria-hidden />
      </Button>
    </li>
  );
}

type WorkoutItemsEditorProps = {
  items: WorkoutItem[];
  // `now` asks for the change to be saved straight away (a tick), not after a pause in typing.
  onChange: (items: WorkoutItem[], now: boolean) => void;
  // A workout has sets to tick and a "last time" line; a template has neither.
  workout?: { day: string; history: Workout[] };
};

export function WorkoutItemsEditorComponent({ items, onChange, workout }: WorkoutItemsEditorProps) {
  const [picking, setPicking] = useState(false);
  const replaceItem = (index: number, item: WorkoutItem, now = false) => onChange(items.map((other, at) => (at === index ? item : other)), now);

  function addExercise({ id, name, kind, primary, secondary }: Exercise) {
    onChange([...items, { exerciseId: id, name, kind, primary, secondary, sets: [EMPTY_SET] }], true);
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        const previous = workout ? lastTime(item, workout.day, workout.history) : null;
        const hint = previous && nextTry(previous.sets, item.kind);
        return (
          <section key={index} aria-label={item.name} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold">{item.name}</h4>
                {workout && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {previous ? `Last time (${formatShortDay(previous.day)}): ${formatSets(previous.sets, item.kind)}` : 'First time logging this'}
                  </p>
                )}
                {hint && <p className="text-xs font-medium tabular-nums">{hint}</p>}
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => onChange(items.filter((_, at) => at !== index), true)}>
                Remove
              </Button>
            </div>
            <ol className="mt-2 flex flex-col gap-1.5">
              {item.sets.map((set, setIndex) => (
                <SetRow
                  // Sets have no id; remounting on a change in count keeps each box showing its own set.
                  key={`${setIndex}-${item.sets.length}`}
                  exercise={item.name}
                  number={setIndex + 1}
                  set={set}
                  kind={item.kind}
                  tickable={Boolean(workout)}
                  onChange={(next, now) => replaceItem(index, { ...item, sets: item.sets.map((other, at) => (at === setIndex ? next : other)) }, now)}
                  onRemove={() => replaceItem(index, { ...item, sets: item.sets.filter((_, at) => at !== setIndex) }, true)}
                />
              ))}
            </ol>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1.5 text-muted-foreground"
              disabled={item.sets.length >= MAX_SETS}
              onClick={() => replaceItem(index, { ...item, sets: [...item.sets, { ...(item.sets.at(-1) ?? EMPTY_SET), done: false }] }, true)}
            >
              <Plus aria-hidden />
              Add set
            </Button>
          </section>
        );
      })}
      <Button type="button" variant="outline" className="self-start" disabled={items.length >= MAX_ITEMS} onClick={() => setPicking(true)}>
        <Plus aria-hidden />
        Add exercise
      </Button>
      <ExercisePickerComponent open={picking} onClose={() => setPicking(false)} onPick={addExercise} />
    </div>
  );
}
