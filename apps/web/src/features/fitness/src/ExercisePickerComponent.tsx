'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { DrawerCloseButtonComponent } from '@/shared/components/DrawerCloseButtonComponent';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/shared/components/ui/drawer';
import { cn } from '@/shared/utils/cn';
import { useExercises } from '../hooks/useExercises';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { BodyDiagramComponent, strengthFromMuscles } from './BodyDiagramComponent';
import type { Exercise, ExerciseKind } from './fitness-types';
import { type Muscle, MUSCLE_LABELS, MUSCLES } from './muscles';

const SHOWN = 60;
const ANY_MUSCLE = 'any';
const KIND_LABELS: Record<ExerciseKind, string> = { weight: 'Weight and reps', reps: 'Reps only (bodyweight)', time: 'Time and distance' };

const SAMPLE_EXERCISES: Exercise[] = ['Barbell Squat', 'Bench Press', 'Deadlift', 'Pull-up', 'Overhead Press'].map((name, index) => ({
  id: `sample-${index}`,
  name,
  kind: 'weight',
  equipment: 'barbell',
  primary: ['chest'],
  secondary: [],
  custom: false,
}));

function MuscleToggles({ label, chosen, onChange }: { label: string; chosen: Muscle[]; onChange: (muscles: Muscle[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {MUSCLES.map((muscle) => {
          const on = chosen.includes(muscle);
          return (
            <button
              key={muscle}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? chosen.filter((other) => other !== muscle) : [...chosen, muscle])}
              className={cn(
                'rounded-md border px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                on && 'border-foreground bg-accent font-medium',
              )}
            >
              {MUSCLE_LABELS[muscle]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function NewExercise({ name: startingName, onBack, onCreated }: { name: string; onBack: () => void; onCreated: (exercise: Exercise) => void }) {
  const { addExercise } = useFitnessMutations();
  const [name, setName] = useState(startingName);
  const [kind, setKind] = useState<ExerciseKind>('weight');
  const [primary, setPrimary] = useState<Muscle[]>([]);
  const [secondary, setSecondary] = useState<Muscle[]>([]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const exercise: Exercise = { id: crypto.randomUUID(), name: name.trim(), kind, equipment: null, primary, secondary: secondary.filter((muscle) => !primary.includes(muscle)), custom: true };
    addExercise.mutate(exercise);
    onCreated(exercise);
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={onBack}>
        <ArrowLeft aria-hidden />
        Back to the list
      </Button>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Name</span>
        <Input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Logged as</span>
        <Select value={kind} onValueChange={(value) => setKind(value as ExerciseKind)}>
          <SelectTrigger aria-label="Logged as" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_LABELS) as ExerciseKind[]).map((key) => (
              <SelectItem key={key} value={key}>
                {KIND_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <MuscleToggles label="Main muscles" chosen={primary} onChange={setPrimary} />
      <MuscleToggles label="Also works" chosen={secondary} onChange={setSecondary} />
      <Button type="submit" disabled={!name.trim()} className="mt-auto">
        Save and add exercise
      </Button>
    </form>
  );
}

type ExercisePickerProps = { open: boolean; onClose: () => void; onPick: (exercise: Exercise) => void };

export function ExercisePickerComponent({ open, onClose, onPick }: ExercisePickerProps) {
  const { data, isPending, isError } = useExercises();
  const [text, setText] = useState('');
  const [muscle, setMuscle] = useState<Muscle | typeof ANY_MUSCLE>(ANY_MUSCLE);
  const [chosenId, setChosenId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (isPending ? SAMPLE_EXERCISES : (data ?? [])).filter(
    (exercise) =>
      words.every((word) => exercise.name.toLowerCase().includes(word)) &&
      (muscle === ANY_MUSCLE || exercise.primary.includes(muscle) || exercise.secondary.includes(muscle)),
  );
  const chosen = matches.find(({ id }) => id === chosenId);

  function pick(exercise: Exercise) {
    onPick(exercise);
    setText('');
    setChosenId(undefined);
    setCreating(false);
    onClose();
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent className="gap-0 data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-md">
        <DrawerCloseButtonComponent />
        <DrawerHeader className="border-b pr-12">
          <DrawerTitle>Add exercise</DrawerTitle>
          <DrawerDescription>Pick one to see the muscles it works, then add it.</DrawerDescription>
        </DrawerHeader>
        {creating ? (
          <NewExercise name={text.trim()} onBack={() => setCreating(false)} onCreated={pick} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <div className="grid grid-cols-[1fr_9rem] gap-2">
              <Input autoFocus aria-label="Search exercises" placeholder="Search exercises" value={text} onChange={(event) => setText(event.target.value)} />
              <Select value={muscle} onValueChange={(value) => setMuscle(value as Muscle | typeof ANY_MUSCLE)}>
                <SelectTrigger aria-label="Muscle" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_MUSCLE}>Any muscle</SelectItem>
                  {MUSCLES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {MUSCLE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isError && (
              <p role="alert" className="text-sm text-destructive">
                Could not load the exercise list. Please try again.
              </p>
            )}
            <Skeleton loading={isPending} label="Loading exercises">
              <ul aria-label="Exercises" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {matches.slice(0, SHOWN).map((exercise) => (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      aria-pressed={exercise.id === chosenId}
                      onClick={() => setChosenId(exercise.id)}
                      onDoubleClick={() => pick(exercise)}
                      className={cn(
                        'flex w-full flex-col rounded-lg px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                        exercise.id === chosenId && 'bg-accent',
                      )}
                    >
                      <span className="text-sm font-medium">{exercise.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[exercise.primary.map((key) => MUSCLE_LABELS[key]).join(', '), exercise.equipment, exercise.custom ? 'yours' : null].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Skeleton>
            {!isPending && !isError && (
              <p className="text-xs text-muted-foreground">
                {matches.length === 0
                  ? data?.length === 0
                    ? 'The exercise list has not been loaded on this server yet. You can still add your own.'
                    : 'No exercises match that.'
                  : matches.length > SHOWN
                    ? `Showing ${SHOWN} of ${matches.length}. Type to narrow it down.`
                    : `${matches.length} ${matches.length === 1 ? 'exercise' : 'exercises'}`}
              </p>
            )}
            {chosen && (
              <div className="flex flex-col gap-3 border-t pt-3">
                <BodyDiagramComponent label={`Muscles worked by ${chosen.name}`} strength={strengthFromMuscles(chosen)} className="[&_svg]:max-w-36" />
                <Button onClick={() => pick(chosen)}>Add {chosen.name}</Button>
              </div>
            )}
            <Button type="button" variant="outline" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {text.trim() ? `Add “${text.trim()}” as my own exercise` : 'Add my own exercise'}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
