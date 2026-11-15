'use client';

import { MoreHorizontal, Plus, Target, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { moneyTone } from './budget-labels';
import { centsToInput, formatMoney, parseMoney } from './budget-money';
import type { Budget, BudgetGoal } from './budget-types';
import type { BudgetViewProps } from './BudgetOverviewComponent';
import { AmountInputComponent, BudgetMeterComponent, StatTileComponent } from './BudgetPartsComponent';
import { goalProgress } from './planning-math';

type MoneyDialog = { goal: BudgetGoal; direction: 1 | -1 };

export function BudgetGoalsComponent({ budget, today, canEdit = true }: BudgetViewProps) {
  const { removeGoal } = useBudgetMutations();
  const [goalForm, setGoalForm] = useState<BudgetGoal | 'new'>();
  const [moneyDialog, setMoneyDialog] = useState<MoneyDialog>();
  const [deleting, setDeleting] = useState<BudgetGoal>();
  const money = (cents: number) => formatMoney(cents, budget.currency);
  const progress = budget.goals.map((goal) => ({ goal, ...goalProgress(budget, goal, today) }));
  const saved = progress.reduce((sum, item) => sum + item.saved, 0);
  const target = progress.reduce((sum, item) => sum + item.goal.target, 0);
  const perMonth = progress.reduce((sum, item) => sum + (item.perMonth ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {budget.goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full border bg-card">
            <Target className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="text-base font-semibold">No savings goals yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Name what you're saving for and how much it takes. Add money as you set it aside and watch it fill up.
          </p>
          {canEdit && (
            <Button onClick={() => setGoalForm('new')} className="mt-2">
              <Plus aria-hidden />
              Add goal
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatTileComponent label="Saved towards goals" value={money(saved)} valueClassName={moneyTone(saved)} detail={`of ${money(target)}`} />
            <StatTileComponent label="Still to save" value={money(Math.max(0, target - saved))} />
            <StatTileComponent label="Needed per month" value={money(perMonth)} detail="To reach every goal with a date on time" />
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setGoalForm('new')}>
                <Plus aria-hidden />
                Add goal
              </Button>
            </div>
          )}
          <ul className="grid gap-4 md:grid-cols-2">
            {progress.map((item) => (
              <GoalCard
                key={item.goal.id}
                budget={budget}
                item={item}
                canEdit={canEdit}
                onAddMoney={(direction) => setMoneyDialog({ goal: item.goal, direction })}
                onEdit={() => setGoalForm(item.goal)}
                onDelete={() => setDeleting(item.goal)}
              />
            ))}
          </ul>
        </>
      )}

      <GoalDialog budget={budget} goal={goalForm} onClose={() => setGoalForm(undefined)} />
      <MoneyDialogComponent budget={budget} today={today} state={moneyDialog} onClose={() => setMoneyDialog(undefined)} />

      <AlertDialog open={deleting !== undefined} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Its progress and history go with it. Your account balances don't change.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && removeGoal.mutate(deleting.id)}>
              Delete goal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type GoalCardProps = {
  budget: Budget;
  item: { goal: BudgetGoal } & ReturnType<typeof goalProgress>;
  canEdit: boolean;
  onAddMoney: (direction: 1 | -1) => void;
  onEdit: () => void;
  onDelete: () => void;
};

function GoalCard({ budget, item, canEdit, onAddMoney, onEdit, onDelete }: GoalCardProps) {
  const { removeContribution } = useBudgetMutations();
  const [showHistory, setShowHistory] = useState(false);
  const { goal, saved, remaining, reached, late, perMonth } = item;
  const money = (cents: number) => formatMoney(cents, budget.currency);
  const history = budget.contributions.filter(({ goalId }) => goalId === goal.id);

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{goal.name}</span>
            {reached && <Badge className="border-transparent bg-money-in/15 text-money-in">Reached</Badge>}
            {late && <Badge variant="outline" className="text-destructive">Past its date</Badge>}
          </span>
          <span className="text-xs text-muted-foreground">{goal.targetDay ? `By ${formatShortDay(goal.targetDay)} ${goal.targetDay.slice(0, 4)}` : 'No target date'}</span>
        </div>
        {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mt-1 -mr-1 size-8" aria-label={`Options for ${goal.name}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{money(saved)}</span>
        <span className="text-sm text-muted-foreground tabular-nums">of {money(goal.target)}</span>
      </div>
      <BudgetMeterComponent spent={Math.min(saved, goal.target)} limit={goal.target} label={`${goal.name} progress`} />
      <p className="text-xs text-muted-foreground">
        {reached
          ? 'Goal reached. Well done.'
          : perMonth
            ? `${money(remaining)} to go · about ${money(perMonth)} a month to make it`
            : `${money(remaining)} to go`}
      </p>

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <Button size="sm" onClick={() => onAddMoney(1)}>
              Add money
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAddMoney(-1)} disabled={saved <= 0}>
              Take out
            </Button>
          </>
        )}
        {history.length > 0 && (
          <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" aria-expanded={showHistory} onClick={() => setShowHistory((open) => !open)}>
            History ({history.length})
          </Button>
        )}
      </div>

      {showHistory && (
        <ul className="flex flex-col divide-y border-t pt-1">
          {history.map((contribution) => (
            <li key={contribution.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="w-14 shrink-0 text-xs text-muted-foreground">{formatShortDay(contribution.day)}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{contribution.note}</span>
              <span className={cn('tabular-nums', moneyTone(contribution.amount))}>
                {formatMoney(contribution.amount, budget.currency, { signed: true })}
              </span>
              {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Remove ${formatShortDay(contribution.day)} ${formatMoney(contribution.amount, budget.currency, { signed: true })}`}
                onClick={() => removeContribution.mutate(contribution.id)}
              >
                <X aria-hidden />
              </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function GoalDialog({ budget, goal, onClose }: { budget: Budget; goal?: BudgetGoal | 'new'; onClose: () => void }) {
  return (
    <Dialog open={goal !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {goal && <GoalForm key={goal === 'new' ? 'new' : goal.id} budget={budget} goal={goal === 'new' ? undefined : goal} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({ budget, goal, onDone }: { budget: Budget; goal?: BudgetGoal; onDone: () => void }) {
  const { addGoal, saveGoal } = useBudgetMutations();
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? centsToInput(goal.target) : '');
  const [targetDay, setTargetDay] = useState(goal?.targetDay ?? '');
  const [error, setError] = useState<string>();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cents = parseMoney(target);
    if (!name.trim()) return setError('Name the goal, like Holiday or Emergency fund.');
    if (!cents) return setError('Enter how much you want to save.');
    const fields = { name: name.trim(), target: cents, targetDay: targetDay || null };
    if (goal) saveGoal.mutate({ id: goal.id, ...fields });
    else addGoal.mutate({ id: crypto.randomUUID(), ...fields });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{goal ? 'Edit goal' : 'New savings goal'}</DialogTitle>
        <DialogDescription>A date is optional. With one, you'll see how much to put aside each month.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-name">Name</Label>
        <Input id="goal-name" autoFocus maxLength={80} placeholder="Emergency fund" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-target">Target</Label>
          <AmountInputComponent id="goal-target" currency={budget.currency} placeholder="0.00" value={target} onChange={(event) => setTarget(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-day">By (optional)</Label>
          <Input id="goal-day" type="date" value={targetDay} onChange={(event) => setTargetDay(event.target.value)} className="[color-scheme:dark]" />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{goal ? 'Save' : 'Add goal'}</Button>
      </DialogFooter>
    </form>
  );
}

type MoneyDialogProps = { budget: Budget; today: string; state?: MoneyDialog; onClose: () => void };

function MoneyDialogComponent({ budget, today, state, onClose }: MoneyDialogProps) {
  return (
    <Dialog open={state !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">{state && <MoneyForm key={state.goal.id} budget={budget} today={today} state={state} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}

function MoneyForm({ budget, today, state, onDone }: { budget: Budget; today: string; state: MoneyDialog; onDone: () => void }) {
  const { addContribution } = useBudgetMutations();
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const adding = state.direction === 1;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cents = parseMoney(amount);
    if (!cents) return setError('Enter an amount above zero.');
    addContribution.mutate({ id: crypto.randomUUID(), goalId: state.goal.id, amount: cents * state.direction, day, note: note.trim() });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>
          {adding ? 'Add money to' : 'Take money out of'} {state.goal.name}
        </DialogTitle>
        <DialogDescription>This tracks the goal only. Record a transfer too if the money moves between accounts.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contribution-amount">Amount</Label>
        <AmountInputComponent id="contribution-amount" currency={budget.currency} autoFocus placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contribution-day">Date</Label>
          <Input id="contribution-day" type="date" value={day} onChange={(event) => setDay(event.target.value)} className="[color-scheme:dark]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contribution-note">Note</Label>
          <Input id="contribution-note" maxLength={200} placeholder="Optional" value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{adding ? 'Add money' : 'Take out'}</Button>
      </DialogFooter>
    </form>
  );
}
