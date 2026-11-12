'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useActiveSpace } from '@/features/spaces';
import * as api from '../src/budget-api';
import type {
  AccountType,
  Budget,
  BudgetAccount,
  BudgetCategory,
  BudgetEntry,
  BudgetGoal,
  BudgetSchedule,
  BudgetSettings,
  CategoryKind,
  EntryInput,
  GoalContribution,
  OccurrenceLink,
  ReceiptImage,
  ScheduleInput,
} from '../src/budget-types';
import { type Occurrence, recordedDay } from '../src/schedule-math';

// Runs budget requests one at a time, so editing a new entry can't reach the server before the entry exists.
const scope = { id: 'budget' };

export function useBudgetMutations() {
  const queryClient = useQueryClient();
  const spaceId = useActiveSpace()?.id as string;
  const key = ['budget', spaceId];

  function useChange<T>(request: (input: T) => Promise<void>, apply: (budget: Budget, input: T) => Budget) {
    return useMutation({
      scope,
      mutationFn: request,
      onMutate: async (input: T) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<Budget>(key);
        queryClient.setQueryData<Budget>(key, (budget) => budget && apply(budget, input));
        return previous;
      },
      onError: (error: Error, _input, previous) => {
        queryClient.setQueryData(key, previous);
        if (error instanceof api.AlreadyRecordedError) queryClient.invalidateQueries({ queryKey: key });
        else toast.error(error.message);
      },
    });
  }

  const addEntry = useChange(
    ({ id, entry, link }: { id: string; entry: EntryInput; link?: OccurrenceLink; createdAt?: string }) =>
      api.createEntry({ id, spaceId, entry, link }),
    (budget, { id, entry, link, createdAt }) => ({
      ...budget,
      entries: [
        {
          ...entry,
          id,
          scheduleId: link?.scheduleId ?? null,
          occurrenceDay: link?.occurrenceDay ?? null,
          createdAt: createdAt ?? new Date().toISOString(),
        },
        ...budget.entries,
      ],
    }),
  );
  const saveEntry = useChange(api.updateEntry, (budget, { id, entry }) => ({
    ...budget,
    entries: budget.entries.map((item) => (item.id === id ? { ...item, ...entry } : item)),
  }));
  const removeEntry = useChange(api.deleteEntry, (budget, id: string) => ({
    ...budget,
    entries: budget.entries.filter((item) => item.id !== id),
  }));

  const addAccount = useChange(
    (account: BudgetAccount) => api.createAccount({ ...account, spaceId }),
    (budget, account) => ({ ...budget, accounts: [...budget.accounts, account] }),
  );
  const saveAccount = useChange(
    api.updateAccount,
    (budget, { id, ...changes }: Partial<BudgetAccount> & { id: string; type?: AccountType }) => ({
      ...budget,
      accounts: budget.accounts.map((account) => (account.id === id ? { ...account, ...changes } : account)),
    }),
  );
  const removeAccount = useChange(api.deleteAccount, (budget, id: string) => ({
    ...budget,
    accounts: budget.accounts.filter((account) => account.id !== id),
    entries: budget.entries.filter((entry) => entry.accountId !== id && entry.toAccountId !== id),
  }));

  const addCategory = useChange(
    ({ id, name, kind }: { id: string; name: string; kind: CategoryKind }) => api.createCategory({ id, spaceId, name, kind }),
    (budget, { id, name, kind }) => ({ ...budget, categories: [...budget.categories, { id, name, kind, monthlyLimit: null }] }),
  );
  const saveCategory = useChange(api.updateCategory, (budget, { id, ...changes }: Partial<BudgetCategory> & { id: string }) => ({
    ...budget,
    categories: budget.categories.map((category) => (category.id === id ? { ...category, ...changes } : category)),
  }));
  const removeCategory = useChange(api.deleteCategory, (budget, id: string) => ({
    ...budget,
    categories: budget.categories.filter((category) => category.id !== id),
    entries: budget.entries.map((entry) => (entry.categoryId === id ? { ...entry, categoryId: null } : entry)),
  }));

  const addSchedule = useChange(
    ({ id, schedule }: { id: string; schedule: ScheduleInput }) => api.createSchedule({ id, spaceId, schedule }),
    (budget, { id, schedule }) => ({ ...budget, schedules: [...budget.schedules, { ...schedule, id }] }),
  );
  const saveSchedule = useChange(api.updateSchedule, (budget, { id, schedule }) => ({
    ...budget,
    schedules: budget.schedules.map((item) => (item.id === id ? { ...schedule, id } : item)),
  }));
  const removeSchedule = useChange(api.deleteSchedule, (budget, id: string) => ({
    ...budget,
    schedules: budget.schedules.filter((schedule) => schedule.id !== id),
    entries: budget.entries.map((entry) => (entry.scheduleId === id ? { ...entry, scheduleId: null } : entry)),
  }));

  const saveSettings = useChange(
    (changes: Partial<BudgetSettings>) => api.saveSettings({ spaceId, changes }),
    (budget, changes) => ({ ...budget, ...changes }),
  );

  const addGoal = useChange(
    (goal: BudgetGoal) => api.createGoal({ ...goal, spaceId }),
    (budget, goal) => ({ ...budget, goals: [...budget.goals, goal] }),
  );
  const saveGoal = useChange(api.updateGoal, (budget, { id, ...changes }: Partial<BudgetGoal> & { id: string }) => ({
    ...budget,
    goals: budget.goals.map((goal) => (goal.id === id ? { ...goal, ...changes } : goal)),
  }));
  const removeGoal = useChange(api.deleteGoal, (budget, id: string) => ({
    ...budget,
    goals: budget.goals.filter((goal) => goal.id !== id),
    contributions: budget.contributions.filter((contribution) => contribution.goalId !== id),
  }));
  const addContribution = useChange(api.createContribution, (budget, contribution: GoalContribution) => ({
    ...budget,
    contributions: [contribution, ...budget.contributions],
  }));
  const removeContribution = useChange(api.deleteContribution, (budget, id: string) => ({
    ...budget,
    contributions: budget.contributions.filter((contribution) => contribution.id !== id),
  }));

  const attachReceipt = useChange(api.uploadReceipt, (budget, { entryId }: { entryId: string; image: ReceiptImage }) => ({
    ...budget,
    receiptEntryIds: budget.receiptEntryIds.includes(entryId) ? budget.receiptEntryIds : [...budget.receiptEntryIds, entryId],
  }));
  const removeReceipt = useChange(api.deleteReceipt, (budget, entryId: string) => ({
    ...budget,
    receiptEntryIds: budget.receiptEntryIds.filter((id) => id !== entryId),
  }));

  function recordOccurrence({ schedule, day }: Occurrence, today: string) {
    addEntry.mutate({
      id: crypto.randomUUID(),
      entry: {
        kind: schedule.kind,
        amount: schedule.amount,
        accountId: schedule.accountId,
        toAccountId: schedule.toAccountId,
        categoryId: schedule.categoryId,
        day: recordedDay({ schedule, day }, today),
        note: schedule.name,
        toAmount: null,
        icon: schedule.icon,
      },
      link: { scheduleId: schedule.id, occurrenceDay: day },
    });
  }

  const updateSchedule = (schedule: BudgetSchedule, changes: Partial<ScheduleInput>) => {
    const { id, ...fields } = schedule;
    saveSchedule.mutate({ id, schedule: { ...fields, ...changes } });
  };

  const skipOccurrence = ({ schedule, day }: Occurrence) =>
    updateSchedule(schedule, { skippedDays: [...schedule.skippedDays, day].sort() });

  const pauseSchedule = (schedule: BudgetSchedule, today: string) => updateSchedule(schedule, { pausedFrom: today });

  // Anything that fell due while paused is let go; the schedule picks up from today.
  const resumeSchedule = (schedule: BudgetSchedule, today: string) =>
    updateSchedule(schedule, { pausedFrom: null, activeFrom: today > schedule.startDay ? today : schedule.startDay });

  function deleteEntryWithUndo(entry: BudgetEntry) {
    removeEntry.mutate(entry.id, {
      onSuccess: () =>
        toast('Entry deleted', {
          action: {
            label: 'Undo',
            onClick: () => {
              const { id, createdAt, scheduleId, occurrenceDay, ...fields } = entry;
              const link = scheduleId && occurrenceDay ? { scheduleId, occurrenceDay } : undefined;
              addEntry.mutate({ id, entry: fields, link, createdAt });
            },
          },
        }),
    });
  }

  return {
    addEntry,
    saveEntry,
    deleteEntryWithUndo,
    addAccount,
    saveAccount,
    removeAccount,
    addCategory,
    saveCategory,
    removeCategory,
    saveSettings,
    addGoal,
    saveGoal,
    removeGoal,
    addContribution,
    removeContribution,
    attachReceipt,
    removeReceipt,
    addSchedule,
    saveSchedule,
    removeSchedule,
    recordOccurrence,
    skipOccurrence,
    pauseSchedule,
    resumeSchedule,
  };
}
