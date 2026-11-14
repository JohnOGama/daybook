'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { DrawerCloseButtonComponent } from '@/shared/components/DrawerCloseButtonComponent';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/shared/components/ui/drawer';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { useFoodSearch } from '../hooks/useFoodSearch';
import { formatGrams, formatKcal, parseAmount } from './fitness-format';
import { type Food, type FoodItem, type FoodLog, type Meal, MEAL_LABELS, MEALS } from './fitness-types';
import { formatQuantity, itemFor, scaleItem, type ServingChoice, servingsFor } from './food-math';

// `pick` hands the chosen food and amount back to the caller (a meal plan); the others write to a day's log.
export type FoodSheetState =
  | { mode: 'add'; day: string; meal: Meal }
  | { mode: 'edit'; log: FoodLog }
  | { mode: 'pick'; meal: Meal; onPick: (item: FoodItem, meal: Meal) => void }
  | null;

const SAMPLE_FOODS: Food[] = ['Rice, white, cooked', 'Chicken breast, grilled', 'Egg, whole, boiled', 'Banana, raw'].map((name, index) => ({
  id: `sample-${index}`,
  name,
  category: null,
  custom: false,
  kcal: 130,
  proteinMg: 2700,
  carbsMg: 28_000,
  fatMg: 300,
  fiberMg: 400,
  servings: [],
}));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function MealSelect({ value, onChange }: { value: Meal; onChange: (meal: Meal) => void }) {
  return (
    <Select value={value} onValueChange={(meal) => onChange(meal as Meal)}>
      <SelectTrigger aria-label="Meal" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MEALS.map((meal) => (
          <SelectItem key={meal} value={meal}>
            {MEAL_LABELS[meal]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Numbers({ item }: { item: Pick<FoodItem, 'kcal' | 'proteinMg' | 'carbsMg' | 'fatMg'> | null }) {
  return (
    <p aria-label="Calories and macros for this amount" className="rounded-lg border bg-card px-3 py-2 text-sm tabular-nums">
      {item ? `${formatKcal(item.kcal)} · protein ${formatGrams(item.proteinMg)} · carbs ${formatGrams(item.carbsMg)} · fat ${formatGrams(item.fatMg)}` : 'Type an amount above zero.'}
    </p>
  );
}

type SearchProps = { onChoose: (food: Food) => void; onCreate: (name: string) => void };

function Search({ onChoose, onCreate }: SearchProps) {
  const [text, setText] = useState('');
  const { data, isPending, isError } = useFoodSearch(text);
  const foods = isPending ? SAMPLE_FOODS : (data ?? []);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <Input autoFocus aria-label="Search foods" placeholder="Search foods, for example cooked rice" value={text} onChange={(event) => setText(event.target.value)} />
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Could not search foods. Please try again.
        </p>
      )}
      {!text.trim() && foods.length > 0 && <p className="text-xs font-medium text-muted-foreground">Recently logged</p>}
      <Skeleton loading={isPending} label="Loading foods">
        <ul aria-label="Foods" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {foods.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => onChoose(food)}
                className="flex w-full flex-col rounded-lg px-2 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-sm font-medium">{food.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatKcal(food.kcal)} per 100 g{food.custom ? ' · yours' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Skeleton>
      {!isPending && !isError && foods.length === 0 && (
        <p className="text-sm text-muted-foreground">{text.trim() ? 'No foods match that.' : 'Search the food list, or add a food of your own.'}</p>
      )}
      <Button type="button" variant="outline" onClick={() => onCreate(text.trim())}>
        <Plus aria-hidden />
        {text.trim() ? `Add “${text.trim()}” as my own food` : 'Add my own food'}
      </Button>
    </div>
  );
}

type AmountProps = { food: Food; meal: Meal; canPlan: boolean; onBack: () => void; onAdd: (item: FoodItem, meal: Meal, eaten: boolean) => void };

function Amount({ food, meal: startingMeal, canPlan, onBack, onAdd }: AmountProps) {
  const { addServing } = useFitnessMutations();
  const [added, setAdded] = useState<ServingChoice[]>([]);
  const servings = [...servingsFor(food), ...added];
  const [servingLabel, setServingLabel] = useState('g');
  const [amount, setAmount] = useState('100');
  const [meal, setMeal] = useState(startingMeal);
  const [eaten, setEaten] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newGrams, setNewGrams] = useState('');
  const serving = servings.find(({ label }) => label === servingLabel) ?? servings[0];
  const quantity = parseAmount(amount);
  const item = quantity === null ? null : itemFor(food, quantity, serving);
  const servingGrams = parseAmount(newGrams);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (item) onAdd(item, meal, eaten);
  }

  function saveServing() {
    const label = newLabel.trim();
    if (!label || servingGrams === null || servings.some((existing) => existing.label === label)) return;
    const amountMg = Math.round(servingGrams * 1000);
    addServing.mutate({ id: crypto.randomUUID(), foodId: food.id, label, amountMg });
    setAdded((current) => [...current, { label, amountMg }]);
    setServingLabel(label);
    setAmount('1');
    setNewLabel('');
    setNewGrams('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={onBack}>
        <ArrowLeft aria-hidden />
        Back to search
      </Button>
      <div>
        <p className="text-sm font-semibold">{food.name}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          Per 100 g: {formatKcal(food.kcal)} · protein {formatGrams(food.proteinMg)} · carbs {formatGrams(food.carbsMg)} · fat {formatGrams(food.fatMg)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <Input autoFocus inputMode="decimal" autoComplete="off" className="tabular-nums" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Serving">
          <Select
            value={serving.label}
            onValueChange={(label) => {
              setServingLabel(label);
              setAmount(label === 'g' ? '100' : '1');
            }}
          >
            <SelectTrigger aria-label="Serving" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {servings.map(({ label, amountMg }) => (
                <SelectItem key={label} value={label}>
                  {label}
                  {/^\d/.test(label) || !['g', 'kg', 'oz', 'lb'].includes(label) ? ` (${formatGrams(amountMg)})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Numbers item={item} />
      <Field label="Meal">
        <MealSelect value={meal} onChange={setMeal} />
      </Field>
      {canPlan && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={eaten} onCheckedChange={(checked) => setEaten(checked === true)} />
          I have eaten this (untick to add it as planned)
        </label>
      )}
      <details className="rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Add a serving size for this food</summary>
        <p className="mt-2 text-xs text-muted-foreground">For example “1 tbsp” or “my bowl”, and what it weighs. It is saved for next time.</p>
        <div className="mt-2 grid grid-cols-[1fr_6rem_auto] items-end gap-2">
          <Input aria-label="Serving name" placeholder="1 tbsp" maxLength={40} value={newLabel} onChange={(event) => setNewLabel(event.target.value)} />
          <Input aria-label="Serving weight in grams" placeholder="grams" inputMode="decimal" value={newGrams} onChange={(event) => setNewGrams(event.target.value)} />
          <Button type="button" variant="outline" disabled={!newLabel.trim() || servingGrams === null} onClick={saveServing}>
            Save
          </Button>
        </div>
      </details>
      <Button type="submit" disabled={!item} className="mt-auto">
        {canPlan ? 'Add to day' : 'Add to plan'}
      </Button>
    </form>
  );
}

function NewFood({ name: startingName, onBack, onCreated }: { name: string; onBack: () => void; onCreated: (food: Food) => void }) {
  const { createFood } = useFitnessMutations();
  const [name, setName] = useState(startingName);
  const [numbers, setNumbers] = useState({ kcal: '', protein: '', carbs: '', fat: '', fibre: '' });
  const [servingLabel, setServingLabel] = useState('');
  const [servingGrams, setServingGrams] = useState('');
  const set = (key: keyof typeof numbers) => (event: { target: { value: string } }) => setNumbers((current) => ({ ...current, [key]: event.target.value }));
  // Zero is a fair answer for a macro, so an empty or zero box reads as 0 here.
  const read = (text: string) => (text.trim() === '' || Number(text.replace(',', '.')) === 0 ? 0 : parseAmount(text));
  const kcal = read(numbers.kcal);
  const macros = [read(numbers.protein), read(numbers.carbs), read(numbers.fat), read(numbers.fibre)];
  const grams = parseAmount(servingGrams);
  const servingOk = servingLabel.trim() === '' || grams !== null;
  const valid = name.trim() !== '' && kcal !== null && kcal <= 900 && macros.every((value) => value !== null && value <= 100) && servingOk;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    const [proteinMg, carbsMg, fatMg, fiberMg] = macros.map((value) => Math.round((value as number) * 1000));
    const servings = servingLabel.trim() && grams !== null ? [{ id: crypto.randomUUID(), label: servingLabel.trim(), amountMg: Math.round(grams * 1000) }] : [];
    const food = { id: crypto.randomUUID(), name: name.trim(), kcal: Math.round(kcal as number), proteinMg, carbsMg, fatMg, fiberMg };
    await createFood.mutateAsync({ ...food, servings });
    onCreated({ ...food, category: null, custom: true, servings: servings.map((serving) => ({ ...serving, custom: true })) });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={onBack}>
        <ArrowLeft aria-hidden />
        Back to search
      </Button>
      <Field label="Name">
        <Input autoFocus maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <p className="text-xs text-muted-foreground">Numbers per 100 g, as on a food label.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories (kcal)">
          <Input inputMode="decimal" value={numbers.kcal} onChange={set('kcal')} />
        </Field>
        <Field label="Protein (g)">
          <Input inputMode="decimal" value={numbers.protein} onChange={set('protein')} />
        </Field>
        <Field label="Carbs (g)">
          <Input inputMode="decimal" value={numbers.carbs} onChange={set('carbs')} />
        </Field>
        <Field label="Fat (g)">
          <Input inputMode="decimal" value={numbers.fat} onChange={set('fat')} />
        </Field>
        <Field label="Fibre (g), optional">
          <Input inputMode="decimal" value={numbers.fibre} onChange={set('fibre')} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Optional: a serving of your own, such as “1 piece” and what it weighs.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Serving name">
          <Input maxLength={40} placeholder="1 piece" value={servingLabel} onChange={(event) => setServingLabel(event.target.value)} />
        </Field>
        <Field label="Weight (g)">
          <Input inputMode="decimal" value={servingGrams} onChange={(event) => setServingGrams(event.target.value)} />
        </Field>
      </div>
      <Button type="submit" disabled={!valid || createFood.isPending} className="mt-auto">
        Save food
      </Button>
    </form>
  );
}

function EditLog({ log, onDone }: { log: FoodLog; onDone: () => void }) {
  const { updateLog, deleteLogWithUndo } = useFitnessMutations();
  const [amount, setAmount] = useState(String(log.quantityMilli / 1000));
  const [meal, setMeal] = useState(log.meal);
  const quantity = parseAmount(amount);
  const scaled = quantity === null ? null : scaleItem(log, quantity);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!scaled) return;
    const { id: _id, day: _day, ...changes } = { ...scaled, meal };
    updateLog.mutate({ id: log.id, changes });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <p className="text-sm font-semibold">{log.name}</p>
      <Field label={`Amount (${/^\d/.test(log.servingLabel) ? `× ${log.servingLabel}` : log.servingLabel})`}>
        <Input autoFocus inputMode="decimal" autoComplete="off" className="tabular-nums" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Numbers item={scaled} />
      <Field label="Meal">
        <MealSelect value={meal} onChange={setMeal} />
      </Field>
      <div className="mt-auto flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="text-destructive"
          onClick={() => {
            deleteLogWithUndo(log);
            onDone();
          }}
        >
          Remove
        </Button>
        <Button type="submit" disabled={!scaled} className="flex-1">
          Save
        </Button>
      </div>
    </form>
  );
}

function AddFlow({ state, onClose }: { state: Exclude<FoodSheetState, null | { mode: 'edit' }>; onClose: () => void }) {
  const { addLogs } = useFitnessMutations();
  const [step, setStep] = useState<{ at: 'search' } | { at: 'amount'; food: Food } | { at: 'new'; name: string }>({ at: 'search' });

  function add(item: FoodItem, meal: Meal, eaten: boolean) {
    if (state.mode === 'pick') state.onPick(item, meal);
    else addLogs.mutate([{ ...item, id: crypto.randomUUID(), day: state.day, meal, eaten }]);
    onClose();
  }

  if (step.at === 'amount') {
    return <Amount food={step.food} meal={state.meal} canPlan={state.mode === 'add'} onBack={() => setStep({ at: 'search' })} onAdd={add} />;
  }
  if (step.at === 'new') {
    return <NewFood name={step.name} onBack={() => setStep({ at: 'search' })} onCreated={(food) => setStep({ at: 'amount', food })} />;
  }
  return <Search onChoose={(food) => setStep({ at: 'amount', food })} onCreate={(name) => setStep({ at: 'new', name })} />;
}

export function FoodSearchSheetComponent({ state, onClose }: { state: FoodSheetState; onClose: () => void }) {
  return (
    <Drawer direction="right" open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="gap-0 data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-md">
        <DrawerCloseButtonComponent />
        <DrawerHeader className="border-b pr-12">
          <DrawerTitle>{state?.mode === 'edit' ? 'Edit food' : 'Add food'}</DrawerTitle>
          <DrawerDescription>
            {state?.mode === 'edit' ? `${formatQuantity(state.log)} logged. Change the amount or the meal, or remove it.` : 'Search the food list, then say how much.'}
          </DrawerDescription>
        </DrawerHeader>
        {state?.mode === 'edit' && <EditLog key={state.log.id} log={state.log} onDone={onClose} />}
        {state && state.mode !== 'edit' && <AddFlow state={state} onClose={onClose} />}
      </DrawerContent>
    </Drawer>
  );
}
