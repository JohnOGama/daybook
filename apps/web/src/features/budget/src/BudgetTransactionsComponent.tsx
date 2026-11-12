'use client';

import { Download, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { cn } from '@/shared/utils/cn';
import { formatDayHeading } from '@/shared/utils/date-formatter';
import { downloadFile } from '@/shared/utils/download-file';
import { baseEntries, currencyOf } from './budget-currency';
import { entriesToCsv } from './budget-csv';
import { accountName, categoryName, moneyTone, signedAmount } from './budget-labels';
import { groupByDay, isActual, sortNewestFirst, sum } from './budget-math';
import { formatMoney } from './budget-money';
import type { BudgetEntry, EntryKind } from './budget-types';
import type { BudgetViewProps } from './BudgetOverviewComponent';
import { EntryRowComponent } from './EntryRowComponent';

const ALL = 'all';
const KIND_FILTERS: { id: EntryKind | typeof ALL; label: string }[] = [
  { id: ALL, label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfers' },
];

// Every entry, newest first, grouped by day.
export function BudgetTransactionsComponent({ budget, today, onOpenEntry, onAddEntry }: BudgetViewProps) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<EntryKind | typeof ALL>(ALL);
  const [accountId, setAccountId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const query = useDeferredValue(search.trim().toLowerCase());

  const matches = (entry: BudgetEntry) =>
    (kind === ALL || entry.kind === kind) &&
    (accountId === ALL || entry.accountId === accountId || entry.toAccountId === accountId) &&
    (categoryId === ALL || entry.categoryId === categoryId) &&
    (!query ||
      [entry.note, categoryName(budget, entry.categoryId), accountName(budget, entry.accountId), formatMoney(entry.amount, currencyOf(budget, entry.accountId))]
        .join(' ')
        .toLowerCase()
        .includes(query));

  const shown = sortNewestFirst(budget.entries.filter(matches));
  const inBase = new Map(baseEntries(budget).map((entry) => [entry.id, entry]));
  const actual = shown.filter((entry) => isActual(entry, today)).map((entry) => inBase.get(entry.id) ?? entry);
  const moneyIn = sum(actual.filter((entry) => entry.kind === 'income').map((entry) => entry.amount));
  const moneyOut = sum(actual.filter((entry) => entry.kind === 'expense').map((entry) => entry.amount));
  const filtered = Boolean(query) || kind !== ALL || accountId !== ALL || categoryId !== ALL;

  function exportCsv() {
    downloadFile(`budget-${filtered ? 'filtered' : 'all'}-entries.csv`, entriesToCsv(budget, shown), 'text/csv');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              aria-label="Search entries"
              placeholder="Search notes, categories, amounts"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <FilterSelect label="Account" value={accountId} onChange={setAccountId} allLabel="All accounts" options={budget.accounts} />
          <FilterSelect label="Category" value={categoryId} onChange={setCategoryId} allLabel="All categories" options={budget.categories} />
          <Button variant="outline" onClick={exportCsv} disabled={shown.length === 0}>
            <Download aria-hidden />
            Export CSV
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg border bg-sidebar p-0.5">
            {KIND_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={kind === id}
                onClick={() => setKind(id)}
                className={cn(
                  'h-7 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors',
                  kind === id && 'bg-background text-foreground shadow-xs',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {shown.length} {shown.length === 1 ? 'entry' : 'entries'} · In {formatMoney(moneyIn, budget.currency)} · Out{' '}
            {formatMoney(moneyOut, budget.currency)}
          </p>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="text-sm font-medium">{filtered ? 'Nothing matches' : 'No entries yet'}</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {filtered ? 'Try a different word or clear a filter.' : 'Record what came in and what went out, and it lists here by day.'}
          </p>
          {!filtered && (
            <Button size="sm" onClick={onAddEntry}>
              Add entry
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupByDay(shown).map((group) => {
            const net = sum(group.entries.map((entry) => signedAmount(inBase.get(entry.id) ?? entry)));
            return (
              <section key={group.day} aria-label={formatDayHeading(group.day)}>
                <div className="flex items-baseline justify-between border-b px-2 pb-1.5">
                  <h3 className="text-[13px] font-medium text-muted-foreground">
                    {formatDayHeading(group.day)}
                    {group.day > today && ' · Planned'}
                  </h3>
                  {net !== 0 && (
                    <span className={cn('text-xs tabular-nums', moneyTone(net))}>{formatMoney(net, budget.currency, { signed: true })}</span>
                  )}
                </div>
                <ul className="pt-1">
                  {group.entries.map((entry) => (
                    <EntryRowComponent key={entry.id} budget={budget} entry={entry} planned={entry.day > today} onOpen={onOpenEntry} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  allLabel: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
};

function FilterSelect({ label, value, allLabel, options, onChange }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
