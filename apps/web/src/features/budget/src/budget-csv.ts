import { currencyOf } from './budget-currency';
import { accountName, categoryName } from './budget-labels';
import type { Budget, BudgetEntry } from './budget-types';

// A leading quote stops spreadsheets from running a note that starts with = + - or @ as a formula.
function cell(text: string): string {
  const value = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function entriesToCsv(budget: Budget, entries: BudgetEntry[]): string {
  const header = ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Account', 'To account', 'Note'];
  const rows = entries.map((entry) => [
    entry.day,
    entry.kind,
    (entry.amount / 100).toFixed(2),
    currencyOf(budget, entry.accountId),
    entry.kind === 'transfer' ? '' : categoryName(budget, entry.categoryId),
    accountName(budget, entry.accountId),
    entry.kind === 'transfer' ? accountName(budget, entry.toAccountId) : '',
    entry.note,
  ]);
  return toCsv([header, ...rows]);
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(cell).join(',')).join('\n');
}
