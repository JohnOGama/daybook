import { describe, expect, it } from 'vitest';
import { daySummary, openTaskCount, sidebarCounts } from './day-summary';
import { filterTasks } from './filter-tasks';
import type { Task } from './task-types';

function task(id: string, fields: Partial<Task> = {}): Task {
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
    subtasks: [],
    ...fields,
  };
}

const sample = [
  task('draft', { highPriority: true }),
  task('reply'),
  task('fix', {
    status: 'in_progress',
    highPriority: true,
    subtasks: [task('reproduce', { parentId: 'fix' })],
  }),
  task('plan', { finished: true }),
  task('tests', { highPriority: true }),
];

describe('daySummary', () => {
  it('empty day reads 0 percent', () => {
    expect(daySummary([])).toEqual({ total: 0, done: 0, percent: 0, highLeft: 0 });
  });

  it('counts subtasks as tasks and rounds', () => {
    expect(daySummary(sample)).toEqual({ total: 6, done: 1, percent: 17, highLeft: 3 });
  });
});

describe('openTaskCount', () => {
  it('counts unfinished top-level tasks, not their subtasks', () => {
    expect(openTaskCount(sample)).toBe(4);
  });
});

describe('sidebarCounts', () => {
  it('matches the mockup', () => {
    expect(sidebarCounts(sample)).toEqual({ todo: 4, inProgress: 1, onHold: 0, high: 3 });
  });

  it('skips finished tasks', () => {
    expect(sidebarCounts([task('a', { finished: true, highPriority: true })])).toEqual({
      todo: 0,
      inProgress: 0,
      onHold: 0,
      high: 0,
    });
  });
});

describe('filterTasks', () => {
  const noFilter = { statuses: [], high: false };

  it('returns everything when no filter is on', () => {
    expect(filterTasks(sample, noFilter)).toBe(sample);
  });

  it('a matching subtask keeps its parent and drops non-matching siblings', () => {
    const parent = task('p', {
      status: 'on_hold',
      subtasks: [
        task('match', { parentId: 'p', status: 'in_progress' }),
        task('other', { parentId: 'p' }),
      ],
    });
    const [result] = filterTasks([parent], { statuses: ['in_progress'], high: false });
    expect(result.id).toBe('p');
    expect(result.subtasks.map((s) => s.id)).toEqual(['match']);
  });

  it('a matching parent keeps only its matching subtasks', () => {
    const parent = task('p', {
      status: 'in_progress',
      subtasks: [task('other', { parentId: 'p' })],
    });
    const [result] = filterTasks([parent], { statuses: ['in_progress'], high: false });
    expect(result.subtasks).toEqual([]);
  });

  it('filters combine status and high priority', () => {
    const result = filterTasks(sample, { statuses: ['in_progress'], high: true });
    expect(result.map((t) => t.id)).toEqual(['fix']);
    expect(filterTasks(sample, { statuses: ['on_hold'], high: true })).toEqual([]);
  });

  it('accepts any of several statuses', () => {
    const result = filterTasks(sample, { statuses: ['todo', 'in_progress'], high: false });
    expect(result.map((t) => t.id)).toEqual(['draft', 'reply', 'fix', 'tests']);
  });

  it('hides finished tasks while a filter is on', () => {
    const finished = task('done', { finished: true, highPriority: true });
    expect(filterTasks([finished], { statuses: [], high: true })).toEqual([]);
  });
});
