import { expect, it } from 'vitest';
import { applyOrder, moveId, siblingIds } from './task-order';
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
    createdAt: '',
    subtasks,
  };
}

const ids = (tasks: Task[]) => tasks.map((item) => item.id);

it('moves an id down', () => {
  expect(moveId(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
});

it('moves an id up', () => {
  expect(moveId(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
});

it('moves past tasks hidden by a filter by working on the full list', () => {
  expect(moveId(['a', 'hidden', 'b'], 'b', 'a')).toEqual(['b', 'a', 'hidden']);
});

it('finds top-level siblings', () => {
  expect(siblingIds([task('a'), task('b', [task('s')])], 'a')).toEqual(['a', 'b']);
});

it('finds subtask siblings', () => {
  expect(siblingIds([task('a', [task('x'), task('y')]), task('b')], 'y')).toEqual(['x', 'y']);
});

it('reorders top-level tasks', () => {
  expect(ids(applyOrder([task('a'), task('b')], ['b', 'a']))).toEqual(['b', 'a']);
});

it('reorders subtasks inside their parent only', () => {
  const result = applyOrder([task('a', [task('x'), task('y')]), task('b')], ['y', 'x']);
  expect(ids(result)).toEqual(['a', 'b']);
  expect(ids(result[0].subtasks)).toEqual(['y', 'x']);
});

it('keeps tasks the new order does not mention', () => {
  expect(ids(applyOrder([task('a'), task('b'), task('c')], ['c', 'a']))).toEqual(['c', 'a', 'b']);
});

it('leaves a list with none of the ids unchanged', () => {
  expect(ids(applyOrder([task('a'), task('b')], ['z']))).toEqual(['a', 'b']);
});
