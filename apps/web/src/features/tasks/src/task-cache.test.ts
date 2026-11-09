import { describe, expect, it } from 'vitest';
import {
  buildCopy,
  buildTask,
  findFamily,
  upsertTask,
  withDay,
  withFields,
  withFinished,
  withoutSubtask,
  withSubtask,
} from './task-cache';
import type { Task } from './task-types';

const today = '2026-11-09';
const range = { from: today, to: today };

function task(id: string, fields: Partial<Task> = {}): Task {
  return {
    id,
    parentId: null,
    title: id,
    status: 'todo',
    highPriority: false,
    finished: false,
    day: today,
    plannedDay: today,
    completedOn: null,
    createdAt: '',
    subtasks: [],
    ...fields,
  };
}

const sub = (id: string, fields: Partial<Task> = {}) => task(id, { parentId: 'p', plannedDay: null, ...fields });

describe('deep nesting', () => {
  const tree = (leaves: Task[] = [sub('leaf', { parentId: 'mid' })]) =>
    task('p', { subtasks: [sub('mid', { subtasks: leaves })] });
  const states = (root: Task) => [root.finished, root.subtasks[0].finished, root.subtasks[0].subtasks[0]?.finished];

  it('finds a family from its deepest task', () => {
    expect(findFamily([tree()], 'leaf')?.id).toBe('p');
  });

  it('finishing the last leaf finishes every parent', () => {
    expect(states(withFinished(tree(), 'leaf', true, today))).toEqual([true, true, true]);
  });

  it('stops going up at a parent with other open work', () => {
    const root = task('p', { subtasks: [tree().subtasks[0], sub('other')] });
    expect(states(withFinished(root, 'leaf', true, today))).toEqual([false, true, true]);
  });

  it('finishing the root finishes everything under it', () => {
    expect(states(withFinished(tree(), 'p', true, today))).toEqual([true, true, true]);
  });

  it('reopening a leaf reopens its parents and moves the family back to its day', () => {
    const finished = withFinished(tree(), 'p', true, '2026-11-12');
    const reopened = withFinished(finished, 'leaf', false, '2026-11-12');
    expect(states(reopened)).toEqual([false, false, false]);
    expect(reopened.subtasks[0].subtasks[0].day).toBe('2026-11-12');
  });

  it('adds a subtask at any depth and reopens the chain', () => {
    const finished = withFinished(tree(), 'p', true, today);
    const next = withSubtask(finished, sub('new', { parentId: 'leaf' }), today);
    expect(states(next)).toEqual([false, false, false]);
    expect(next.subtasks[0].subtasks[0].subtasks[0].id).toBe('new');
  });

  it('removing the last open leaf finishes the parents', () => {
    const root = tree([sub('leaf', { parentId: 'mid' }), sub('done', { parentId: 'mid', finished: true })]);
    const next = withoutSubtask(root, 'leaf', today);
    expect([next.finished, next.subtasks[0].finished]).toEqual([true, true]);
  });

  it('renames at any depth', () => {
    expect(withFields(tree(), 'leaf', { title: 'New' }).subtasks[0].subtasks[0].title).toBe('New');
  });

  it('copies the whole tree with new ids', () => {
    const copy = buildCopy(tree(), { p: 'p2', mid: 'mid2', leaf: 'leaf2' }, true, today);
    expect(copy.subtasks[0]).toMatchObject({ id: 'mid2', parentId: 'p2' });
    expect(copy.subtasks[0].subtasks[0]).toMatchObject({ id: 'leaf2', parentId: 'mid2' });
  });
});

describe('findFamily', () => {
  const list = [task('a'), task('p', { subtasks: [sub('s')] })];

  it('finds a top-level task', () => expect(findFamily(list, 'a')?.id).toBe('a'));
  it('finds the parent of a subtask', () => expect(findFamily(list, 's')?.id).toBe('p'));
  it('returns nothing for an unknown id', () => expect(findFamily(list, 'z')).toBeUndefined());
});

describe('upsertTask', () => {
  it('replaces a task in place', () => {
    const result = upsertTask([task('a'), task('b')], range, task('a', { title: 'new' }));
    expect(result.map((t) => t.title)).toEqual(['new', 'b']);
  });

  it('appends a task new to this range', () => {
    expect(upsertTask([task('a')], range, task('b')).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('removes a task that left this range', () => {
    expect(upsertTask([task('a')], range, task('a', { day: '2026-11-20' }))).toEqual([]);
  });

  it('ignores a task that was never in this range', () => {
    const list = [task('a')];
    expect(upsertTask(list, range, task('b', { day: '2026-11-20' }))).toBe(list);
  });
});

describe('withFields', () => {
  it('changes the task itself', () => {
    expect(withFields(task('a'), 'a', { title: 'x', status: 'on_hold' })).toMatchObject({ title: 'x', status: 'on_hold' });
  });

  it('changes only the matching subtask', () => {
    const result = withFields(task('p', { subtasks: [sub('s'), sub('t')] }), 's', { highPriority: true });
    expect(result.subtasks.map((s) => s.highPriority)).toEqual([true, false]);
    expect(result.highPriority).toBe(false);
  });
});

describe('withFinished', () => {
  it('finishing a task moves it to today and finishes its subtasks', () => {
    const family = task('p', { day: '2026-11-20', plannedDay: '2026-11-20', subtasks: [sub('s')] });
    const result = withFinished(family, 'p', true, today);
    expect(result).toMatchObject({ finished: true, day: today });
    expect(result.subtasks[0]).toMatchObject({ finished: true, day: today });
  });

  it('reopening puts a task back on its planned day and sets To do', () => {
    const family = task('p', { finished: true, day: today, plannedDay: '2026-11-20', status: 'in_progress' });
    expect(withFinished(family, 'p', false, today)).toMatchObject({
      finished: false,
      day: '2026-11-20',
      status: 'todo',
    });
  });

  it('reopening a task planned in the past puts it on today', () => {
    const family = task('p', { finished: true, day: '2026-11-05', plannedDay: '2026-11-05' });
    expect(withFinished(family, 'p', false, today).day).toBe(today);
  });

  it('reopening a task reopens its subtasks', () => {
    const family = task('p', { finished: true, subtasks: [sub('s', { finished: true })] });
    expect(withFinished(family, 'p', false, today).subtasks[0].finished).toBe(false);
  });

  it('finishing the last open subtask finishes the parent', () => {
    const family = task('p', { subtasks: [sub('s', { finished: true }), sub('t')] });
    expect(withFinished(family, 't', true, today).finished).toBe(true);
  });

  it('stamps today when finishing and keeps a subtask finished earlier', () => {
    const family = task('p', { subtasks: [sub('s', { finished: true, completedOn: '2026-11-05' }), sub('t')] });
    const result = withFinished(family, 'p', true, today);
    expect(result.completedOn).toBe(today);
    expect(result.subtasks.map((s) => s.completedOn)).toEqual(['2026-11-05', today]);
  });

  it('clears the completed date when reopening', () => {
    const family = task('p', {
      finished: true,
      completedOn: today,
      subtasks: [sub('s', { finished: true, completedOn: today })],
    });
    const result = withFinished(family, 'p', false, today);
    expect(result.completedOn).toBeNull();
    expect(result.subtasks[0].completedOn).toBeNull();
  });

  it('stays open while another subtask is open', () => {
    const family = task('p', { subtasks: [sub('s'), sub('t')] });
    expect(withFinished(family, 's', true, today).finished).toBe(false);
  });

  it('unticking a subtask reopens a finished parent', () => {
    const family = task('p', { finished: true, subtasks: [sub('s', { finished: true })] });
    const result = withFinished(family, 's', false, today);
    expect(result.finished).toBe(false);
    expect(result.subtasks[0].finished).toBe(false);
  });

  it('leaves the status alone when unticking something already open', () => {
    expect(withFinished(task('p', { status: 'on_hold' }), 'p', false, today).status).toBe('on_hold');
  });
});

describe('withDay', () => {
  it('moves a task and its subtasks to a future day', () => {
    const result = withDay(task('p', { subtasks: [sub('s')] }), '2026-11-20', today);
    expect(result).toMatchObject({ day: '2026-11-20', plannedDay: '2026-11-20' });
    expect(result.subtasks[0].day).toBe('2026-11-20');
  });

  it('a task moved into the past appears on today', () => {
    expect(withDay(task('p'), '2026-11-01', today)).toMatchObject({ day: today, plannedDay: '2026-11-01' });
  });
});

describe('subtasks', () => {
  it('adding a subtask appends it', () => {
    expect(withSubtask(task('p'), sub('s'), today).subtasks.map((s) => s.id)).toEqual(['s']);
  });

  it('adding a subtask reopens a finished parent', () => {
    expect(withSubtask(task('p', { finished: true }), sub('s'), today).finished).toBe(false);
  });

  it('removing the last open subtask finishes the parent', () => {
    const family = task('p', { subtasks: [sub('s', { finished: true }), sub('t')] });
    expect(withoutSubtask(family, 't', today).finished).toBe(true);
  });

  it('removing the only subtask leaves the parent alone', () => {
    expect(withoutSubtask(task('p', { subtasks: [sub('s')] }), 's', today).finished).toBe(false);
  });
});

describe('buildTask', () => {
  it('builds an unfinished task, placing a past day on today', () => {
    const built = buildTask({ id: 'n', title: ' New ', day: '2026-11-01', status: 'todo', highPriority: true }, today);
    expect(built).toMatchObject({ id: 'n', title: 'New', day: today, plannedDay: '2026-11-01', finished: false, subtasks: [] });
  });
});

describe('buildCopy', () => {
  const family = task('p', {
    title: 'Plan',
    status: 'on_hold',
    highPriority: true,
    subtasks: [sub('s', { finished: true, status: 'in_progress' }), sub('t', { status: 'on_hold' })],
  });
  const newIds = { p: 'p2', s: 's2', t: 't2' };

  it('copies within a space with a marked title and new ids', () => {
    const copy = buildCopy(family, newIds, true, today);
    expect(copy).toMatchObject({ id: 'p2', title: 'Plan (copy)', status: 'on_hold', highPriority: true, finished: false });
    expect(copy.subtasks.map((s) => s.id)).toEqual(['s2', 't2']);
    expect(copy.subtasks.every((s) => s.parentId === 'p2')).toBe(true);
  });

  it('keeps the title when copying to another space', () => {
    expect(buildCopy(family, newIds, false, today).title).toBe('Plan');
  });

  it('resets finished subtasks and keeps open ones', () => {
    const [first, second] = buildCopy(family, newIds, true, today).subtasks;
    expect(first).toMatchObject({ finished: false, status: 'todo' });
    expect(second).toMatchObject({ finished: false, status: 'on_hold' });
  });

  it('stays within 200 characters', () => {
    expect(buildCopy({ ...family, title: 'a'.repeat(200) }, newIds, true, today).title).toHaveLength(200);
  });
});
