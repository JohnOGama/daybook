'use client';

import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import {
  accountBalances,
  formatMonth,
  isActual,
  monthOf,
  monthTotals,
  NEAR_LIMIT,
  sortNewestFirst,
  spendingByCategory,
  sum,
  upcomingEntries,
} from './budget-math';
import { baseEntries, currencyOf, totalInBase } from './budget-currency';
import { AccountIconComponent } from './BrandIconComponent';
import { formatMoney } from './budget-money';
import { categoryName, moneyTone } from './budget-labels';
import { type Budget, type BudgetEntry, type BudgetView, DEBT_TYPES, type EntryInput } from './budget-types';
import { BudgetMeterComponent, SectionCardComponent, StatTileComponent } from './BudgetPartsComponent';
import { CategoryBarsComponent } from './CategoryBarsComponent';
import { EntryRowComponent } from './EntryRowComponent';
import { OccurrenceRowComponent } from './OccurrenceRowComponent';
import { dueOccurrences, upcomingOccurrences } from './schedule-math';

const ATTENTION_SHOWN = 3;
const COMING_UP_DAYS = 14;

export type BudgetViewProps = {
  budget: Budget;
  month: string;
  today: string;
  onOpenEntry: (entry: BudgetEntry) => void;
  onAddEntry: () => void;
  onRecordEntry: (draft: Partial<EntryInput>) => void;
  onAddSchedule: () => void;
  onOpenSchedule: (scheduleId: string) => void;
  hrefFor: (change: { view?: BudgetView; month?: string }) => string;
};

export function BudgetOverviewComponent({ budget, month, today, onOpenEntry, onAddEntry, onOpenSchedule, hrefFor }: BudgetViewProps) {
  const { currency } = budget;
  const money = (cents: number) => formatMoney(cents, currency);
  const balances = accountBalances(budget, today);
  const totals = monthTotals(baseEntries(budget), month, today);
  const spent = spendingByCategory(baseEntries(budget), month, today);
  const limited = budget.categories.filter((category) => category.kind === 'expense' && category.monthlyLimit);
  const limitTotal = sum(limited.map((category) => category.monthlyLimit ?? 0));
  const limitSpent = sum(limited.map((category) => spent.get(category.id) ?? 0));
  const isCurrentMonth = monthOf(today) === month;
  const inMonth = budget.entries.filter((entry) => monthOf(entry.day) === month);
  const recent = sortNewestFirst(inMonth.filter((entry) => isActual(entry, today))).slice(0, 6);
  const upcoming = upcomingEntries(budget.entries, today).slice(0, 5);
  const upcomingScheduled = upcomingOccurrences(budget, today, COMING_UP_DAYS)
    .filter((occurrence) => !occurrence.entry)
    .slice(0, 5);
  const due = dueOccurrences(budget, today).filter((occurrence) => !occurrence.schedule.autoRecord);
  const alerts = isCurrentMonth
    ? limited
        .map((category) => ({ category, spent: spent.get(category.id) ?? 0, limit: category.monthlyLimit ?? 0 }))
        .filter(({ spent: used, limit }) => used >= limit * NEAR_LIMIT)
        .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
    : [];
  const categoryRows = [...spent]
    .map(([id, amount]) => ({ id: id ?? 'none', label: categoryName(budget, id), amount }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="flex flex-col gap-4">
      {(due.length > 0 || alerts.length > 0) && (
        <SectionCardComponent
          title="Needs attention"
          className="border-signal/40"
          action={
            due.length > ATTENTION_SHOWN && (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href={hrefFor({ view: 'recurring' })}>See all {due.length}</Link>
              </Button>
            )
          }
        >
          {due.length > 0 && (
            <ul className="flex flex-col px-2 pb-1">
              {due.slice(0, ATTENTION_SHOWN).map((occurrence) => (
                <OccurrenceRowComponent
                  key={`${occurrence.schedule.id}-${occurrence.day}`}
                  budget={budget}
                  occurrence={occurrence}
                  today={today}
                  onOpenSchedule={onOpenSchedule}
                />
              ))}
            </ul>
          )}
          {alerts.length > 0 && (
            <ul className="flex flex-col gap-2 px-4 pt-1 pb-4">
              {alerts.map(({ category, spent: used, limit }) => (
                <li key={category.id} className="flex flex-col gap-1.5">
                  <Link href={hrefFor({ view: 'budgets' })} className="flex items-baseline justify-between gap-3 text-sm hover:underline">
                    <span className="truncate font-medium">{category.name}</span>
                    <span className={cn('shrink-0 text-xs tabular-nums', used > limit ? 'text-destructive' : 'text-signal')}>
                      {used > limit ? `Over by ${money(used - limit)}` : `${money(limit - used)} left of ${money(limit)}`}
                    </span>
                  </Link>
                  <BudgetMeterComponent spent={used} limit={limit} label={`${category.name} budget used`} />
                </li>
              ))}
            </ul>
          )}
        </SectionCardComponent>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTileComponent
          label="Total balance"
          value={money(totalInBase(budget, balances))}
          detail={`Across ${budget.accounts.length} ${budget.accounts.length === 1 ? 'account' : 'accounts'}, as of today`}
        />
        <StatTileComponent
          label={`Income · ${formatMonth(month, 'short')}`}
          value={money(totals.income)}
          valueClassName={moneyTone(totals.income)}
          detail={totals.plannedIncome > 0 ? `+${money(totals.plannedIncome)} still to come` : 'Received so far'}
        />
        <StatTileComponent
          label={`Spent · ${formatMonth(month, 'short')}`}
          value={money(totals.expense)}
          valueClassName={moneyTone(-totals.expense)}
          detail={totals.plannedExpense > 0 ? `${money(totals.plannedExpense)} more planned` : 'Transfers not included'}
        />
        {limitTotal > 0 ? (
          <StatTileComponent
            label="Budget left"
            value={money(limitTotal - limitSpent)}
            detail={`${money(limitSpent)} of ${money(limitTotal)} used`}
          >
            <div className="mt-1.5">
              <BudgetMeterComponent spent={limitSpent} limit={limitTotal} label="Monthly budget used" />
            </div>
          </StatTileComponent>
        ) : (
          <StatTileComponent label="Budget left" value="—" detail={<Link href={hrefFor({ view: 'budgets' })} className="underline underline-offset-2 hover:text-foreground">Set monthly limits</Link>} />
        )}
      </div>

      <ul aria-label="Accounts" className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {budget.accounts.map((account) => {
          const balance = balances.get(account.id) ?? 0;
          return (
            <li key={account.id} className="flex min-w-44 flex-1 items-center gap-3 rounded-xl border bg-card px-3.5 py-3">
              <AccountIconComponent account={account} className="size-9" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-xs text-muted-foreground">{account.name}</span>
                <span className={cn('truncate text-sm font-semibold tabular-nums', balance < 0 && 'text-destructive')}>
                  {DEBT_TYPES.includes(account.type) && balance < 0
                    ? `${formatMoney(-balance, currencyOf(budget, account.id))} owed`
                    : formatMoney(balance, currencyOf(budget, account.id))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCardComponent
          title={isCurrentMonth ? 'Recent' : `Latest in ${formatMonth(month, 'short')}`}
          className="lg:col-span-3"
          action={
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href={hrefFor({ view: 'transactions' })}>See all</Link>
            </Button>
          }
        >
          {recent.length > 0 ? (
            <ul className="px-2 pb-2">
              {recent.map((entry) => (
                <EntryRowComponent key={entry.id} budget={budget} entry={entry} showDate onOpen={onOpenEntry} />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-3 px-4 pb-4 text-sm text-muted-foreground">
              Nothing recorded in {formatMonth(month)} yet.
              <Button size="sm" onClick={onAddEntry}>
                Add your first entry
              </Button>
            </div>
          )}
        </SectionCardComponent>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCardComponent title="Where it went">
            {categoryRows.length > 0 ? (
              <div className="px-4 pb-4">
                <CategoryBarsComponent rows={categoryRows.slice(0, 5)} total={totals.expense} currency={currency} />
              </div>
            ) : (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No spending in {formatMonth(month)}.</p>
            )}
          </SectionCardComponent>

          <SectionCardComponent title="Coming up">
            {upcoming.length + upcomingScheduled.length > 0 ? (
              <ul className="px-2 pb-2">
                {upcomingScheduled.map((occurrence) => (
                  <OccurrenceRowComponent
                    key={`${occurrence.schedule.id}-${occurrence.day}`}
                    budget={budget}
                    occurrence={occurrence}
                    today={today}
                    onOpenSchedule={onOpenSchedule}
                  />
                ))}
                {upcoming.map((entry) => (
                  <EntryRowComponent key={entry.id} budget={budget} entry={entry} planned showDate onOpen={onOpenEntry} />
                ))}
              </ul>
            ) : (
              <p className="px-4 pb-4 text-sm text-muted-foreground">
                Nothing in the next {COMING_UP_DAYS} days. Add your bills and salary under Recurring and they show here.
              </p>
            )}
          </SectionCardComponent>
        </div>
      </div>
    </div>
  );
}
