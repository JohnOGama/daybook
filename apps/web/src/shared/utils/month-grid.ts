import { addDays, localDay } from './date-formatter';

const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;

function parseMonth(month: string): Date {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1);
}

// Every day a month calendar shows for `month` (YYYY-MM): whole weeks, Monday first.
export function monthGrid(month: string): string[] {
  const first = parseMonth(month);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const cellCount = mondayIndex(first) + last.getDate() + (6 - mondayIndex(last));
  const start = addDays(localDay(first), -mondayIndex(first));
  return Array.from({ length: cellCount }, (_, index) => addDays(start, index));
}

export function shiftMonth(month: string, amount: number): string {
  const date = parseMonth(month);
  date.setMonth(date.getMonth() + amount);
  return localDay(date).slice(0, 7);
}

export function formatMonthHeading(month: string): string {
  return parseMonth(month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
