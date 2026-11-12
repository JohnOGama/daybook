'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/utils/cn';
import { currencySymbol, formatMoney } from './budget-money';

type StatTileProps = { label: string; value: string; valueClassName?: string; detail?: ReactNode; children?: ReactNode };

export function StatTileComponent({ label, value, valueClassName, detail, children }: StatTileProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn('truncate text-2xl font-semibold tracking-tight tabular-nums', valueClassName)}>{value}</span>
      {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      {children}
    </div>
  );
}

// Yellow while there's room, red once spending passes the limit.
export function BudgetMeterComponent({ spent, limit, label }: { spent: number; limit: number; label: string }) {
  const share = limit > 0 ? spent / limit : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={Math.min(spent, limit)}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', share > 1 ? 'bg-destructive' : 'bg-signal')}
        style={{ width: `${Math.min(share, 1) * 100}%` }}
      />
    </div>
  );
}

export function SectionCardComponent({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl border bg-card', className)}>
      <div className="flex min-h-12 items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MoneyTextComponent({ cents, currency, signed, className }: { cents: number; currency: string; signed?: boolean; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatMoney(cents, currency, { signed })}</span>;
}

export function AmountInputComponent({ currency, className, ...props }: ComponentProps<typeof Input> & { currency: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        {currencySymbol(currency)}
      </span>
      <Input inputMode="decimal" autoComplete="off" className={cn('pl-9 tabular-nums', className)} {...props} />
    </div>
  );
}
