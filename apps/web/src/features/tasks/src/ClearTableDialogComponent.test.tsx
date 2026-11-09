import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ClearTableDialogComponent } from './ClearTableDialogComponent';
import type { Task } from './task-types';

const { removeMany } = vi.hoisted(() => ({ removeMany: vi.fn() }));
vi.mock('../hooks/useTaskMutations', () => ({ useTaskMutations: () => ({ removeMany: { mutate: removeMany } }) }));

const task = (id: string, subtasks: Task[] = []) => ({ id, title: id, subtasks }) as Task;
const tasks = [task('a', [task('a1')]), task('b')];

beforeEach(() => vi.clearAllMocks());

it('says what will move and clears every row once confirmed', async () => {
  render(<ClearTableDialogComponent tasks={tasks} someHidden={false} open onOpenChange={() => {}} />);
  expect(screen.getByRole('alertdialog')).toHaveTextContent('2 tasks and 1 subtask');
  expect(screen.queryByText(/not showing/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Clear table' }));
  expect(removeMany).toHaveBeenCalledWith(['a', 'b']);
});

it('clears nothing when cancelled', async () => {
  render(<ClearTableDialogComponent tasks={tasks} someHidden={false} open onOpenChange={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(removeMany).not.toHaveBeenCalled();
});

it('warns that hidden tasks stay', () => {
  render(<ClearTableDialogComponent tasks={tasks} someHidden open onOpenChange={() => {}} />);
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Tasks that are not showing stay where they are.');
});
