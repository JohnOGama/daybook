import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const deepTask = () =>
  task('a', {
    subtasks: [
      task('b', {
        parentId: 'a',
        subtasks: [task('c', { parentId: 'b', subtasks: [task('d', { parentId: 'c' })] })],
      }),
    ],
  });

it('shows every level, each indented further than the last', () => {
  renderTable([deepTask()]);
  const finishBox = (title: string) => screen.getByRole('checkbox', { name: `Finish ${title}` });
  const indent = (title: string) => (finishBox(title).parentElement as HTMLElement).style.paddingLeft;
  expect(finishBox('d')).toBeInTheDocument();
  expect([indent('b'), indent('c'), indent('d')]).toEqual(['0px', '20px', '40px']);
});

it('collapsing a middle level hides only what is under it', async () => {
  renderTable([deepTask()]);
  await userEvent.click(screen.getByRole('button', { name: 'Collapse c' }));
  expect(screen.getByRole('checkbox', { name: 'Finish c' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Finish d' })).not.toBeInTheDocument();
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
