'use client';

import { ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { relativeDayLabel } from '@/shared/utils/date-formatter';
import { BrandOrIconComponent } from './BrandIconComponent';
import { baseEntries, currencyOf, toBase } from './budget-currency';
import { moneyTone } from './budget-labels';
import { formatMonth, monthOf, shiftMonth, sum } from './budget-math';
import { formatMoney } from './budget-money';
import type { BudgetEntry } from './budget-types';
import type { BudgetViewProps } from './BudgetOverviewComponent';
import { EntryRowComponent } from './EntryRowComponent';
import { OccurrenceRowComponent } from './OccurrenceRowComponent';
import { type Occurrence, occurrencesOf } from './schedule-math';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ICONS_SHOWN = 3;


const dayKey = (month: string, date: number) => `${month}-${String(date).padStart(2, '0')}`;

// A month at a glance: each day's money in and out, and the recurring items that fall on it.
export function BudgetCalendarComponent({ budget, month, today, hrefFor, onOpenEntry, onOpenSchedule, onRecordEntry }: BudgetViewProps) {
  const entries = budget.entries;
  // Recurring items not yet recorded; recorded ones are already entries.
  const occurrences = occurrencesOf(budget, `${month}-01`, `${shiftMonth(month, 1)}-01`).filter(({ entry, day }) => !entry && monthOf(day) === month);
  const [picked, setSelected] = useState<string>();
  // A day picked in another month doesn't carry over: the shown month opens on today, or on its 1st.
  const selected = picked && monthOf(picked) === month ? picked : monthOf(today) === month ? today : `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const leadingBlanks = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const money = (cents: number, compact = false) => formatMoney(cents, budget.currency, { compact });

  const inBase = new Map(baseEntries(budget).map((entry) => [entry.id, entry.amount]));
  const amountOf = (entry: BudgetEntry) => inBase.get(entry.id) ?? entry.amount;
  const entriesOn = (day: string) => entries.filter((entry) => entry.day === day);
  const scheduledOn = (day: string) => occurrences.filter((occurrence) => occurrence.day === day);
  const totals = (dayEntries: BudgetEntry[], scheduled: Occurrence[]) => {
    const fromSchedule = (kind: 'income' | 'expense') =>
      sum(scheduled.filter(({ schedule }) => schedule.kind === kind).map(({ schedule }) => toBase(budget, schedule.amount, currencyOf(budget, schedule.accountId))));
    return {
      income: sum(dayEntries.filter(({ kind }) => kind === 'income').map(amountOf)) + fromSchedule('income'),
      expense: sum(dayEntries.filter(({ kind }) => kind === 'expense').map(amountOf)) + fromSchedule('expense'),
    };
  };

  const monthEntries = entries.filter((entry) => monthOf(entry.day) === month);
  const monthTotal = totals(monthEntries, occurrences.filter(({ day }) => monthOf(day) === month));
  const selectedEntries = entriesOn(selected);
  const selectedScheduled = scheduledOn(selected);
  const selectedTotal = totals(selectedEntries, selectedScheduled);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={formatMonth(month)} className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="Previous month">
              <Link href={hrefFor({ month: shiftMonth(month, -1) })}>
                <ChevronLeft aria-hidden />
              </Link>
            </Button>
            <h2 className="min-w-36 text-center text-sm font-semibold">{formatMonth(month)}</h2>
            <Button asChild variant="ghost" size="icon" aria-label="Next month">
              <Link href={hrefFor({ month: shiftMonth(month, 1) })}>
                <ChevronRight aria-hidden />
              </Link>
            </Button>
            {monthOf(today) !== month && (
              <Button asChild variant="outline" size="sm" className="ml-1">
                <Link href={hrefFor({ month: monthOf(today) })}>Today</Link>
              </Button>
            )}
          </div>
          <dl className="flex gap-4 text-xs tabular-nums">
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">In</dt>
              <dd className="text-money-in">{money(monthTotal.income)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Out</dt>
              <dd className="text-money-out">{money(monthTotal.expense)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Net</dt>
              <dd className={moneyTone(monthTotal.income - monthTotal.expense)}>
                {formatMoney(monthTotal.income - monthTotal.expense, budget.currency, { signed: true })}
              </dd>
            </div>
          </dl>
        </header>

        <div className="grid grid-cols-7 border-b text-center text-[11px] font-medium text-muted-foreground" aria-hidden>
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="py-2">
              {weekday}
            </span>
          ))}
        </div>

        <div role="group" aria-label={`${formatMonth(month)} by day`} className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <span key={`blank-${index}`} className="min-h-16 border-r border-b bg-muted/20 sm:min-h-24" aria-hidden />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = dayKey(month, index + 1);
            const dayEntries = entriesOn(day);
            const scheduled = scheduledOn(day);
            const { income, expense } = totals(dayEntries, scheduled);
            const recurringIcons = [
              ...scheduled.map(({ schedule }) => schedule.icon),
              ...dayEntries.filter((entry) => entry.scheduleId).map((entry) => entry.icon ?? budget.schedules.find(({ id }) => id === entry.scheduleId)?.icon ?? null),
            ];
            const future = day > today;
            const label = [
              relativeDayLabel(day, today),
              income > 0 && `in ${money(income)}`,
              expense > 0 && `out ${money(expense)}`,
              recurringIcons.length > 0 && `${recurringIcons.length} recurring`,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <button
                key={day}
                type="button"
                aria-label={label}
                aria-pressed={selected === day}
                onClick={() => setSelected(day)}
                className={cn(
                  'flex min-h-16 flex-col items-stretch gap-0.5 border-r border-b p-1.5 text-left outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:min-h-24 sm:p-2',
                  selected === day && 'bg-accent/70 hover:bg-accent/70',
                )}
              >
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full text-xs tabular-nums',
                    day === today ? 'bg-foreground font-semibold text-background' : 'text-muted-foreground',
                  )}
                >
                  {index + 1}
                </span>
                <span className={cn('hidden flex-col text-[11px] leading-tight font-medium tabular-nums sm:flex', future && 'opacity-60')}>
                  {income > 0 && <span className="truncate text-money-in">+{money(income, income >= 1_000_000)}</span>}
                  {expense > 0 && <span className="truncate text-money-out">−{money(expense, expense >= 1_000_000)}</span>}
                </span>
                <span className="mt-auto flex items-center gap-0.5">
                  <span className="flex gap-0.5 sm:hidden" aria-hidden>
                    {income > 0 && <span className="size-1.5 rounded-full bg-money-in" />}
                    {expense > 0 && <span className="size-1.5 rounded-full bg-money-out" />}
                  </span>
                  {recurringIcons.slice(0, ICONS_SHOWN).map((icon, iconIndex) => (
                    <BrandOrIconComponent
                      key={`${icon}-${iconIndex}`}
                      icon={icon}
                      className="hidden size-4 rounded-[4px] sm:grid"
                      fallback={<Repeat className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden />}
                    />
                  ))}
                  {recurringIcons.length > 0 && <Repeat className="size-3 text-muted-foreground sm:hidden" aria-hidden />}
                  {recurringIcons.length > ICONS_SHOWN && (
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">+{recurringIcons.length - ICONS_SHOWN}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label={`Entries on ${relativeDayLabel(selected, today)}`} className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">
            {relativeDayLabel(selected, today)}
            {selected > today && <span className="ml-2 text-xs font-normal text-muted-foreground">Planned</span>}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums">
              {selectedTotal.income > 0 && <span className="text-money-in">+{money(selectedTotal.income)} </span>}
              {selectedTotal.expense > 0 && <span className="text-money-out">−{money(selectedTotal.expense)}</span>}
            </span>
            <Button size="sm" variant="outline" onClick={() => onRecordEntry({ day: selected })}>
              <Plus aria-hidden />
              Add entry on this day
            </Button>
          </div>
        </header>
        {selectedEntries.length + selectedScheduled.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border/60 px-1.5 py-1">
            {selectedScheduled.map((occurrence) => (
              <OccurrenceRowComponent
                key={`${occurrence.schedule.id}-${occurrence.day}`}
                budget={budget}
                occurrence={occurrence}
                today={today}
                onOpenSchedule={onOpenSchedule}
              />
            ))}
            {selectedEntries.map((entry) => (
              <EntryRowComponent key={entry.id} budget={budget} entry={entry} planned={entry.day > today} onOpen={onOpenEntry} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing on this day.</p>
        )}
      </section>
    </div>
  );
}
