'use client';

import { Download } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { cn } from '@/shared/utils/cn';
import { downloadFile } from '@/shared/utils/download-file';
import { toCsv } from './budget-csv';
import { categoryName, moneyTone } from './budget-labels';
import { categoryMonths, formatMonth, monthlySeries, monthTotals, savingsRate, shiftMonth, spendingByCategory } from './budget-math';
import { baseEntries, currencyOf, totalInBase } from './budget-currency';
import { formatMoney } from './budget-money';
import type { BudgetViewProps } from './BudgetOverviewComponent';
import { SectionCardComponent, StatTileComponent } from './BudgetPartsComponent';
import { CategoryBarsComponent } from './CategoryBarsComponent';
import { InsightsCardComponent } from './InsightsCardComponent';

const RANGES = [6, 12];

const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

export function BudgetReportsComponent({ budget, month, today, hrefFor, canEdit = true }: BudgetViewProps) {
  const { currency } = budget;
  const money = (cents: number) => formatMoney(cents, currency);
  const totals = monthTotals(baseEntries(budget), month, today);
  const previous = monthTotals(baseEntries(budget), shiftMonth(month, -1), today);
  const [monthsShown, setMonthsShown] = useState(6);
  const series = monthlySeries(baseEntries(budget), month, monthsShown, today);
  const months = series.map((point) => point.month);
  const byCategory = [...categoryMonths(baseEntries(budget), months, today)]
    .map(([id, values]) => ({ id: id ?? 'none', label: categoryName(budget, id), values, total: values.reduce((sum, value) => sum + value, 0) }))
    .sort((a, b) => b.total - a.total);
  const categoryRows = [...spendingByCategory(baseEntries(budget), month, today)]
    .map(([id, amount]) => ({ id: id ?? 'none', label: categoryName(budget, id), amount }))
    .sort((a, b) => b.amount - a.amount);
  const net = totals.income - totals.expense;
  const change = previous.expense > 0 ? (totals.expense - previous.expense) / previous.expense : null;
  const planned = totals.plannedIncome + totals.plannedExpense;

  function exportSummary() {
    const header = ['Month', 'Income', 'Spent', 'Net', 'Saved %', ...byCategory.map((row) => row.label)];
    const lines = series.map((point, index) => [
      point.month,
      (point.income / 100).toFixed(2),
      (point.expense / 100).toFixed(2),
      ((point.income - point.expense) / 100).toFixed(2),
      percent(savingsRate(point.income, point.expense)),
      ...byCategory.map((row) => (row.values[index] / 100).toFixed(2)),
    ]);
    downloadFile(`budget-report-${months[0]}-to-${month}.csv`, toCsv([header, ...lines]), 'text/csv');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border bg-sidebar p-0.5" role="group" aria-label="Report range">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={monthsShown === range}
              onClick={() => setMonthsShown(range)}
              className={cn('h-7 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors', monthsShown === range && 'bg-background text-foreground shadow-xs')}
            >
              {range} months
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={exportSummary}>
          <Download aria-hidden />
          Export report
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTileComponent label="Income" value={money(totals.income)} valueClassName={moneyTone(totals.income)} />
        <StatTileComponent
          label="Spent"
          value={money(totals.expense)}
          valueClassName={moneyTone(-totals.expense)}
          detail={change === null ? 'Nothing to compare with last month' : `${change > 0 ? 'Up' : 'Down'} ${percent(Math.abs(change))} on last month`}
        />
        <StatTileComponent label={net < 0 ? 'Overspent' : 'Saved'} value={money(Math.abs(net))} valueClassName={moneyTone(net)} />
        <StatTileComponent label="Savings rate" value={percent(savingsRate(totals.income, totals.expense))} detail="Share of income kept" />
      </div>
      {planned > 0 && (
        <p className="text-xs text-muted-foreground">
          Actual entries only. {money(totals.plannedIncome)} in and {money(totals.plannedExpense)} out are planned later in{' '}
          {formatMonth(month, 'short')}.
        </p>
      )}

      {canEdit && <InsightsCardComponent budget={budget} month={month} today={today} />}

      <SectionCardComponent title={`Last ${monthsShown} months`} action={<Legend />}>
        <div className="px-4 pb-4">
          <MonthlyChart series={series} activeMonth={month} currency={currency} hrefFor={hrefFor} />
        </div>
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Month</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="pr-4 text-right">Saved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...series].reverse().map((point) => (
                <TableRow key={point.month} data-state={point.month === month ? 'selected' : undefined}>
                  <TableCell className="pl-4">{formatMonth(point.month)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(point.income)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(point.expense)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', moneyTone(point.income - point.expense))}>
                    {formatMoney(point.income - point.expense, currency, { signed: true })}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{percent(savingsRate(point.income, point.expense))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCardComponent>

      <SectionCardComponent title={`Spending by category · ${formatMonth(month, 'short')}`}>
        {categoryRows.length > 0 ? (
          <div className="flex flex-col gap-4 px-4 pb-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{categoryRows[0].label}</span> took the most, {money(categoryRows[0].amount)}.
            </p>
            <CategoryBarsComponent rows={categoryRows} total={totals.expense} currency={currency} />
          </div>
        ) : (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No spending recorded in {formatMonth(month)}.</p>
        )}
      </SectionCardComponent>

      {byCategory.length > 0 && (
        <SectionCardComponent title="Categories month by month">
          <div className="overflow-x-auto border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card pl-4">Category</TableHead>
                  {months.map((item) => (
                    <TableHead key={item} className={cn('text-right', item === month && 'text-foreground')}>
                      {formatMonth(item, 'short')}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="pr-4 text-right">vs last month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCategory.map((row) => {
                  const current = row.values.at(-1) ?? 0;
                  const before = row.values.at(-2) ?? 0;
                  const delta = current - before;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="sticky left-0 bg-card pl-4 font-medium">{row.label}</TableCell>
                      {row.values.map((value, index) => (
                        <TableCell key={months[index]} className={cn('text-right tabular-nums', value === 0 && 'text-muted-foreground')}>
                          {value === 0 ? '—' : formatMoney(value, currency, { compact: value >= 100_000_00 })}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-muted-foreground tabular-nums">{money(Math.round(row.total / months.length))}</TableCell>
                      <TableCell className={cn('pr-4 text-right tabular-nums', moneyTone(-delta))}>
                        {delta === 0 ? '—' : formatMoney(delta, currency, { signed: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionCardComponent>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-foreground" aria-hidden />
        Income
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] bg-muted-foreground/45" aria-hidden />
        Spent
      </span>
    </div>
  );
}

type MonthlyChartProps = {
  series: { month: string; income: number; expense: number }[];
  activeMonth: string;
  currency: string;
  hrefFor: BudgetViewProps['hrefFor'];
};

// Paired bars per month on one shared scale; each month opens its own reports and shows its figures on hover or focus.
function MonthlyChart({ series, activeMonth, currency, hrefFor }: MonthlyChartProps) {
  const top = Math.max(...series.flatMap((point) => [point.income, point.expense]), 1);
  const height = (cents: number) => `${(cents / top) * 100}%`;

  return (
    <div className="flex pt-8">
      {series.map((point) => {
        const label = `${formatMonth(point.month)}: income ${formatMoney(point.income, currency)}, spent ${formatMoney(point.expense, currency)}`;
        const active = point.month === activeMonth;
        return (
          <Link
            key={point.month}
            href={hrefFor({ month: point.month })}
            aria-label={label}
            aria-current={active ? 'date' : undefined}
            className="group relative flex min-w-0 flex-1 flex-col items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-1 z-10 hidden min-w-36 -translate-y-full rounded-lg border bg-popover px-3 py-2 text-left text-xs shadow-md group-hover:block group-focus-visible:block"
            >
              <span className="block font-medium">{formatMonth(point.month)}</span>
              <span className="mt-1 flex justify-between gap-4 text-muted-foreground">
                Income <span className="text-foreground tabular-nums">{formatMoney(point.income, currency)}</span>
              </span>
              <span className="flex justify-between gap-4 text-muted-foreground">
                Spent <span className="text-foreground tabular-nums">{formatMoney(point.expense, currency)}</span>
              </span>
            </span>
            <span className="flex h-40 w-full items-end justify-center gap-[2px] border-b border-border px-1.5 group-hover:bg-accent/40 sm:px-3">
              <span className="w-1/2 max-w-6 rounded-t-[4px] bg-foreground transition-[height] duration-300" style={{ height: height(point.income) }} />
              <span className="w-1/2 max-w-6 rounded-t-[4px] bg-muted-foreground/45 transition-[height] duration-300" style={{ height: height(point.expense) }} />
            </span>
            <span className={cn('text-xs text-muted-foreground', active && 'font-medium text-foreground')}>
              {formatMonth(point.month, 'short')}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
