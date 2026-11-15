import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskRowMenuComponent } from './TaskRowMenuComponent';
import type { Task } from './task-types';

const { copy, spacesData, active } = vi.hoisted(() => ({
  copy: vi.fn(),
  spacesData: { current: [] as unknown[] },
  active: { current: { id: 'here' } as Record<string, unknown> },
}));

vi.mock('../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({ copy: { mutate: copy } }),
}));
vi.mock('@/features/spaces', () => ({
  useSpaces: () => ({ data: spacesData.current }),
  useActiveSpace: () => active.current,
}));

const baseTask: Task = {
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

const onOpenForm = vi.fn();
const onDelete = vi.fn();

async function openMenu(task: Task) {
  render(<TaskRowMenuComponent task={task} onOpenForm={onOpenForm} onDelete={onDelete} />);
  await userEvent.click(screen.getByRole('button', { name: 'Actions for Task one' }));
  const items = await screen.findAllByRole('menuitem');
  return items.map((item) => item.textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
  active.current = { id: 'here' };
  spacesData.current = [
    { id: 'here', kind: 'space', title: 'Here', tool: 'list' },
    { id: 'folder', kind: 'folder', title: 'Team', tool: null },
    { id: 'there', kind: 'space', title: 'There', tool: 'list' },
  ];
});

it('hides Copy to when the only other space is a notebook', async () => {
  spacesData.current = [
    { id: 'here', kind: 'space', title: 'Here', tool: 'list' },
    { id: 'book', kind: 'space', title: 'Book', tool: 'notebook' },
  ];
  expect(await openMenu(baseTask)).not.toContain('Copy to');
});

it('top-level open task offers every action', async () => {
  expect(await openMenu(baseTask)).toEqual([
    'Edit',
    'Add subtask',
    'Move to another day',
    'Duplicate',
    'Copy to',
    'Delete',
  ]);
});

it('hides Copy to when there is no other space', async () => {
  spacesData.current = [{ id: 'here', kind: 'space', title: 'Here' }];
  expect(await openMenu(baseTask)).toEqual(['Edit', 'Add subtask', 'Move to another day', 'Duplicate', 'Delete']);
});

it('subtask offers Edit, Add subtask and Delete', async () => {
  expect(await openMenu({ ...baseTask, parentId: 'p1' })).toEqual(['Edit', 'Add subtask', 'Delete']);
});

it('finished task does not offer Move to another day', async () => {
  expect(await openMenu({ ...baseTask, finished: true })).not.toContain('Move to another day');
});

it('Edit asks the row to open the edit form', async () => {
  await openMenu(baseTask);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  expect(onOpenForm).toHaveBeenCalledWith('edit');
});

it('Duplicate copies within the same space', async () => {
  await openMenu(baseTask);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  expect(copy).toHaveBeenCalledWith({ id: 't1' });
});

it('Copy to lists the other spaces and copies to the chosen one', async () => {
  await openMenu(baseTask);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Copy to' }));
  const target = await screen.findByRole('menuitem', { name: 'There' });
  expect(screen.queryByRole('menuitem', { name: 'Here' })).not.toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Team' })).not.toBeInTheDocument();
  await userEvent.click(target);
  expect(copy).toHaveBeenCalledWith({ id: 't1', targetSpaceId: 'there' }, expect.anything());
});

it('Delete asks the row to confirm', async () => {
  await openMenu(baseTask);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(onDelete).toHaveBeenCalled();
});

const ACTIONS = ['Edit', 'Add subtask', 'Move to another day', 'Duplicate', 'Copy to', 'Delete'];

async function copyTargets() {
  await openMenu(baseTask);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Copy to' }));
  await screen.findAllByRole('menuitem', { name: /^(Theirs|Mine|Mine too|Other owner|Read only)$/ });
  return screen
    .getAllByRole('menuitem')
    .map((item) => item.textContent ?? '')
    .filter((name) => !ACTIONS.includes(name));
}

const listSpace = (id: string, fields: Record<string, unknown>) => ({
  id,
  kind: 'space',
  title: id,
  tool: 'list',
  ...fields,
});

it("from a shared edit list, Copy to lists only that owner's other editable lists", async () => {
  active.current = { id: 'here', access: 'edit', ownerId: 'u2' };
  spacesData.current = [
    listSpace('here', { access: 'edit', ownerId: 'u2' }),
    listSpace('Theirs', { access: 'edit', ownerId: 'u2' }),
    listSpace('Read only', { access: 'view', ownerId: 'u2' }),
    listSpace('Other owner', { access: 'edit', ownerId: 'u3' }),
    listSpace('Mine', { access: 'owner', ownerId: 'u1' }),
  ];
  expect(await copyTargets()).toEqual(['Theirs']);
});

it('from an owned list, Copy to lists only the other lists the user owns', async () => {
  active.current = { id: 'here', access: 'owner', ownerId: '' };
  spacesData.current = [
    listSpace('here', { access: 'owner', ownerId: '' }),
    listSpace('Mine', { access: 'owner', ownerId: 'u1' }),
    listSpace('Mine too', { access: 'owner', ownerId: '' }),
    listSpace('Theirs', { access: 'edit', ownerId: 'u2' }),
  ];
  expect(await copyTargets()).toEqual(['Mine', 'Mine too']);
});
