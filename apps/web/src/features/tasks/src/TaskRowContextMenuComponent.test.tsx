import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskRowContextMenuComponent } from './TaskRowContextMenuComponent';
import type { Task } from './task-types';

const { copy } = vi.hoisted(() => ({ copy: vi.fn() }));

vi.mock('../hooks/useTaskMutations', () => ({ useTaskMutations: () => ({ copy: { mutate: copy } }) }));

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
  dueDay: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
};

const onOpenForm = vi.fn();
const onDelete = vi.fn();

async function rightClick(row: Task) {
  render(
    <table>
      <tbody>
        <TaskRowContextMenuComponent task={row} onOpenForm={onOpenForm} onDelete={onDelete}>
          <tr>
            <td>the row</td>
          </tr>
        </TaskRowContextMenuComponent>
      </tbody>
    </table>,
  );
  fireEvent.contextMenu(screen.getByText('the row'));
  const items = await screen.findAllByRole('menuitem');
  return items.map((item) => item.textContent);
}

beforeEach(() => vi.clearAllMocks());

it('right-clicking a parent offers Edit, Duplicate and Delete', async () => {
  expect(await rightClick(task)).toEqual(['Edit', 'Duplicate', 'Delete']);
});

it('right-clicking a subtask offers Edit and Delete', async () => {
  expect(await rightClick({ ...task, parentId: 'p1' })).toEqual(['Edit', 'Delete']);
});

it('Edit opens the edit form', async () => {
  await rightClick(task);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  expect(onOpenForm).toHaveBeenCalledWith('edit');
});

it('Duplicate copies the task', async () => {
  await rightClick(task);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  expect(copy).toHaveBeenCalledWith({ id: 't1' });
});

it('Delete asks the row to confirm', async () => {
  await rightClick(task);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(onDelete).toHaveBeenCalled();
});
