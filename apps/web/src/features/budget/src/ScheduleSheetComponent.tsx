'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/shared/utils/cn';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { currencyOf } from './budget-currency';
import { centsToInput, parseMoney } from './budget-money';
import type { Budget, BudgetSchedule, EntryKind, Frequency, ScheduleInput } from './budget-types';
import { brandForName } from './brand-icons';
import { BrandPickerComponent } from './BrandPickerComponent';
import { AmountInputComponent } from './BudgetPartsComponent';
import { AccountSelectComponent, CategorySelectComponent, KindSwitchComponent, NO_CATEGORY } from './FlowFieldsComponent';
import { occurrencesBetween, plusDays } from './schedule-math';

export type ScheduleSheetState = { mode: 'add'; draft?: Partial<ScheduleInput> } | { mode: 'edit'; schedule: BudgetSchedule } | null;

const FREQUENCIES: { id: Frequency; label: string; unit: string }[] = [
  { id: 'daily', label: 'Daily', unit: 'day' },
  { id: 'weekly', label: 'Weekly', unit: 'week' },
  { id: 'monthly', label: 'Monthly', unit: 'month' },
  { id: 'yearly', label: 'Yearly', unit: 'year' },
];
const MONTH_DAYS = [...Array.from({ length: 31 }, (_, index) => index + 1), -1];
const LAST_DAY = -1;
const PATTERN_FIELDS = ['frequency', 'interval', 'monthDays', 'startDay'] as const;

type ScheduleSheetProps = { budget: Budget; today: string; state: ScheduleSheetState; onClose: () => void };

export function ScheduleSheetComponent({ budget, today, state, onClose }: ScheduleSheetProps) {
  const editing = state?.mode === 'edit' ? state.schedule : undefined;
  return (
    <Sheet open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{editing ? 'Edit recurring' : 'New recurring'}</SheetTitle>
          <SheetDescription>Salary, rent, bills, subscriptions: anything that comes round again.</SheetDescription>
        </SheetHeader>
        {state && (
          <ScheduleForm
            key={editing?.id ?? 'new'}
            budget={budget}
            today={today}
            schedule={editing}
            draft={state.mode === 'add' ? state.draft : undefined}
            onDone={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type ScheduleFormProps = { budget: Budget; today: string; schedule?: BudgetSchedule; draft?: Partial<ScheduleInput>; onDone: () => void };

function ScheduleForm({ budget, today, schedule, draft, onDone }: ScheduleFormProps) {
  const { addSchedule, saveSchedule } = useBudgetMutations();
  const initial = schedule ?? draft ?? {};
  const firstAccount = budget.accounts[0]?.id ?? '';
  const [kind, setKind] = useState<EntryKind>(initial.kind ?? 'expense');
  const [name, setName] = useState(initial.name ?? '');
  const [amount, setAmount] = useState(initial.amount ? centsToInput(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? NO_CATEGORY);
  const [accountId, setAccountId] = useState(initial.accountId ?? firstAccount);
  const [toAccountId, setToAccountId] = useState(initial.toAccountId ?? budget.accounts.find(({ id }) => id !== accountId)?.id ?? '');
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency ?? 'monthly');
  const [intervalText, setIntervalText] = useState(String(initial.interval ?? 1));
  const [startDay, setStartDay] = useState(initial.startDay ?? today);
  const [monthDays, setMonthDays] = useState<number[]>(initial.monthDays?.length ? initial.monthDays : [Number(startDay.slice(8, 10))]);
  const [endDay, setEndDay] = useState(initial.endDay ?? '');
  const [isSubscription, setIsSubscription] = useState(initial.isSubscription ?? false);
  const [autoRecord, setAutoRecord] = useState(initial.autoRecord ?? false);
  // Naming it "Netflix" picks the Netflix logo, until an icon is chosen by hand.
  const [icon, setIcon] = useState(initial.icon ?? brandForName(initial.name ?? '')?.key ?? null);
  const [iconChosen, setIconChosen] = useState(Boolean(schedule));
  const [error, setError] = useState<string>();
  const isTransfer = kind === 'transfer';
  const every = Math.min(365, Math.max(1, Math.floor(Number(intervalText)) || 1));
  const unit = FREQUENCIES.find(({ id }) => id === frequency)?.unit ?? 'month';

  function switchKind(next: EntryKind) {
    setKind(next);
    if (!budget.categories.some((category) => category.id === categoryId && category.kind === next)) setCategoryId(NO_CATEGORY);
  }

  function toggleMonthDay(day: number) {
    setMonthDays((days) => (days.includes(day) ? days.filter((item) => item !== day) : [...days, day]));
  }

  const pattern = { frequency, interval: every, monthDays: frequency === 'monthly' ? monthDays : [], startDay };
  // A changed pattern takes effect from today, so past dates it would now land on don't turn up as overdue.
  const patternChanged = schedule !== undefined && PATTERN_FIELDS.some((field) => String(schedule[field]) !== String(pattern[field]));
  const activeFrom = !schedule ? startDay : patternChanged ? (today > startDay ? today : startDay) : schedule.activeFrom;

  const fields: ScheduleInput = {
    kind,
    name: name.trim(),
    amount: parseMoney(amount) ?? 0,
    accountId,
    toAccountId: isTransfer ? toAccountId : null,
    categoryId: isTransfer || categoryId === NO_CATEGORY ? null : categoryId,
    ...pattern,
    endDay: endDay || null,
    activeFrom,
    pausedFrom: schedule?.pausedFrom ?? null,
    skippedDays: schedule?.skippedDays ?? [],
    autoRecord,
    isSubscription: kind === 'expense' && isSubscription,
    icon,
  };
  const preview = monthDays.length > 0 || frequency !== 'monthly' ? occurrencesBetween({ ...fields, id: 'preview' }, today, plusDays(today, 800)).slice(0, 3) : [];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!fields.name) return setError('Give it a name, like Rent or Salary.');
    if (!fields.amount) return setError('Enter an amount above zero.');
    if (!accountId) return setError('Pick an account.');
    if (isTransfer && (!toAccountId || toAccountId === accountId)) return setError('Pick two different accounts.');
    if (!startDay) return setError('Pick a start date.');
    if (frequency === 'monthly' && monthDays.length === 0) return setError('Pick at least one day of the month.');
    if (fields.endDay && fields.endDay < startDay) return setError('The end date must be on or after the start date.');
    if (schedule) saveSchedule.mutate({ id: schedule.id, schedule: fields });
    else addSchedule.mutate({ id: crypto.randomUUID(), schedule: fields });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        <KindSwitchComponent value={kind} onChange={switchKind} />

        <div className="grid grid-cols-[1fr_9rem] gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-name">Name</Label>
            <Input
              id="schedule-name"
              autoFocus
              maxLength={80}
              placeholder={kind === 'income' ? 'Salary' : kind === 'transfer' ? 'Savings' : 'Rent'}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!iconChosen) setIcon(brandForName(event.target.value)?.key ?? null);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-amount">Amount</Label>
            <AmountInputComponent id="schedule-amount" currency={currencyOf(budget, accountId)} placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
        </div>

        {!isTransfer && <CategorySelectComponent id="schedule-category" budget={budget} kind={kind} value={categoryId} onChange={setCategoryId} />}

        <div className={cn('grid gap-3', isTransfer && 'grid-cols-2')}>
          <AccountSelectComponent id="schedule-account" label={isTransfer ? 'From' : 'Account'} budget={budget} value={accountId} onChange={setAccountId} />
          {isTransfer && (
            <AccountSelectComponent id="schedule-to-account" label="To" budget={budget} value={toAccountId} onChange={setToAccountId} />
          )}
        </div>

        <fieldset className="flex flex-col gap-3 rounded-xl border p-3.5">
          <legend className="px-1 text-sm font-medium">Repeats</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-frequency">How often</Label>
              <Select value={frequency} onValueChange={(value) => setFrequency(value as Frequency)}>
                <SelectTrigger id="schedule-frequency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(({ id, label }) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-interval">Every</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="schedule-interval"
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  value={intervalText}
                  onChange={(event) => setIntervalText(event.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">{every === 1 ? unit : `${unit}s`}</span>
              </div>
            </div>
          </div>

          {frequency === 'monthly' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium" id="schedule-days-label">
                On these days
              </span>
              <div role="group" aria-labelledby="schedule-days-label" className="grid grid-cols-8 gap-1">
                {MONTH_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={monthDays.includes(day)}
                    aria-label={day === LAST_DAY ? 'Last day of the month' : `Day ${day}`}
                    onClick={() => toggleMonthDay(day)}
                    className={cn(
                      'h-8 rounded-md border text-xs tabular-nums text-muted-foreground transition-colors hover:bg-accent',
                      day === LAST_DAY && 'col-span-8 sm:col-span-1',
                      monthDays.includes(day) && 'border-foreground bg-foreground text-background hover:bg-foreground/90',
                    )}
                  >
                    {day === LAST_DAY ? 'Last' : day}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Days a month doesn't have fall on its last day.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-start">Starts</Label>
              <Input id="schedule-start" type="date" value={startDay} onChange={(event) => setStartDay(event.target.value)} className="[color-scheme:dark]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-end">Ends (optional)</Label>
              <Input id="schedule-end" type="date" min={startDay} value={endDay} onChange={(event) => setEndDay(event.target.value)} className="[color-scheme:dark]" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground" aria-live="polite">
            {preview.length > 0 ? `Next: ${preview.map(formatShortDay).join(', ')}` : 'No dates ahead with these settings.'}
            {patternChanged && ' · The new pattern applies from today.'}
          </p>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schedule-icon">Icon (optional)</Label>
          <BrandPickerComponent
            id="schedule-icon"
            value={icon}
            onChange={(next) => {
              setIcon(next);
              setIconChosen(true);
            }}
          />
        </div>

        {kind === 'expense' && (
          <SwitchRow
            id="schedule-subscription"
            label="Subscription"
            description="Counts towards your monthly subscriptions total."
            checked={isSubscription}
            onChange={setIsSubscription}
          />
        )}
        <SwitchRow
          id="schedule-auto"
          label="Record automatically"
          description={
            autoRecord
              ? 'Each one is added on its day, no tap needed.'
              : 'Each one waits for you to confirm it, so nothing counts until it really happens.'
          }
          checked={autoRecord}
          onChange={setAutoRecord}
        />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <SheetFooter className="flex-row items-center justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{schedule ? 'Save' : 'Add recurring'}</Button>
      </SheetFooter>
    </form>
  );
}

type SwitchRowProps = { id: string; label: string; description: string; checked: boolean; onChange: (checked: boolean) => void };

function SwitchRow({ id, label, description, checked, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-description`} />
    </div>
  );
}
