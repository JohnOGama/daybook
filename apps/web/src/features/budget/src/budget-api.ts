import type {
  AccountType,
  Budget,
  BudgetAccount,
  BudgetCategory,
  BudgetGoal,
  BudgetSettings,
  CategoryKind,
  GoalContribution,
  Insights,
  ReceiptImage,
  ReceiptScan,
  EntryInput,
  OccurrenceLink,
  ScheduleInput,
} from './budget-types';

// The server already has this occurrence recorded, usually from another tab.
export class AlreadyRecordedError extends Error {}

async function send(method: string, path: string, body: unknown, failure: string): Promise<void> {
  const response = await fetch(`/api/budget${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 409) throw new AlreadyRecordedError(failure);
  if (!response.ok) throw new Error(failure);
}

export async function fetchBudget(spaceId: string): Promise<Budget> {
  const response = await fetch(`/api/budget?${new URLSearchParams({ spaceId })}`);
  if (!response.ok) throw new Error('Could not load this budget');
  return response.json();
}

export const saveSettings = ({ spaceId, changes }: { spaceId: string; changes: Partial<BudgetSettings> }) =>
  send('PUT', `/${spaceId}`, changes, 'That setting could not be saved. Please try again.');

export const createAccount = (input: BudgetAccount & { spaceId: string }) =>
  send('POST', '/accounts', input, 'That account could not be added. Please try again.');

export const updateAccount = ({ id, ...changes }: Partial<BudgetAccount> & { id: string; type?: AccountType }) =>
  send('PATCH', `/accounts/${id}`, changes, 'That account could not be saved. Please try again.');

export const deleteAccount = (id: string) =>
  send('DELETE', `/accounts/${id}`, undefined, 'That account could not be deleted. Please try again.');

export const createCategory = (input: { id: string; spaceId: string; name: string; kind: CategoryKind }) =>
  send('POST', '/categories', input, 'That category could not be added. Please try again.');

export const updateCategory = ({ id, ...changes }: Partial<BudgetCategory> & { id: string }) =>
  send('PATCH', `/categories/${id}`, changes, 'That category could not be saved. Please try again.');

export const deleteCategory = (id: string) =>
  send('DELETE', `/categories/${id}`, undefined, 'That category could not be deleted. Please try again.');

export const createEntry = ({ id, spaceId, entry, link }: { id: string; spaceId: string; entry: EntryInput; link?: OccurrenceLink }) =>
  send('POST', '/entries', { id, spaceId, ...entry, ...link }, 'That entry could not be saved. Please try again.');

export const updateEntry = ({ id, entry }: { id: string; entry: EntryInput }) =>
  send('PUT', `/entries/${id}`, entry, 'Your changes could not be saved. Please try again.');

export const deleteEntry = (id: string) =>
  send('DELETE', `/entries/${id}`, undefined, 'That entry could not be deleted. Please try again.');

export const createSchedule = ({ id, spaceId, schedule }: { id: string; spaceId: string; schedule: ScheduleInput }) =>
  send('POST', '/schedules', { id, spaceId, ...schedule }, 'That schedule could not be saved. Please try again.');

export const updateSchedule = ({ id, schedule }: { id: string; schedule: ScheduleInput }) =>
  send('PUT', `/schedules/${id}`, schedule, 'That schedule could not be saved. Please try again.');

export const deleteSchedule = (id: string) =>
  send('DELETE', `/schedules/${id}`, undefined, 'That schedule could not be deleted. Please try again.');

export const createGoal = (input: BudgetGoal & { spaceId: string }) =>
  send('POST', '/goals', input, 'That goal could not be added. Please try again.');

export const updateGoal = ({ id, ...changes }: Partial<BudgetGoal> & { id: string }) =>
  send('PATCH', `/goals/${id}`, changes, 'That goal could not be saved. Please try again.');

export const deleteGoal = (id: string) => send('DELETE', `/goals/${id}`, undefined, 'That goal could not be deleted. Please try again.');

export const createContribution = (input: GoalContribution) =>
  send('POST', '/contributions', input, 'That could not be saved. Please try again.');

export const deleteContribution = (id: string) =>
  send('DELETE', `/contributions/${id}`, undefined, 'That could not be removed. Please try again.');

export const receiptUrl = (entryId: string) => `/api/budget/receipts/${entryId}`;

export const uploadReceipt = ({ entryId, image }: { entryId: string; image: ReceiptImage }) =>
  send('PUT', `/receipts/${entryId}`, image, 'The receipt could not be saved. Please try again.');

export const deleteReceipt = (entryId: string) =>
  send('DELETE', `/receipts/${entryId}`, undefined, 'The receipt could not be removed. Please try again.');

async function ask<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/budget/ai/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 429) throw new Error('The AI service is busy. Please try again in a minute.');
  if (!response.ok) throw new Error("The AI couldn't help with that just now. Please try again.");
  return response.json();
}

export const suggestCategory = (input: { spaceId: string; kind: 'income' | 'expense'; note: string; amount: string }) =>
  ask<{ categoryId: string | null }>('categorize', input);

export const scanReceipt = (input: { spaceId: string; today: string } & ReceiptImage) => ask<ReceiptScan>('scan-receipt', input);

export const fetchInsights = (input: { spaceId: string; summary: Record<string, unknown> }) => ask<Insights>('insights', input);
