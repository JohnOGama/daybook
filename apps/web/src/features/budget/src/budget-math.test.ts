import { describe, expect, it } from 'vitest';
import { baseEntries, totalInBase } from './budget-currency';
import { centsToInput, formatMoney, parseMoney } from './budget-money';
import {
  accountBalances,
  daysLeftInMonth,
  groupByDay,
  limitAlert,
  monthlySeries,
  monthTotals,
  savingsRate,
  shiftMonth,
  spendingByCategory,
  upcomingEntries,
} from './budget-math';
import type { Budget, BudgetEntry } from './budget-types';

const entry = (fields: Partial<BudgetEntry>): BudgetEntry => ({
  id: crypto.randomUUID(),
  kind: 'expense',
  amount: 1000,
  accountId: 'bank',
  toAccountId: null,
  categoryId: 'food',
  day: '2026-11-05',
  note: '',
  toAmount: null,
  icon: null,
  scheduleId: null,
  occurrenceDay: null,
  createdAt: '2026-11-05T10:00:00.000Z',
  ...fields,
});

const today = '2026-11-12';
const budget: Budget = {
  currency: 'USD',
  lowBalance: 0,
  rates: {},
  accounts: [
    { id: 'bank', name: 'Bank', type: 'bank', openingBalance: 100_000, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
    { id: 'savings', name: 'Savings', type: 'savings', openingBalance: 0, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
  ],
  categories: [],
  schedules: [],
  goals: [],
  contributions: [],
  receiptEntryIds: [],
  aiEnabled: false,
  entries: [
    entry({ kind: 'income', amount: 50_000, categoryId: 'salary', day: '2026-11-01' }),
    entry({ amount: 2_500 }),
    entry({ kind: 'transfer', amount: 10_000, toAccountId: 'savings', categoryId: null, day: '2026-11-06' }),
    entry({ kind: 'income', amount: 50_000, categoryId: 'salary', day: '2026-11-30' }),
    entry({ amount: 9_000, day: '2026-10-20', categoryId: 'rent' }),
  ],
};

describe('budget math', () => {
  it('moves money between accounts on a transfer and ignores planned entries', () => {
    const balances = accountBalances(budget, today);
    expect(balances.get('bank')).toBe(100_000 + 50_000 - 2_500 - 10_000 - 9_000);
    expect(balances.get('savings')).toBe(10_000);
  });

  it('keeps transfers out of income and spending, and planned money apart', () => {
    expect(monthTotals(budget.entries, '2026-11', today)).toEqual({
      income: 50_000,
      expense: 2_500,
      plannedIncome: 50_000,
      plannedExpense: 0,
    });
  });

  it('adds up spending per category for a month', () => {
    expect(spendingByCategory(budget.entries, '2026-11', today)).toEqual(new Map([['food', 2_500]]));
    expect(spendingByCategory(budget.entries, '2026-10', today)).toEqual(new Map([['rent', 9_000]]));
  });

  it('builds a month series ending at the chosen month', () => {
    expect(monthlySeries(budget.entries, '2026-11', 3, today)).toEqual([
      { month: '2026-09', income: 0, expense: 0 },
      { month: '2026-10', income: 0, expense: 9_000 },
      { month: '2026-11', income: 50_000, expense: 2_500 },
    ]);
  });

  it('handles months, days left and savings rate', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(daysLeftInMonth('2026-11', today)).toBe(19);
    expect(daysLeftInMonth('2026-10', today)).toBeNull();
    expect(savingsRate(50_000, 2_500)).toBeCloseTo(0.95);
    expect(savingsRate(0, 100)).toBeNull();
  });

  it('lists upcoming entries soonest first and groups by day newest first', () => {
    expect(upcomingEntries(budget.entries, today).map((item) => item.day)).toEqual(['2026-11-30']);
    expect(groupByDay(budget.entries).map((group) => group.day)).toEqual(['2026-11-30', '2026-11-06', '2026-11-05', '2026-11-01', '2026-10-20']);
  });
});

describe('budget money', () => {
  it('formats cents with a sign and a true minus', () => {
    expect(formatMoney(123_450, 'USD')).toBe('$1,234.50');
    expect(formatMoney(-500, 'USD')).toBe('−$5.00');
    expect(formatMoney(500, 'USD', { signed: true })).toBe('+$5.00');
  });

  it('reads typed amounts as cents', () => {
    expect(parseMoney('1,250.5')).toBe(125_050);
    expect(parseMoney('$12')).toBe(1_200);
    expect(parseMoney('.5')).toBe(50);
    expect(parseMoney('-20')).toBeNull();
    expect(parseMoney('-20', { allowNegative: true })).toBe(-2_000);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
    expect(centsToInput(125_050)).toBe('1250.50');
    expect(centsToInput(1_200)).toBe('12');
  });
});

describe('limit alerts', () => {
  const withLimit: Budget = {
    ...budget,
    categories: [{ id: 'food', name: 'Food', kind: 'expense', monthlyLimit: 10_000 }],
    entries: [entry({ amount: 7_000 })],
  };
  const spend = (amount: number) => ({ ...entry({ amount, day: today }) });

  it('warns once spending crosses 80% and again once it passes the limit', () => {
    expect(limitAlert(withLimit, spend(500), undefined, today)).toBeNull();
    expect(limitAlert(withLimit, spend(1_500), undefined, today)).toEqual({ level: 'near', name: 'Food', amount: 1_500 });
    expect(limitAlert(withLimit, spend(4_000), undefined, today)).toEqual({ level: 'over', name: 'Food', amount: 1_000 });
  });

  it('ignores income, planned spending and categories without a limit', () => {
    expect(limitAlert(withLimit, { ...spend(9_000), kind: 'income' }, undefined, today)).toBeNull();
    expect(limitAlert(withLimit, { ...spend(9_000), day: '2026-11-20' }, undefined, today)).toBeNull();
    expect(limitAlert(withLimit, { ...spend(9_000), categoryId: 'rent' }, undefined, today)).toBeNull();
  });
});

describe('currencies', () => {
  const twoCurrencies: Budget = {
    ...budget,
    rates: { EUR: 1.1 },
    accounts: [
      { id: 'bank', name: 'Bank', type: 'bank', openingBalance: 100_000, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
      { id: 'euro', name: 'Euro', type: 'bank', openingBalance: 10_000, aprBps: null, dueDay: null, minimumPayment: null, currency: 'EUR', icon: null },
    ],
    entries: [
      entry({ kind: 'transfer', amount: 11_000, toAccountId: 'euro', toAmount: 9_800, categoryId: null }),
      entry({ amount: 1_000, accountId: 'euro' }),
      entry({ kind: 'transfer', amount: 2_200, toAccountId: 'euro', categoryId: null }),
    ],
  };

  it('keeps each balance in its own currency and uses what a transfer delivered', () => {
    const balances = accountBalances(twoCurrencies, today);
    expect(balances.get('bank')).toBe(100_000 - 11_000 - 2_200);
    expect(balances.get('euro')).toBe(10_000 + 9_800 - 1_000 + 2_000);
  });

  it('adds accounts up in the budget currency and converts spending', () => {
    expect(totalInBase(twoCurrencies, accountBalances(twoCurrencies, today))).toBe(86_800 + Math.round(20_800 * 1.1));
    expect(monthTotals(baseEntries(twoCurrencies), '2026-11', today).expense).toBe(1_100);
  });
});
