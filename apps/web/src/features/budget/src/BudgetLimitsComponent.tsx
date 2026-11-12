'use client';

import { type FormEvent, useState } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { daysLeftInMonth, formatMonth, monthTotals, NEAR_LIMIT, spendingByCategory, sum } from './budget-math';
import { baseEntries } from './budget-currency';
import { centsToInput, formatMoney, parseMoney } from './budget-money';
import type { BudgetCategory } from './budget-types';
import { AmountInputComponent, BudgetMeterComponent, SectionCardComponent } from './BudgetPartsComponent';
import type { BudgetViewProps } from './BudgetOverviewComponent';


export function BudgetLimitsComponent({ budget, month, today }: BudgetViewProps) {
  const [editingId, setEditingId] = useState<string>();
  const { currency } = budget;
  const money = (cents: number) => formatMoney(cents, currency);
  const spent = spendingByCategory(baseEntries(budget), month, today);
  const expenseCategories = budget.categories.filter((category) => category.kind === 'expense');
  const limited = expenseCategories
    .filter((category) => category.monthlyLimit)
    .sort((a, b) => (spent.get(b.id) ?? 0) / (b.monthlyLimit ?? 1) - (spent.get(a.id) ?? 0) / (a.monthlyLimit ?? 1));
  const unlimited = expenseCategories.filter((category) => !category.monthlyLimit);
  const limitTotal = sum(limited.map((category) => category.monthlyLimit ?? 0));
  const limitSpent = sum(limited.map((category) => spent.get(category.id) ?? 0));
  const left = limitTotal - limitSpent;
  const daysLeft = daysLeftInMonth(month, today);
  const unbudgetedSpend = monthTotals(baseEntries(budget), month, today).expense - limitSpent;

  const row = (category: BudgetCategory) => (
    <LimitRow
      key={category.id}
      category={category}
      spent={spent.get(category.id) ?? 0}
      currency={currency}
      editing={editingId === category.id}
      onEdit={(editing) => setEditingId(editing ? category.id : undefined)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{formatMonth(month)}</span>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {limitTotal > 0 ? money(Math.abs(left)) : money(0)}
              <span className="ml-2 text-base font-normal text-muted-foreground">{left < 0 ? 'over budget' : 'left to spend'}</span>
            </span>
          </div>
          {limitTotal > 0 && (
            <div className="flex flex-col items-end gap-0.5 text-sm text-muted-foreground tabular-nums">
              <span>
                {money(limitSpent)} of {money(limitTotal)}
              </span>
              {daysLeft !== null && left > 0 && (
                <span>
                  About {money(Math.floor(left / daysLeft))} a day for {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                </span>
              )}
            </div>
          )}
        </div>
        {limitTotal > 0 ? (
          <BudgetMeterComponent spent={limitSpent} limit={limitTotal} label="Total budget used" />
        ) : (
          <p className="text-sm text-muted-foreground">Give a category a monthly limit below to start tracking it. Limits repeat every month.</p>
        )}
        {unbudgetedSpend > 0 && limitTotal > 0 && (
          <p className="text-xs text-muted-foreground">Plus {money(unbudgetedSpend)} spent in categories without a limit.</p>
        )}
      </section>

      {limited.length > 0 && (
        <SectionCardComponent title="Monthly limits">
          <ul className="flex flex-col divide-y px-4 pb-1">{limited.map(row)}</ul>
        </SectionCardComponent>
      )}

      {unlimited.length > 0 && (
        <SectionCardComponent title="No limit yet">
          <ul className="flex flex-col divide-y px-4 pb-1">{unlimited.map(row)}</ul>
        </SectionCardComponent>
      )}
    </div>
  );
}

type LimitRowProps = {
  category: BudgetCategory;
  spent: number;
  currency: string;
  editing: boolean;
  onEdit: (editing: boolean) => void;
};

function LimitRow({ category, spent, currency, editing, onEdit }: LimitRowProps) {
  const { saveCategory } = useBudgetMutations();
  const limit = category.monthlyLimit;
  const money = (cents: number) => formatMoney(cents, currency);
  const share = limit ? spent / limit : 0;

  // An empty field or zero removes the limit.
  function save(text: string) {
    const cents = parseMoney(text) || null;
    if (cents !== limit) saveCategory.mutate({ id: category.id, monthlyLimit: cents });
    onEdit(false);
  }

  return (
    <li className="flex flex-col gap-2.5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{category.name}</span>
          {limit && share > 1 && <Badge variant="destructive">Over by {money(spent - limit)}</Badge>}
          {limit && share >= NEAR_LIMIT && share <= 1 && (
            <Badge variant="outline" className="border-signal/50 text-signal">
              {share === 1 ? 'Limit reached' : 'Almost there'}
            </Badge>
          )}
        </div>
        {editing ? (
          <LimitEditor limit={limit} currency={currency} label={category.name} onSave={save} onCancel={() => onEdit(false)} />
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {limit ? (
                <>
                  <span className="text-foreground">{money(spent)}</span> of {money(limit)}
                </>
              ) : (
                `${money(spent)} spent`
              )}
            </span>
            <Button variant="outline" size="sm" onClick={() => onEdit(true)}>
              {limit ? 'Edit' : 'Set limit'}
            </Button>
          </div>
        )}
      </div>
      {limit && <BudgetMeterComponent spent={spent} limit={limit} label={`${category.name} budget used`} />}
    </li>
  );
}

type LimitEditorProps = { limit: number | null; currency: string; label: string; onSave: (text: string) => void; onCancel: () => void };

function LimitEditor({ limit, currency, label, onSave, onCancel }: LimitEditorProps) {
  const [text, setText] = useState(limit ? centsToInput(limit) : '');
  const invalid = text.trim() !== '' && !parseMoney(text);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!invalid) onSave(text);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2" onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
      <AmountInputComponent
        currency={currency}
        autoFocus
        aria-label={`Monthly limit for ${label}`}
        aria-invalid={invalid}
        placeholder="No limit"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="h-8 w-36"
      />
      <Button type="submit" size="sm" disabled={invalid}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
