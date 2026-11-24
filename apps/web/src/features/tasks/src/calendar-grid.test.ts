import { expect, it } from 'vitest';
import { dayListHref, formatMonthHeading, monthGrid, shiftMonth, taskSpan, weekLayout } from './calendar-grid';
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
    plannedDay: '2026-11-09',
    completedOn: null,
    dueDay: null,
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

const week = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

function spanning(id: string, plannedDay: string, day: string, fields: Partial<Task> = {}): Task {
  return { ...task(id), plannedDay, day, createdAt: `${plannedDay}T12:00:00.000Z`, ...fields };
}

const placed = (tasks: Task[]) =>
  weekLayout(week, tasks).entries.map(({ task: entry, ...rest }) => ({ id: entry.id, ...rest }));

it('an open carried-over task spans from its planned day to today', () => {
  expect(taskSpan(spanning('m', '2026-11-18', '2026-11-21'))).toEqual({ start: '2026-11-18', end: '2026-11-21' });
});

it('a task created after its planned day starts on its created day', () => {
  const late = spanning('m', '2026-11-16', '2026-11-21', { createdAt: '2026-11-19T12:00:00.000Z' });
  expect(taskSpan(late)).toEqual({ start: '2026-11-19', end: '2026-11-21' });
});

it('a finished task ends on the day it was finished', () => {
  const done = spanning('m', '2026-11-18', '2026-11-20', { finished: true, completedOn: '2026-11-20' });
  expect(taskSpan(done)).toEqual({ start: '2026-11-18', end: '2026-11-20' });
});

it('a task finished before its planned day is a single day', () => {
  const early = spanning('m', '2026-11-25', '2026-11-20', {
    finished: true,
    completedOn: '2026-11-20',
    dueDay: null,
    createdAt: '2026-11-10T12:00:00.000Z',
  });
  expect(taskSpan(early)).toEqual({ start: '2026-11-20', end: '2026-11-20' });
});

it('an overdue task with carry-over off stays on its planned day', () => {
  const overdue = spanning('m', '2026-11-18', '2026-11-18', { createdAt: '2026-11-10T12:00:00.000Z' });
  expect(taskSpan(overdue)).toEqual({ start: '2026-11-18', end: '2026-11-18' });
});

it('places a four-day task as one entry', () => {
  expect(placed([spanning('m', '2026-11-18', '2026-11-21')])).toEqual([
    { id: 'm', line: 0, column: 2, span: 4, days: 4, openStart: false, openEnd: false },
  ]);
});

it('cuts a span at both week edges', () => {
  expect(placed([spanning('m', '2026-11-12', '2026-11-25')])).toEqual([
    { id: 'm', line: 0, column: 0, span: 7, days: 14, openStart: true, openEnd: true },
  ]);
});

it('puts subtasks as one-day chips right after their parent on its day', () => {
  const parent = { ...spanning('p', '2026-11-18', '2026-11-18'), subtasks: [task('s')] };
  expect(placed([parent]).map(({ id, line, column, span }) => [id, line, column, span])).toEqual([
    ['p', 0, 2, 1],
    ['s', 1, 2, 1],
  ]);
});

it('never overlaps entries on a line and counts the rest per day', () => {
  const four = ['a', 'b', 'c', 'd'].map((id) => spanning(id, '2026-11-17', '2026-11-19'));
  const { entries, more } = weekLayout(week, four);
  expect(entries.map((entry) => entry.line)).toEqual([0, 1, 2]);
  expect(more).toEqual([0, 1, 1, 1, 0, 0, 0]);
});

it('reuses a free line for a later task', () => {
  const tasks = [
    spanning('a', '2026-11-16', '2026-11-17'),
    spanning('b', '2026-11-17', '2026-11-18'),
    spanning('c', '2026-11-19', '2026-11-19'),
  ];
  expect(placed(tasks).map(({ id, line }) => [id, line])).toEqual([
    ['a', 0],
    ['b', 1],
    ['c', 0],
  ]);
});

it('leaves out tasks that do not touch the week', () => {
  expect(placed([spanning('m', '2026-11-01', '2026-11-05')])).toEqual([]);
});

it('hides a subtask whose multi-day parent is hidden, and counts it', () => {
  const full = ['a', 'b', 'c'].map((id) => spanning(id, '2026-11-16', '2026-11-17'));
  const parent = { ...spanning('p', '2026-11-17', '2026-11-19'), subtasks: [task('s')] };
  const { entries, more } = weekLayout(week, [...full, parent]);
  expect(entries.map((entry) => entry.task.id)).toEqual(['a', 'b', 'c']);
  expect(more).toEqual([0, 1, 1, 2, 0, 0, 0]);
});
