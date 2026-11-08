import { expect, it } from 'vitest';
import { dayEntries, dayListHref, formatMonthHeading, monthGrid, shiftMonth } from './calendar-grid';
import type { Task } from './task-types';

function task(id: string, subtasks: Task[] = []): Task {
  return {
    id,
    parentId: null,
    title: id,
    status: 'todo',
    highPriority: false,
    finished: false,
    day: '2026-11-09',
    createdAt: '2026-11-06T10:00:00.000Z',
    subtasks,
  };
}

it('November 2026 starts on a Monday and fills six weeks', () => {
  const grid = monthGrid('2026-11');
  expect([grid[0], grid.at(-1), grid.length]).toEqual(['2026-10-26', '2026-12-06', 42]);
});

it('February 2027 needs exactly four weeks', () => {
  const grid = monthGrid('2027-02');
  expect([grid[0], grid.at(-1), grid.length]).toEqual(['2027-02-01', '2027-02-28', 28]);
});

it('shows three entries, counts subtasks, and reports the rest', () => {
  const sixTaskDay = [task('a'), task('b'), task('c', [task('d')]), task('e'), task('f')];
  const result = dayEntries(sixTaskDay);
  expect(result.shown.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  expect(result.more).toBe(3);
});

it('reports nothing more when three or fewer entries exist', () => {
  expect(dayEntries([task('a')])).toEqual({ shown: [task('a')], more: 0 });
});

it('shifts months across a year end', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  expect(shiftMonth('2027-01', -1)).toBe('2026-12');
});

it('links a day to the list, keeping filters', () => {
  const filters = new URLSearchParams('status=todo');
  expect(dayListHref('2026-11-08', '2026-11-09', filters)).toBe('/list?status=todo&day=2026-11-08');
});

it('links today without pinning the date', () => {
  expect(dayListHref('2026-11-09', '2026-11-09', new URLSearchParams())).toBe('/list');
  expect(dayListHref('2026-11-09', '2026-11-09', new URLSearchParams('high=1'))).toBe('/list?high=1');
});

it('formats the month heading', () => {
  expect(formatMonthHeading('2026-11')).toBe('November 2026');
});
