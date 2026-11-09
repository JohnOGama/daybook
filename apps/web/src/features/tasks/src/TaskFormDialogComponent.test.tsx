import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskFormDialogComponent } from './TaskFormDialogComponent';
import type { Task } from './task-types';

const { create, createMany, createSubtask, update } = vi.hoisted(() => ({
  create: vi.fn(async () => undefined),
  createMany: vi.fn(async () => undefined),
  createSubtask: vi.fn(async () => undefined),
  update: vi.fn(async () => undefined),
}));

vi.mock('../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({
    create: { mutateAsync: create },
    createMany: { mutateAsync: createMany },
    createSubtask: { mutateAsync: createSubtask },
    update: { mutateAsync: update },
  }),
}));

const task: Task = {
  id: 't1',
  parentId: null,
  title: 'Task one',
  status: 'in_progress',
  highPriority: true,
  finished: false,
  day: '2026-11-09',
  plannedDay: '2026-11-09',
  completedOn: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
};

const onOpenChange = vi.fn();

beforeEach(() => vi.clearAllMocks());

it('pasting a list into the title previews it and creates it all at once', async () => {
  render(<TaskFormDialogComponent mode="new" defaultDay="2026-11-20" open onOpenChange={onOpenChange} />);
  await userEvent.click(screen.getByLabelText('Title'));
  await userEvent.paste('- [ ] One\n    - [ ] Under one\n- [ ] Two');
  expect(screen.getByRole('heading', { name: 'Paste tasks' })).toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'Preview' })).toHaveTextContent('Under one');
  await userEvent.click(screen.getByRole('button', { name: 'Create 2 tasks and 1 subtask' }));
  expect(createMany).toHaveBeenCalledWith({
    day: '2026-11-20',
    list: [
      { title: 'One', subtasks: ['Under one'] },
      { title: 'Two', subtasks: [] },
    ],
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it('pasting a single line stays an ordinary title', async () => {
  render(<TaskFormDialogComponent mode="new" defaultDay="2026-11-20" open onOpenChange={onOpenChange} />);
  await userEvent.click(screen.getByLabelText('Title'));
  await userEvent.paste('Just one');
  expect(screen.getByLabelText('Title')).toHaveValue('Just one');
});

it('a list pasted while editing is not turned into tasks', async () => {
  render(<TaskFormDialogComponent mode="edit" task={task} defaultDay="2026-11-20" open onOpenChange={onOpenChange} />);
  await userEvent.click(screen.getByLabelText('Title'));
  await userEvent.paste('One\nTwo');
  expect(screen.queryByRole('heading', { name: 'Paste tasks' })).not.toBeInTheDocument();
});

it('the paste link opens an empty list that cannot be saved yet', async () => {
  render(<TaskFormDialogComponent mode="new" defaultDay="2026-11-20" open onOpenChange={onOpenChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Paste a list instead' }));
  expect(screen.getByLabelText('List')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
});

it('new mode creates a task on the default day and closes', async () => {
  render(<TaskFormDialogComponent mode="new" defaultDay="2026-11-20" open onOpenChange={onOpenChange} />);
  await userEvent.type(screen.getByLabelText('Title'), 'Buy milk');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(create).toHaveBeenCalledWith({
    title: 'Buy milk',
    day: '2026-11-20',
    status: 'todo',
    highPriority: false,
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it('will not save a blank title', () => {
  render(<TaskFormDialogComponent mode="new" defaultDay="2026-11-20" open onOpenChange={onOpenChange} />);
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

it('edit mode starts from the task and has no day field', async () => {
  render(
    <TaskFormDialogComponent mode="edit" task={task} defaultDay="2026-11-09" open onOpenChange={onOpenChange} />,
  );
  expect(screen.getByLabelText('Title')).toHaveValue('Task one');
  expect(screen.queryByLabelText('Day')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(update).toHaveBeenCalledWith({
    id: 't1',
    input: { title: 'Task one', status: 'in_progress', highPriority: true },
  });
});

it('move mode changes only the day', async () => {
  render(
    <TaskFormDialogComponent mode="move" task={task} defaultDay="2026-11-09" open onOpenChange={onOpenChange} />,
  );
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(update).toHaveBeenCalledWith({ id: 't1', input: { day: '2026-11-09' } });
});

it('subtask mode adds a subtask to the task', async () => {
  render(
    <TaskFormDialogComponent mode="subtask" task={task} defaultDay="2026-11-09" open onOpenChange={onOpenChange} />,
  );
  await userEvent.type(screen.getByLabelText('Title'), 'Child');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(createSubtask).toHaveBeenCalledWith({
    parentId: 't1',
    input: { title: 'Child', status: 'todo', highPriority: false },
  });
});

it('stays open when saving fails', async () => {
  create.mockRejectedValueOnce(new Error('nope'));
  render(<TaskFormDialogComponent mode="new" defaultDay="2026-11-20" open onOpenChange={onOpenChange} />);
  await userEvent.type(screen.getByLabelText('Title'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onOpenChange).not.toHaveBeenCalled();
});
