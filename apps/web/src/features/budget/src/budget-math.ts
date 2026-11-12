import { baseEntries, currencyOf, receivedAmount, toBase } from './budget-currency';
import type { Budget, BudgetEntry, EntryInput } from './budget-types';

// Only entries dated up to today are real; later ones are plans and never touch a balance or a total.
export const isActual = (entry: BudgetEntry, today: string) => entry.day <= today;

export const monthOf = (day: string) => day.slice(0, 7);

export function shiftMonth(month: string, by: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + by, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonth(month: string, style: 'long' | 'short' = 'long'): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('en-GB', {
    month: style,
    ...(style === 'long' ? { year: 'numeric' } : {}),
  });
}

export function daysLeftInMonth(month: string, today: string): number | null {
  if (monthOf(today) !== month) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return lastDay - Number(today.slice(8, 10)) + 1;
}

export function accountBalances(budget: Budget, today: string): Map<string, number> {
  const { accounts, entries } = budget;
  const balances = new Map(accounts.map((account) => [account.id, account.openingBalance]));
  const move = (id: string | null, amount: number) => {
    if (id && balances.has(id)) balances.set(id, (balances.get(id) ?? 0) + amount);
  };
  for (const entry of entries) {
    if (!isActual(entry, today)) continue;
    if (entry.kind === 'income') move(entry.accountId, entry.amount);
    else move(entry.accountId, -entry.amount);
    if (entry.kind === 'transfer') move(entry.toAccountId, receivedAmount(budget, entry));
  }
  return balances;
}

export const sum = (values: Iterable<number>) => [...values].reduce((total, value) => total + value, 0);

export type MonthTotals = { income: number; expense: number; plannedIncome: number; plannedExpense: number };

// Transfers move money between accounts, so they are never income or spending.
export function monthTotals(entries: BudgetEntry[], month: string, today: string): MonthTotals {
  const totals: MonthTotals = { income: 0, expense: 0, plannedIncome: 0, plannedExpense: 0 };
  for (const entry of entries) {
    if (entry.kind === 'transfer' || monthOf(entry.day) !== month) continue;
    const actual = isActual(entry, today);
    if (entry.kind === 'income') totals[actual ? 'income' : 'plannedIncome'] += entry.amount;
    else totals[actual ? 'expense' : 'plannedExpense'] += entry.amount;
  }
  return totals;
}

export function spendingByCategory(entries: BudgetEntry[], month: string, today: string): Map<string | null, number> {
  const spent = new Map<string | null, number>();
  for (const entry of entries) {
    if (entry.kind !== 'expense' || monthOf(entry.day) !== month || !isActual(entry, today)) continue;
    spent.set(entry.categoryId, (spent.get(entry.categoryId) ?? 0) + entry.amount);
  }
  return spent;
}

export function monthlySeries(entries: BudgetEntry[], lastMonth: string, count: number, today: string) {
  return Array.from({ length: count }, (_, index) => {
    const month = shiftMonth(lastMonth, index - count + 1);
    const { income, expense } = monthTotals(entries, month, today);
    return { month, income, expense };
  });
}

export const savingsRate = (income: number, expense: number) => (income > 0 ? (income - expense) / income : null);

export function upcomingEntries(entries: BudgetEntry[], today: string): BudgetEntry[] {
  return entries.filter((entry) => !isActual(entry, today)).sort((a, b) => a.day.localeCompare(b.day));
}

export function groupByDay(entries: BudgetEntry[]): { day: string; entries: BudgetEntry[] }[] {
  const groups = new Map<string, BudgetEntry[]>();
  for (const entry of entries) groups.set(entry.day, [...(groups.get(entry.day) ?? []), entry]);
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([day, dayEntries]) => ({ day, entries: dayEntries }));
}

export const sortNewestFirst = (entries: BudgetEntry[]) =>
  [...entries].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));

export type LimitAlert = { level: 'near' | 'over'; name: string; amount: number };

export const NEAR_LIMIT = 0.8;

// Says when saving this expense pushes its category past 80% or past its limit for the month.
export function limitAlert(budget: Budget, entry: EntryInput, replacingId: string | undefined, today: string): LimitAlert | null {
  if (entry.kind !== 'expense' || !entry.categoryId || entry.day > today) return null;
  const category = budget.categories.find(({ id }) => id === entry.categoryId);
  const limit = category?.monthlyLimit;
  if (!category || !limit) return null;
  const month = monthOf(entry.day);
  const entries = baseEntries(budget);
  const before = spendingByCategory(entries, month, today).get(category.id) ?? 0;
  const others = entries.filter(({ id }) => id !== replacingId);
  const after = (spendingByCategory(others, month, today).get(category.id) ?? 0) + toBase(budget, entry.amount, currencyOf(budget, entry.accountId));
  if (after > limit && before <= limit) return { level: 'over', name: category.name, amount: after - limit };
  if (after >= limit * NEAR_LIMIT && after <= limit && before < limit * NEAR_LIMIT) {
    return { level: 'near', name: category.name, amount: limit - after };
  }
  return null;
}

// Actual spending per category for each of the given months, in the same order.
export function categoryMonths(entries: BudgetEntry[], months: string[], today: string): Map<string | null, number[]> {
  const rows = new Map<string | null, number[]>();
  months.forEach((month, index) => {
    for (const [categoryId, amount] of spendingByCategory(entries, month, today)) {
      const row = rows.get(categoryId) ?? months.map(() => 0);
      row[index] = amount;
      rows.set(categoryId, row);
    }
  });
  return rows;
}
