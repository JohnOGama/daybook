'use client';

import { MoreHorizontal, Plus, Repeat } from 'lucide-react';
import { useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { BrandOrIconComponent } from './BrandIconComponent';
import { currencyOf, toBase } from './budget-currency';
import { moneyTone } from './budget-labels';
import { formatMoney } from './budget-money';
import type { BudgetSchedule } from './budget-types';
import type { BudgetViewProps } from './BudgetOverviewComponent';
import { SectionCardComponent, StatTileComponent } from './BudgetPartsComponent';
import { OccurrenceRowComponent } from './OccurrenceRowComponent';
import { describeSchedule, dueOccurrences, monthlyAmount, monthlyTotals, nextOccurrence, upcomingOccurrences } from './schedule-math';

const AHEAD_DAYS = 30;
const DUE_SHOWN = 12;

export function BudgetRecurringComponent({ budget, today, onAddSchedule, onOpenSchedule }: BudgetViewProps) {
  const { currency } = budget;
  const money = (cents: number) => formatMoney(cents, currency);
  const [deleting, setDeleting] = useState<BudgetSchedule>();
  const { removeSchedule } = useBudgetMutations();
  const due = dueOccurrences(budget, today).filter((occurrence) => !occurrence.schedule.autoRecord);
  const ahead = upcomingOccurrences(budget, today, AHEAD_DAYS);
  const totals = monthlyTotals(budget, today);
  const dueThisWeek = upcomingOccurrences(budget, today, 7).filter((occurrence) => !occurrence.entry && occurrence.schedule.kind === 'expense');

  if (budget.schedules.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full border bg-card">
          <Repeat className="size-5 text-muted-foreground" aria-hidden />
        </span>
        <p className="text-base font-semibold">Nothing repeats yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Add your salary, rent, bills and subscriptions once. Daybook reminds you when each one is due, and nothing counts towards
          your balance until you confirm it.
        </p>
        <Button onClick={onAddSchedule} className="mt-2">
          <Plus aria-hidden />
          Add recurring
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTileComponent label="Recurring income" value={money(totals.income)} valueClassName={moneyTone(totals.income)} detail="Per month, on average" />
        <StatTileComponent label="Bills" value={money(totals.bills)} valueClassName={moneyTone(-totals.bills)} detail="Per month, subscriptions included" />
        <StatTileComponent label="Subscriptions" value={money(totals.subscriptions)} detail="Per month" />
        <StatTileComponent
          label="Due this week"
          value={money(dueThisWeek.reduce((sum, { schedule }) => sum + toBase(budget, schedule.amount, currencyOf(budget, schedule.accountId)), 0))}
          detail={`${dueThisWeek.length} ${dueThisWeek.length === 1 ? 'payment' : 'payments'} in the next 7 days`}
        />
      </div>

      {due.length > 0 && (
        <SectionCardComponent title={`Needs attention · ${due.length}`} className="border-signal/40">
          <ul className="flex flex-col px-2 pb-2">
            {due.slice(0, DUE_SHOWN).map((occurrence) => (
              <OccurrenceRowComponent
                key={`${occurrence.schedule.id}-${occurrence.day}`}
                budget={budget}
                occurrence={occurrence}
                today={today}
                onOpenSchedule={onOpenSchedule}
              />
            ))}
          </ul>
          {due.length > DUE_SHOWN && (
            <p className="px-4 pb-3 text-xs text-muted-foreground">And {due.length - DUE_SHOWN} older ones. Clear these first to see them.</p>
          )}
        </SectionCardComponent>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCardComponent title={`Next ${AHEAD_DAYS} days`} className="lg:col-span-3">
          {ahead.length > 0 ? (
            <ul className="flex flex-col px-2 pb-2">
              {ahead.map((occurrence) => (
                <OccurrenceRowComponent
                  key={`${occurrence.schedule.id}-${occurrence.day}`}
                  budget={budget}
                  occurrence={occurrence}
                  today={today}
                  onOpenSchedule={onOpenSchedule}
                />
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Nothing due in the next {AHEAD_DAYS} days.</p>
          )}
        </SectionCardComponent>

        <SectionCardComponent
          title="Schedules"
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm" onClick={onAddSchedule}>
              <Plus aria-hidden />
              Add
            </Button>
          }
        >
          <ul className="flex flex-col divide-y px-4 pb-1">
            {budget.schedules.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                currency={currencyOf(budget, schedule.accountId)}
                today={today}
                onOpen={() => onOpenSchedule(schedule.id)}
                onDelete={() => setDeleting(schedule)}
              />
            ))}
          </ul>
        </SectionCardComponent>
      </div>

      <AlertDialog open={deleting !== undefined} onOpenChange={(open) => !open && setDeleting(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops repeating and won't remind you again. Entries it already recorded stay in your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && removeSchedule.mutate(deleting.id)}>
              Cancel schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type ScheduleRowProps = { schedule: BudgetSchedule; currency: string; today: string; onOpen: () => void; onDelete: () => void };

function ScheduleRow({ schedule, currency, today, onOpen, onDelete }: ScheduleRowProps) {
  const { pauseSchedule, resumeSchedule } = useBudgetMutations();
  const paused = Boolean(schedule.pausedFrom);
  const ended = schedule.endDay !== null && schedule.endDay < today;
  const next = paused || ended ? null : nextOccurrence(schedule, today);
  const sign = schedule.kind === 'income' ? 1 : schedule.kind === 'expense' ? -1 : 0;
  const perMonth = monthlyAmount(schedule);

  return (
    <li className={cn('flex items-start gap-3 py-3', (paused || ended) && 'opacity-60')}>
      <BrandOrIconComponent
        icon={schedule.icon}
        className="mt-0.5 size-8"
        fallback={
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
            <Repeat className="size-4 text-muted-foreground" aria-hidden />
          </span>
        }
      />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">{schedule.name}</span>
          {paused && <Badge variant="outline">Paused</Badge>}
          {ended && <Badge variant="outline">Ended</Badge>}
          {schedule.autoRecord && <Badge variant="outline">Auto</Badge>}
          {schedule.isSubscription && <Badge variant="outline">Subscription</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">{describeSchedule(schedule)}</span>
        <span className="text-xs text-muted-foreground">
          {next ? `Next ${formatShortDay(next)}` : paused ? `Paused since ${formatShortDay(schedule.pausedFrom as string)}` : 'No more dates'}
          {schedule.frequency !== 'monthly' || schedule.interval !== 1 || schedule.monthDays.length > 1
            ? ` · about ${formatMoney(perMonth, currency)} a month`
            : ''}
        </span>
      </button>
      <span className={cn('pt-0.5 text-sm font-medium tabular-nums', moneyTone(sign))}>
        {formatMoney(sign * schedule.amount, currency, { signed: true })}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="-mt-1 size-8" aria-label={`Options for ${schedule.name}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpen}>Edit</DropdownMenuItem>
          {!ended &&
            (paused ? (
              <DropdownMenuItem onSelect={() => resumeSchedule(schedule, today)}>Resume</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => pauseSchedule(schedule, today)}>Pause</DropdownMenuItem>
            ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            Cancel schedule
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
