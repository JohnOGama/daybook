import { addDays, formatShortDay } from '@/shared/utils/date-formatter';

// How close a due date is, for its colour: past and still open, today, within a week, or later.
// A finished task's due date is history, so it never reads as overdue.
export type DueTone = 'overdue' | 'today' | 'soon' | 'later';

export function dueTone(dueDay: string, today: string, finished: boolean): DueTone {
  if (finished) return 'later';
  if (dueDay < today) return 'overdue';
  if (dueDay === today) return 'today';
  return dueDay <= addDays(today, 7) ? 'soon' : 'later';
}

export function dueLabel(dueDay: string, today: string): string {
  if (dueDay === today) return 'Today';
  if (dueDay === addDays(today, 1)) return 'Tomorrow';
  if (dueDay === addDays(today, -1)) return 'Yesterday';
  return formatShortDay(dueDay);
}

export const DUE_TONE_CLASSES: Record<DueTone, string> = {
  overdue: 'text-destructive',
  today: 'text-signal',
  soon: 'text-foreground',
  later: 'text-muted-foreground',
};
