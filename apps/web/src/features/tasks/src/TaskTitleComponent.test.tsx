import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskTitleComponent } from './TaskTitleComponent';
import type { Task } from './task-types';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({ update: { mutate, isPending: false } }),
}));

const task: Task = {
  id: 't1',
  parentId: null,
  title: 'Old name',
  status: 'todo',
  highPriority: false,
  finished: false,
  day: '2026-11-09',
  plannedDay: '2026-11-09',
  completedOn: null,
  dueDay: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
};

async function startEditing() {
  render(<TaskTitleComponent task={task} finished={false} />);
  await userEvent.dblClick(screen.getByText('Old name'));
  return screen.getByRole('textbox', { name: 'Title of Old name' });
}

beforeEach(() => vi.clearAllMocks());

it('does not start editing on a single click', async () => {
  render(<TaskTitleComponent task={task} finished={false} />);
  await userEvent.click(screen.getByText('Old name'));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('double-click opens the title for editing, focused', async () => {
  const input = await startEditing();
  expect(input).toHaveValue('Old name');
  expect(input).toHaveFocus();
});

it('Enter saves the trimmed title once and closes', async () => {
  const input = await startEditing();
  await userEvent.clear(input);
  await userEvent.type(input, '  New name  {Enter}');
  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate).toHaveBeenCalledWith({ id: 't1', input: { title: 'New name' } });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('clicking away saves', async () => {
  const input = await startEditing();
  await userEvent.type(input, ' two');
  await userEvent.tab();
  expect(mutate).toHaveBeenCalledWith({ id: 't1', input: { title: 'Old name two' } });
});

it('Escape cancels without saving', async () => {
  const input = await startEditing();
  await userEvent.type(input, ' two{Escape}');
  expect(mutate).not.toHaveBeenCalled();
  expect(screen.getByText('Old name')).toBeInTheDocument();
});

it('a blank title keeps the old one', async () => {
  const input = await startEditing();
  await userEvent.clear(input);
  await userEvent.keyboard('{Enter}');
  expect(mutate).not.toHaveBeenCalled();
  expect(screen.getByText('Old name')).toBeInTheDocument();
});

it('an unchanged title saves nothing', async () => {
  await startEditing();
  await userEvent.keyboard('{Enter}');
  expect(mutate).not.toHaveBeenCalled();
});

it('limits the title to 200 characters', async () => {
  const input = await startEditing();
  expect(input).toHaveAttribute('maxlength', '200');
});
