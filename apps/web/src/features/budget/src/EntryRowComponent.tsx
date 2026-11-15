'use client';

import { Paperclip, Repeat } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/shared/utils/cn';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { BrandOrIconComponent } from './BrandIconComponent';
import { currencyOf, receivedAmount } from './budget-currency';
import { formatMoney } from './budget-money';
import { ENTRY_ICONS, entryDetail, entryTitle, moneyTone, signedAmount } from './budget-labels';
import type { Budget, BudgetEntry } from './budget-types';

type EntryRowProps = {
  budget: Budget;
  entry: BudgetEntry;
  planned?: boolean;
  showDate?: boolean;
  onOpen?: (entry: BudgetEntry) => void;
};

export const EntryRowComponent = memo(function EntryRowComponent({ budget, entry, planned, showDate, onOpen }: EntryRowProps) {
  const Icon = ENTRY_ICONS[entry.kind];
  // An entry's own logo, or the logo of the schedule it was recorded from, so a Netflix payment shows Netflix.
  const icon = entry.icon ?? (entry.scheduleId ? (budget.schedules.find(({ id }) => id === entry.scheduleId)?.icon ?? null) : null);
  const amount = formatMoney(entry.amount, currencyOf(budget, entry.accountId));
  const crossCurrency = entry.kind === 'transfer' && currencyOf(budget, entry.toAccountId) !== currencyOf(budget, entry.accountId);
  const shownAmount = entry.kind === 'income' ? `+${amount}` : entry.kind === 'expense' ? `−${amount}` : amount;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen?.(entry)}
        disabled={!onOpen}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BrandOrIconComponent
          icon={icon}
          className="size-9 rounded-full"
          fallback={
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full border bg-background',
                entry.kind === 'income' && 'border-money-in/40',
                entry.kind === 'expense' && 'border-money-out/30',
              )}
            >
              <Icon className={cn('size-4', moneyTone(signedAmount(entry)) ?? 'text-muted-foreground')} aria-hidden />
            </span>
          }
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">{entryTitle(budget, entry)}</span>
            {entry.scheduleId && <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="Recurring" />}
            {budget.receiptEntryIds.includes(entry.id) && <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-label="Receipt attached" />}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {showDate && `${formatShortDay(entry.day)} · `}
            {entryDetail(budget, entry)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className={cn('text-sm font-medium tabular-nums', moneyTone(signedAmount(entry)))}>
            {shownAmount}
          </span>
          {crossCurrency && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              → {formatMoney(receivedAmount(budget, entry), currencyOf(budget, entry.toAccountId))}
            </span>
          )}
          {planned && <span className="text-[11px] text-muted-foreground">Planned</span>}
        </span>
      </button>
    </li>
  );
});
