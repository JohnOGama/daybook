import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, CreditCard, HandCoins, Landmark, PiggyBank, Smartphone } from 'lucide-react';
import type { AccountType, Budget, BudgetEntry, EntryKind } from './budget-types';

export const ACCOUNT_ICONS: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  bank: Landmark,
  savings: PiggyBank,
  ewallet: Smartphone,
  credit: CreditCard,
  loan: HandCoins,
};

export const ENTRY_ICONS: Record<EntryKind, typeof Banknote> = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
};

export const accountName = (budget: Budget, id: string | null) =>
  budget.accounts.find((account) => account.id === id)?.name ?? 'Deleted account';

export const categoryName = (budget: Budget, id: string | null) =>
  budget.categories.find((category) => category.id === id)?.name ?? 'Uncategorised';

export function entryTitle(budget: Budget, entry: BudgetEntry): string {
  if (entry.note) return entry.note;
  return entry.kind === 'transfer' ? 'Transfer' : categoryName(budget, entry.categoryId);
}


export function entryDetail(budget: Budget, entry: BudgetEntry): string {
  if (entry.kind === 'transfer') return `${accountName(budget, entry.accountId)} → ${accountName(budget, entry.toAccountId)}`;
  const account = accountName(budget, entry.accountId);
  return entry.note ? `${categoryName(budget, entry.categoryId)} · ${account}` : account;
}

// Income adds, spending subtracts; a transfer shows its plain amount because the total doesn't change.
export const signedAmount = (entry: BudgetEntry) =>
  entry.kind === 'income' ? entry.amount : entry.kind === 'expense' ? -entry.amount : 0;

// Green for money coming in, soft red for money going out; zero and transfers stay neutral.
export const moneyTone = (cents: number) => (cents > 0 ? 'text-money-in' : cents < 0 ? 'text-money-out' : undefined);

const normalise = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

// The category used last time for an entry with the same note, so "Coffee" lands where it did before.
export function categoryFromHistory(budget: Budget, note: string, kind: EntryKind): string | null {
  const wanted = normalise(note);
  if (wanted.length < 2) return null;
  const exists = (id: string | null) => budget.categories.some((category) => category.id === id && category.kind === kind);
  const fromEntry = budget.entries.find((entry) => entry.kind === kind && exists(entry.categoryId) && normalise(entry.note) === wanted);
  const fromSchedule = budget.schedules.find((schedule) => schedule.kind === kind && exists(schedule.categoryId) && normalise(schedule.name) === wanted);
  return fromEntry?.categoryId ?? fromSchedule?.categoryId ?? null;
}
