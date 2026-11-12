import { expect, it } from 'vitest';
import { addDays, formatDayHeading, formatShortDate, localDay, relativeDayLabel } from './date-formatter';

it('formats the day heading', () => {
  expect(formatDayHeading('2026-11-09')).toBe('Monday, 9 November');
});

it('adds days across a month end', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
});

it('adds days across a clock change', () => {
  expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
});

it('subtracts days', () => {
  expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
});

it('reads the local date late in the evening', () => {
  expect(localDay(new Date(2026, 10, 9, 23, 59))).toBe('2026-11-09');
});

it('formats a created time as a short date', () => {
  expect(formatShortDate(new Date(2026, 10, 6, 12).toISOString())).toBe('6 Nov');
});

it('names nearby days and dates the rest', () => {
  expect(relativeDayLabel('2026-11-12', '2026-11-12')).toBe('Today');
  expect(relativeDayLabel('2026-11-11', '2026-11-12')).toBe('Yesterday');
  expect(relativeDayLabel('2026-11-13', '2026-11-12')).toBe('Tomorrow');
  expect(relativeDayLabel('2026-11-10', '2026-11-12')).toBe('Tue, 10 Nov');
  expect(relativeDayLabel('2026-11-01', '2026-10-31')).toBe('Tomorrow');
});
