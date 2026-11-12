import { addDays } from '@/shared/utils/date-formatter';
import type { Budget, BudgetEntry } from './budget-types';

// Shapes the loading skeleton like a lived-in budget.
export function sampleBudget(today: string): Budget {
  const entry = (id: number, kind: BudgetEntry['kind'], amount: number, daysAgo: number, note: string): BudgetEntry => ({
    id: `sample-${id}`,
    kind,
    amount,
    accountId: 'sample-bank',
    toAccountId: kind === 'transfer' ? 'sample-cash' : null,
    categoryId: kind === 'transfer' ? null : 'sample-food',
    day: addDays(today, -daysAgo),
    note,
    toAmount: null,
    icon: null,
    scheduleId: null,
    occurrenceDay: null,
    createdAt: '',
  });
  return {
    currency: 'USD',
    lowBalance: 0,
    rates: {},
    accounts: [
      { id: 'sample-bank', name: 'Everyday bank', type: 'bank', openingBalance: 240_000, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
      { id: 'sample-cash', name: 'Cash', type: 'cash', openingBalance: 12_000, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
      { id: 'sample-savings', name: 'Savings', type: 'savings', openingBalance: 500_000, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
    ],
    categories: [{ id: 'sample-food', name: 'Food', kind: 'expense', monthlyLimit: 40_000 }],
    schedules: [],
    goals: [],
    contributions: [],
    receiptEntryIds: [],
    aiEnabled: false,
    entries: [
      entry(1, 'expense', 2_450, 0, 'Groceries'),
      entry(2, 'expense', 1_200, 1, 'Lunch with team'),
      entry(3, 'transfer', 5_000, 2, 'Cash for the week'),
      entry(4, 'income', 320_000, 3, 'Salary'),
      entry(5, 'expense', 6_800, 4, 'Electricity bill'),
    ],
  };
}
