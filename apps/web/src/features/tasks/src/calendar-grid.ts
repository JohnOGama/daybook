import { addDays, localDay } from '@/shared/utils/date-formatter';
import type { Task } from './task-types';

const VISIBLE_ENTRIES = 3;

const mondayIndex = (date: Date) => (date.getDay() + 6) % 7;

function parseMonth(month: string): Date {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber - 1, 1);
}

export function monthGrid(month: string): string[] {
  const first = parseMonth(month);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const cellCount = mondayIndex(first) + last.getDate() + (6 - mondayIndex(last));
  const start = addDays(localDay(first), -mondayIndex(first));
  return Array.from({ length: cellCount }, (_, index) => addDays(start, index));
}

export function dayEntries(tasks: Task[]): { shown: Task[]; more: number } {
  const entries = tasks.flatMap((task) => [task, ...task.subtasks]);
  return {
    shown: entries.slice(0, VISIBLE_ENTRIES),
    more: Math.max(0, entries.length - VISIBLE_ENTRIES),
  };
}

export function dayListHref(day: string, today: string, filters: URLSearchParams): string {
  const query = new URLSearchParams(filters);
  if (day !== today) query.set('day', day);
  return query.size > 0 ? `/list?${query}` : '/list';
}

export function shiftMonth(month: string, amount: number): string {
  const date = parseMonth(month);
  date.setMonth(date.getMonth() + amount);
  return localDay(date).slice(0, 7);
}

export function formatMonthHeading(month: string): string {
  return parseMonth(month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
