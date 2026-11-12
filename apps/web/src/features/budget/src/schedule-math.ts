import { currencyOf, toBase } from './budget-currency';
import type { Budget, BudgetEntry, BudgetSchedule } from './budget-types';

// Dates are plain YYYY-MM-DD strings, worked on in UTC so a daylight-saving change can't shift a day.
const DAY_MS = 86_400_000;
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (time: number) => new Date(time).toISOString().slice(0, 10);
const plusDays = (day: string, amount: number) => toDay(toTime(day) + amount * DAY_MS);
const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY_MS);
const lastDayOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const dayOf = (year: number, month: number, date: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(Math.min(date, lastDayOf(year, month))).padStart(2, '0')}`;
const parts = (day: string) => day.split('-').map(Number) as [number, number, number];
const earliest = (...days: string[]) => days.reduce((a, b) => (a < b ? a : b));
const latest = (...days: string[]) => days.reduce((a, b) => (a > b ? a : b));

function* datesFrom(schedule: BudgetSchedule, from: string, to: string): Generator<string> {
  const { frequency, interval, startDay } = schedule;
  const [startYear, startMonth, startDate] = parts(startDay);

  if (frequency === 'daily' || frequency === 'weekly') {
    const step = interval * (frequency === 'weekly' ? 7 : 1);
    const first = Math.max(0, Math.ceil(daysBetween(startDay, from) / step));
    for (let index = first; ; index++) {
      const day = plusDays(startDay, index * step);
      if (day > to) return;
      yield day;
    }
  }

  const [fromYear, fromMonth] = parts(from);
  const monthsIn = (fromYear - startYear) * 12 + fromMonth - startMonth;
  const stepMonths = interval * (frequency === 'yearly' ? 12 : 1);
  const days = frequency === 'monthly' && schedule.monthDays.length > 0 ? schedule.monthDays : [startDate];
  for (let index = Math.max(0, Math.floor(monthsIn / stepMonths)); ; index++) {
    const monthIndex = startMonth - 1 + index * stepMonths;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    if (dayOf(year, month, 1) > to) return;
    const inMonth = [...new Set(days.map((date) => dayOf(year, month, date === -1 ? 31 : date)))].sort();
    yield* inMonth;
  }
}

// Every day the schedule falls on between from and to (inclusive), minus skipped days and paused or ended stretches.
export function occurrencesBetween(schedule: BudgetSchedule, from: string, to: string): string[] {
  const start = latest(from, schedule.startDay, schedule.activeFrom);
  const limits = [to, schedule.endDay, schedule.pausedFrom && plusDays(schedule.pausedFrom, -1)].filter(Boolean) as string[];
  const end = earliest(...limits);
  if (start > end) return [];
  const skipped = new Set(schedule.skippedDays);
  return [...datesFrom(schedule, start, end)].filter((day) => day >= start && day <= end && !skipped.has(day));
}

export function nextOccurrence(schedule: BudgetSchedule, after: string): string | null {
  const span = { daily: 1, weekly: 7, monthly: 31, yearly: 366 }[schedule.frequency] * schedule.interval;
  return occurrencesBetween(schedule, after, plusDays(after, span * 3 + 1))[0] ?? null;
}

export type Occurrence = { schedule: BudgetSchedule; day: string; entry?: BudgetEntry };

const occurrenceKey = (scheduleId: string, day: string) => `${scheduleId}|${day}`;

export function occurrencesOf(budget: Budget, from: string, to: string): Occurrence[] {
  const recorded = new Map(
    budget.entries.filter((entry) => entry.scheduleId).map((entry) => [occurrenceKey(entry.scheduleId as string, entry.occurrenceDay ?? ''), entry]),
  );
  return budget.schedules
    .flatMap((schedule) =>
      occurrencesBetween(schedule, from, to).map((day) => ({ schedule, day, entry: recorded.get(occurrenceKey(schedule.id, day)) })),
    )
    .sort((a, b) => a.day.localeCompare(b.day) || a.schedule.name.localeCompare(b.schedule.name));
}

// Occurrences up to today that nobody has recorded or skipped yet, oldest first.
export const dueOccurrences = (budget: Budget, today: string) =>
  occurrencesOf(budget, '0000-01-01', today).filter((occurrence) => !occurrence.entry);

export const upcomingOccurrences = (budget: Budget, today: string, days: number) =>
  occurrencesOf(budget, plusDays(today, 1), plusDays(today, days));

// An occurrence recorded late keeps its due date; one paid early is dated the day it's paid.
export const recordedDay = (occurrence: Occurrence, today: string) => earliest(occurrence.day, today);

const isRunning = (schedule: BudgetSchedule, today: string) => !schedule.pausedFrom && (!schedule.endDay || schedule.endDay >= today);

// What a schedule costs or brings in for an average month.
export function monthlyAmount(schedule: BudgetSchedule): number {
  const perMonth = {
    daily: 365.25 / 12,
    weekly: 365.25 / 12 / 7,
    monthly: Math.max(1, schedule.monthDays.length),
    yearly: 1 / 12,
  }[schedule.frequency];
  return Math.round((schedule.amount * perMonth) / schedule.interval);
}

export function monthlyTotals(budget: Budget, today: string) {
  const running = budget.schedules.filter((schedule) => isRunning(schedule, today));
  const total = (schedules: BudgetSchedule[]) =>
    schedules.reduce((sum, schedule) => sum + toBase(budget, monthlyAmount(schedule), currencyOf(budget, schedule.accountId)), 0);
  return {
    bills: total(running.filter((schedule) => schedule.kind === 'expense')),
    subscriptions: total(running.filter((schedule) => schedule.isSubscription)),
    income: total(running.filter((schedule) => schedule.kind === 'income')),
  };
}

const ordinal = (date: number) => {
  const tens = date % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[date % 10] ?? 'th';
  return `${date}${suffix}`;
};

const joinWords = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);

export function describeSchedule(schedule: BudgetSchedule): string {
  const { frequency, interval, startDay } = schedule;
  const start = new Date(toTime(startDay));
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[frequency];
  const every = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
  if (frequency === 'daily') return every;
  if (frequency === 'weekly') return `${every} on ${start.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}`;
  if (frequency === 'yearly') return `${every} on ${start.getUTCDate()} ${start.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })}`;
  const days = schedule.monthDays.length > 0 ? schedule.monthDays : [start.getUTCDate()];
  const sorted = [...days].sort((a, b) => (a === -1 ? 32 : a) - (b === -1 ? 32 : b));
  return `${every} on the ${joinWords(sorted.map((date) => (date === -1 ? 'last day' : ordinal(date))))}`;
}

export { plusDays };
