import type { DragEndEvent } from '@dnd-kit/core';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { KanbanBoardComponent } from './KanbanBoardComponent';
import type { Task } from './task-types';

const { dnd, update, setFinished } = vi.hoisted(() => ({
  dnd: { onDragEnd: undefined as ((event: DragEndEvent) => void) | undefined },
  update: { mutate: vi.fn() },
  setFinished: { mutate: vi.fn() },
}));

vi.mock('@dnd-kit/core', async (importActual) => ({
  ...(await importActual<typeof import('@dnd-kit/core')>()),
  DndContext: ({ onDragEnd, children }: { onDragEnd: (event: DragEndEvent) => void; children: ReactNode }) => {
    dnd.onDragEnd = onDragEnd;
    return children;
  },
  DragOverlay: () => null,
}));
vi.mock('../hooks/useTaskMutations', () => ({ useTaskMutations: () => ({ update, setFinished }) }));
vi.mock('./TaskFormDialogComponent', () => ({ TaskFormDialogComponent: () => null }));

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
  dueDay: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
  ...fields,
});

const open = task('open');
const done = task('done', { finished: true, completedOn: '2026-11-09' });
const drop = (id: string, column: string | null) =>
  dnd.onDragEnd?.({ active: { id }, over: column ? { id: column } : null } as DragEndEvent);

beforeEach(() => {
  vi.clearAllMocks();
  render(<KanbanBoardComponent tasks={[open, done, task('held', { status: 'on_hold' })]} />);
});

it('puts each task in its status column, with Completed last', () => {
  const columns = screen.getAllByRole('region');
  expect(columns.map((column) => column.getAttribute('aria-label'))).toEqual([
    'To do',
    'In progress',
    'On hold',
    'Completed',
  ]);
  expect(within(columns[0]).getByRole('button', { name: 'open' })).toBeInTheDocument();
  expect(within(columns[2]).getByRole('button', { name: 'held' })).toBeInTheDocument();
  expect(within(columns[3]).getByRole('button', { name: 'done' })).toBeInTheDocument();
});

it('changes the status when moved between open columns', () => {
  drop('open', 'in_progress');
  expect(update.mutate).toHaveBeenCalledWith({ id: 'open', input: { status: 'in_progress' } });
});

it('finishes a task dropped on Completed', () => {
  drop('open', 'completed');
  expect(setFinished.mutate).toHaveBeenCalledWith({ id: 'open', finished: true });
});

it('reopens a completed task into the column it was dropped on', () => {
  drop('done', 'on_hold');
  expect(setFinished.mutate).toHaveBeenCalledWith({ id: 'done', finished: false, status: 'on_hold' });
  expect(update.mutate).not.toHaveBeenCalled();
});

it('does nothing when dropped on its own column or outside the board', () => {
  drop('open', 'todo');
  drop('open', null);
  expect(update.mutate).not.toHaveBeenCalled();
  expect(setFinished.mutate).not.toHaveBeenCalled();
});
