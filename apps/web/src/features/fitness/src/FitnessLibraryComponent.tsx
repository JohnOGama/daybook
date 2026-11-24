'use client';

import { Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { toast } from 'sonner';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { useExercises } from '../hooks/useExercises';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { useMyFoods } from '../hooks/useMyFoods';
import { formatKcal } from './fitness-format';
import type { FitnessViewProps, Food, MealPlan, WorkoutTemplate } from './fitness-types';
import { totalsOf } from './food-math';
import { MealPlanEditorComponent } from './MealPlanEditorComponent';
import { MUSCLE_LABELS } from './muscles';
import { WorkoutTemplateEditorComponent } from './WorkoutTemplateEditorComponent';

const SAMPLE_ROWS = ['First sample row', 'Second sample row'].map((name, index) => ({ id: `sample-${index}`, name, detail: 'Sample detail' }));

type Row = { id: string; name: string; detail: string };
type OwnListProps = { title: string; hint: string; label: string; rows: Row[] | undefined; isPending: boolean; isError: boolean; empty: string; canEdit: boolean; onDelete: (id: string) => void };

const Hint = ({ children }: { children: string }) => <p className="-mt-1 px-4 pb-2 text-xs text-muted-foreground">{children}</p>;

// A list of the owner's own foods or exercises, each with a delete button.
function OwnList({ title, hint, label, rows, isPending, isError, empty, canEdit, onDelete }: OwnListProps) {
  const shown = isPending ? SAMPLE_ROWS : (rows ?? []);
  return (
    <SectionCardComponent title={title}>
      <Hint>{hint}</Hint>
      {isError && (
        <p role="alert" className="px-4 pb-4 text-sm text-destructive">
          Could not load these. Please try again.
        </p>
      )}
      <Skeleton loading={isPending} label={label}>
        <ul className="px-2 pb-2">
          {shown.map((row) => (
            <li key={row.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{row.name}</span>
                <span className="truncate text-xs text-muted-foreground tabular-nums">{row.detail}</span>
              </span>
              {canEdit && (
                <Button variant="ghost" size="icon" aria-label={`Delete ${row.name}`} className="size-8 text-muted-foreground" onClick={() => onDelete(row.id)}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Skeleton>
      {!isPending && !isError && shown.length === 0 && <p className="px-4 pb-4 text-sm text-muted-foreground">{empty}</p>}
    </SectionCardComponent>
  );
}

function MyFoods({ canEdit }: { canEdit: boolean }) {
  const { data, isPending, isError } = useMyFoods();
  const { removeFood, createFood } = useFitnessMutations();

  function remove(food: Food) {
    removeFood.mutate(food.id);
    const { category: _category, custom: _custom, servings, ...numbers } = food;
    const restore = () => createFood.mutate({ ...numbers, servings: servings.map(({ id, label, amountMg }) => ({ id, label, amountMg })) });
    toast(`Deleted ${food.name}`, { action: { label: 'Undo', onClick: restore } });
  }

  return (
    <OwnList
      title="My foods"
      hint="Foods you added that the built-in list doesn't have. Numbers are per 100 g."
      label="Loading your foods"
      rows={data?.map((food) => ({ id: food.id, name: food.name, detail: `${formatKcal(food.kcal)} per 100 g` }))}
      isPending={isPending}
      isError={isError}
      empty="No foods of your own yet. Add one from “Add food” on Today when the food list does not have it."
      canEdit={canEdit}
      onDelete={(id) => remove(data?.find((food) => food.id === id) as Food)}
    />
  );
}

function MyExercises({ canEdit }: { canEdit: boolean }) {
  const { data, isPending, isError } = useExercises();
  const { deleteExerciseWithUndo } = useFitnessMutations();
  const mine = data?.filter((exercise) => exercise.custom);
  return (
    <OwnList
      title="My exercises"
      hint="Exercises you added that the built-in list doesn't have."
      label="Loading your exercises"
      rows={mine?.map((exercise) => ({ id: exercise.id, name: exercise.name, detail: exercise.primary.map((muscle) => MUSCLE_LABELS[muscle]).join(', ') || 'No muscles set' }))}
      isPending={isPending}
      isError={isError}
      empty="No exercises of your own yet. Add one from “Add exercise” in a workout when the list does not have it."
      canEdit={canEdit}
      onDelete={(id) => deleteExerciseWithUndo(mine?.find((exercise) => exercise.id === id) as NonNullable<typeof mine>[number])}
    />
  );
}

type SavedListProps<T extends { id: string; name: string }> = { title: string; hint: string; newLabel: string; items: T[]; detail: (item: T) => string; empty: string; canEdit: boolean; onNew: () => void; onOpen: (item: T) => void };

function SavedList<T extends { id: string; name: string }>({ title, hint, newLabel, items, detail, empty, canEdit, onNew, onOpen }: SavedListProps<T>): ReactNode {
  return (
    <SectionCardComponent
      title={title}
      action={
        canEdit && (
          <Button variant="ghost" size="sm" onClick={onNew}>
            <Plus aria-hidden />
            {newLabel}
          </Button>
        )
      }
    >
      <Hint>{hint}</Hint>
      {items.length > 0 ? (
        <ul className="px-2 pb-2">
          {items.map((item) => (
            <li key={item.id}>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{detail(item)}</span>
                </button>
              ) : (
                <div className="flex w-full items-center justify-between gap-3 px-2 py-2">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{detail(item)}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </SectionCardComponent>
  );
}

type Editing = { kind: 'plan'; plan: MealPlan; isNew: boolean } | { kind: 'template'; template: WorkoutTemplate; isNew: boolean };

const count = (amount: number, one: string, many: string) => `${amount} ${amount === 1 ? one : many}`;

export function FitnessLibraryComponent({ fitness, canEdit = true }: FitnessViewProps) {
  const { addMealPlan, saveMealPlan, deleteMealPlanWithUndo, addTemplate, saveTemplate, deleteTemplateWithUndo } = useFitnessMutations();
  const [editing, setEditing] = useState<Editing>();
  const close = () => setEditing(undefined);

  if (editing?.kind === 'plan') {
    return (
      <MealPlanEditorComponent
        key={editing.plan.id}
        plan={editing.plan}
        isNew={editing.isNew}
        onCancel={close}
        onSave={(plan) => {
          (editing.isNew ? addMealPlan : saveMealPlan).mutate(plan);
          close();
        }}
        onDelete={() => {
          deleteMealPlanWithUndo(editing.plan);
          close();
        }}
      />
    );
  }

  if (editing?.kind === 'template') {
    return (
      <WorkoutTemplateEditorComponent
        key={editing.template.id}
        template={editing.template}
        isNew={editing.isNew}
        onCancel={close}
        onSave={(template) => {
          (editing.isNew ? addTemplate : saveTemplate).mutate(template);
          close();
        }}
        onDelete={() => {
          deleteTemplateWithUndo(editing.template);
          close();
        }}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SavedList
        title="Workout templates"
        newLabel="New template"
        items={fitness.templates}
        detail={(template) => `${count(template.items.length, 'exercise', 'exercises')} · ${count(template.items.reduce((sets, item) => sets + item.sets.length, 0), 'set', 'sets')}`}
        hint="Workouts you repeat. Start one from Today or Workouts, then tick off the sets you actually do."
        empty="No templates yet."
        canEdit={canEdit}
        onNew={() => setEditing({ kind: 'template', template: { id: crypto.randomUUID(), name: '', items: [] }, isNew: true })}
        onOpen={(template) => setEditing({ kind: 'template', template, isNew: false })}
      />
      <SavedList
        title="Meal plans"
        newLabel="New meal plan"
        items={fitness.mealPlans}
        detail={(plan) => `${count(plan.items.length, 'food', 'foods')} · ${formatKcal(totalsOf(plan.items).kcal)}`}
        hint="Days of eating you repeat. Apply one on Today, then tick off what you actually eat."
        empty="No meal plans yet."
        canEdit={canEdit}
        onNew={() => setEditing({ kind: 'plan', plan: { id: crypto.randomUUID(), name: '', items: [] }, isNew: true })}
        onOpen={(plan) => setEditing({ kind: 'plan', plan, isNew: false })}
      />
      <MyExercises canEdit={canEdit} />
      <MyFoods canEdit={canEdit} />
    </div>
  );
}
