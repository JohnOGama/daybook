'use client';

import { TriangleAlert, X } from 'lucide-react';
import { type FormEvent, type PointerEvent, useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { moneyTone } from './budget-labels';
import { centsToInput, formatMoney, parseMoney } from './budget-money';
import type { BudgetViewProps } from './BudgetOverviewComponent';
import { AmountInputComponent, SectionCardComponent, StatTileComponent } from './BudgetPartsComponent';
import { type ForecastPoint, forecast, isDebt, lowestPoint, type WhatIf } from './planning-math';
import { plusDays } from './schedule-math';

const HORIZONS = [30, 90, 180];

export function BudgetForecastComponent({ budget, today, canEdit = true }: BudgetViewProps) {
  const { saveSettings } = useBudgetMutations();
  const [days, setDays] = useState(90);
  // Until someone picks, every account that isn't a debt is in, including ones added later.
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const chosen = useMemo(
    () => picked ?? new Set(budget.accounts.filter((account) => !isDebt(account)).map(({ id }) => id)),
    [picked, budget.accounts],
  );
  const [whatIfs, setWhatIfs] = useState<WhatIf[]>([]);
  const points = useMemo(() => forecast(budget, today, days, chosen, whatIfs), [budget, today, days, chosen, whatIfs]);
  const money = (cents: number) => formatMoney(cents, budget.currency);
  const low = lowestPoint(points);
  const end = points.at(-1) as ForecastPoint;
  const firstBelow = points.find((point) => point.balance < budget.lowBalance);
  const commitments = points
    .flatMap((point) => point.changes.filter((change) => change.amount < 0).map((change) => ({ ...change, day: point.day })))
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 6);

  function toggleAccount(id: string) {
    setPicked(() => {
      const next = new Set(chosen);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border bg-sidebar p-0.5" role="group" aria-label="How far ahead">
          {HORIZONS.map((horizon) => (
            <button
              key={horizon}
              type="button"
              aria-pressed={days === horizon}
              onClick={() => setDays(horizon)}
              className={cn('h-7 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors', days === horizon && 'bg-background text-foreground shadow-xs')}
            >
              {horizon} days
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Accounts in the forecast">
          {budget.accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              aria-pressed={chosen.has(account.id)}
              onClick={() => toggleAccount(account.id)}
              className={cn(
                'h-7 rounded-full border px-3 text-xs text-muted-foreground transition-colors hover:bg-accent',
                chosen.has(account.id) && 'border-foreground/60 text-foreground',
              )}
            >
              {account.name}
            </button>
          ))}
        </div>
      </div>

      {firstBelow && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            Your balance is expected to fall below {money(budget.lowBalance)} on <strong>{formatShortDay(firstBelow.day)}</strong>
            {firstBelow.day === today ? ' (today)' : ''}, reaching {money(low.balance)} at its lowest on {formatShortDay(low.day)}.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTileComponent label="Today" value={money(points[0].balance)} detail="After anything overdue" />
        <StatTileComponent label={`In ${days} days`} value={money(end.balance)} valueClassName={moneyTone(end.balance - points[0].balance)} detail={`${formatMoney(end.balance - points[0].balance, budget.currency, { signed: true })} from today`} />
        <StatTileComponent label="Lowest point" value={money(low.balance)} detail={formatShortDay(low.day)} valueClassName={low.balance < budget.lowBalance ? 'text-destructive' : undefined} />
        <LowBalanceTile value={budget.lowBalance} currency={budget.currency} canEdit={canEdit} onSave={(lowBalance) => saveSettings.mutate({ lowBalance })} />
      </div>

      <SectionCardComponent title="Projected balance · estimate" action={<span className="text-xs text-muted-foreground">Includes schedules, planned entries and what-ifs</span>}>
        <div className="px-4 pb-4">
          {chosen.size === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Pick at least one account to forecast.</p>
          ) : (
            <ForecastChart points={points} threshold={budget.lowBalance} currency={budget.currency} />
          )}
        </div>
      </SectionCardComponent>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCardComponent title="What if I buy…">
          <div className="flex flex-col gap-3 px-4 pb-4">
            <WhatIfForm today={today} currency={budget.currency} onAdd={(whatIf) => setWhatIfs((items) => [...items, whatIf])} />
            {whatIfs.length > 0 && (
              <ul className="flex flex-col divide-y rounded-lg border">
                {whatIfs.map((whatIf) => (
                  <li key={whatIf.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{whatIf.label}</span>
                    <span className="text-xs text-muted-foreground">{formatShortDay(whatIf.day)}</span>
                    <span className="text-money-out tabular-nums">−{money(whatIf.amount)}</span>
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove ${whatIf.label}`} onClick={() => setWhatIfs((items) => items.filter(({ id }) => id !== whatIf.id))}>
                      <X aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">Nothing here is saved or recorded. It only changes the forecast above.</p>
          </div>
        </SectionCardComponent>

        <SectionCardComponent title="Biggest commitments ahead">
          {commitments.length > 0 ? (
            <ul className="flex flex-col divide-y px-4 pb-2">
              {commitments.map((commitment, index) => (
                <li key={`${commitment.day}-${commitment.label}-${index}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground">{formatShortDay(commitment.day)}</span>
                  <span className="min-w-0 flex-1 truncate">{commitment.label}</span>
                  <span className="text-money-out tabular-nums">{formatMoney(commitment.amount, budget.currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Nothing scheduled to leave these accounts. Add bills under Recurring.</p>
          )}
        </SectionCardComponent>
      </div>
    </div>
  );
}

function LowBalanceTile({ value, currency, canEdit, onSave }: { value: number; currency: string; canEdit: boolean; onSave: (cents: number) => void }) {
  const [text, setText] = useState(centsToInput(value));
  function save() {
    const cents = text.trim() === '' ? 0 : parseMoney(text, { allowNegative: true });
    if (cents === null) return setText(centsToInput(value));
    if (cents !== value) onSave(cents);
  }
  if (!canEdit) return <StatTileComponent label="Warn me below" value={formatMoney(value, currency)} />;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-4">
      <Label htmlFor="low-balance" className="text-xs font-medium text-muted-foreground">
        Warn me below
      </Label>
      <AmountInputComponent
        id="low-balance"
        currency={currency}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        className="h-9 text-lg font-semibold"
      />
    </div>
  );
}

function WhatIfForm({ today, currency, onAdd }: { today: string; currency: string; onAdd: (whatIf: WhatIf) => void }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(plusDays(today, 7));
  const cents = parseMoney(amount);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!cents) return;
    onAdd({ id: crypto.randomUUID(), label: label.trim() || 'Purchase', amount: cents, day });
    setLabel('');
    setAmount('');
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_8rem_9.5rem_auto]">
      <Input aria-label="What" placeholder="New laptop" maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} className="col-span-2 sm:col-span-1" />
      <AmountInputComponent aria-label="Cost" currency={currency} placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <Input aria-label="When" type="date" min={today} value={day} onChange={(event) => setDay(event.target.value)} className="[color-scheme:dark]" />
      <Button type="submit" variant="outline" disabled={!cents} className="col-span-2 sm:col-span-1">
        Try it
      </Button>
    </form>
  );
}

const CHART_HEIGHT = 200;

// One line on one scale: the projected balance, a dashed warning level, and a crosshair that reads out each day.
function ForecastChart({ points, threshold, currency }: { points: ForecastPoint[]; threshold: number; currency: string }) {
  const [hover, setHover] = useState<number>();
  const values = points.map((point) => point.balance);
  const top = Math.max(...values, threshold, 0);
  const bottom = Math.min(...values, threshold, 0);
  const span = top - bottom || 1;
  const x = (index: number) => (index / Math.max(1, points.length - 1)) * 100;
  const y = (balance: number) => ((top - balance) / span) * 100;
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.balance)}`).join(' ');
  const shown = hover === undefined ? undefined : points[hover];

  function handlePointer(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setHover(Math.round(share * (points.length - 1)));
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between py-0.5 text-right text-[11px] text-muted-foreground tabular-nums" style={{ height: CHART_HEIGHT }}>
        <span>{formatMoney(top, currency, { compact: true })}</span>
        <span>{formatMoney(bottom, currency, { compact: true })}</span>
      </div>
      <div className="relative min-w-0 flex-1">
        <div
          className="relative touch-none"
          style={{ height: CHART_HEIGHT }}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setHover(undefined)}
          role="img"
          aria-label={`Projected balance from ${formatMoney(points[0].balance, currency)} today to ${formatMoney(points.at(-1)?.balance ?? 0, currency)} on ${formatShortDay(points.at(-1)?.day ?? '')}`}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <line x1="0" x2="100" y1={y(0)} y2={y(0)} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <line x1="0" x2="100" y1={y(threshold)} y2={y(threshold)} className="stroke-destructive/70" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={`${line} L100,${y(bottom)} L0,${y(bottom)} Z`} className="fill-foreground/[0.06]" />
            <path d={line} fill="none" className="stroke-foreground" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {shown && hover !== undefined && (
              <line x1={x(hover)} x2={x(hover)} y1="0" y2="100" className="stroke-muted-foreground/60" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {shown && hover !== undefined && (
            <>
              <span
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
                style={{ left: `${x(hover)}%`, top: `${y(shown.balance)}%` }}
              />
              <div
                role="tooltip"
                className={cn(
                  'pointer-events-none absolute top-0 z-10 w-52 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md',
                  x(hover) > 60 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3',
                )}
                style={{ left: `${x(hover)}%` }}
              >
                <span className="block font-medium">{formatShortDay(shown.day)}</span>
                <span className={cn('block text-base font-semibold tabular-nums', shown.balance < threshold && 'text-destructive')}>
                  {formatMoney(shown.balance, currency)}
                </span>
                {shown.changes.map((change, index) => (
                  <span key={`${change.label}-${index}`} className="mt-0.5 flex justify-between gap-3 text-muted-foreground">
                    <span className="truncate">{change.label}</span>
                    <span className={cn('tabular-nums', moneyTone(change.amount))}>{formatMoney(change.amount, currency, { signed: true })}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>Today</span>
          <span>{formatShortDay(points[Math.floor((points.length - 1) / 2)].day)}</span>
          <span>{formatShortDay(points.at(-1)?.day ?? '')}</span>
        </div>
      </div>
    </div>
  );
}
