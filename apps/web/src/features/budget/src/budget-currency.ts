import type { Budget, BudgetEntry } from './budget-types';

// Each account keeps money in its own currency; totals, budgets and reports use the budget's currency.
export const currencyOf = (budget: Budget, accountId: string | null) =>
  budget.accounts.find(({ id }) => id === accountId)?.currency ?? budget.currency;

// ponytail: today's hand-set rate converts every past entry too; store a rate per entry if history must be exact
export function toBase(budget: Budget, cents: number, currency: string): number {
  return currency === budget.currency ? cents : Math.round(cents * (budget.rates[currency] ?? 1));
}

export function fromBase(budget: Budget, cents: number, currency: string): number {
  return currency === budget.currency ? cents : Math.round(cents / (budget.rates[currency] ?? 1));
}

// What a transfer put into the receiving account, in that account's currency.
export function receivedAmount(budget: Budget, entry: Pick<BudgetEntry, 'amount' | 'accountId' | 'toAccountId' | 'toAmount'>): number {
  if (entry.toAmount) return entry.toAmount;
  const from = currencyOf(budget, entry.accountId);
  const to = currencyOf(budget, entry.toAccountId);
  return from === to ? entry.amount : fromBase(budget, toBase(budget, entry.amount, from), to);
}

export const hasForeignAccounts = (budget: Budget) =>
  budget.accounts.some(({ currency }) => currency !== null && currency !== budget.currency);

const converted = new WeakMap<Budget, BudgetEntry[]>();

// The entries with every amount in the budget's currency, for adding up across accounts.
export function baseEntries(budget: Budget): BudgetEntry[] {
  if (!hasForeignAccounts(budget)) return budget.entries;
  let entries = converted.get(budget);
  if (!entries) {
    entries = budget.entries.map((entry) => ({ ...entry, amount: toBase(budget, entry.amount, currencyOf(budget, entry.accountId)) }));
    converted.set(budget, entries);
  }
  return entries;
}

export const totalInBase = (budget: Budget, balances: Map<string, number>, accountIds?: Iterable<string>) =>
  [...(accountIds ?? balances.keys())].reduce((sum, id) => sum + toBase(budget, balances.get(id) ?? 0, currencyOf(budget, id)), 0);
