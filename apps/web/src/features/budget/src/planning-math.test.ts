import { describe, expect, it } from 'vitest';
import type { Budget, BudgetEntry, BudgetSchedule } from './budget-types';
import { forecast, goalProgress, lowestPoint, nextDueDate, payoffPlan } from './planning-math';

const today = '2026-11-12';

const entry = (fields: Partial<BudgetEntry>): BudgetEntry => ({
  id: crypto.randomUUID(),
  kind: 'expense',
  amount: 1_000,
  accountId: 'bank',
  toAccountId: null,
  categoryId: null,
  day: today,
  note: '',
  toAmount: null,
  icon: null,
  scheduleId: null,
  occurrenceDay: null,
  createdAt: '',
  ...fields,
});

const rent: BudgetSchedule = {
  id: 'rent',
  name: 'Rent',
  kind: 'expense',
  amount: 50_000,
  accountId: 'bank',
  toAccountId: null,
  categoryId: null,
  frequency: 'monthly',
  interval: 1,
  monthDays: [15],
  startDay: '2026-10-15',
  endDay: null,
  activeFrom: '2026-10-15',
  pausedFrom: null,
  skippedDays: [],
  autoRecord: false,
  isSubscription: false,
  icon: null,
};

const budget: Budget = {
  currency: 'USD',
  lowBalance: 0,
  rates: {},
  accounts: [
    { id: 'bank', name: 'Bank', type: 'bank', openingBalance: 100_000, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
    { id: 'savings', name: 'Savings', type: 'savings', openingBalance: 0, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
  ],
  categories: [],
  schedules: [rent],
  receiptEntryIds: [],
  aiEnabled: false,
  goals: [{ id: 'trip', name: 'Trip', target: 100_000, targetDay: '2027-04-30' }],
  contributions: [
    { id: 'c1', goalId: 'trip', amount: 30_000, day: '2026-10-01', note: '' },
    { id: 'c2', goalId: 'trip', amount: -10_000, day: '2026-11-01', note: '' },
  ],
  entries: [
    entry({ kind: 'transfer', amount: 20_000, toAccountId: 'savings', day: '2026-11-20', note: 'To savings' }),
    entry({ kind: 'income', amount: 300_000, day: '2026-11-30', note: 'Pay' }),
  ],
};

describe('goals', () => {
  it('adds up contributions and spreads what is left over the months to the target date', () => {
    expect(goalProgress(budget, budget.goals[0], today)).toEqual({
      saved: 20_000,
      remaining: 80_000,
      share: 0.2,
      reached: false,
      late: false,
      perMonth: 13_334,
    });
  });
});

describe('debts', () => {
  it('finds the next due date, moving past days and short months forward', () => {
    expect(nextDueDate(15, today)).toBe('2026-11-15');
    expect(nextDueDate(5, today)).toBe('2026-12-05');
    expect(nextDueDate(-1, '2027-02-10')).toBe('2027-02-28');
    expect(nextDueDate(31, '2026-11-12')).toBe('2026-11-30');
  });

  it('estimates months and interest to pay off, or says it never will', () => {
    expect(payoffPlan(100_000, 0, 25_000)).toEqual({ months: 4, interest: 0 });
    expect(payoffPlan(100_000, 1_200, 50_000)).toEqual({ months: 3, interest: 1_525 });
    expect(payoffPlan(100_000, 2_400, 1_000)).toBeNull();
    expect(payoffPlan(0, 2_400, 1_000)).toEqual({ months: 0, interest: 0 });
  });
});

describe('forecast', () => {
  it('projects the bank balance with overdue rent today, planned transfers and income, and a what-if', () => {
    const points = forecast(budget, today, 20, new Set(['bank']), [{ id: 'tv', label: 'TV', amount: 40_000, day: '2026-11-25' }]);
    const on = (day: string) => points.find((point) => point.day === day)?.balance;
    expect(on(today)).toBe(100_000 - 50_000);
    expect(on('2026-11-15')).toBe(0);
    expect(on('2026-11-20')).toBe(-20_000);
    expect(on('2026-11-25')).toBe(-60_000);
    expect(on('2026-11-30')).toBe(240_000);
    expect(lowestPoint(points)).toMatchObject({ day: '2026-11-25', balance: -60_000 });
  });

  it('counts a transfer between two chosen accounts as no change', () => {
    const points = forecast(budget, today, 10, new Set(['bank', 'savings']), []);
    expect(points.find((point) => point.day === '2026-11-20')?.changes).toEqual([]);
  });
});
