import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskDeleteDialogComponent } from './TaskDeleteDialogComponent';
import type { Task } from './task-types';

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock('../hooks/useTaskMutations', () => ({ useTaskMutations: () => ({ remove: { mutate: remove } }) }));

const task: Task = {
  id: 't1',
  parentId: null,
  title: 'Task one',
  status: 'todo',
  highPriority: false,
  finished: false,
  day: '2026-11-09',
  plannedDay: '2026-11-09',
  completedOn: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
};

beforeEach(() => vi.clearAllMocks());

it('deletes only after confirming', async () => {
  render(<TaskDeleteDialogComponent task={task} open onOpenChange={() => {}} />);
  const dialog = await screen.findByRole('alertdialog');
  expect(remove).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(remove).toHaveBeenCalledWith('t1');
});

it('Cancel deletes nothing', async () => {
  render(<TaskDeleteDialogComponent task={task} open onOpenChange={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  expect(remove).not.toHaveBeenCalled();
});

it('warns that subtasks go too', async () => {
  render(
    <TaskDeleteDialogComponent task={{ ...task, subtasks: [{ ...task, id: 's1' }] }} open onOpenChange={() => {}} />,
  );
  expect(await screen.findByText(/and its subtasks/)).toBeInTheDocument();
});
