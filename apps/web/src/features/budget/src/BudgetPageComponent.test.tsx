import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { BudgetPageComponent } from './BudgetPageComponent';
import type { Budget, BudgetEntry, BudgetSchedule } from './budget-types';

const { useBudget, mutations, query } = vi.hoisted(() => {
  const mutation = () => ({ mutate: vi.fn() });
  return {
    useBudget: vi.fn(),
    mutations: {
      addEntry: mutation(),
      saveEntry: mutation(),
      deleteEntryWithUndo: vi.fn(),
      addAccount: mutation(),
      saveAccount: mutation(),
      removeAccount: mutation(),
      addCategory: mutation(),
      saveCategory: mutation(),
      removeCategory: mutation(),
      addSchedule: mutation(),
      saveSchedule: mutation(),
      removeSchedule: mutation(),
      recordOccurrence: vi.fn(),
      skipOccurrence: vi.fn(),
      pauseSchedule: vi.fn(),
      resumeSchedule: vi.fn(),
      saveSettings: mutation(),
      addGoal: mutation(),
      saveGoal: mutation(),
      removeGoal: mutation(),
      addContribution: mutation(),
      removeContribution: mutation(),
      attachReceipt: mutation(),
      removeReceipt: mutation(),
    },
    query: { current: 'space=s1' },
  };
});

vi.mock('../hooks/useBudget', () => ({ useBudget }));
vi.mock('../hooks/useBudgetMutations', () => ({ useBudgetMutations: () => mutations }));
const ai = vi.hoisted(() => ({ suggestCategory: vi.fn(), scanReceipt: vi.fn(), fetchInsights: vi.fn() }));
vi.mock('./budget-api', async (original) => ({ ...(await original<typeof import('./budget-api')>()), ...ai }));
vi.mock('./receipt-image', () => ({ shrinkReceipt: async () => ({ mediaType: 'image/jpeg', data: 'cGhvdG8=' }) }));
vi.mock('../hooks/useOfflineQueue', () => ({ useOfflineQueue: () => ({ online: true, waiting: 0 }) }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Money' }),
  useSpaceAccess: () => ({ access: 'edit', canEdit: true, isOwner: true }),
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => null,
}));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-12' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(query.current) }));

const entry = (fields: Partial<BudgetEntry>): BudgetEntry => ({
  id: crypto.randomUUID(),
  kind: 'expense',
  amount: 2_000,
  accountId: 'bank',
  toAccountId: null,
  categoryId: 'food',
  day: '2026-11-10',
  note: '',
  toAmount: null,
  icon: null,
  scheduleId: null,
  occurrenceDay: null,
  createdAt: '2026-11-10T09:00:00.000Z',
  ...fields,
});

const budget: Budget = {
  currency: 'USD',
  lowBalance: 0,
  rates: {},
  accounts: [
    { id: 'bank', name: 'Bank', type: 'bank', openingBalance: 100_000, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
    { id: 'savings', name: 'Savings', type: 'savings', openingBalance: 0, aprBps: null, dueDay: null, minimumPayment: null, currency: null, icon: null },
  ],
  categories: [
    { id: 'food', name: 'Food', kind: 'expense', monthlyLimit: 3_000 },
    { id: 'salary', name: 'Salary', kind: 'income', monthlyLimit: null },
  ],
  schedules: [],
  goals: [],
  contributions: [],
  receiptEntryIds: [],
  aiEnabled: false,
  entries: [
    entry({ amount: 4_500, note: 'Groceries' }),
    entry({ kind: 'income', amount: 50_000, categoryId: 'salary', day: '2026-11-01', note: 'Pay' }),
    entry({ kind: 'transfer', amount: 10_000, toAccountId: 'savings', categoryId: null, day: '2026-11-02' }),
    entry({ kind: 'income', amount: 50_000, categoryId: 'salary', day: '2026-11-28', note: 'Next pay' }),
  ],
};

const show = (search = 'space=s1') => {
  query.current = search;
  useBudget.mockReturnValue({ data: budget, isPending: false, isError: false });
  render(<BudgetPageComponent />);
};

beforeEach(() => vi.clearAllMocks());

it('sums balances and the month without counting transfers or planned income', () => {
  show();
  const tile = (label: string) => screen.getByText(label).parentElement as HTMLElement;
  expect(within(tile('Total balance')).getByText('$1,455.00')).toBeInTheDocument();
  expect(within(tile('Income · Nov')).getByText('$500.00')).toBeInTheDocument();
  expect(within(tile('Income · Nov')).getByText('+$500.00 still to come')).toBeInTheDocument();
  expect(within(tile('Spent · Nov')).getByText('$45.00')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Accounts' })).toHaveTextContent('Savings$100.00');
});

it('colours money in green and money out red, and leaves transfers neutral', () => {
  show('space=s1&view=transactions');
  for (const amount of screen.getAllByText('+$500.00')) expect(amount).toHaveClass('text-money-in');
  for (const amount of screen.getAllByText('−$45.00')) expect(amount).toHaveClass('text-money-out');
  expect(screen.getByText('$100.00').className).not.toMatch(/money-/);
});

it('lists planned entries under Coming up', () => {
  show();
  const comingUp = screen.getByRole('heading', { name: 'Coming up' }).closest('section') as HTMLElement;
  expect(within(comingUp).getByRole('button', { name: /^Next pay/ })).toHaveTextContent('Planned');
});

it('adds an expense to the last used account, dated today', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));
  await userEvent.type(screen.getByLabelText('Amount'), '12.50');
  await userEvent.type(screen.getByLabelText('Note'), 'Coffee');
  await userEvent.click(screen.getByRole('button', { name: 'Add entry', hidden: false }));
  expect(mutations.addEntry.mutate).toHaveBeenCalledWith({
    id: expect.any(String),
    entry: { kind: 'expense', amount: 1_250, accountId: 'bank', toAccountId: null, categoryId: null, day: '2026-11-12', note: 'Coffee', toAmount: null, icon: null },
  });
});

it('refuses an empty amount', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add entry' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount above zero.');
  expect(mutations.addEntry.mutate).not.toHaveBeenCalled();
});

it('opens an entry to edit and saves it', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: /^Groceries/ }));
  const amount = screen.getByLabelText('Amount');
  await userEvent.clear(amount);
  await userEvent.type(amount, '40');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(mutations.saveEntry.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ entry: expect.objectContaining({ amount: 4_000, note: 'Groceries' }) }),
  );
});

it('flags a category that went over its limit', () => {
  show('space=s1&view=budgets');
  expect(screen.getByText('Over by $15.00')).toBeInTheDocument();
  expect(screen.getByText('over budget')).toBeInTheDocument();
});

it('lists every month newest first without a month switcher, and filters by search and type', async () => {
  show('space=s1&view=transactions&month=2026-10');
  expect(screen.queryByRole('link', { name: 'Previous month' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Tuesday, 10 November' })).toBeInTheDocument();
  expect(screen.getByText('4 entries · In $500.00 · Out $45.00')).toBeInTheDocument();
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search entries' }), 'pay');
  expect(screen.getByRole('button', { name: /^Next pay/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Groceries/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Expenses' }));
  expect(screen.getByText('Nothing matches')).toBeInTheDocument();
});

it('shows money in, money out and recurring items on the calendar, and opens the chosen day', async () => {
  showWithSchedules([schedule({ name: 'Netflix', icon: 'netflix', monthDays: [20], startDay: '2026-11-20', activeFrom: '2026-11-20' })], 'space=s1&view=calendar');
  expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tue, 10 Nov, out $45.00' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sun, 1 Nov, in $500.00' })).toBeInTheDocument();
  const netflixDay = screen.getByRole('button', { name: 'Fri, 20 Nov, out $900.00, 1 recurring' });
  expect(netflixDay.querySelector('[data-brand="netflix"]')).not.toBeNull();
  await userEvent.click(netflixDay);
  const day = screen.getByRole('dialog', { name: 'Fri, 20 Nov' });
  expect(within(day).getByRole('button', { name: 'Mark paid: Netflix, 20 Nov' })).toBeInTheDocument();
  await userEvent.click(within(day).getByRole('button', { name: 'Add entry on this day' }));
  expect(within(screen.getByRole('dialog')).getByLabelText('Date')).toHaveValue('2026-11-20');
});

it('shows the month report with a table of the last six months', () => {
  show('space=s1&view=reports');
  const monthly = screen.getByRole('heading', { name: 'Last 6 months' }).closest('section') as HTMLElement;
  const rows = within(monthly).getAllByRole('row');
  expect(rows).toHaveLength(7);
  const byCategory = screen.getByRole('heading', { name: 'Categories month by month' }).closest('section') as HTMLElement;
  expect(within(byCategory).getAllByRole('row')[1]).toHaveTextContent('Food');
  expect(rows[1]).toHaveTextContent('November 2026$500.00$45.00+$455.00');
  expect(screen.getByRole('link', { name: 'November 2026: income $500.00, spent $45.00' })).toHaveAttribute('aria-current', 'date');
});

const schedule = (fields: Partial<BudgetSchedule>): BudgetSchedule => ({
  id: 'rent',
  name: 'Rent',
  kind: 'expense',
  amount: 90_000,
  accountId: 'bank',
  toAccountId: null,
  categoryId: null,
  frequency: 'monthly',
  interval: 1,
  monthDays: [10],
  startDay: '2026-11-10',
  endDay: null,
  activeFrom: '2026-11-10',
  pausedFrom: null,
  skippedDays: [],
  autoRecord: false,
  isSubscription: false,
  icon: null,
  ...fields,
});

const showWithSchedules = (schedules: BudgetSchedule[], search = 'space=s1') => {
  query.current = search;
  useBudget.mockReturnValue({ data: { ...budget, schedules }, isPending: false, isError: false });
  render(<BudgetPageComponent />);
};

it('asks to confirm an overdue bill on the overview and counts it on the Recurring tab', async () => {
  showWithSchedules([schedule({})]);
  expect(screen.getByRole('link', { name: /Recurring, 1 due/ })).toBeInTheDocument();
  const attention = screen.getByRole('heading', { name: 'Needs attention' }).closest('section') as HTMLElement;
  expect(within(attention).getByText(/Overdue · 10 Nov/)).toBeInTheDocument();
  await userEvent.click(within(attention).getByRole('button', { name: 'Mark paid: Rent, 10 Nov' }));
  expect(mutations.recordOccurrence).toHaveBeenCalledWith(expect.objectContaining({ day: '2026-11-10' }), '2026-11-12');
  await userEvent.click(within(attention).getByRole('button', { name: 'Skip Rent, 10 Nov' }));
  expect(mutations.skipOccurrence).toHaveBeenCalledWith(expect.objectContaining({ day: '2026-11-10' }));
});

it('warns on the overview when a category passes its limit', () => {
  showWithSchedules([]);
  const attention = screen.getByRole('heading', { name: 'Needs attention' }).closest('section') as HTMLElement;
  expect(within(attention).getByText('Over by $15.00')).toBeInTheDocument();
});

it('records schedules set to automatic by themselves, once each', () => {
  showWithSchedules([schedule({ autoRecord: true, frequency: 'weekly', startDay: '2026-11-01', activeFrom: '2026-11-01', monthDays: [] })]);
  expect(mutations.recordOccurrence).toHaveBeenCalledTimes(2);
  expect(mutations.recordOccurrence.mock.calls.map(([occurrence]) => occurrence.day)).toEqual(['2026-11-01', '2026-11-08']);
  expect(screen.queryByRole('link', { name: /due/ })).not.toBeInTheDocument();
});

it('lists schedules with their pattern, monthly cost and next date', () => {
  showWithSchedules([schedule({ name: 'Netflix', monthDays: [15, -1], isSubscription: true })], 'space=s1&view=recurring');
  const schedules = screen.getByRole('heading', { name: 'Schedules' }).closest('section') as HTMLElement;
  expect(within(schedules).getByText('Every month on the 15th and last day')).toBeInTheDocument();
  expect(within(schedules).getByText('Next 15 Nov · about $1,800.00 a month')).toBeInTheDocument();
  expect(within(schedules).getByText('Subscription')).toBeInTheDocument();
});

it('adds a monthly schedule on the 15th and the last day', async () => {
  showWithSchedules([], 'space=s1&view=recurring');
  await userEvent.click(screen.getByRole('button', { name: 'Add recurring' }));
  const sheet = screen.getByRole('dialog');
  await userEvent.type(within(sheet).getByLabelText('Name'), 'Salary');
  await userEvent.click(within(sheet).getByRole('radio', { name: 'Income' }));
  await userEvent.type(within(sheet).getByLabelText('Amount'), '2500');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Day 12' }));
  await userEvent.click(within(sheet).getByRole('button', { name: 'Day 15' }));
  await userEvent.click(within(sheet).getByRole('button', { name: 'Last day of the month' }));
  expect(within(sheet).getByText('Next: 15 Nov, 30 Nov, 15 Dec')).toBeInTheDocument();
  await userEvent.click(within(sheet).getByRole('button', { name: 'Add recurring' }));
  expect(mutations.addSchedule.mutate).toHaveBeenCalledWith({
    id: expect.any(String),
    schedule: expect.objectContaining({
      name: 'Salary',
      kind: 'income',
      amount: 250_000,
      frequency: 'monthly',
      monthDays: [15, -1],
      startDay: '2026-11-12',
      activeFrom: '2026-11-12',
      autoRecord: false,
    }),
  });
});

it('turns a new entry into a recurring one, keeping what was typed', async () => {
  showWithSchedules([]);
  await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));
  await userEvent.type(screen.getByLabelText('Amount'), '15.99');
  await userEvent.type(screen.getByLabelText('Note'), 'Spotify');
  await userEvent.click(screen.getByRole('button', { name: 'Make it repeat' }));
  const sheet = screen.getByRole('dialog', { name: 'New recurring' });
  expect(within(sheet).getByLabelText('Name')).toHaveValue('Spotify');
  expect(within(sheet).getByLabelText('Amount')).toHaveValue('15.99');
});

const showPlanning = (extra: Partial<Budget>, search: string) => {
  query.current = search;
  useBudget.mockReturnValue({ data: { ...budget, ...extra }, isPending: false, isError: false });
  render(<BudgetPageComponent />);
};

it('shows goal progress and adds money to a goal', async () => {
  showPlanning(
    {
      goals: [{ id: 'trip', name: 'Trip', target: 100_000, targetDay: '2027-04-30' }],
      contributions: [{ id: 'c1', goalId: 'trip', amount: 20_000, day: '2026-11-01', note: '' }],
    },
    'space=s1&view=goals',
  );
  expect(screen.getByText('$800.00 to go · about $133.34 a month to make it')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Add money' }));
  await userEvent.type(screen.getByLabelText('Amount'), '50');
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add money' }));
  expect(mutations.addContribution.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ goalId: 'trip', amount: 5_000, day: '2026-11-12' }),
  );
});

it('shows what a loan still owes, its payoff and records a payment from an everyday account', async () => {
  showPlanning(
    {
      accounts: [
        ...budget.accounts,
        { id: 'loan', name: 'Car loan', type: 'loan', openingBalance: -100_000, aprBps: 0, dueDay: 15, minimumPayment: 25_000, currency: null, icon: null },
      ],
    },
    'space=s1&view=debts',
  );
  expect(screen.getByText('At $250.00 a month: paid off in 4 months (March 2027), with about $0.00 in interest.')).toBeInTheDocument();
  expect(screen.getByText('Due 15 Nov')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Record payment' }));
  const sheet = screen.getByRole('dialog', { name: 'New entry' });
  expect(within(sheet).getByRole('radio', { name: 'Transfer' })).toHaveAttribute('aria-checked', 'true');
  expect(within(sheet).getByLabelText('Amount')).toHaveValue('250');
  expect(within(sheet).getByLabelText('Note')).toHaveValue('Car loan payment');
});

it('warns when the forecast drops below the warning level, and a what-if moves it', async () => {
  showPlanning({ lowBalance: 140_000 }, 'space=s1&view=forecast');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('textbox', { name: 'What' }), 'Laptop');
  await userEvent.type(screen.getByRole('textbox', { name: 'Cost' }), '200');
  await userEvent.click(screen.getByRole('button', { name: 'Try it' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Your balance is expected to fall below $1,400.00 on 19 Nov');
  expect(screen.getByRole('button', { name: 'Remove Laptop' })).toBeInTheDocument();
});

const categoryShown = () => within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Category' });

it('fills the category from a past entry with the same note', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));
  await userEvent.type(screen.getByLabelText('Note'), 'groceries');
  expect(categoryShown()).toHaveTextContent('Food');
  expect(screen.getByText('Picked from your past entries')).toBeInTheDocument();
  expect(ai.suggestCategory).not.toHaveBeenCalled();
});

it('asks Gemini for a category only when it is set up and history has no match', async () => {
  ai.suggestCategory.mockResolvedValue({ categoryId: 'food' });
  showPlanning({ aiEnabled: true }, 'space=s1');
  await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));
  await userEvent.type(screen.getByLabelText('Note'), 'Bakery');
  await waitFor(() => expect(categoryShown()).toHaveTextContent('Food'), { timeout: 2000 });
  expect(ai.suggestCategory).toHaveBeenCalledWith(expect.objectContaining({ spaceId: 's1', kind: 'expense', note: 'Bakery' }));
  expect(screen.getByText(/Suggested by Gemini/)).toBeInTheDocument();
});

it('scans a receipt into the form and attaches the photo to the saved entry', async () => {
  ai.scanReceipt.mockResolvedValue({ merchant: 'Corner Cafe', amount: 1_250, currency: 'USD', day: '2026-11-11', categoryId: 'food' });
  showPlanning({ aiEnabled: true }, 'space=s1');
  await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));
  const sheet = screen.getByRole('dialog');
  await userEvent.upload(within(sheet).getByLabelText(/Scan receipt/), new File(['x'], 'receipt.jpg', { type: 'image/jpeg' }));
  await waitFor(() => expect(within(sheet).getByLabelText('Amount')).toHaveValue('12.50'));
  expect(within(sheet).getByLabelText('Note')).toHaveValue('Corner Cafe');
  expect(within(sheet).getByLabelText('Date')).toHaveValue('2026-11-11');
  expect(within(sheet).getByText('Photo attached')).toBeInTheDocument();
  await userEvent.click(within(sheet).getByRole('button', { name: 'Add entry' }));
  const saved = mutations.addEntry.mutate.mock.calls[0][0];
  expect(saved.entry).toMatchObject({ amount: 1_250, categoryId: 'food', day: '2026-11-11' });
  expect(mutations.attachReceipt.mutate).toHaveBeenCalledWith({ entryId: saved.id, image: { mediaType: 'image/jpeg', data: 'cGhvdG8=' } });
});

it('writes a monthly check-in from totals only, never notes', async () => {
  ai.fetchInsights.mockResolvedValue({ headline: 'A steady month.', points: ['Food went over its limit by $15.00.'] });
  showPlanning({ aiEnabled: true }, 'space=s1&view=reports');
  await userEvent.click(screen.getByRole('button', { name: 'Write my check-in' }));
  expect(await screen.findByText('A steady month.')).toBeInTheDocument();
  const sent = JSON.stringify(ai.fetchInsights.mock.calls[0][0]);
  expect(sent).toContain('$45.00');
  expect(sent).not.toContain('Groceries');
});

it('explains how to turn the check-in on when Gemini is not set up', () => {
  show('space=s1&view=reports');
  expect(screen.getByText(/Add a Gemini API key to the server/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Write my check-in' })).not.toBeInTheDocument();
});

it('picks the Netflix logo from the name of a new recurring item, and lets you change it', async () => {
  showWithSchedules([], 'space=s1&view=recurring');
  await userEvent.click(screen.getByRole('button', { name: 'Add recurring' }));
  const sheet = screen.getByRole('dialog');
  await userEvent.type(within(sheet).getByLabelText('Name'), 'Netflix Premium');
  expect(within(sheet).getByRole('button', { name: /Icon/ })).toHaveTextContent('Netflix');
  await userEvent.click(within(sheet).getByRole('button', { name: /Icon/ }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Search icons' }), 'spot');
  await userEvent.click(screen.getByRole('button', { name: 'Spotify' }));
  await userEvent.type(within(sheet).getByLabelText('Amount'), '9.99');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Add recurring' }));
  expect(mutations.addSchedule.mutate).toHaveBeenCalledWith(expect.objectContaining({ schedule: expect.objectContaining({ icon: 'spotify' }) }));
});

it('shows the logo of the schedule an entry came from, and an account logo on Overview', () => {
  const netflix = schedule({ id: 'netflix-plan', name: 'Netflix', icon: 'netflix' });
  query.current = 'space=s1&view=transactions';
  useBudget.mockReturnValue({
    data: {
      ...budget,
      accounts: budget.accounts.map((account) => (account.id === 'bank' ? { ...account, icon: 'gcash' } : account)),
      schedules: [netflix],
      entries: [...budget.entries, entry({ note: 'Netflix', scheduleId: 'netflix-plan', occurrenceDay: '2026-11-10' })],
    },
    isPending: false,
    isError: false,
  });
  const { unmount } = render(<BudgetPageComponent />);
  expect(screen.getByRole('button', { name: /^Netflix/ }).querySelector('[data-brand="netflix"]')).not.toBeNull();
  unmount();
  query.current = 'space=s1';
  render(<BudgetPageComponent />);
  expect(screen.getByRole('list', { name: 'Accounts' }).querySelector('[data-brand="gcash"]')).not.toBeNull();
});

it('picks an icon for a new entry from its note and saves it with the entry', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Add entry' }));
  const sheet = screen.getByRole('dialog');
  await userEvent.type(within(sheet).getByLabelText('Amount'), '549');
  await userEvent.type(within(sheet).getByLabelText('Note'), 'Netflix');
  expect(within(sheet).getByRole('button', { name: /Icon/ })).toHaveTextContent('Netflix');
  await userEvent.click(within(sheet).getByRole('button', { name: 'Add entry' }));
  expect(mutations.addEntry.mutate).toHaveBeenCalledWith(expect.objectContaining({ entry: expect.objectContaining({ note: 'Netflix', icon: 'netflix' }) }));
});

it('opens another month of the calendar with no day opened', () => {
  show('space=s1&view=calendar&month=2026-12');
  expect(screen.getByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'This month' })).not.toBeInTheDocument();
});
