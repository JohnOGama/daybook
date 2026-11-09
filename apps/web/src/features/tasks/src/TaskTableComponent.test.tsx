import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { keepRowInTable, TaskTableComponent } from './TaskTableComponent';
import type { Task } from './task-types';

vi.mock('../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({ reorder: { mutate: vi.fn() }, setFinished: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock('./TaskRowContextMenuComponent', () => ({
  TaskRowContextMenuComponent: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./TaskRowMenuComponent', () => ({ TaskRowMenuComponent: () => null }));
vi.mock('./TaskFormDialogComponent', () => ({ TaskFormDialogComponent: () => null }));
vi.mock('./TaskDeleteDialogComponent', () => ({ TaskDeleteDialogComponent: () => null }));
vi.mock('./TaskTitleComponent', () => ({ TaskTitleComponent: () => null }));
vi.mock('./StatusPillComponent', () => ({ StatusPillComponent: () => null }));
vi.mock('./PriorityPillComponent', () => ({ PriorityPillComponent: () => null }));

const task = (id: string, fields: Partial<Task> = {}): Task => ({
  id,
  parentId: null,
  title: id,
  status: 'todo',
  highPriority: false,
  finished: false,
  day: '2026-11-09',
  plannedDay: '2026-11-09',
  completedOn: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
  ...fields,
});

const renderTable = (tasks: Task[]) => render(<TaskTableComponent tasks={tasks} allTasks={tasks} />);
const handle = (title: string) => screen.queryByRole('button', { name: `Reorder ${title}` });

it('has no drag handle for an only task', () => {
  renderTable([task('a')]);
  expect(handle('a')).not.toBeInTheDocument();
});

it('has drag handles when tasks can swap places', () => {
  renderTable([task('a'), task('b')]);
  expect(handle('a')).toBeInTheDocument();
  expect(handle('b')).toBeInTheDocument();
});

it('counts subtasks only against their own siblings', () => {
  renderTable([
    task('a', { subtasks: [task('a1', { parentId: 'a' })] }),
    task('b', { subtasks: [task('b1', { parentId: 'b' }), task('b2', { parentId: 'b' })] }),
  ]);
  expect(handle('a')).toBeInTheDocument();
  expect(handle('a1')).not.toBeInTheDocument();
  expect(handle('b1')).toBeInTheDocument();
});

it('shows the completed date, or a dash when the task is open', () => {
  renderTable([task('a', { finished: true, completedOn: '2026-11-09' }), task('b')]);
  const completedCell = (row: number) => screen.getAllByRole('row')[row].querySelectorAll('td')[6].textContent;
  expect(screen.getByRole('columnheader', { name: /Completed at/ })).toBeInTheDocument();
  expect(completedCell(1)).toBe('9 Nov');
  expect(completedCell(2)).toBe('-');
});

const clampY = (y: number) =>
  keepRowInTable({
    transform: { x: 30, y, scaleX: 1, scaleY: 1 },
    draggingNodeRect: { top: 100, bottom: 146 },
    containerNodeRect: { top: 54, bottom: 192 },
  } as Parameters<typeof keepRowInTable>[0]);

it('keeps a dragged row inside the table and on its vertical axis', () => {
  expect(clampY(20)).toMatchObject({ x: 0, y: 20 });
  expect(clampY(500)).toMatchObject({ x: 0, y: 46 });
  expect(clampY(-500)).toMatchObject({ x: 0, y: -46 });
});
