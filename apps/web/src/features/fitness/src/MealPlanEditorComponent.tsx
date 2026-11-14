'use client';

import { Plus, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { formatGrams, formatKcal } from './fitness-format';
import { type MealPlan, MEAL_LABELS, MEALS } from './fitness-types';
import { formatQuantity, totalsOf } from './food-math';
import { type FoodSheetState, FoodSearchSheetComponent } from './FoodSearchSheetComponent';

type MealPlanEditorProps = { plan: MealPlan; isNew: boolean; onSave: (plan: MealPlan) => void; onCancel: () => void; onDelete: () => void };

export function MealPlanEditorComponent({ plan, isNew, onSave, onCancel, onDelete }: MealPlanEditorProps) {
  const [name, setName] = useState(plan.name);
  const [items, setItems] = useState(plan.items);
  const [sheet, setSheet] = useState<FoodSheetState>(null);
  const totals = totalsOf(items);
  const valid = name.trim() !== '' && items.length > 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (valid) onSave({ id: plan.id, name: name.trim(), items });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Meal plan name</span>
        <Input autoFocus={isNew} maxLength={80} placeholder="For example: Cutting day" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <p className="text-sm tabular-nums">
        {formatKcal(totals.kcal)} · protein {formatGrams(totals.proteinMg)} · carbs {formatGrams(totals.carbsMg)} · fat {formatGrams(totals.fatMg)}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {MEALS.map((meal) => (
          <SectionCardComponent
            key={meal}
            title={MEAL_LABELS[meal]}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Add food to ${MEAL_LABELS[meal]}`}
                onClick={() => setSheet({ mode: 'pick', meal, onPick: (item, pickedMeal) => setItems((current) => [...current, { ...item, meal: pickedMeal }]) })}
              >
                <Plus aria-hidden />
                Add food
              </Button>
            }
          >
            <ul className="px-2 pb-2">
              {items.map((item, index) =>
                item.meal !== meal ? null : (
                  <li key={index} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatQuantity(item)} · {formatKcal(item.kcal)}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${item.name}`}
                      className="size-8 text-muted-foreground"
                      onClick={() => setItems((current) => current.filter((_, at) => at !== index))}
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                ),
              )}
            </ul>
          </SectionCardComponent>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!valid}>
          Save meal plan
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {!isNew && (
          <Button type="button" variant="ghost" className="ml-auto text-destructive" onClick={onDelete}>
            Delete plan
          </Button>
        )}
      </div>
      <FoodSearchSheetComponent state={sheet} onClose={() => setSheet(null)} />
    </form>
  );
}
