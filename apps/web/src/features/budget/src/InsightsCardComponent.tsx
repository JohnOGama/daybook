'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useActiveSpace } from '@/features/spaces';
import { Button } from '@/shared/components/ui/button';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { fetchInsights } from './budget-api';
import { baseEntries, currencyOf } from './budget-currency';
import { categoryName } from './budget-labels';
import { formatMonth, monthTotals, savingsRate, shiftMonth, spendingByCategory } from './budget-math';
import { formatMoney } from './budget-money';
import type { Budget, Insights } from './budget-types';
import { SectionCardComponent } from './BudgetPartsComponent';
import { upcomingOccurrences } from './schedule-math';

// Only these figures are sent: totals, top categories, limits and upcoming bills. No notes, accounts or entry history.
function monthSummary(budget: Budget, month: string, today: string) {
  const money = (cents: number) => formatMoney(cents, budget.currency);
  const entries = baseEntries(budget);
  const totals = monthTotals(entries, month, today);
  const previous = monthTotals(entries, shiftMonth(month, -1), today);
  const spent = spendingByCategory(entries, month, today);
  const rate = savingsRate(totals.income, totals.expense);
  return {
    month: formatMonth(month),
    income: money(totals.income),
    spent: money(totals.expense),
    savingsRate: rate === null ? 'no income recorded' : `${Math.round(rate * 100)}%`,
    lastMonth: { income: money(previous.income), spent: money(previous.expense) },
    topCategories: [...spent]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, amount]) => {
        const limit = budget.categories.find((category) => category.id === id)?.monthlyLimit;
        return { name: categoryName(budget, id), spent: money(amount), ...(limit ? { monthlyLimit: money(limit) } : {}) };
      }),
    billsInNext14Days: upcomingOccurrences(budget, today, 14)
      .filter(({ entry, schedule }) => !entry && schedule.kind === 'expense')
      .slice(0, 8)
      .map(({ schedule, day }) => ({ name: schedule.name, amount: formatMoney(schedule.amount, currencyOf(budget, schedule.accountId)), due: formatShortDay(day) })),
  };
}

export function InsightsCardComponent({ budget, month, today }: { budget: Budget; month: string; today: string }) {
  const spaceId = useActiveSpace()?.id ?? '';
  const [insights, setInsights] = useState<Insights>();
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string>();

  async function write() {
    setWriting(true);
    setError(undefined);
    try {
      setInsights(await fetchInsights({ spaceId, summary: monthSummary(budget, month, today) }));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setWriting(false);
    }
  }

  return (
    <SectionCardComponent
      title={`Check-in · ${formatMonth(month, 'short')}`}
      action={
        budget.aiEnabled && (
          <Button variant="outline" size="sm" onClick={write} disabled={writing}>
            <Sparkles aria-hidden />
            {writing ? 'Writing…' : insights ? 'Write again' : 'Write my check-in'}
          </Button>
        )
      }
    >
      <div className="px-4 pb-4 text-sm" aria-live="polite">
        {!budget.aiEnabled && (
          <p className="text-muted-foreground">Add a Gemini API key to the server (GEMINI_API_KEY) to get a written check-in on your month.</p>
        )}
        {budget.aiEnabled && !insights && !error && (
          <p className="text-muted-foreground">
            Gemini reads this month's totals, top categories and upcoming bills and writes a short check-in. Notes and account names aren't sent.
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {insights && (
          <div className="flex flex-col gap-2">
            <p className="font-medium">{insights.headline}</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
              {insights.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCardComponent>
  );
}
