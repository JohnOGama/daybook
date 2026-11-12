'use client';

import { HandCoins, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { currencyOf, toBase } from './budget-currency';
import { moneyTone } from './budget-labels';
import { accountBalances, formatMonth, shiftMonth } from './budget-math';
import { formatMoney } from './budget-money';
import type { Budget, BudgetAccount } from './budget-types';
import { AccountDialogComponent } from './AccountDialogComponent';
import { AccountIconComponent } from './BrandIconComponent';
import type { BudgetViewProps } from './BudgetOverviewComponent';
import { StatTileComponent } from './BudgetPartsComponent';
import { EntryRowComponent } from './EntryRowComponent';
import { debtActivity, isDebt, nextDueDate, owed, payoffPlan } from './planning-math';
import { plusDays } from './schedule-math';

const DUE_SOON_DAYS = 7;
const HISTORY_SHOWN = 8;

export function BudgetDebtsComponent({ budget, today, onOpenEntry, onRecordEntry }: BudgetViewProps) {
  const [accountForm, setAccountForm] = useState<BudgetAccount | 'new'>();
  const balances = accountBalances(budget, today);
  const debts = budget.accounts.filter(isDebt);
  const money = (cents: number) => formatMoney(cents, budget.currency);
  const inBase = (account: BudgetAccount, cents: number) => toBase(budget, cents, currencyOf(budget, account.id));
  const totalOwed = debts.reduce((sum, account) => sum + inBase(account, owed(balances.get(account.id) ?? 0)), 0);
  const minimums = debts.reduce(
    (sum, account) => sum + (owed(balances.get(account.id) ?? 0) > 0 ? inBase(account, account.minimumPayment ?? 0) : 0),
    0,
  );
  const nextDue = debts
    .filter((account) => account.dueDay !== null && owed(balances.get(account.id) ?? 0) > 0)
    .map((account) => ({ account, day: nextDueDate(account.dueDay as number, today) }))
    .sort((a, b) => a.day.localeCompare(b.day))[0];

  return (
    <div className="flex flex-col gap-4">
      {debts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full border bg-card">
            <HandCoins className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <p className="text-base font-semibold">No debts tracked</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add a credit card or a loan with its interest rate and due day. Daybook shows what's left, when it's due and when it'll be paid off.
          </p>
          <Button onClick={() => setAccountForm('new')} className="mt-2">
            <Plus aria-hidden />
            Add a debt
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatTileComponent label="Total owed" value={money(totalOwed)} valueClassName={moneyTone(-totalOwed)} detail={`Across ${debts.length} ${debts.length === 1 ? 'debt' : 'debts'}`} />
            <StatTileComponent label="Minimum payments" value={money(minimums)} detail="Per month" />
            <StatTileComponent
              label="Next due"
              value={nextDue ? formatShortDay(nextDue.day) : '—'}
              detail={
                nextDue
                  ? `${nextDue.account.name}${nextDue.account.minimumPayment ? ` · ${formatMoney(nextDue.account.minimumPayment, currencyOf(budget, nextDue.account.id))}` : ''}`
                  : 'Set a due day on a debt'
              }
            />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAccountForm('new')}>
              <Plus aria-hidden />
              Add a debt
            </Button>
          </div>
          <ul className="flex flex-col gap-4">
            {debts.map((account) => (
              <DebtCard
                key={account.id}
                budget={budget}
                account={account}
                balance={balances.get(account.id) ?? 0}
                today={today}
                onEdit={() => setAccountForm(account)}
                onOpenEntry={onOpenEntry}
                onPay={() =>
                  onRecordEntry({
                    kind: 'transfer',
                    toAccountId: account.id,
                    accountId: budget.accounts.find((other) => !isDebt(other))?.id,
                    amount: Math.min(account.minimumPayment ?? owed(balances.get(account.id) ?? 0), owed(balances.get(account.id) ?? 0)) || undefined,
                    note: `${account.name} payment`,
                  })
                }
              />
            ))}
          </ul>
        </>
      )}
      <AccountDialogComponent budget={budget} account={accountForm} defaultType="credit" onClose={() => setAccountForm(undefined)} />
    </div>
  );
}

type DebtCardProps = {
  budget: Budget;
  account: BudgetAccount;
  balance: number;
  today: string;
  onEdit: () => void;
  onPay: () => void;
  onOpenEntry: BudgetViewProps['onOpenEntry'];
};

function DebtCard({ budget, account, balance, today, onEdit, onPay, onOpenEntry }: DebtCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const money = (cents: number) => formatMoney(cents, currencyOf(budget, account.id));
  const remaining = owed(balance);
  const due = account.dueDay !== null && remaining > 0 ? nextDueDate(account.dueDay, today) : null;
  const dueSoon = due !== null && due <= plusDays(today, DUE_SOON_DAYS);
  const plan = account.minimumPayment && remaining > 0 ? payoffPlan(remaining, account.aprBps ?? 0, account.minimumPayment) : undefined;
  const yearlyInterest = account.aprBps ? Math.round((remaining * account.aprBps) / 10_000) : 0;
  const activity = debtActivity(budget, account.id);

  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <AccountIconComponent account={account} className="size-10" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{account.name}</span>
            {remaining === 0 && <Badge className="border-transparent bg-money-in/15 text-money-in">Paid off</Badge>}
            {dueSoon && <Badge variant="outline" className="border-signal/50 text-signal">Due {formatShortDay(due as string)}</Badge>}
          </span>
          <span className="text-xs text-muted-foreground">
            {account.aprBps !== null ? `${(account.aprBps / 100).toFixed(2)}% a year` : 'No interest rate set'}
            {account.minimumPayment ? ` · ${money(account.minimumPayment)} minimum` : ''}
            {due && !dueSoon ? ` · due ${formatShortDay(due)}` : ''}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className={cn('text-xl font-semibold tabular-nums', remaining > 0 && 'text-money-out')}>{money(remaining)}</span>
          <span className="text-xs text-muted-foreground">owed</span>
        </div>
      </div>

      {remaining > 0 && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {plan === undefined
            ? 'Add a minimum payment to see when this will be paid off.'
            : plan === null
              ? `The minimum payment doesn't cover the interest (about ${money(Math.round(yearlyInterest / 12))} a month). Pay more to bring it down.`
              : `At ${money(account.minimumPayment as number)} a month: paid off in ${plan.months} ${plan.months === 1 ? 'month' : 'months'} (${formatMonth(shiftMonth(today.slice(0, 7), plan.months))}), with about ${money(plan.interest)} in interest.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onPay} disabled={remaining === 0}>
          Record payment
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil aria-hidden />
          Edit details
        </Button>
        {activity.length > 0 && (
          <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" aria-expanded={showHistory} onClick={() => setShowHistory((open) => !open)}>
            Payments and charges ({activity.length})
          </Button>
        )}
      </div>

      {showHistory && (
        <ul className="-mx-2 border-t pt-1">
          {activity.slice(0, HISTORY_SHOWN).map((entry) => (
            <EntryRowComponent key={entry.id} budget={budget} entry={entry} planned={entry.day > today} showDate onOpen={onOpenEntry} />
          ))}
        </ul>
      )}
    </li>
  );
}
