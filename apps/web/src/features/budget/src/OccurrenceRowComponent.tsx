'use client';

import { Check, Repeat } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { BrandOrIconComponent } from './BrandIconComponent';
import { accountName, categoryName, moneyTone } from './budget-labels';
import { currencyOf } from './budget-currency';
import { formatMoney } from './budget-money';
import type { Budget, EntryKind } from './budget-types';
import type { Occurrence } from './schedule-math';

const RECORD_LABELS: Record<EntryKind, string> = { expense: 'Mark paid', income: 'Mark received', transfer: 'Mark done' };
const DONE_LABELS: Record<EntryKind, string> = { expense: 'Paid', income: 'Received', transfer: 'Done' };

type OccurrenceRowProps = {
  budget: Budget;
  occurrence: Occurrence;
  today: string;
  onOpenSchedule?: (scheduleId: string) => void;
};

export function OccurrenceRowComponent({ budget, occurrence, today, onOpenSchedule }: OccurrenceRowProps) {
  const { recordOccurrence, skipOccurrence, deleteEntryWithUndo } = useBudgetMutations();
  const { schedule, day, entry } = occurrence;
  const sign = schedule.kind === 'income' ? 1 : schedule.kind === 'expense' ? -1 : 0;
  const amount = formatMoney(schedule.amount, currencyOf(budget, schedule.accountId));
  const overdue = !entry && day < today;
  const when = entry
    ? `${DONE_LABELS[schedule.kind]} ${formatShortDay(entry.day)}`
    : day === today
      ? 'Due today'
      : overdue
        ? `Overdue · ${formatShortDay(day)}`
        : formatShortDay(day);
  const detail =
    schedule.kind === 'transfer'
      ? `${accountName(budget, schedule.accountId)} → ${accountName(budget, schedule.toAccountId)}`
      : `${categoryName(budget, schedule.categoryId)} · ${accountName(budget, schedule.accountId)}`;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-2">
      <button
        type="button"
        onClick={() => onOpenSchedule?.(schedule.id)}
        disabled={!onOpenSchedule}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BrandOrIconComponent
          icon={schedule.icon}
          className="size-9 rounded-full"
          fallback={
            <span className="grid size-9 shrink-0 place-items-center rounded-full border bg-background">
              {entry ? (
                <Check className="size-4 text-money-in" aria-hidden />
              ) : (
                <Repeat className={cn('size-4', overdue ? 'text-destructive' : 'text-muted-foreground')} aria-hidden />
              )}
            </span>
          }
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{schedule.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            <span className={cn(overdue && 'text-destructive')}>{when}</span> · {detail}
          </span>
        </span>
      </button>
      <span className={cn('ml-auto text-sm font-medium tabular-nums', moneyTone(sign), entry && 'opacity-60')}>
        {sign > 0 ? `+${amount}` : sign < 0 ? `−${amount}` : amount}
      </span>
      <span className="flex gap-1.5">
        {entry ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            aria-label={`Undo ${schedule.name}, ${formatShortDay(day)}`}
            onClick={() => deleteEntryWithUndo(entry)}
          >
            Undo
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              aria-label={`Skip ${schedule.name}, ${formatShortDay(day)}`}
              onClick={() => skipOccurrence(occurrence)}
            >
              Skip
            </Button>
            <Button
              size="sm"
              variant={day <= today ? 'default' : 'outline'}
              aria-label={`${RECORD_LABELS[schedule.kind]}: ${schedule.name}, ${formatShortDay(day)}`}
              onClick={() => recordOccurrence(occurrence, today)}
            >
              {RECORD_LABELS[schedule.kind]}
            </Button>
          </>
        )}
      </span>
    </li>
  );
}
