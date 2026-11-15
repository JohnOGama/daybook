import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { BudgetPageComponent } from './BudgetPageComponent';
import type { Budget, BudgetSchedule } from './budget-types';

const { useBudget, mutations, query } = vi.hoisted(() => ({
  useBudget: vi.fn(),
  mutations: new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) => (target[key] ??= Object.assign(vi.fn(), { mutate: vi.fn() })),
  }) as Record<string, ReturnType<typeof vi.fn> & { mutate: ReturnType<typeof vi.fn> }>,
  query: { current: 'space=s1' },
}));

vi.mock('../hooks/useBudget', () => ({ useBudget }));
vi.mock('../hooks/useBudgetMutations', () => ({ useBudgetMutations: () => mutations }));
vi.mock('../hooks/useOfflineQueue', () => ({ useOfflineQueue: () => ({ online: true, waiting: 0 }) }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Money' }),
  useSpaceAccess: () => ({ access: 'view', canEdit: false, isOwner: false }),
  ViewOnlyBadgeComponent: () => <span>View only</span>,
}));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-12' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(query.current) }));

const schedule: BudgetSchedule = {
  id: 'rent',
  name: 'Rent',
  kind: 'expense',
  amount: 90_000,
  accountId: 'bank',
  toAccountId: null,
  categoryId: null,
  frequency: 'weekly',
  interval: 1,
  monthDays: [],
  startDay: '2026-11-01',
  endDay: null,
  activeFrom: '2026-11-01',
  pausedFrom: null,
  skippedDays: [],
  autoRecord: true,
  isSubscription: false,
  icon: null,
};

const budget = {
  currency: 'USD',
  lowBalance: 0,
  rates: {},
  accounts: [{ id: 'bank', name: 'Bank', type: 'bank', openingBalance: 100_000, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null }],
  categories: [{ id: 'food', name: 'Food', kind: 'expense', monthlyLimit: 3_000 }],
  schedules: [schedule],
  goals: [{ id: 'g', name: 'Trip', target: 100_000, targetDay: null }],
  contributions: [],
  receiptEntryIds: [],
  aiEnabled: true,
  entries: [],
} as unknown as Budget;

const show = (view: string) => {
  query.current = `space=s1&view=${view}`;
  useBudget.mockReturnValue({ data: budget, isPending: false, isError: false });
  render(<BudgetPageComponent />);
};

beforeEach(() => vi.clearAllMocks());

it('never records a due automatic schedule for a viewer', () => {
  show('overview');
  expect(mutations.recordOccurrence).not.toHaveBeenCalled();
});

it.each(['overview', 'transactions', 'calendar', 'recurring', 'budgets', 'goals', 'debts', 'forecast', 'reports'])(
  'offers a viewer nothing that changes the budget on %s',
  (view) => {
    show(view);
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^(add|edit|set limit|skip|undo|record|mark|take out|write|cancel schedule|delete|remove)/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /options for/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  },
);

it('sends a viewer who opens Settings to the overview', () => {
  show('settings');
  expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
});
