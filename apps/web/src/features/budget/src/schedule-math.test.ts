import { describe, expect, it } from 'vitest';
import type { Budget, BudgetSchedule } from './budget-types';
import {
  describeSchedule,
  dueOccurrences,
  monthlyAmount,
  nextOccurrence,
  occurrencesBetween,
  recordedDay,
  upcomingOccurrences,
} from './schedule-math';

const schedule = (fields: Partial<BudgetSchedule>): BudgetSchedule => ({
  id: 'rent',
  name: 'Rent',
  kind: 'expense',
  amount: 100_000,
  accountId: 'bank',
  toAccountId: null,
  categoryId: null,
  frequency: 'monthly',
  interval: 1,
  monthDays: [],
  startDay: '2026-01-15',
  endDay: null,
  activeFrom: '2026-01-15',
  pausedFrom: null,
  skippedDays: [],
  autoRecord: false,
  isSubscription: false,
  icon: null,
  ...fields,
});

describe('occurrencesBetween', () => {
  it('repeats monthly on the start date by default', () => {
    expect(occurrencesBetween(schedule({}), '2026-01-01', '2026-04-30')).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
  });

  it('handles the 15th and the last day, including February and leap years', () => {
    const pay = schedule({ monthDays: [15, -1], startDay: '2028-01-01', activeFrom: '2028-01-01' });
    expect(occurrencesBetween(pay, '2028-02-01', '2028-03-31')).toEqual(['2028-02-15', '2028-02-29', '2028-03-15', '2028-03-31']);
  });

  it('moves the 31st to the last day of shorter months without doubling up', () => {
    const bill = schedule({ monthDays: [31, -1], startDay: '2026-01-01', activeFrom: '2026-01-01' });
    expect(occurrencesBetween(bill, '2026-02-01', '2026-04-30')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('steps weeks and months by the interval from the start date', () => {
    const fortnightly = schedule({ frequency: 'weekly', interval: 2, startDay: '2026-11-06', activeFrom: '2026-11-06' });
    expect(occurrencesBetween(fortnightly, '2026-11-10', '2026-12-31')).toEqual(['2026-11-20', '2026-12-04', '2026-12-18']);
    const quarterly = schedule({ interval: 3 });
    expect(occurrencesBetween(quarterly, '2026-01-01', '2026-12-31')).toEqual(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']);
  });

  it('keeps a 29 February yearly date on the 28th in other years', () => {
    const yearly = schedule({ frequency: 'yearly', startDay: '2028-02-29', activeFrom: '2028-02-29' });
    expect(occurrencesBetween(yearly, '2028-01-01', '2030-12-31')).toEqual(['2028-02-29', '2029-02-28', '2030-02-28']);
  });

  it('leaves out skipped days, paused stretches and days after the end', () => {
    const daily = schedule({ frequency: 'daily', startDay: '2026-11-01', activeFrom: '2026-11-01', skippedDays: ['2026-11-02'], endDay: '2026-11-05' });
    expect(occurrencesBetween(daily, '2026-10-01', '2026-12-01')).toEqual(['2026-11-01', '2026-11-03', '2026-11-04', '2026-11-05']);
    const paused = schedule({ frequency: 'daily', startDay: '2026-11-01', activeFrom: '2026-11-01', pausedFrom: '2026-11-03' });
    expect(occurrencesBetween(paused, '2026-11-01', '2026-11-30')).toEqual(['2026-11-01', '2026-11-02']);
    const resumed = schedule({ frequency: 'daily', startDay: '2026-11-01', activeFrom: '2026-11-10' });
    expect(occurrencesBetween(resumed, '2026-11-01', '2026-11-11')).toEqual(['2026-11-10', '2026-11-11']);
  });

  it('starts a long-running daily schedule from the requested day without walking every past day', () => {
    const daily = schedule({ frequency: 'daily', startDay: '2000-01-01', activeFrom: '2000-01-01' });
    expect(occurrencesBetween(daily, '2026-11-12', '2026-11-13')).toEqual(['2026-11-12', '2026-11-13']);
  });
});

describe('schedule status', () => {
  const rent = schedule({ id: 'rent', startDay: '2026-09-15', activeFrom: '2026-09-15' });
  const budget: Budget = {
    currency: 'USD',
    lowBalance: 0,
    rates: {},
    accounts: [],
    categories: [],
    schedules: [rent],
    goals: [],
    contributions: [],
    receiptEntryIds: [],
    aiEnabled: false,
    entries: [
      {
        id: 'paid',
        kind: 'expense',
        amount: 100_000,
        accountId: 'bank',
        toAccountId: null,
        categoryId: null,
        day: '2026-09-15',
        note: 'Rent',
        toAmount: null,
        icon: null,
        scheduleId: 'rent',
        occurrenceDay: '2026-09-15',
        createdAt: '',
      },
    ],
  };

  it('finds unrecorded occurrences up to today and the ones ahead', () => {
    expect(dueOccurrences(budget, '2026-11-12').map((occurrence) => occurrence.day)).toEqual(['2026-10-15']);
    expect(upcomingOccurrences(budget, '2026-11-12', 2)).toEqual([]);
    expect(upcomingOccurrences(budget, '2026-11-12', 7).map((occurrence) => occurrence.day)).toEqual(['2026-11-15']);
    expect(nextOccurrence(rent, '2026-11-12')).toBe('2026-11-15');
  });

  it('dates a late recording on its due day and an early one on today', () => {
    expect(recordedDay({ schedule: rent, day: '2026-10-15' }, '2026-11-12')).toBe('2026-10-15');
    expect(recordedDay({ schedule: rent, day: '2026-11-15' }, '2026-11-12')).toBe('2026-11-12');
  });

  it('averages the monthly cost and describes the pattern', () => {
    expect(monthlyAmount(schedule({ monthDays: [15, -1] }))).toBe(200_000);
    expect(monthlyAmount(schedule({ frequency: 'yearly', amount: 12_000 }))).toBe(1_000);
    expect(describeSchedule(schedule({ monthDays: [-1, 15, 1] }))).toBe('Every month on the 1st, 15th and last day');
    expect(describeSchedule(schedule({ frequency: 'weekly', interval: 2, startDay: '2026-11-06' }))).toBe('Every 2 weeks on Friday');
    expect(describeSchedule(schedule({ frequency: 'yearly', startDay: '2026-03-03' }))).toBe('Every year on 3 March');
    expect(describeSchedule(schedule({ frequency: 'daily' }))).toBe('Every day');
  });
});
