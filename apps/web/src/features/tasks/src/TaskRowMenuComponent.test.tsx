import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskRowMenuComponent } from './TaskRowMenuComponent';
import type { Task } from './task-types';

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock('../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({ remove: { mutate: remove } }),
}));

const baseTask: Task = {
  id: 't1',
  parentId: null,
  title: 'Task one',
  status: 'todo',
  highPriority: false,
  finished: false,
  day: '2026-11-09',
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
};

const onOpenForm = vi.fn();

async function openMenu(task: Task) {
  render(<TaskRowMenuComponent task={task} onOpenForm={onOpenForm} />);
  await userEvent.click(screen.getByRole('button', { name: 'Actions for Task one' }));
  const items = await screen.findAllByRole('menuitem');
  return items.map((item) => item.textContent);
}

beforeEach(() => vi.clearAllMocks());

it('top-level open task offers Edit, Add subtask, Move to another day, Delete', async () => {
  expect(await openMenu(baseTask)).toEqual(['Edit', 'Add subtask', 'Move to another day', 'Delete']);
});

it('subtask offers only Edit and Delete', async () => {
  expect(await openMenu({ ...baseTask, parentId: 'p1' })).toEqual(['Edit', 'Delete']);
});

it('finished task does not offer Move to another day', async () => {
  expect(await openMenu({ ...baseTask, finished: true })).toEqual(['Edit', 'Add subtask', 'Delete']);
});

it('Edit asks the row to open the edit form', async () => {
  await openMenu(baseTask);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  expect(onOpenForm).toHaveBeenCalledWith('edit');
});

it('Delete asks for confirmation before calling remove', async () => {
  await openMenu(baseTask);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(remove).not.toHaveBeenCalled();
  const dialog = await screen.findByRole('alertdialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(remove).toHaveBeenCalledWith('t1');
});
