import { currencyOf, receivedAmount, toBase, totalInBase } from './budget-currency';
import { accountBalances, isActual } from './budget-math';
import { type Budget, type BudgetAccount, type BudgetEntry, type BudgetGoal, DEBT_TYPES } from './budget-types';
import { dueOccurrences, occurrencesOf, plusDays } from './schedule-math';

const monthsBetween = (from: string, to: string) => {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + toMonth - fromMonth - (toDay < fromDay ? 1 : 0);
};

export function goalProgress(budget: Budget, goal: BudgetGoal, today: string) {
  const saved = budget.contributions.filter(({ goalId }) => goalId === goal.id).reduce((sum, { amount }) => sum + amount, 0);
  const remaining = Math.max(0, goal.target - saved);
  const monthsLeft = goal.targetDay && goal.targetDay > today ? Math.max(1, monthsBetween(today, goal.targetDay) + 1) : null;
  return {
    saved,
    remaining,
    share: Math.min(1, Math.max(0, saved / goal.target)),
    reached: saved >= goal.target,
    late: Boolean(goal.targetDay && goal.targetDay < today && saved < goal.target),
    perMonth: monthsLeft && remaining > 0 ? Math.ceil(remaining / monthsLeft) : null,
  };
}

export const isDebt = (account: BudgetAccount) => DEBT_TYPES.includes(account.type);

// What's still owed: a debt account's balance runs below zero as it's used.
export const owed = (balance: number) => Math.max(0, -balance);

export function nextDueDate(dueDay: number, today: string): string {
  const [year, month, date] = today.split('-').map(Number);
  const dayIn = (y: number, m: number) => {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Math.min(dueDay === -1 ? last : dueDay, last);
  };
  const thisMonth = dayIn(year, month);
  if (thisMonth >= date) return `${year}-${String(month).padStart(2, '0')}-${String(thisMonth).padStart(2, '0')}`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(dayIn(nextYear, nextMonth)).padStart(2, '0')}`;
}

const MAX_MONTHS = 600;

// Paying a fixed amount each month with interest added monthly. Null when the payment never catches up with the interest.
export function payoffPlan(balance: number, aprBps: number, payment: number): { months: number; interest: number } | null {
  if (balance <= 0) return { months: 0, interest: 0 };
  if (payment <= 0) return null;
  const monthlyRate = aprBps / 10_000 / 12;
  let left = balance;
  let interest = 0;
  for (let month = 1; month <= MAX_MONTHS; month++) {
    const charge = Math.round(left * monthlyRate);
    if (payment <= charge) return null;
    interest += charge;
    left += charge - payment;
    if (left <= 0) return { months: month, interest };
  }
  return null;
}

// Payments into a debt account and new charges on it, newest first.
export const debtActivity = (budget: Budget, accountId: string): BudgetEntry[] =>
  budget.entries
    .filter((entry) => entry.accountId === accountId || entry.toAccountId === accountId)
    .sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));

export type WhatIf = { id: string; label: string; amount: number; day: string };
export type ForecastPoint = { day: string; balance: number; changes: { label: string; amount: number }[] };

// Projects the combined balance of the chosen accounts day by day: planned entries, every schedule still to be
// recorded (anything overdue is assumed to land today) and any what-if purchases.
export function forecast(budget: Budget, today: string, days: number, accountIds: Set<string>, whatIfs: WhatIf[]): ForecastPoint[] {
  const balances = accountBalances(budget, today);
  let balance = totalInBase(budget, balances, accountIds);
  const end = plusDays(today, days);
  const changes = new Map<string, { label: string; amount: number }[]>();
  const add = (day: string, label: string, amount: number) => {
    if (amount !== 0 && day <= end) changes.set(day, [...(changes.get(day) ?? []), { label, amount }]);
  };
  // Each change is converted to the budget's currency, so accounts in different currencies add up.
  const effect = (flow: Pick<BudgetEntry, 'kind' | 'amount' | 'accountId' | 'toAccountId' | 'toAmount'>) => {
    let change = 0;
    if (accountIds.has(flow.accountId)) {
      const amount = toBase(budget, flow.amount, currencyOf(budget, flow.accountId));
      change += flow.kind === 'income' ? amount : -amount;
    }
    if (flow.kind === 'transfer' && flow.toAccountId && accountIds.has(flow.toAccountId)) {
      change += toBase(budget, receivedAmount(budget, flow), currencyOf(budget, flow.toAccountId));
    }
    return change;
  };

  for (const entry of budget.entries) {
    if (!isActual(entry, today)) add(entry.day, entry.note || 'Planned entry', effect(entry));
  }
  const unrecorded = [...dueOccurrences(budget, today), ...occurrencesOf(budget, plusDays(today, 1), end).filter(({ entry }) => !entry)];
  for (const { schedule, day } of unrecorded) {
    add(day < today ? today : day, schedule.name, effect({ ...schedule, toAmount: null }));
  }
  for (const whatIf of whatIfs) add(whatIf.day < today ? today : whatIf.day, whatIf.label, -whatIf.amount);

  return Array.from({ length: days + 1 }, (_, index) => {
    const day = plusDays(today, index);
    const dayChanges = changes.get(day) ?? [];
    balance += dayChanges.reduce((sum, change) => sum + change.amount, 0);
    return { day, balance, changes: dayChanges };
  });
}

export const lowestPoint = (points: ForecastPoint[]) =>
  points.reduce((low, point) => (point.balance < low.balance ? point : low), points[0]);
